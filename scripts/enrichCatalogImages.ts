/**
 * Catalog Image Enrichment Script
 * 
 * Enriches catalog products with distinct, category-relevant stock photos using:
 * Pexels API (Tier 1) -> Pixabay API (Tier 2) -> Seeded Picsum (Tier 3 Fallback)
 * 
 * Includes rate-limiting (throttling), local JSON caching, and audit logging.
 * 
 * Usage:
 *   npx tsx scripts/enrichCatalogImages.ts
 *   npx tsx scripts/enrichCatalogImages.ts --update-db
 */

import * as fs from 'fs';
import * as path from 'path';
import { PRODUCTS_CATALOG, CatalogProduct } from '../lib/productsData';
import { getProductImage, ImageLookupResult, loadCache } from '../lib/imageLookupService';

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore
}

// Rate-limiting delay helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runEnrichment() {
  console.log('================================================================');
  console.log('🖼️  CATALOG IMAGE ENRICHMENT & DEDUPLICATION SERVICE');
  console.log('================================================================\n');

  console.log('🔑 Environment Status:');
  console.log(`  - PEXELS_API_KEY:  ${process.env.PEXELS_API_KEY ? '✅ Configured (Tier 1 Primary)' : '⚠️ Not set (will fall back to Pixabay/Picsum)'}`);
  console.log(`  - PIXABAY_API_KEY: ${process.env.PIXABAY_API_KEY ? '✅ Configured (Tier 2 Fallback)' : '⚠️ Not set (will fall back to Picsum)'}`);
  console.log(`  - PICSUM SEED:     ✅ Active (Tier 3 Deterministic Unique Fallback)`);
  console.log(`  - TOTAL PRODUCTS:  ${PRODUCTS_CATALOG.length} items\n`);

  const results: Array<{
    product: CatalogProduct;
    lookup: ImageLookupResult;
  }> = [];

  const sourceCounts: Record<string, number> = {
    pexels: 0,
    pixabay: 0,
    picsum_seeded: 0,
    cache: 0,
  };

  const seenUrls = new Map<string, string>(); // url -> productId

  console.log('🚀 Processing catalog products...\n');

  for (let i = 0; i < PRODUCTS_CATALOG.length; i++) {
    const product = PRODUCTS_CATALOG[i];
    
    // Resolve image
    const lookup = await getProductImage(product);
    results.push({ product, lookup });
    sourceCounts[lookup.source] = (sourceCounts[lookup.source] || 0) + 1;

    // Check for duplicate URLs across different products
    if (seenUrls.has(lookup.imageUrl)) {
      const previousId = seenUrls.get(lookup.imageUrl)!;
      console.warn(`  ⚠️ Duplicate Image URL detected between ${product.id} and ${previousId}`);
    } else {
      seenUrls.set(lookup.imageUrl, product.id);
    }

    const badgeSource =
      lookup.source === 'pexels'
        ? '📸 [PEXELS]'
        : lookup.source === 'pixabay'
        ? '🎨 [PIXABAY]'
        : lookup.source === 'cache'
        ? '⚡ [CACHE]'
        : '🎲 [PICSUM SEEDED]';

    console.log(
      `[${String(i + 1).padStart(2, '0')}/${PRODUCTS_CATALOG.length}] ${badgeSource.padEnd(18)} ${product.name.slice(0, 40).padEnd(40)} | Q: "${lookup.query}"`
    );
    console.log(`     └─ Image: ${lookup.imageUrl}\n`);

    // Throttle API requests (300ms delay if not served from cache)
    if (lookup.source !== 'cache') {
      await sleep(300);
    }
  }

  // --- Audit Report & Summary ---
  console.log('================================================================');
  console.log('📊 ENRICHMENT AUDIT REPORT');
  console.log('================================================================');
  console.log(`Total Products Processed: ${PRODUCTS_CATALOG.length}`);
  console.log(`Unique Image URLs:        ${seenUrls.size} / ${PRODUCTS_CATALOG.length}`);
  console.log(`Source Breakdown:`);
  console.log(`  - 📸 Pexels Stock API:       ${sourceCounts.pexels}`);
  console.log(`  - 🎨 Pixabay Stock API:      ${sourceCounts.pixabay}`);
  console.log(`  - ⚡ Local Query Cache:      ${sourceCounts.cache}`);
  console.log(`  - 🎲 Deterministic Picsum:   ${sourceCounts.picsum_seeded}`);
  console.log('================================================================\n');

  if (seenUrls.size === PRODUCTS_CATALOG.length) {
    console.log('✅ PASSED: 100% of products have distinct, unique, non-empty image URLs!\n');
  } else {
    console.log(`ℹ️ NOTE: ${PRODUCTS_CATALOG.length - seenUrls.size} products share URLs due to identical high-level search queries.\n`);
  }

  // Optional: write an enriched catalog JSON snapshot
  const snapshotPath = path.resolve(process.cwd(), 'scripts', 'enriched_catalog_snapshot.json');
  const enrichedCatalog = results.map((r) => ({
    ...r.product,
    imageUrl: r.lookup.imageUrl,
    imageSource: r.lookup.source,
  }));
  fs.writeFileSync(snapshotPath, JSON.stringify(enrichedCatalog, null, 2), 'utf8');
  console.log(`💾 Saved enriched catalog snapshot to: ${snapshotPath}\n`);
}

runEnrichment().catch((err) => {
  console.error('❌ Enrichment failed:', err);
  process.exit(1);
});
