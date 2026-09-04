/**
 * VoiceStateMachine — Explicit conversational state machine for voice shopping.
 *
 * States: idle → greeting → category → brand → price_range → show_results →
 *         product_detail → review → confirm_add_to_cart → upsell_offer →
 *         cart → address_confirm → bounded_confirmation → payment →
 *         order_confirmed | order_failed
 *
 * Enforces track requirements:
 * 1. Revenue growth mechanism (Cross-sell / Upsell pairing per category, 1 skippable turn).
 * 2. Bounded, explainable, gated money actions (2nd explicit confirmation for orders > ₹10,000, 1 upsell max).
 * 3. Graceful failure state (Razorpay decline/timeout handling with cart preservation and retry).
 * 4. Structured reasoning attached to every money-moving turn for audit logs.
 */

import { CatalogProduct, PRODUCTS_CATALOG } from './productsData';
import { parseIntent, ParsedIntent } from './intentParser';
import { Cart } from './schemas';

// ─── Cross-Sell Catalog ───────────────────────────────────────────

export interface CrossSellItem {
  id: string;
  name: string;
  category: string;
  price: number; // in paise
  displayPrice: number; // in Rupees
  matchCategories: string[];
  reason: string;
}

export const CROSS_SELL_CATALOG: CrossSellItem[] = [
  {
    id: 'xsell_sports_socks',
    name: 'ProFit Cushioned Breathable Sports Socks (3-Pack)',
    category: 'Footwear',
    price: 34900,
    displayPrice: 349,
    matchCategories: ['Footwear'],
    reason: 'commonly paired with footwear for blister prevention',
  },
  {
    id: 'xsell_carrying_case',
    name: 'AuraShield Shockproof Headphone Hard Travel Case',
    category: 'Audio',
    price: 49900,
    displayPrice: 499,
    matchCategories: ['Audio'],
    reason: 'provides waterproof protection for premium audio gear',
  },
  {
    id: 'xsell_wrist_rest',
    name: 'ErgoRest Memory Foam Keyboard & Mouse Wrist Rest',
    category: 'Peripherals',
    price: 39900,
    displayPrice: 399,
    matchCategories: ['Peripherals'],
    reason: 'ergonomic support for daily desk and typing work',
  },
  {
    id: 'xsell_watch_strap',
    name: 'QuickFit Magnetic Sport Silicone Smartwatch Strap',
    category: 'Wearables',
    price: 44900,
    displayPrice: 449,
    matchCategories: ['Wearables'],
    reason: 'sweat-resistant replacement band for workouts',
  },
  {
    id: 'xsell_otg_cable',
    name: 'TurboSpeed Braided 10Gbps USB-C OTG Fast Cable',
    category: 'Storage',
    price: 29900,
    displayPrice: 299,
    matchCategories: ['Storage'],
    reason: 'high-speed plug-and-play adapter for phones and laptops',
  },
  {
    id: 'xsell_gaming_mousepad',
    name: 'HyperGlide Extended Anti-Fray RGB Gaming Mousepad',
    category: 'Gaming',
    price: 49900,
    displayPrice: 499,
    matchCategories: ['Gaming'],
    reason: 'low-friction micro-woven surface for competitive gaming',
  },
];

// ─── Types ────────────────────────────────────────────────────────

export type VoiceState =
  | 'idle'
  | 'greeting'
  | 'category'
  | 'brand'
  | 'price_range'
  | 'show_results'
  | 'product_detail'
  | 'review'
  | 'confirm_add_to_cart'
  | 'upsell_offer'
  | 'cart'
  | 'address_confirm'
  | 'bounded_confirmation'
  | 'payment'
  | 'order_confirmed'
  | 'order_failed';

export interface TranscriptEntry {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  intent?: string;
  slots?: Record<string, unknown>;
  state?: VoiceState;
  reasoning?: string;
}

export interface VoiceSession {
  sessionId: string;
  state: VoiceState;
  category: string | null;
  brand: string | null;
  priceRange: { min: number; max: number } | null;
  filteredProducts: CatalogProduct[];
  selectedProduct: CatalogProduct | null;
  cart: Cart | null;
  address: string | null;
  transcript: TranscriptEntry[];
  userId: string | null;
  userName: string | null;
  startedAt: Date;
  upsellOffered: boolean;
  upsellAccepted: boolean | null;
  upsellItem: { id: string; name: string; displayPrice: number; price: number } | null;
  lastFailureReason: string | null;
}

export interface StateTransitionResult {
  newState: VoiceState;
  botResponse: string;
  filteredProducts: CatalogProduct[];
  selectedProduct: CatalogProduct | null;
  categoryFilter: string | null;
  priceBandFilter: 'all' | 'budget' | 'mid' | 'premium' | null;
  requiresLLM: boolean;
  requiresApiCall: boolean;
  apiAction: string | null; // 'propose_cart' | 'create_order' | 'resolve_address' | null
  apiPayload: Record<string, unknown> | null;
}

// ─── Session Factory ──────────────────────────────────────────────

export function createVoiceSession(userId: string | null, userName: string | null): VoiceSession {
  return {
    sessionId: `vs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    state: 'idle',
    category: null,
    brand: null,
    priceRange: null,
    filteredProducts: [],
    selectedProduct: null,
    cart: null,
    address: null,
    transcript: [],
    userId,
    userName,
    startedAt: new Date(),
    upsellOffered: false,
    upsellAccepted: null,
    upsellItem: null,
    lastFailureReason: null,
  };
}

// ─── Greeting ─────────────────────────────────────────────────────

export function generateGreeting(session: VoiceSession): StateTransitionResult {
  const name = session.userName || 'there';
  session.state = 'greeting';
  const botResponse = `Welcome, ${name}! I'm your PrimeStore voice shopping assistant. What would you like to shop for today? You can say things like "Show me headphones", "Find Nike running shoes", or "Show smartwatches under ₹5,000".`;

  session.transcript.push({
    role: 'bot',
    text: botResponse,
    timestamp: new Date(),
    state: 'greeting',
    reasoning: 'initial_voice_greeting_with_user_personalization',
  });

  return {
    newState: 'greeting',
    botResponse,
    filteredProducts: [],
    selectedProduct: null,
    categoryFilter: null,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

// ─── Main Transition Function ─────────────────────────────────────

export function processUserInput(session: VoiceSession, userText: string): StateTransitionResult {
  const intent = parseIntent(userText);

  // Log user turn
  session.transcript.push({
    role: 'user',
    text: userText,
    timestamp: new Date(),
    intent: intent.type,
    slots: intent.slots as unknown as Record<string, unknown>,
    state: session.state,
  });

  let result: StateTransitionResult;

  // Route based on current state + intent
  switch (session.state) {
    case 'idle':
    case 'greeting':
      result = handleOpenState(session, intent);
      break;
    case 'category':
      result = handleCategoryState(session, intent);
      break;
    case 'brand':
      result = handleBrandState(session, intent);
      break;
    case 'price_range':
      result = handlePriceRangeState(session, intent);
      break;
    case 'show_results':
      result = handleShowResultsState(session, intent);
      break;
    case 'product_detail':
      result = handleProductDetailState(session, intent);
      break;
    case 'review':
      result = handleReviewState(session, intent);
      break;
    case 'confirm_add_to_cart':
      result = handleConfirmCartState(session, intent);
      break;
    case 'upsell_offer':
      result = handleUpsellState(session, intent);
      break;
    case 'cart':
      result = handleCartState(session, intent);
      break;
    case 'address_confirm':
      result = handleAddressState(session, intent);
      break;
    case 'bounded_confirmation':
      result = handleBoundedConfirmationState(session, intent);
      break;
    case 'payment':
      result = handlePaymentState(session, intent);
      break;
    case 'order_confirmed':
      result = handleOrderConfirmedState(session, intent);
      break;
    case 'order_failed':
      result = handleOrderFailedState(session, intent);
      break;
    default:
      result = handleOpenState(session, intent);
  }

  // Log bot turn
  session.transcript.push({
    role: 'bot',
    text: result.botResponse,
    timestamp: new Date(),
    state: result.newState,
    reasoning: `state_transition_to_${result.newState}`,
  });

  session.state = result.newState;
  return result;
}

// ─── State Handlers ───────────────────────────────────────────────

function handleOpenState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'navigate_category' && intent.slots.category) {
    return navigateToCategory(session, intent.slots.category, intent.slots.brand || null);
  }

  if (intent.type === 'set_brand' && intent.slots.brand) {
    const category = inferCategoryFromBrand(intent.slots.brand);
    if (category) {
      return navigateToCategory(session, category, intent.slots.brand);
    }
    session.brand = intent.slots.brand;
    session.state = 'brand';
    const products = filterProducts(session);
    session.filteredProducts = products;
    return {
      newState: 'brand',
      botResponse: `I found ${products.length} ${intent.slots.brand} products. Which category interests you — Audio, Footwear, Wearables, Peripherals, Storage, or Gaming?`,
      filteredProducts: products,
      selectedProduct: null,
      categoryFilter: null,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'order_it' && intent.slots.productId) {
    const product = PRODUCTS_CATALOG.find((p) => p.id === intent.slots.productId) || null;
    if (product) {
      session.selectedProduct = product;
      return promptUpsellOrCart(session, product);
    }
  }

  if (intent.type === 'greeting' || intent.type === 'help') {
    return {
      newState: 'greeting',
      botResponse: `I can help you shop! Try saying a category like "shoes" or "headphones", or a brand like "Nike" or "Sony". You can also say "order" followed by a product name to buy directly.`,
      filteredProducts: [],
      selectedProduct: null,
      categoryFilter: null,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  return { ...fallbackPrompt(session), requiresLLM: true };
}

function handleCategoryState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'set_brand' && intent.slots.brand) {
    session.brand = intent.slots.brand;
    session.state = 'brand';
    const products = filterProducts(session);
    session.filteredProducts = products;
    return {
      newState: 'brand',
      botResponse: `Filtered to ${intent.slots.brand} in ${session.category}. What price range are you looking for — budget under ₹2,000, mid-range up to ₹8,000, or premium?`,
      filteredProducts: products,
      selectedProduct: null,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'set_price_range') {
    return applyPriceFilter(session, intent);
  }

  if (intent.type === 'select_product') {
    return handleProductSelection(session, intent);
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `I've opened ${session.category}. What brand or price range do you prefer?`);
}

function handleBrandState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'set_price_range') {
    return applyPriceFilter(session, intent);
  }

  if (intent.type === 'select_product') {
    return handleProductSelection(session, intent);
  }

  if (intent.type === 'navigate_category' && intent.slots.category) {
    return navigateToCategory(session, intent.slots.category, session.brand);
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `Viewing ${session.brand} products. You can specify a budget like "under ₹5,000" or pick an item.`);
}

function handlePriceRangeState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'select_product') {
    return handleProductSelection(session, intent);
  }

  if (intent.type === 'order_it' && intent.slots.productId) {
    const product = PRODUCTS_CATALOG.find((p) => p.id === intent.slots.productId) || null;
    if (product) {
      session.selectedProduct = product;
      return promptUpsellOrCart(session, product);
    }
  }

  if ((intent.type === 'get_review' || intent.type === 'ask_review') && session.selectedProduct) {
    return presentReview(session, session.selectedProduct);
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `Found ${session.filteredProducts.length} items. Which one would you like to inspect or order?`);
}

function handleShowResultsState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'select_product') {
    return handleProductSelection(session, intent);
  }

  if (intent.type === 'order_it') {
    const product = intent.slots.productId
      ? PRODUCTS_CATALOG.find((p) => p.id === intent.slots.productId) || session.filteredProducts[0]
      : session.selectedProduct || session.filteredProducts[0];

    if (product) {
      session.selectedProduct = product;
      return promptUpsellOrCart(session, product);
    }
  }

  if (intent.type === 'get_review' || intent.type === 'ask_review') {
    const product = intent.slots.productId
      ? PRODUCTS_CATALOG.find((p) => p.id === intent.slots.productId) || session.selectedProduct || session.filteredProducts[0]
      : session.selectedProduct || session.filteredProducts[0];

    if (product) {
      return presentReview(session, product);
    }
  }

  if (intent.type === 'set_price_range') {
    return applyPriceFilter(session, intent);
  }

  if (intent.type === 'set_brand' && intent.slots.brand) {
    session.brand = intent.slots.brand;
    const products = filterProducts(session);
    session.filteredProducts = products;
    return {
      newState: 'show_results',
      botResponse: `Filtered to ${intent.slots.brand}. ${formatProductList(products)}`,
      filteredProducts: products,
      selectedProduct: null,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `Say a product name, number, or tell me to refine by price.`);
}

function handleProductDetailState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const product = session.selectedProduct;
  if (!product) return handleShowResultsState(session, intent);

  if (intent.type === 'order_it' || intent.type === 'confirm_yes') {
    return promptUpsellOrCart(session, product);
  }

  if (intent.type === 'get_review' || intent.type === 'ask_review') {
    return presentReview(session, product);
  }

  if (intent.type === 'go_back' || intent.type === 'confirm_no') {
    session.state = 'show_results';
    session.selectedProduct = null;
    return {
      newState: 'show_results',
      botResponse: `Back to results. ${formatProductList(session.filteredProducts)} Which one would you like to see?`,
      filteredProducts: session.filteredProducts,
      selectedProduct: null,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `Looking at ${product.name}. You can say "order it", "what's the review", or "go back".`);
}

function handleReviewState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const product = session.selectedProduct;
  if (!product) return handleShowResultsState(session, intent);

  if (intent.type === 'order_it' || intent.type === 'confirm_yes') {
    return promptUpsellOrCart(session, product);
  }

  if (intent.type === 'go_back' || intent.type === 'confirm_no') {
    session.state = 'product_detail';
    return {
      newState: 'product_detail',
      botResponse: `${product.name} is priced at ₹${product.displayPrice.toLocaleString('en-IN')}. Say "order it" to checkout, or "go back" to browse more.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `Would you like to order ${product.name}? Say "order it" or "go back".`);
}

function handleConfirmCartState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const product = session.selectedProduct!;
  if (intent.type === 'confirm_yes' || intent.type === 'order_it') {
    return promptUpsellOrCart(session, product);
  }

  if (intent.type === 'confirm_no' || intent.type === 'go_back') {
    session.state = 'show_results';
    return {
      newState: 'show_results',
      botResponse: `No problem! ${formatProductList(session.filteredProducts)} Which other item would you prefer?`,
      filteredProducts: session.filteredProducts,
      selectedProduct: null,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'unrecognized') {
    return { ...fallbackPrompt(session), requiresLLM: true };
  }

  return fallbackPrompt(session, `Please confirm: add ${product.name} (₹${product.displayPrice.toLocaleString('en-IN')}) to your cart? Say "yes" or "no".`);
}

// ─── Phase 6: Revenue Growth Upsell Handler ───────────────────────

function handleUpsellState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const product = session.selectedProduct!;
  const upsell = session.upsellItem;

  // Accept cross-sell
  if (intent.type === 'confirm_yes' || /\b(yes|sure|add|include|ok|yep)\b/i.test(intent.slots.rawText)) {
    session.upsellAccepted = true;
    session.state = 'cart';

    session.transcript.push({
      role: 'bot',
      text: `Upsell accepted: ${upsell?.name} (+₹${upsell?.displayPrice})`,
      timestamp: new Date(),
      state: 'cart',
      reasoning: `upsell_accepted: merchant revenue increased by ₹${upsell?.displayPrice}`,
    });

    const items = [
      { productId: product.id, quantity: 1 },
      ...(upsell?.id ? [{ productId: upsell.id, quantity: 1 }] : []),
    ];

    return {
      newState: 'cart',
      botResponse: `Added both! I've included ${product.name} and matching ${upsell?.name} in your cart. Let's review your order.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: true,
      apiAction: 'propose_cart',
      apiPayload: { items },
    };
  }

  // Decline cross-sell (single friction-free turn)
  if (intent.type === 'confirm_no' || intent.type === 'go_back' || /\b(no|skip|just|pass|nope|nah)\b/i.test(intent.slots.rawText)) {
    session.upsellAccepted = false;
    session.state = 'cart';

    session.transcript.push({
      role: 'bot',
      text: `Upsell declined: user chose base item only`,
      timestamp: new Date(),
      state: 'cart',
      reasoning: 'upsell_declined: single_turn_friction_free_skip',
    });

    return {
      newState: 'cart',
      botResponse: `Got it! Proceeding with just ${product.name} at ₹${product.displayPrice.toLocaleString('en-IN')}.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: true,
      apiAction: 'propose_cart',
      apiPayload: { items: [{ productId: product.id, quantity: 1 }] },
    };
  }

  return fallbackPrompt(session, `Would you like to include ${upsell?.name} for ₹${upsell?.displayPrice}? Say "yes" to add it or "no" to skip.`);
}

function handleCartState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'confirm_yes' || intent.type === 'order_it') {
    session.state = 'address_confirm';
    return {
      newState: 'address_confirm',
      botResponse: session.address
        ? `Your delivery address is ${session.address}. Shall I deliver here, or would you like to update it?`
        : `Let me resolve your delivery address for instant delivery.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: session.selectedProduct,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: !session.address,
      apiAction: session.address ? null : 'resolve_address',
      apiPayload: null,
    };
  }

  if (intent.type === 'confirm_no' || intent.type === 'go_back') {
    session.state = 'show_results';
    session.cart = null;
    return fallbackPrompt(session, 'Cart cleared. What other products can I help you find?');
  }

  return fallbackPrompt(session, 'Your cart proposal is ready on screen. Say "yes" to confirm your address, or "no" to browse more.');
}

function handleAddressState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'confirm_yes') {
    const product = session.selectedProduct!;
    const orderTotal = session.cart?.totalDisplay || product.displayPrice;

    // Phase 3 Bounded Action Rule: High-Value Order Safety Check (> ₹10,000)
    if (orderTotal > 10000) {
      session.state = 'bounded_confirmation';
      const prompt = `⚠️ High-Value Order Confirmation: Your order total is ₹${orderTotal.toLocaleString('en-IN')}, which exceeds our ₹10,000 safety limit. Please explicitly say "yes, confirm" or "approve" to proceed to checkout.`;
      session.transcript.push({
        role: 'bot',
        text: prompt,
        timestamp: new Date(),
        state: 'bounded_confirmation',
        reasoning: `bounded_action_triggered: order total ₹${orderTotal} > ₹10,000 threshold, requiring 2nd explicit verbal confirmation`,
      });

      return {
        newState: 'bounded_confirmation',
        botResponse: prompt,
        filteredProducts: session.filteredProducts,
        selectedProduct: product,
        categoryFilter: session.category,
        priceBandFilter: null,
        requiresLLM: false,
        requiresApiCall: false,
        apiAction: null,
        apiPayload: null,
      };
    }

    // Standard order under ₹10,000 -> proceed to payment
    session.state = 'payment';
    return {
      newState: 'payment',
      botResponse: `Perfect! Order summary: ${product.name} delivering to ${session.address || 'your address'}. Please complete the payment on screen.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: true,
      apiAction: 'create_order',
      apiPayload: { cartId: session.cart?.id, deliveryAddress: session.address },
    };
  }

  if (intent.type === 'set_address' && intent.slots.addressText) {
    session.address = intent.slots.addressText;
    return {
      newState: 'address_confirm',
      botResponse: `Updated! Delivering to: ${intent.slots.addressText}. Is that correct?`,
      filteredProducts: session.filteredProducts,
      selectedProduct: session.selectedProduct,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  if (intent.type === 'confirm_no') {
    return {
      newState: 'address_confirm',
      botResponse: 'Please tell me your delivery address. Say "deliver to" followed by your street and city.',
      filteredProducts: session.filteredProducts,
      selectedProduct: session.selectedProduct,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  return fallbackPrompt(session, `Please confirm your delivery address: ${session.address || 'Address'}. Say "yes" or tell me a new address.`);
}

// ─── Phase 3: Bounded Action Confirmation Handler ─────────────────

function handleBoundedConfirmationState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const product = session.selectedProduct!;
  const orderTotal = session.cart?.totalDisplay || product.displayPrice;

  if (intent.type === 'confirm_yes' || /\b(yes|confirm|approve|proceed|continue)\b/i.test(intent.slots.rawText)) {
    session.state = 'payment';
    session.transcript.push({
      role: 'bot',
      text: `2nd confirmation approved for high-value order (₹${orderTotal})`,
      timestamp: new Date(),
      state: 'payment',
      reasoning: `bounded_action_approved: 2nd explicit confirmation verified`,
    });

    return {
      newState: 'payment',
      botResponse: `Confirmed! Launching secure payment for ₹${orderTotal.toLocaleString('en-IN')}. Please complete the payment in the Razorpay window.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: true,
      apiAction: 'create_order',
      apiPayload: { cartId: session.cart?.id, deliveryAddress: session.address },
    };
  }

  if (intent.type === 'confirm_no' || intent.type === 'go_back') {
    session.state = 'cart';
    session.transcript.push({
      role: 'bot',
      text: `High-value order payment halted by user`,
      timestamp: new Date(),
      state: 'cart',
      reasoning: `bounded_action_declined: payment halted, cart preserved`,
    });

    return {
      newState: 'cart',
      botResponse: `Payment halted. Your cart has been kept safe. Would you like to change items or browse other products?`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  return fallbackPrompt(session, `This is a high-value order (₹${orderTotal.toLocaleString('en-IN')}). Please say "yes, confirm" to proceed or "no" to halt.`);
}

function handlePaymentState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'confirm_yes' || /\b(done|paid|completed|finished)\b/i.test(intent.slots.rawText)) {
    session.state = 'order_confirmed';
    return {
      newState: 'order_confirmed',
      botResponse: `Payment confirmed! Your order for ${session.selectedProduct?.name} has been placed successfully. Thank you for shopping with PrimeStore!`,
      filteredProducts: [],
      selectedProduct: null,
      categoryFilter: null,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  return fallbackPrompt(session, `Payment is active on screen. Complete the Razorpay checkout to finish your order.`);
}

function handleOrderConfirmedState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  if (intent.type === 'navigate_category' && intent.slots.category) {
    return navigateToCategory(session, intent.slots.category, null);
  }

  return {
    newState: 'greeting',
    botResponse: `What else can I help you find today? Say a category or brand to start shopping.`,
    filteredProducts: [],
    selectedProduct: null,
    categoryFilter: null,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

// ─── Phase 8: Graceful Failure State Handler ──────────────────────

function handleOrderFailedState(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const product = session.selectedProduct;

  if (intent.type === 'confirm_yes' || /\b(try again|retry|re-open|pay)\b/i.test(intent.slots.rawText)) {
    session.state = 'payment';
    session.transcript.push({
      role: 'bot',
      text: `User retried payment after failure`,
      timestamp: new Date(),
      state: 'payment',
      reasoning: `user_retried_payment: cart preserved and checkout re-engaged`,
    });

    return {
      newState: 'payment',
      botResponse: `Re-opening Razorpay checkout for ${product?.name || 'your order'}. Please complete the payment on screen.`,
      filteredProducts: session.filteredProducts,
      selectedProduct: product,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: true,
      apiAction: 'create_order',
      apiPayload: { cartId: session.cart?.id, deliveryAddress: session.address },
    };
  }

  if (intent.type === 'confirm_no' || intent.type === 'go_back' || /\b(cancel|no|stop|abandon)\b/i.test(intent.slots.rawText)) {
    session.state = 'show_results';
    session.transcript.push({
      role: 'bot',
      text: `User cancelled order following payment failure`,
      timestamp: new Date(),
      state: 'show_results',
      reasoning: `order_abandoned: payment failed and user decided not to retry`,
    });

    return {
      newState: 'show_results',
      botResponse: `Order cancelled. Your cart remains saved. What else would you like to explore?`,
      filteredProducts: session.filteredProducts,
      selectedProduct: null,
      categoryFilter: session.category,
      priceBandFilter: null,
      requiresLLM: false,
      requiresApiCall: false,
      apiAction: null,
      apiPayload: null,
    };
  }

  return fallbackPrompt(session, `Your cart is saved. Say "try again" to retry payment, or "cancel" to return to browsing.`);
}

// ─── Public Action Helpers ────────────────────────────────────────

export function markOrderConfirmed(session: VoiceSession): StateTransitionResult {
  session.state = 'order_confirmed';
  const botResponse = `🎉 Payment confirmed! Your order for ${session.selectedProduct?.name || 'your items'} has been placed successfully. Thank you for shopping with PrimeStore!`;

  session.transcript.push({
    role: 'bot',
    text: botResponse,
    timestamp: new Date(),
    state: 'order_confirmed',
    reasoning: 'payment_verified_and_order_saved',
  });

  return {
    newState: 'order_confirmed',
    botResponse,
    filteredProducts: [],
    selectedProduct: null,
    categoryFilter: null,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

export function markOrderFailed(session: VoiceSession, reason: string): StateTransitionResult {
  session.state = 'order_failed';
  session.lastFailureReason = reason;
  const botResponse = `⚠️ Payment was not completed (${reason}). Don't worry, your cart is preserved! Would you like to try again, or should we cancel?`;

  session.transcript.push({
    role: 'bot',
    text: botResponse,
    timestamp: new Date(),
    state: 'order_failed',
    reasoning: `payment_failed: ${reason}. Cart preserved.`,
  });

  return {
    newState: 'order_failed',
    botResponse,
    filteredProducts: session.filteredProducts,
    selectedProduct: session.selectedProduct,
    categoryFilter: session.category,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

export function setSessionAddress(session: VoiceSession, address: string): void {
  session.address = address;
}

export function setSessionCart(session: VoiceSession, cart: Cart): void {
  session.cart = cart;
}

// ─── Internal Navigation & Filter Helpers ─────────────────────────

function promptUpsellOrCart(session: VoiceSession, product: CatalogProduct): StateTransitionResult {
  // Phase 6: Revenue Growth — Check for cross-sell opportunity
  if (!session.upsellOffered) {
    const crossSell = CROSS_SELL_CATALOG.find((x) => x.matchCategories.includes(product.category));
    if (crossSell) {
      session.upsellOffered = true;
      session.upsellItem = { id: crossSell.id, name: crossSell.name, displayPrice: crossSell.displayPrice, price: crossSell.price };
      session.state = 'upsell_offer';

      const botResponse = `Great choice! Adding the ${product.name} (₹${product.displayPrice.toLocaleString('en-IN')}) to your order. Before checkout, would you like to add matching ${crossSell.name} for just ₹${crossSell.displayPrice}? Say "yes" to include it, or "no" to skip.`;

      session.transcript.push({
        role: 'bot',
        text: botResponse,
        timestamp: new Date(),
        state: 'upsell_offer',
        reasoning: `upsell_offer_presented: offered ${crossSell.name} (₹${crossSell.displayPrice}) because ${crossSell.reason}`,
      });

      return {
        newState: 'upsell_offer',
        botResponse,
        filteredProducts: session.filteredProducts,
        selectedProduct: product,
        categoryFilter: session.category,
        priceBandFilter: null,
        requiresLLM: false,
        requiresApiCall: false,
        apiAction: null,
        apiPayload: null,
      };
    }
  }

  // If already offered or no cross-sell, proceed to cart proposal
  session.state = 'confirm_add_to_cart';
  const botResponse = `Adding ${product.name} at ₹${product.displayPrice.toLocaleString('en-IN')} to your cart. Please say "yes" to confirm, or "no" to cancel.`;

  return {
    newState: 'confirm_add_to_cart',
    botResponse,
    filteredProducts: session.filteredProducts,
    selectedProduct: product,
    categoryFilter: session.category,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: true,
    apiAction: 'propose_cart',
    apiPayload: { items: [{ productId: product.id, quantity: 1 }] },
  };
}

function navigateToCategory(session: VoiceSession, category: string, brand: string | null): StateTransitionResult {
  session.category = category;
  if (brand) session.brand = brand;
  session.state = 'category';
  const products = filterProducts(session);
  session.filteredProducts = products;

  const brandsAvailable = Array.from(new Set(products.map((p) => p.brand))).slice(0, 4);
  const botResponse = `I've opened ${category}! We have ${products.length} items from brands like ${brandsAvailable.join(', ')}. What brand or price range do you prefer?`;

  return {
    newState: 'category',
    botResponse,
    filteredProducts: products,
    selectedProduct: null,
    categoryFilter: category,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

function applyPriceFilter(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  const band = intent.slots.priceBand;
  const maxPrice = intent.slots.priceMax ?? intent.slots.maxPrice;
  const minPrice = intent.slots.priceMin ?? intent.slots.minPrice ?? 0;

  if (band && band !== 'all') {
    session.priceRange =
      band === 'budget' ? { min: 0, max: 2000 } : band === 'mid' ? { min: 2000, max: 8000 } : { min: 8000, max: 1000000 };
  } else if (maxPrice !== undefined) {
    session.priceRange = { min: minPrice, max: maxPrice };
  }

  session.state = 'price_range';
  const products = filterProducts(session);
  session.filteredProducts = products;

  const botResponse = products.length > 0
    ? `Found ${products.length} products matching your budget. ${formatProductList(products)} Which one would you like to select or hear reviews for?`
    : `I couldn't find items in that exact price band. Try expanding your range or saying "all prices".`;

  return {
    newState: 'show_results',
    botResponse,
    filteredProducts: products,
    selectedProduct: null,
    categoryFilter: session.category,
    priceBandFilter: band || null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

function handleProductSelection(session: VoiceSession, intent: ParsedIntent): StateTransitionResult {
  let product: CatalogProduct | null = null;
  const targetIdx = intent.slots.productIndex !== undefined
    ? intent.slots.productIndex
    : intent.slots.itemIndex !== undefined
    ? intent.slots.itemIndex - 1
    : undefined;

  if (targetIdx !== undefined && targetIdx >= 0 && session.filteredProducts.length > targetIdx) {
    product = session.filteredProducts[targetIdx];
  } else if (intent.slots.productId) {
    product = PRODUCTS_CATALOG.find((p) => p.id === intent.slots.productId) || null;
  } else if (session.filteredProducts.length > 0) {
    product = session.filteredProducts[0];
  }

  if (!product) {
    return fallbackPrompt(session, `I couldn't find that item. Please say the product number like "number 1" or the name.`);
  }

  session.selectedProduct = product;
  session.state = 'product_detail';

  return {
    newState: 'product_detail',
    botResponse: `Selected ${product.name} by ${product.brand} for ₹${product.displayPrice.toLocaleString('en-IN')}. ${product.description} Say "order it" to checkout or "what's the review" to hear customer ratings.`,
    filteredProducts: session.filteredProducts,
    selectedProduct: product,
    categoryFilter: session.category,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

function presentReview(session: VoiceSession, product: CatalogProduct): StateTransitionResult {
  session.state = 'review';
  session.selectedProduct = product;

  const reviewSummary = product.reviewSummary || `${product.name} has a ${product.rating} out of 5 star rating across ${product.reviewsCount.toLocaleString('en-IN')} verified reviews. Customers highlight its ${product.specs.slice(0, 3).join(', ')}.`;

  return {
    newState: 'review',
    botResponse: reviewSummary + ` Would you like to order it for ₹${product.displayPrice.toLocaleString('en-IN')}? Say "order it" or "go back".`,
    filteredProducts: session.filteredProducts,
    selectedProduct: product,
    categoryFilter: session.category,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}

function filterProducts(session: VoiceSession): CatalogProduct[] {
  return PRODUCTS_CATALOG.filter((p) => {
    if (session.category && session.category !== 'All Categories' && p.category.toLowerCase() !== session.category.toLowerCase()) {
      return false;
    }
    if (session.brand && session.brand !== 'All' && p.brand.toLowerCase() !== session.brand.toLowerCase()) {
      return false;
    }
    if (session.priceRange) {
      if (p.displayPrice < session.priceRange.min || p.displayPrice > session.priceRange.max) {
        return false;
      }
    }
    return true;
  });
}

function formatProductList(products: CatalogProduct[]): string {
  const top = products.slice(0, 3);
  return top.map((p, i) => `Number ${i + 1}: ${p.name} for ₹${p.displayPrice.toLocaleString('en-IN')}.`).join(' ');
}

function inferCategoryFromBrand(brand: string): string | null {
  const b = brand.toLowerCase();
  if (['nike', 'adidas', 'puma', 'asics', 'sparx'].includes(b)) return 'Footwear';
  if (['boat', 'sony', 'bose', 'jbl'].includes(b)) return 'Audio';
  if (['noise', 'oneplus', 'apple', 'rolex'].includes(b)) return 'Wearables';
  if (['dell', 'logitech', 'keychron', 'acer', 'knoll'].includes(b)) return 'Peripherals';
  if (['sandisk', 'crucial', 'western digital', 'wd', 'silicon power'].includes(b)) return 'Storage';
  if (['cosmic byte', 'hyperx', 'razer'].includes(b)) return 'Gaming';
  return null;
}

function fallbackPrompt(session: VoiceSession, customMessage?: string): StateTransitionResult {
  return {
    newState: session.state,
    botResponse: customMessage || `I'm not sure I understood. You can say a category like "shoes", a brand like "Nike", or "help" for options.`,
    filteredProducts: session.filteredProducts,
    selectedProduct: session.selectedProduct,
    categoryFilter: session.category,
    priceBandFilter: null,
    requiresLLM: false,
    requiresApiCall: false,
    apiAction: null,
    apiPayload: null,
  };
}
