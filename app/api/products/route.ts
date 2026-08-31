import { NextResponse } from 'next/server';
import { getProductsList } from '@/lib/dbStore';

export async function GET() {
  try {
    const products = await getProductsList();
    console.log(`📦 [GET /api/products] Returned ${products.length} products to client.`);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('❌ [GET /api/products] Error fetching products:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
