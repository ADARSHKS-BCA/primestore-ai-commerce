import { NextResponse } from 'next/server';
import { getProductsList } from '@/lib/dbStore';
import { CURRENCY } from '@/lib/constants';

/**
 * GET /api/catalog
 * 
 * Agent-Readable Public Catalog API.
 * Provides a structured, machine-parseable catalog endpoint for external
 * autonomous AI buyers, agentic commerce integrations, and programmatic queries.
 * 
 * Query Parameters:
 * - category: string (e.g. "Footwear", "Audio", "Wearables", "Storage", "Gaming", "Peripherals")
 * - brand: string (e.g. "Nike", "Sony", "Apple", "Puma", "Dell")
 * - minPrice: number (in INR Rupees)
 * - maxPrice: number (in INR Rupees)
 * - search: string (keyword match against name, description, specs)
 * - priceBand: "budget" | "mid" | "premium"
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : null;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : null;
    const search = searchParams.get('search');
    const priceBand = searchParams.get('priceBand');

    let products = await getProductsList();

    // 1. Filter by category
    if (category && category !== 'All Categories' && category !== 'all') {
      products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    // 2. Filter by brand
    if (brand && brand !== 'All' && brand !== 'all') {
      products = products.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
    }

    // 3. Filter by price range
    if (minPrice !== null && !isNaN(minPrice)) {
      products = products.filter((p) => p.displayPrice >= minPrice);
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      products = products.filter((p) => p.displayPrice <= maxPrice);
    }

    // 4. Filter by priceBand
    if (priceBand && ['budget', 'mid', 'premium'].includes(priceBand.toLowerCase())) {
      products = products.filter((p) => p.priceBand === priceBand.toLowerCase());
    }

    // 5. Filter by search keyword
    if (search && search.trim()) {
      const q = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.specs.some((s) => s.toLowerCase().includes(q))
      );
    }

    // Format for AI Agents with clear schema
    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      pricing: {
        currency: CURRENCY,
        amountInPaise: p.price,
        displayPriceRupees: p.displayPrice,
        originalPriceRupees: p.originalPrice,
        discountPercentage: p.discountPercent,
        priceBand: p.priceBand,
      },
      inventory: {
        inStock: p.inStock,
        stockCount: p.stockCount,
      },
      reputation: {
        rating: p.rating,
        ratingOutOf: 5.0,
        reviewsCount: p.reviewsCount,
        reviewSummary: p.reviewSummary || `${p.name} has a ${p.rating}/5 rating from ${p.reviewsCount} customer reviews.`,
      },
      specifications: p.specs,
      description: p.description,
      images: {
        primary: p.imageUrl,
      },
      badge: p.badge || null,
      transactable: p.inStock,
    }));

    return NextResponse.json(
      {
        version: '1.0.0',
        merchant: 'PrimeStore AI Commerce',
        currency: CURRENCY,
        totalItems: formattedProducts.length,
        filtersApplied: {
          category: category || null,
          brand: brand || null,
          minPrice: minPrice || null,
          maxPrice: maxPrice || null,
          search: search || null,
          priceBand: priceBand || null,
        },
        schema: {
          documentation: 'https://primestore.com/docs/agent-api',
          transactableEndpoint: '/api/orders/create',
          currencyFormat: 'INR (Indian Rupees / Paise)',
        },
        products: formattedProducts,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'Content-Type': 'application/json',
          'X-Agent-Protocol': 'ACommerce-v1',
        },
      }
    );
  } catch (error) {
    console.error('❌ [GET /api/catalog] Catalog API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve catalog' },
      { status: 500 }
    );
  }
}
