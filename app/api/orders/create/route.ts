import { NextResponse } from 'next/server';
import { getCartById, getProductById, saveOrder, updateCart } from '@/lib/dbStore';
import { ORDER_LIMIT_PAISE, CURRENCY } from '@/lib/constants';
import { getRazorpay } from '@/lib/razorpay';
import { writeAuditLog } from '@/lib/auditLog';
import { CartItem } from '@/lib/schemas';

/**
 * POST /api/orders/create
 * 
 * High-performance, Human-gated Order Creation with Stage Timing Instrumentation.
 */
export async function POST(request: Request) {
  const reqStart = performance.now();
  console.log(`\n⏱️ [TIMING START: /api/orders/create]`);

  try {
    const body = await request.json();
    const { cartId } = body;

    if (!cartId || typeof cartId !== 'string') {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    // 1. Fetch Cart (Instrumented)
    const tCart0 = performance.now();
    const cart = await getCartById(cartId);
    console.log(`⏱️ [STAGE 1: FETCH_CART] Completed in ${(performance.now() - tCart0).toFixed(1)}ms`);

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (cart.status !== 'proposed') {
      return NextResponse.json(
        { error: `Cart status is '${cart.status}', expected 'proposed'` },
        { status: 400 }
      );
    }

    // 2. Parallel Product Verification (Instrumented)
    const tVerify0 = performance.now();
    const items = cart.items as CartItem[];
    const productFetches = await Promise.all(items.map((i) => getProductById(i.productId)));

    let recalculatedTotalPaise = 0;
    for (let i = 0; i < items.length; i++) {
      const product = productFetches[i];
      const item = items[i];
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }
      recalculatedTotalPaise += product.price * item.quantity;
    }
    console.log(`⏱️ [STAGE 2: VERIFY_PRODUCTS] Parallel pricing check for ${items.length} items completed in ${(performance.now() - tVerify0).toFixed(1)}ms`);

    // 3. Enforce Limit Safety Gate (Server-side)
    if (recalculatedTotalPaise > ORDER_LIMIT_PAISE) {
      return NextResponse.json(
        { error: `Order total ₹${recalculatedTotalPaise / 100} exceeds the ₹${ORDER_LIMIT_PAISE / 100} limit` },
        { status: 400 }
      );
    }

    // 4. Razorpay Orders API Call (Instrumented)
    const tRzp0 = performance.now();
    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: recalculatedTotalPaise,
      currency: CURRENCY,
      receipt: cartId,
    });
    console.log(`⏱️ [STAGE 3: RAZORPAY_API] Razorpay Order ${razorpayOrder.id} created in ${(performance.now() - tRzp0).toFixed(1)}ms`);

    // 5. Parallel Database Writes (Instrumented)
    const tWrites0 = performance.now();
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = {
      id: orderId,
      cartId,
      razorpayOrderId: razorpayOrder.id,
      amount: recalculatedTotalPaise,
      currency: CURRENCY,
      status: 'created' as const,
      createdAt: new Date(),
      userId: null,
    };

    await Promise.all([
      saveOrder(order),
      updateCart(cartId, {
        status: 'approved',
        totalPaise: recalculatedTotalPaise,
        totalDisplay: recalculatedTotalPaise / 100,
      }),
      writeAuditLog({
        actor: 'human',
        action: 'approve_order',
        details: {
          cartId,
          orderId: order.id,
          razorpayOrderId: razorpayOrder.id,
          amount: recalculatedTotalPaise / 100,
        },
        status: 'approved',
        relatedCartId: cartId,
        relatedOrderId: order.id,
      }),
    ]);
    console.log(`⏱️ [STAGE 4: DB_PARALLEL_WRITES] Order, Cart & Audit saved in ${(performance.now() - tWrites0).toFixed(1)}ms`);

    const totalDuration = performance.now() - reqStart;
    console.log(`🚀 [TIMING END: /api/orders/create] Total request processed in ${totalDuration.toFixed(1)}ms\n`);

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: recalculatedTotalPaise,
      currency: CURRENCY,
    });
  } catch (error) {
    console.error('❌ [POST /api/orders/create] Order creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}
