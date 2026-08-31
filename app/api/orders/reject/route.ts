import { NextResponse } from 'next/server';
import { getCartById, updateCart } from '@/lib/dbStore';
import { writeAuditLog } from '@/lib/auditLog';

/**
 * POST /api/orders/reject
 * 
 * Rejects a proposed cart. Human-initiated action.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cartId } = body;

    console.log(`\n❌ [POST /api/orders/reject] User rejected Cart ID: ${cartId}`);

    if (!cartId || typeof cartId !== 'string') {
      console.warn('⚠️ [POST /api/orders/reject] cartId is required');
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    const cart = await getCartById(cartId);
    if (!cart) {
      console.error(`❌ [POST /api/orders/reject] Cart not found: ${cartId}`);
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (cart.status !== 'proposed') {
      console.warn(`⚠️ [POST /api/orders/reject] Cart status is '${cart.status}', expected 'proposed'`);
      return NextResponse.json(
        { error: `Cart status is '${cart.status}', expected 'proposed'` },
        { status: 400 }
      );
    }

    // Update cart status
    await updateCart(cartId, {
      status: 'rejected',
    });

    // Write audit log
    await writeAuditLog({
      actor: 'human',
      action: 'reject_cart',
      details: { cartId, totalDisplay: cart.totalDisplay },
      status: 'rejected',
      relatedCartId: cartId,
    });

    console.log(`✅ [POST /api/orders/reject] Cart ${cartId} marked as rejected.`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [POST /api/orders/reject] Cart rejection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject cart' },
      { status: 500 }
    );
  }
}
