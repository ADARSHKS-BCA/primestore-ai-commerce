/**
 * IntentParser — Fast client-side intent classification from voice text.
 *
 * Classifies user utterances into structured intents for the state machine.
 * Pure keyword/regex matching — runs in < 2ms with zero network calls.
 * Unrecognized inputs fall through to the LLM for disambiguation.
 */

import { PRODUCTS_CATALOG, CatalogProduct } from './productsData';

// ─── Intent Types ─────────────────────────────────────────────────

export type IntentType =
  | 'navigate_category'
  | 'set_brand'
  | 'set_price_range'
  | 'show_cheaper'
  | 'show_expensive'
  | 'select_product'
  | 'ask_review'
  | 'get_review'
  | 'order_it'
  | 'add_to_cart'
  | 'confirm_yes'
  | 'confirm_no'
  | 'go_back'
  | 'set_address'
  | 'help'
  | 'greeting'
  | 'unrecognized';

export interface ParsedIntent {
  type: IntentType;
  confidence: number; // 0-1
  slots: {
    category?: string;
    brand?: string;
    priceMin?: number;
    priceMax?: number;
    minPrice?: number;
    maxPrice?: number;
    priceBand?: 'all' | 'budget' | 'mid' | 'premium';
    productName?: string;
    productIndex?: number;
    itemIndex?: number;
    productId?: string;
    addressText?: string;
    rawText: string;
  };
}

// ─── Category Mapping ─────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Audio: ['audio', 'earbud', 'earbuds', 'headphone', 'headphones', 'earphone', 'earphones', 'speaker', 'speakers', 'music', 'airpods', 'airpod'],
  Footwear: ['shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'running shoe', 'running shoes', 'boot', 'boots', 'slides', 'sandals'],
  Wearables: ['watch', 'watches', 'smartwatch', 'smartwatches', 'wearable', 'wearables', 'fitness band', 'tracker'],
  Peripherals: ['keyboard', 'keyboards', 'mouse', 'mice', 'peripheral', 'peripherals', 'typing'],
  Storage: ['ssd', 'drive', 'drives', 'storage', 'pendrive', 'pen drive', 'flash drive', 'hard disk', 'hard drive'],
  Gaming: ['game', 'games', 'gaming', 'controller', 'controllers', 'gamepad', 'gamepads', 'console'],
};

// ─── Brand Mapping ────────────────────────────────────────────────

const BRAND_KEYWORDS: Record<string, string> = {
  nike: 'Nike',
  adidas: 'Adidas',
  puma: 'Puma',
  asics: 'Asics',
  sparx: 'Sparx',
  boat: 'boAt',
  'bo at': 'boAt',
  sony: 'Sony',
  bose: 'Bose',
  jbl: 'JBL',
  aura: 'Aura',
  dell: 'Dell',
  logitech: 'Logitech',
  cybermech: 'CyberMech',
  keychron: 'Keychron',
  noise: 'Noise',
  pulsetrack: 'PulseTrack',
  oneplus: 'OnePlus',
  'one plus': 'OnePlus',
  samsung: 'Samsung',
  apple: 'Apple',
  sandisk: 'SanDisk',
  crucial: 'Crucial',
  turbodrive: 'TurboDrive',
  'cosmic byte': 'Cosmic Byte',
  cosmicbyte: 'Cosmic Byte',
  viperstrike: 'ViperStrike',
  hyperx: 'HyperX',
  razer: 'Razer',
  rolex: 'Rolex',
  chanel: 'Chanel',
  dior: 'Dior',
  'calvin klein': 'Calvin Klein',
  ck: 'Calvin Klein',
  essence: 'Essence',
  'western digital': 'Western Digital',
  wd: 'Western Digital',
  acer: 'Acer',
  fjallraven: 'Fjallraven',
  'silicon power': 'Silicon Power',
  knoll: 'Knoll',
  jordan: 'Nike',
  'air jordan': 'Nike',
};

// ─── Parser ───────────────────────────────────────────────────────

export function parseIntent(utterance: string): ParsedIntent {
  const raw = utterance.trim();
  const q = raw.toLowerCase();

  const base: ParsedIntent = {
    type: 'unrecognized',
    confidence: 0,
    slots: { rawText: raw },
  };

  if (!raw) return base;

  // ── 1. Greeting ─────────────────────────────────────────────
  if (/^(hi|hello|hey|good morning|good evening|good afternoon|namaste)\b/i.test(q)) {
    return { ...base, type: 'greeting', confidence: 0.9 };
  }

  // ── 2. Help ─────────────────────────────────────────────────
  if (/^(help|what can you do|how does this work|options)\b/i.test(q)) {
    return { ...base, type: 'help', confidence: 0.9 };
  }

  // ── 3. Confirm Yes ──────────────────────────────────────────
  if (/^(yes|yeah|yep|yup|sure|okay|ok|confirm|correct|that's right|go ahead|proceed|do it|place it|place the order)\b/i.test(q)) {
    return { ...base, type: 'confirm_yes', confidence: 0.95 };
  }

  // ── 4. Confirm No / Go Back ─────────────────────────────────
  if (/^(no|nah|nope|cancel|never mind|go back|back|change|wait|stop|wrong)\b/i.test(q)) {
    const afterNo = q.replace(/^(no|nah|nope|not that|wrong|change|go back|back)[,.]?\s*/i, '').trim();
    if (afterNo.length > 2) {
      const correctionIntent = parseIntent(afterNo);
      if (correctionIntent.type !== 'unrecognized') {
        return { ...correctionIntent, confidence: correctionIntent.confidence * 0.9 };
      }
    }
    if (/^(go back|back|change)\b/i.test(q)) {
      return { ...base, type: 'go_back', confidence: 0.9 };
    }
    return { ...base, type: 'confirm_no', confidence: 0.9 };
  }

  // ── 5. Review / Rating Query ────────────────────────────────
  if (/\b(review|reviews|rating|ratings|how good|is it good|worth it|recommend|feedback|what do people think|what's the review)\b/i.test(q)) {
    const product = matchProductFromText(q);
    return {
      ...base,
      type: 'ask_review',
      confidence: 0.9,
      slots: {
        rawText: raw,
        productName: product?.name,
        productId: product?.id,
      },
    };
  }

  // ── 6. Explicit Single-Phrase Order ─────────────────────────
  if (/^(?:order it|order this|order that|buy it|buy this|buy that|add to cart|add it|purchase|checkout|place order)$/i.test(q.trim())) {
    const product = matchProductFromText(q);
    return {
      ...base,
      type: 'order_it',
      confidence: 0.95,
      slots: {
        rawText: raw,
        productName: product?.name,
        productId: product?.id,
      },
    };
  }

  // ── 7. Check if a SPECIFIC Product is Mentioned (High Priority) ───
  const matchedProduct = matchProductFromText(q);
  const isOrderVerb = /\b(order|buy|purchase|checkout|add to cart|add it|get me|i want to buy|i want to order|i'll take|take the)\b/i.test(q);

  if (matchedProduct) {
    if (isOrderVerb) {
      return {
        ...base,
        type: 'order_it',
        confidence: 0.95,
        slots: {
          rawText: raw,
          productName: matchedProduct.name,
          productId: matchedProduct.id,
        },
      };
    } else {
      return {
        ...base,
        type: 'select_product',
        confidence: 0.9,
        slots: {
          rawText: raw,
          productName: matchedProduct.name,
          productId: matchedProduct.id,
        },
      };
    }
  }

  // ── 8. Ordinal Selection (e.g. "first one", "number 2", "the 3rd option") ───
  const numMatch = q.match(/^(?:the\s+)?(?:number\s+|option\s+|#)?(\d+)(?:st|nd|rd|th)?(?:\s+one)?$/i) ||
    q.match(/(?:show me|select|pick|choose)\s+(?:the\s+)?(?:number\s+|option\s+|#)?(\d+)/i) ||
    q.match(/(?:the\s+)?(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(?:one|option|product)?/i);
  if (numMatch) {
    const ordinalMap: Record<string, number> = {
      first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3,
      fourth: 4, '4th': 4, fifth: 5, '5th': 5,
    };
    let idx: number;
    if (numMatch[1]) {
      idx = parseInt(numMatch[1], 10);
    } else {
      const word = q.match(/(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)/i)?.[1]?.toLowerCase() || '';
      idx = ordinalMap[word] || 1;
    }
    return {
      ...base,
      type: 'select_product',
      confidence: 0.85,
      slots: { rawText: raw, productIndex: idx - 1 },
    };
  }

  // ── 9. Price Filters ─────────────────────────────────────────
  if (/\b(cheaper|less expensive|lower price|budget|affordable|under|below)\b/i.test(q)) {
    const priceMatch = q.match(/(?:under|below|less than|within)\s*(?:₹|rupees?|rs\.?|inr)?\s*(\d[\d,]*)/i);
    if (priceMatch) {
      const max = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      return {
        ...base,
        type: 'set_price_range',
        confidence: 0.9,
        slots: { rawText: raw, priceMax: max },
      };
    }
    return { ...base, type: 'show_cheaper', confidence: 0.85 };
  }

  if (/\b(expensive|premium|high end|flagship|luxury|above|over)\b/i.test(q)) {
    const priceMatch = q.match(/(?:above|over|more than|starting)\s*(?:₹|rupees?|rs\.?|inr)?\s*(\d[\d,]*)/i);
    if (priceMatch) {
      const min = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      return {
        ...base,
        type: 'set_price_range',
        confidence: 0.9,
        slots: { rawText: raw, priceMin: min },
      };
    }
    return { ...base, type: 'show_expensive', confidence: 0.85 };
  }

  const rangeMatch = q.match(/(?:₹|rupees?|rs\.?|inr)?\s*(\d[\d,]*)\s*(?:to|-|–)\s*(?:₹|rupees?|rs\.?|inr)?\s*(\d[\d,]*)/i);
  if (rangeMatch) {
    return {
      ...base,
      type: 'set_price_range',
      confidence: 0.9,
      slots: {
        rawText: raw,
        priceMin: parseInt(rangeMatch[1].replace(/,/g, ''), 10),
        priceMax: parseInt(rangeMatch[2].replace(/,/g, ''), 10),
      },
    };
  }

  const underMatch = q.match(/(?:under|below|less than|within|upto|up to|max)\s*(?:₹|rupees?|rs\.?|inr)?\s*(\d[\d,]*)/i);
  if (underMatch) {
    return {
      ...base,
      type: 'set_price_range',
      confidence: 0.85,
      slots: {
        rawText: raw,
        priceMax: parseInt(underMatch[1].replace(/,/g, ''), 10),
      },
    };
  }

  // ── 10. Set Address ──────────────────────────────────────────
  if (/\b(deliver to|ship to|send to|address is|my address|office|home)\b/i.test(q)) {
    const addrMatch = q.match(/(?:deliver to|ship to|send to|address is)\s+(.+)/i);
    return {
      ...base,
      type: 'set_address',
      confidence: 0.8,
      slots: {
        rawText: raw,
        addressText: addrMatch ? addrMatch[1].trim() : raw,
      },
    };
  }

  // ── 11. Brand Filter ─────────────────────────────────────────
  for (const [keyword, brand] of Object.entries(BRAND_KEYWORDS)) {
    if (q.includes(keyword)) {
      let category: string | undefined;
      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((k) => q.includes(k))) {
          category = cat;
          break;
        }
      }
      return {
        ...base,
        type: category ? 'navigate_category' : 'set_brand',
        confidence: 0.85,
        slots: { rawText: raw, brand, category },
      };
    }
  }

  // ── 12. Category Navigation ──────────────────────────────────
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => q.includes(k))) {
      return {
        ...base,
        type: 'navigate_category',
        confidence: 0.85,
        slots: { rawText: raw, category },
      };
    }
  }

  // ── 13. Fallback / Unrecognized — forward to LLM ─────────────
  return base;
}

// ─── Helpers ──────────────────────────────────────────────────────

export function matchProductFromText(text: string, currentFilteredProducts?: CatalogProduct[]): CatalogProduct | null {
  const q = text.toLowerCase().trim();
  if (!q) return null;

  // 1. Exact ID match
  const byId = PRODUCTS_CATALOG.find((p) => p.id.toLowerCase() === q || q.includes(p.id.toLowerCase()));
  if (byId) return byId;

  // 2. Exact full Name match
  const byExactName = PRODUCTS_CATALOG.find((p) => p.name.toLowerCase() === q);
  if (byExactName) return byExactName;

  // 3. Tokenize query and remove generic stop words
  const stopWords = new Set([
    'i', 'want', 'to', 'buy', 'order', 'get', 'the', 'a', 'an', 'please',
    'for', 'me', 'this', 'that', 'item', 'product', 'from', 'with', 'and',
    'show', 'give', 'tell', 'about', 'is', 'it', 'can', 'you', 'my', 'find',
    'looking', 'need', 'would', 'like', 'some', 'any', 'pair', 'unit', 'units',
    'good', 'best', 'view', 'check', 'have', 'there', 'what', 'which', 'one'
  ]);

  const queryTokens = q
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  if (queryTokens.length === 0) return null;

  // Check if query is ONLY broad category or brand keywords (e.g. "shoes", "nike", "audio", "smartwatches")
  const isOnlyCategoryOrBrand = queryTokens.every((token) => {
    const isBrand = Object.keys(BRAND_KEYWORDS).includes(token);
    const isCat = Object.values(CATEGORY_KEYWORDS).some((kws) => kws.includes(token));
    return isBrand || isCat;
  });

  // If query is ONLY "shoes", "nike", "headphones", "audio", "shoes nike", it's a category/brand search, not a specific product match
  if (isOnlyCategoryOrBrand && queryTokens.length <= 2) {
    return null;
  }

  let bestScore = 0;
  let bestProduct: CatalogProduct | null = null;

  for (const product of PRODUCTS_CATALOG) {
    let score = 0;
    const nameLower = product.name.toLowerCase();
    const brandLower = product.brand.toLowerCase();
    const categoryLower = product.category.toLowerCase();
    const descLower = product.description.toLowerCase();
    const specsLower = product.specs.join(' ').toLowerCase();

    let matchedTokenCount = 0;
    let hasDistinctiveMatch = false;

    for (const token of queryTokens) {
      if (nameLower.includes(token)) {
        score += 35;
        matchedTokenCount++;
        // If token is in product name and NOT just brand/category, it's distinctive (e.g. "air", "max", "pegasus", "bassheads", "smashic")
        if (!brandLower.includes(token) && !categoryLower.includes(token)) {
          hasDistinctiveMatch = true;
          score += 20;
        }
      } else if (brandLower === token || brandLower.includes(token)) {
        score += 20;
        matchedTokenCount++;
      } else if (specsLower.includes(token)) {
        score += 15;
        matchedTokenCount++;
      } else if (descLower.includes(token)) {
        score += 10;
      }
    }

    // Boost if multiple tokens matched
    if (matchedTokenCount >= 2) {
      score += matchedTokenCount * 25;
    }

    // Boost if product is in currently filtered list on screen
    if (currentFilteredProducts && currentFilteredProducts.some((p) => p.id === product.id)) {
      score += 15;
    }

    // Boost if distinctive model token matched
    if (hasDistinctiveMatch) {
      score += 25;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  // Minimum score threshold of 35 to ensure high precision
  if (bestScore >= 35 && bestProduct) {
    return bestProduct;
  }

  return null;
}
