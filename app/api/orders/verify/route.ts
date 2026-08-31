import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderByRazorpayId, updateOrder, updateCart } from '@/lib/dbStore';
import { writeAuditLog } from '@/lib/auditLog';

/**
 * POST /api/orders/verify
 * 
 * Signature verification route (mirrors /api/payments/verify for consistency).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    console.log(`\n🔒 [POST /api/orders/verify] Verifying payment signature for Razorpay Order: ${razorpay_order_id}`);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.warn('⚠️ [POST /api/orders/verify] Missing required verification parameters');
      return NextResponse.json(
        { error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error('❌ [POST /api/orders/verify] RAZORPAY_KEY_SECRET is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Generate expected signature: HMAC_SHA256(order_id + "|" + payment_id, secret)
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // 2. Timing-safe comparison
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(razorpay_signature, 'utf8');

    let isValid = false;
    if (expectedBuffer.length === receivedBuffer.length) {
      isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    }

    const order = await getOrderByRazorpayId(razorpay_order_id);

    if (!order) {
      console.error(`❌ [POST /api/orders/verify] Order not found for Razorpay Order ID: ${razorpay_order_id}`);
      await writeAuditLog({
        actor: 'system',
        action: 'payment_verification',
        details: { razorpay_order_id, razorpay_payment_id, error: 'Order record not found' },
        status: 'failed',
      });
      return NextResponse.json({ error: 'Order not found in database' }, { status: 404 });
    }

    if (!isValid) {
      console.error(`🚨 [SECURITY ALERT] Invalid payment signature for Order: ${order.id}`);
      await writeAuditLog({
        actor: 'system',
        action: 'payment_verification',
        details: {
          razorpay_order_id,
          razorpay_payment_id,
          error: 'Signature mismatch — potential tampering attempt',
        },
        status: 'failed',
        relatedOrderId: order.id,
        relatedCartId: order.cartId,
      });

      await updateOrder(order.id, { status: 'failed' });

      return NextResponse.json(
        { error: 'Invalid payment signature. Payment cannot be verified.' },
        { status: 400 }
      );
    }

    console.log(`✅ [POST /api/orders/verify] Signature verified successfully! Order ID: ${order.id}`);

    if (order.status !== 'paid') {
      await updateOrder(order.id, {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
      });

      await updateCart(order.cartId, {
        status: 'checked_out',
      });

      await writeAuditLog({
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
      });

      console.log(`🎉 [POST /api/orders/verify] Order ${order.id} marked PAID and Cart ${order.cartId} marked CHECKED OUT.`);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: 'paid',
      message: 'Payment verified and order processed successfully',
    });
  } catch (error) {
    console.error('❌ [POST /api/orders/verify] Verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
