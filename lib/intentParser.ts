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
  Audio: ['audio', 'earbud', 'earbuds', 'headphone', 'headphones', 'earphone', 'earphones', 'speaker', 'speakers', 'music'],
  Footwear: ['shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'running shoe', 'running shoes', 'boot', 'boots'],
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

  // ── Greeting ────────────────────────────────────────────────
  if (/^(hi|hello|hey|good morning|good evening|good afternoon|namaste)\b/i.test(q)) {
    return { ...base, type: 'greeting', confidence: 0.9 };
  }

  // ── Help ────────────────────────────────────────────────────
  if (/^(help|what can you do|how does this work|options)\b/i.test(q)) {
    return { ...base, type: 'help', confidence: 0.9 };
  }

  // ── Confirm Yes ─────────────────────────────────────────────
  if (/^(yes|yeah|yep|yup|sure|okay|ok|confirm|correct|that's right|go ahead|proceed|do it|place it|place the order)\b/i.test(q)) {
    return { ...base, type: 'confirm_yes', confidence: 0.95 };
  }

  // ── Confirm No / Go Back ────────────────────────────────────
  if (/^(no|nah|nope|cancel|never mind|go back|back|change|wait|stop|wrong)\b/i.test(q)) {
    // Distinguish "no, show me Nike" (correction with new intent) from plain "no"
    // Check if there's a brand or category correction embedded
    const afterNo = q.replace(/^(no|nah|nope|not that|wrong|change|go back|back)[,.]?\s*/i, '').trim();
    if (afterNo.length > 2) {
      // Re-parse the correction
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

  // ── Order / Buy ─────────────────────────────────────────────
  if (/\b(order it|order this|order that|buy it|buy this|buy that|add to cart|add it|purchase|checkout|place order)\b/i.test(q)) {
    // Try to extract product reference
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

  // Explicit "order [product name]" pattern
  const orderMatch = q.match(/^(?:order|buy|get|i want|i'll take|give me)\s+(?:the\s+|a\s+|an\s+)?(.+)/i);
  if (orderMatch) {
    const productText = orderMatch[1].trim();
    const product = matchProductFromText(productText);
    if (product) {
      return {
        ...base,
        type: 'order_it',
        confidence: 0.9,
        slots: {
          rawText: raw,
          productName: product.name,
          productId: product.id,
        },
      };
    }
  }

  // ── Ask Review ──────────────────────────────────────────────
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

  // ── Show Cheaper / More Expensive ───────────────────────────
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

  // ── Price Range (explicit) ──────────────────────────────────
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

  // ── Set Address ─────────────────────────────────────────────
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

  // ── Select Product (by number) ──────────────────────────────
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

  // ── Brand ───────────────────────────────────────────────────
  for (const [keyword, brand] of Object.entries(BRAND_KEYWORDS)) {
    if (q.includes(keyword)) {
      // Check if there's also a category
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

  // ── Category Navigation ─────────────────────────────────────
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

  // ── Product name match ──────────────────────────────────────
  const product = matchProductFromText(q);
  if (product) {
    return {
      ...base,
      type: 'select_product',
      confidence: 0.7,
      slots: { rawText: raw, productName: product.name, productId: product.id },
    };
  }

  // ── Unrecognized — forward to LLM ──────────────────────────
  return base;
}

// ─── Helpers ──────────────────────────────────────────────────────

function matchProductFromText(text: string): CatalogProduct | null {
  const q = text.toLowerCase();

  // Exact ID match
  const byId = PRODUCTS_CATALOG.find((p) => q.includes(p.id.toLowerCase()));
  if (byId) return byId;

  // Name match (partial, longest match wins)
  let bestMatch: CatalogProduct | null = null;
  let bestLen = 0;

  for (const p of PRODUCTS_CATALOG) {
    const nameLower = p.name.toLowerCase();
    // Check if significant part of product name appears in query
    const nameWords = nameLower.split(/\s+/);
    const matchedWords = nameWords.filter((w) => w.length > 2 && q.includes(w));
    if (matchedWords.length >= 2 && matchedWords.length > bestLen) {
      bestMatch = p;
      bestLen = matchedWords.length;
    }
  }
  if (bestMatch) return bestMatch;

  // Brand + category match
  for (const p of PRODUCTS_CATALOG) {
    if (q.includes(p.brand.toLowerCase())) {
      return p;
    }
  }

  return null;
}
