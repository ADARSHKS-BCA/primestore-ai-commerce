import { NextResponse } from 'next/server';
import { getCustomerOrders } from '@/lib/supabaseStore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const orders = await getCustomerOrders(userId);

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (err: unknown) {
    console.error('❌ [GET /api/orders/user] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch user orders' },
      { status: 500 }
    );
  }
}
