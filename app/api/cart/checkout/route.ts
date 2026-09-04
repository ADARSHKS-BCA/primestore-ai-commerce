import { NextResponse } from 'next/server';
import { getProductById, saveCart, saveOrder } from '@/lib/dbStore';
import { ORDER_LIMIT_PAISE, CURRENCY } from '@/lib/constants';
import { getRazorpay } from '@/lib/razorpay';
import { writeAuditLog } from '@/lib/auditLog';
import { Cart, CartItem } from '@/lib/schemas';

/**
 * POST /api/cart/checkout
 * 
 * Direct Multi-Product Cart Checkout with Razorpay Test Mode integration.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items: inputItems, userId } = body as {
      items: Array<{ productId: string; quantity: number }>;
      userId?: string;
    };

    if (!inputItems || !Array.isArray(inputItems) || inputItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty. Please add items.' }, { status: 400 });
    }

    // Verify each product and build structured CartItems
    const cartItems: CartItem[] = [];
    let totalPaise = 0;

    for (const item of inputItems) {
      const product = await getProductById(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 404 });
      }

      const qty = Math.max(1, Math.min(item.quantity || 1, 10));
      const subtotal = product.price * qty;
      totalPaise += subtotal;

      cartItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
      });
    }

    // Enforce Human-gated Safety Limit
    if (totalPaise > ORDER_LIMIT_PAISE) {
      return NextResponse.json(
        { error: `Order total ₹${totalPaise / 100} exceeds the ₹${ORDER_LIMIT_PAISE / 100} limit` },
        { status: 400 }
      );
    }

    // 1. Create Cart Proposal Record
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const cart: Cart = {
      id: cartId,
      items: cartItems,
      totalPaise,
      totalDisplay: totalPaise / 100,
      currency: CURRENCY,
      status: 'approved',
      proposedAt: now,
      approvedAt: now,
      userId: userId || undefined,
    };

    await saveCart(cart);

    // 2. Create Razorpay Order
    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: totalPaise,
      currency: CURRENCY,
      receipt: cartId,
    });

    // 3. Create Order Record
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = {
      id: orderId,
      cartId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalPaise,
      currency: CURRENCY,
      status: 'created' as const,
      createdAt: now,
      userId: userId || undefined,
    };

    await Promise.all([
      saveOrder(order),
      writeAuditLog({
        actor: 'human',
        action: 'approve_order',
        details: {
          cartId,
          orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: totalPaise / 100,
          itemCount: cartItems.length,
        },
        status: 'approved',
        userId: userId || undefined,
        relatedCartId: cartId,
        relatedOrderId: orderId,
      }),
    ]);

    return NextResponse.json({
      success: true,
      cartId,
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalPaise,
      currency: CURRENCY,
    });
  } catch (error) {
    console.error('Cart checkout API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize cart payment' },
      { status: 500 }
    );
  }
}
