import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderByRazorpayId, updateOrder, updateCart } from '@/lib/dbStore';
import { writeAuditLog } from '@/lib/auditLog';

/**
 * POST /api/webhooks/razorpay
 * 
 * Razorpay Webhook Handler — Secondary Source of Truth.
 * 
 * Flow:
 *   1. Read raw body buffer/text from incoming webhook request.
 *   2. Recompute HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET).
 *   3. Validate x-razorpay-signature header with timing-safe comparison.
 *   4. Idempotently process 'payment.captured', 'order.paid', 'payment.failed' events.
 *   5. Prevent double-processing if client handler already verified the payment.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    console.log('\n🔔 [WEBHOOK] Incoming Razorpay Webhook notification received');

    if (!signature) {
      console.error('❌ [WEBHOOK] Missing x-razorpay-signature header');
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!webhookSecret) {
      console.error('❌ [WEBHOOK] Neither RAZORPAY_WEBHOOK_SECRET nor RAZORPAY_KEY_SECRET configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // 1. Verify Webhook Signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    let isValid = false;
    if (expectedBuffer.length === receivedBuffer.length) {
      isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    }

    if (!isValid) {
      console.error('🚨 [WEBHOOK SECURITY ALERT] Invalid webhook signature mismatch!');
      await writeAuditLog({
        actor: 'system',
        action: 'webhook_verification',
        details: { error: 'Invalid webhook signature' },
        status: 'failed',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 2. Parse Event Payload
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`📌 [WEBHOOK] Event type: "${event}"`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;
      const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const razorpayPaymentId = paymentEntity?.id;

      if (!razorpayOrderId) {
        console.warn('⚠️ [WEBHOOK] Webhook event missing order_id');
        return NextResponse.json({ status: 'ignored', reason: 'no order_id' });
      }

      console.log(`🔍 [WEBHOOK] Processing captured payment for Razorpay Order: ${razorpayOrderId}`);
      const order = await getOrderByRazorpayId(razorpayOrderId);

      if (!order) {
        console.warn(`⚠️ [WEBHOOK] Order ${razorpayOrderId} not found in database`);
        return NextResponse.json({ status: 'order_not_found' });
      }

      // Idempotency check: Don't double-process if already marked as 'paid'
      if (order.status === 'paid') {
        console.log(`ℹ️ [WEBHOOK] Order ${order.id} is already marked as 'paid'. Skipping duplicate write.`);
        return NextResponse.json({ status: 'already_processed' });
      }

      // Update Order & Cart
      await updateOrder(order.id, {
        status: 'paid',
        razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
      });

      await updateCart(order.cartId, {
        status: 'checked_out',
      });

      await writeAuditLog({
        actor: 'system',
        action: 'webhook_payment_captured',
        details: {
          orderId: order.id,
          cartId: order.cartId,
          razorpayOrderId,
          razorpayPaymentId,
          amountDisplay: order.amount / 100,
          event,
        },
        status: 'executed',
        relatedOrderId: order.id,
        relatedCartId: order.cartId,
      });

      console.log(`🎉 [WEBHOOK SUCCESS] Order ${order.id} updated to PAID via Webhook event.\n`);
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;

      if (razorpayOrderId) {
        const order = await getOrderByRazorpayId(razorpayOrderId);
        if (order && order.status !== 'paid') {
          await updateOrder(order.id, { status: 'failed' });
          await writeAuditLog({
            actor: 'system',
            action: 'webhook_payment_failed',
            details: {
              orderId: order.id,
              razorpayOrderId,
              errorDescription: paymentEntity?.error_description,
            },
            status: 'failed',
            relatedOrderId: order.id,
            relatedCartId: order.cartId,
          });
          console.log(`❌ [WEBHOOK] Order ${order.id} marked as FAILED via Webhook.`);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook error' },
      { status: 500 }
    );
  }
}
