import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderByRazorpayId, updateOrder, updateCart, getCartById } from '@/lib/dbStore';
import { writeAuditLog } from '@/lib/auditLog';
import { saveCustomerOrderToSupabase } from '@/lib/supabaseStore';

/**
 * POST /api/payments/verify
 * 
 * High-performance, Security-Critical Payment Signature Verification Endpoint.
 * - Recomputes HMAC-SHA256 signature with RAZORPAY_KEY_SECRET
 * - Writes completed order to Supabase Customer History
 * - Writes immutable audit log to Firebase Firestore
 */
export async function POST(request: Request) {
  const reqStart = performance.now();
  console.log(`\n⏱️ [TIMING START: /api/payments/verify]`);

  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // 1. Validate payload
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 2. Timing-safe cryptographic signature check
    const tCrypto0 = performance.now();
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(razorpay_signature, 'utf8');

    let isValid = false;
    if (expectedBuffer.length === receivedBuffer.length) {
      isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    }
    console.log(`⏱️ [STAGE 1: CRYPTO_HMAC_VERIFY] Evaluated in ${(performance.now() - tCrypto0).toFixed(2)}ms`);

    // 3. Lookup Order
    const tOrder0 = performance.now();
    const order = await getOrderByRazorpayId(razorpay_order_id);
    console.log(`⏱️ [STAGE 2: DB_LOOKUP_ORDER] Fetched order in ${(performance.now() - tOrder0).toFixed(1)}ms`);

    if (!order) {
      return NextResponse.json({ error: 'Order not found in database' }, { status: 404 });
    }

    if (!isValid) {
      console.error(`🚨 [SECURITY ALERT] Signature mismatch for Order: ${order.id}`);
      await Promise.all([
        updateOrder(order.id, { status: 'failed' }),
        writeAuditLog({
          actor: 'system',
          action: 'payment_verification',
          details: { razorpay_order_id, razorpay_payment_id, error: 'Signature mismatch' },
          status: 'failed',
          relatedOrderId: order.id,
          relatedCartId: order.cartId,
        }),
      ]);
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // 4. Parallel Status & Multi-DB Writes (Idempotent)
    const tUpdate0 = performance.now();
    if (order.status !== 'paid') {
      const cart = await getCartById(order.cartId);

      await Promise.all([
        // Update Firestore & memory stores
        updateOrder(order.id, {
          status: 'paid',
          razorpayPaymentId: razorpay_payment_id,
        }),
        updateCart(order.cartId, {
          status: 'checked_out',
        }),
        // Write Security Audit Log (Firestore)
        writeAuditLog({
          actor: 'system',
          action: 'payment_verified',
          details: {
            orderId: order.id,
            cartId: order.cartId,
            razorpay_order_id,
            razorpay_payment_id,
            amountDisplay: order.amount / 100,
          },
          status: 'executed',
          relatedOrderId: order.id,
          relatedCartId: order.cartId,
        }),
        // Write Customer Order to Supabase
        saveCustomerOrderToSupabase({
          id: order.id,
          userId: order.userId || null,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          amount: order.amount,
          totalDisplay: order.amount / 100,
          currency: order.currency || 'INR',
          status: 'paid',
          items: cart?.items || [],
          createdAt: new Date().toISOString(),
        }),
      ]);
      console.log(`⏱️ [STAGE 3: DB_PARALLEL_UPDATES] Order marked PAID in Firestore + Supabase in ${(performance.now() - tUpdate0).toFixed(1)}ms`);
    }

    const totalDuration = performance.now() - reqStart;
    console.log(`🚀 [TIMING END: /api/payments/verify] Verification completed in ${totalDuration.toFixed(1)}ms\n`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: 'paid',
      message: 'Payment verified and order processed successfully',
    });
  } catch (error) {
    console.error('❌ [POST /api/payments/verify] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
