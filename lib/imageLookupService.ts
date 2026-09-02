/**
 * Image Lookup Service — Enriches catalog products with category-relevant, distinct photos
 * using a multi-tier fallback chain:
 * 
 * Tier 1: Pexels Stock Photo API (via PEXELS_API_KEY)
 * Tier 2: Pixabay Stock Photo API (via PIXABAY_API_KEY)
 * Tier 3: Deterministic Seeded Picsum Placeholder (unique & reproducible per product ID)
 * 
 * Also provides query cleaning (stripping SKU/filler terms) and caching support.
 */

import * as fs from 'fs';
import * as path from 'path';

export type ImageSource = 'pexels' | 'pixabay' | 'picsum_seeded' | 'cache';

export interface ImageLookupResult {
  imageUrl: string;
  source: ImageSource;
  query: string;
  productId: string;
}

export interface CachedImageEntry {
  imageUrl: string;
  source: ImageSource;
  query: string;
  timestamp: string;
}

// Local cache path
const CACHE_FILE_PATH = path.resolve(process.cwd(), 'scripts', 'image_cache.json');

// In-memory cache loaded from disk
let memoryCache: Record<string, CachedImageEntry> | null = null;

/**
 * Load image cache from disk or initialize empty cache.
 */
export function loadCache(): Record<string, CachedImageEntry> {
  if (memoryCache) return memoryCache;

  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const content = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      memoryCache = JSON.parse(content);
      return memoryCache || {};
    }
  } catch (err) {
    console.warn('⚠️ [ImageLookupService] Could not read cache file, initializing empty:', err);
  }

  memoryCache = {};
  return memoryCache;
}

/**
 * Persist in-memory cache to disk.
 */
export function saveCache(): void {
  try {
    if (!memoryCache) return;
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(memoryCache, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ [ImageLookupService] Could not write cache file:', err);
  }
}

/**
 * Clean product name / title into a concise, high-relevance search query.
 * Strips filler words, promotional tags, technical dimensions, pack counts, and noise.
 */
export function buildCleanSearchQuery(product: {
  name: string;
  brand?: string;
  category?: string;
}): string {
  let q = product.name;

  // 1. Remove bracketed / parenthesized content (e.g. "(Fits 15\" Laptop)", "(100ml)", "(Pack of 3)")
  q = q.replace(/\([^)]*\)/g, ' ');
  q = q.replace(/\[[^\]]*\]/g, ' ');

  // 2. Remove common filler words, marketing badges, technical dimensions
  const fillers = [
    /\b(pack of \d+|pack|\d+-pack)\b/gi,
    /\b(with mic|with pouch|with case|with mirror|with s pen)\b/gi,
    /\b(men's|mens|women's|womens|unisex|for her|for him)\b/gi,
    /\b(casual|premium|solid|petite|classic|pro|plus|ultra|max|edition|gold|silver|black|white)\b/gi,
    /\b(fits \d+["']|1080p|144hz|75hz|4k|usb \d+\.\d+|sata iii|m3 chip|5g ai|nvme|ssd|hdd|3d nand)\b/gi,
    /\b(formula|spray|retro high og|velocity nitro|oystersteel automatic luxury)\b/gi,
    /\b(new|best|top|high|low|sale|deal|genuine|authentic)\b/gi,
    /[0-9]+(gb|tb|ml|w|mm|cm|kg|g|hz|mprt|rpm|mah)\b/gi,
    /[0-9]+(\.[0-9]+)?["']/g,
  ];

  for (const regex of fillers) {
    q = q.replace(regex, ' ');
  }

  // 3. Remove punctuation and extra whitespace
  q = q.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // If query is too short or emptied, fall back to brand + category or category
  const words = q.split(' ').filter(Boolean);
  if (words.length < 2) {
    if (product.brand && product.category) {
      q = `${product.brand} ${product.category}`;
    } else if (product.category) {
      q = product.category;
    } else {
      q = product.name.slice(0, 30);
    }
  } else {
    // Keep first 3-4 salient keywords for stock photo search accuracy
    q = words.slice(0, 4).join(' ');
  }

  return q;
}

/**
 * Multi-tier Image Lookup Service:
 * Pexels (Tier 1) -> Pixabay (Tier 2) -> Deterministic Seeded Picsum (Tier 3 Fallback)
 */
export async function getProductImage(
  product: { id: string; name: string; brand?: string; category?: string },
  options: { bypassCache?: boolean; customQuery?: string } = {}
): Promise<ImageLookupResult> {
  const query = options.customQuery || buildCleanSearchQuery(product);
  const cacheKey = `${product.id}:::${query.toLowerCase()}`;

  const cache = loadCache();

  // 1. Check local cache
  if (!options.bypassCache && cache[cacheKey]) {
    const cached = cache[cacheKey];
    return {
      imageUrl: cached.imageUrl,
      source: 'cache',
      query,
      productId: product.id,
    };
  }

  let resolvedUrl: string | null = null;
  let resolvedSource: ImageSource = 'picsum_seeded';

  // 2. Tier 1: Pexels API
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      const res = await fetch(pexelsUrl, {
        headers: {
          Authorization: pexelsKey,
          'User-Agent': 'PrimeStoreCatalogEnricher/1.0',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
          resolvedUrl = data.photos[0].src.large || data.photos[0].src.medium || data.photos[0].src.original;
          resolvedSource = 'pexels';
        }
      } else {
        console.warn(`⚠️ [ImageLookupService] Pexels API returned status ${res.status} for "${query}"`);
      }
    } catch (err) {
      console.warn(`⚠️ [ImageLookupService] Pexels request failed for "${query}":`, err);
    }
  }

  // 3. Tier 2: Pixabay API Fallback (if Pexels failed or key missing)
  if (!resolvedUrl) {
    const pixabayKey = process.env.PIXABAY_API_KEY;
    if (pixabayKey) {
      try {
        const pixabayUrl = `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&safesearch=true`;
        const res = await fetch(pixabayUrl);

        if (res.ok) {
          const data = await res.json();
          if (data.hits && data.hits.length > 0) {
            resolvedUrl = data.hits[0].webformatURL || data.hits[0].largeImageURL;
            resolvedSource = 'pixabay';
          }
        } else {
          console.warn(`⚠️ [ImageLookupService] Pixabay API returned status ${res.status} for "${query}"`);
        }
      } catch (err) {
        console.warn(`⚠️ [ImageLookupService] Pixabay request failed for "${query}":`, err);
      }
    }
  }

  // 4. Tier 3: Deterministic Seeded Picsum Placeholder Fallback
  // Unique per product ID and 100% reproducible across re-runs
  if (!resolvedUrl) {
    const cleanId = encodeURIComponent(product.id.replace(/[^a-zA-Z0-9_-]/g, ''));
    resolvedUrl = `https://picsum.photos/seed/${cleanId}/600/400`;
    resolvedSource = 'picsum_seeded';
  }

  // Validation: Ensure URL is non-empty
  if (!resolvedUrl || resolvedUrl.trim() === '') {
    throw new Error(`❌ [ImageLookupService] Critical: Failed to resolve valid image URL for product ${product.id}`);
  }

  // Save to cache
  cache[cacheKey] = {
    imageUrl: resolvedUrl,
    source: resolvedSource,
    query,
    timestamp: new Date().toISOString(),
  };
  saveCache();

  return {
    imageUrl: resolvedUrl,
    source: resolvedSource,
    query,
    productId: product.id,
  };
}
