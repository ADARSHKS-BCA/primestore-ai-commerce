import { getProductsList, getProductById, saveCart } from './dbStore';
import { writeAuditLog } from './auditLog';
import { Product, CartItem, Cart } from './schemas';

/**
 * Multi-Provider Ultra-Fast AI Shopping Agent (Groq LPU / OpenRouter / Smart Fallback)
 * 
 * SERVER-ONLY module with 4-Stage Intent Handling:
 * 1. Navigation ("I want to buy shoes" -> Navigates to category without ordering)
 * 2. Clarification (Asks for price range / preferred brand)
 * 3. Filtered Results (Narrows down catalog)
 * 4. Explicit Order Intent ("Order it" / "Proceed" -> Proposes cart)
 */

// --- Tool Declarations (OpenAI / OpenRouter / Groq Compatible) ---

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search the product catalog by keyword or category. Returns matching products with name, brand, price, and availability.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keyword (e.g. "earbuds", "shoes", "keyboard", "ssd", "smartwatch", "nike", "sony")',
          },
          category: {
            type: 'string',
            description: 'Category filter (Audio, Peripherals, Wearables, Storage, Gaming, Footwear)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_cart',
      description: 'Create a cart proposal ONLY when the customer gives an EXPLICIT purchase command (e.g. "order it", "buy this", "proceed with Nike Air Max"). Max ₹100,000.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Array of items to add to the cart',
            items: {
              type: 'object',
              properties: {
                productId: {
                  type: 'string',
                  description: 'The product ID from the catalog (e.g. "prod_nike_air_max_sc", "prod_earbuds_pro")',
                },
                quantity: {
                  type: 'number',
                  description: 'Number of units (must be >= 1)',
                },
              },
              required: ['productId', 'quantity'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_review',
      description: 'Get customer ratings, review summary, and feature feedback for a specific product ID.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The product ID to get reviews for (e.g. "prod_nike_air_max_sc", "prod_earbuds_pro")',
          },
        },
        required: ['productId'],
      },
    },
  },
];

// --- Tool Implementations ---

async function executeGetProductReview(args: { productId: string }): Promise<{
  product: Product | null;
  reviewSummary: string;
  rating: number;
  reviewsCount: number;
}> {
  const allProducts = await getProductsList();
  let product = await getProductById(args.productId);
  if (!product) {
    const rawId = (args.productId || '').toLowerCase();
    product = allProducts.find(
      (p) =>
        p.id.toLowerCase() === rawId ||
        rawId.includes(p.id.toLowerCase()) ||
        p.name.toLowerCase().includes(rawId) ||
        rawId.includes(p.brand.toLowerCase())
    ) || null;
  }

  if (!product) {
    return {
      product: null,
      reviewSummary: 'Product not found in catalog.',
      rating: 0,
      reviewsCount: 0,
    };
  }

  const ratingDesc = product.rating >= 4.7 ? 'outstanding' : product.rating >= 4.3 ? 'highly rated' : 'well-reviewed';
  const summary = `${product.name} by ${product.brand} has a ${product.rating} out of 5 star customer rating with ${product.reviewsCount.toLocaleString('en-IN')} customer reviews (${ratingDesc}). Key highlights: ${product.specs.slice(0, 3).join(', ')}.`;

  writeAuditLog({
    actor: 'ai',
    action: 'get_product_review',
    details: { productId: product.id, productName: product.name, rating: product.rating },
    status: 'executed',
  }).catch(() => {});

  return {
    product,
    reviewSummary: summary,
    rating: product.rating,
    reviewsCount: product.reviewsCount,
  };
}

async function executeSearchProducts(args: { query?: string; category?: string }): Promise<Product[]> {
  const t0 = performance.now();
  console.log('🔍 [TOOL: search_products] Searching catalog with filters:', args);
  const allProducts = await getProductsList();
  let products = allProducts;

  if (args.category) {
    const cat = args.category.toLowerCase();
    products = products.filter((p) => p.category.toLowerCase() === cat);
  }

  if (args.query) {
    const q = args.query.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  console.log(`✅ [TOOL: search_products] Found ${products.length} matching products in ${(performance.now() - t0).toFixed(1)}ms`);

  // Non-blocking audit write
  writeAuditLog({
    actor: 'ai',
    action: 'search_products',
    details: { query: args.query || null, category: args.category || null, resultsCount: products.length },
    status: 'executed',
  }).catch(() => {});

  return products;
}

async function executeProposeCart(args: { items: Array<{ productId: string; quantity: number }> }): Promise<Cart> {
  const t0 = performance.now();
  console.log('🛒 [TOOL: propose_cart] Assembling cart proposal with items:', args.items);
  const cartItems: CartItem[] = [];
  let totalPaise = 0;

  const allProducts = await getProductsList();

  for (const item of args.items) {
    let product = await getProductById(item.productId);

    // Self-healing fallback if LLM hallucinated ID
    if (!product) {
      const rawId = (item.productId || '').toLowerCase();
      product = allProducts.find(
        (p) =>
          p.id.toLowerCase() === rawId ||
          rawId.includes(p.id.toLowerCase()) ||
          p.id.toLowerCase().includes(rawId.replace(/_100|_pro|_v2|_v4/g, '')) ||
          rawId.includes(p.brand.toLowerCase())
      ) || null;

      if (!product) {
        // Match by name similarity
        product = allProducts.find(
          (p) => rawId.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(rawId)
        ) || allProducts[0];
      }
      console.log(`🔧 [FUZZY RESOLVE] Hallucinated ID "${item.productId}" auto-resolved to "${product?.id}" (${product?.name})`);
    }

    if (!product || !product.inStock) {
      product = allProducts.find((p) => p.inStock) || allProducts[0];
    }

    const quantity = Math.max(1, Math.floor(item.quantity || 1));
    cartItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
    });
    totalPaise += product.price * quantity;
  }

  const cartId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cart: Cart = {
    id: cartId,
    items: cartItems,
    totalPaise,
    totalDisplay: totalPaise / 100,
    status: 'proposed',
    createdAt: new Date(),
    userId: undefined,
  };

  await saveCart(cart);
  console.log(`✨ [TOOL: propose_cart] Cart ID ${cart.id} (₹${cart.totalDisplay}) created in ${(performance.now() - t0).toFixed(1)}ms`);

  // Non-blocking audit log
  writeAuditLog({
    actor: 'ai',
    action: 'propose_cart',
    details: {
      cartId: cart.id,
      itemCount: cartItems.length,
      totalDisplay: cart.totalDisplay,
    },
    status: 'proposed',
    relatedCartId: cart.id,
  }).catch(() => {});

  return cart;
}

const SYSTEM_PROMPT = `You are "PrimeStore AI Copilot", a smart conversational shopping assistant for a multi-brand e-commerce store with Audio, Peripherals, Wearables, Storage, Gaming, and Footwear categories.

YOUR 4-STAGE INTERACTION MODEL:
1. NAVIGATION INTENT ("I want to buy shoes", "Show me smartwatches", "Looking for headphones"):
   - Acknowledge the category, highlight 2-3 popular brands/options, and ask clarifying questions:
     "I've filtered the store to Shoes! What brand (Nike, Adidas, Puma, Sparx) or price range (under ₹3,000 or premium) do you prefer?"
   - DO NOT automatically propose a cart on broad navigation queries.

2. CLARIFICATION & FILTERING ("Under 5000", "Nike", "Show budget options"):
   - Narrow down recommendations and present matching products with prices in ₹.

3. EXPLICIT ORDER INTENT ("Order the Nike Air Max", "Order it", "Buy this", "Proceed with 2 boAt Earbuds"):
   - ONLY when the user explicitly commands an order, call propose_cart to generate the 1-click Razorpay proposal.

4. CATALOG PRODUCT IDS FOR propose_cart:
   - Audio: prod_boat_bassheads (₹499), prod_boat_airdopes_141 (₹1,299), prod_earbuds_pro (₹2,499), prod_jbl_tune_760nc (₹5,499), prod_sony_wh1000xm4 (₹19,990), prod_bose_quietcomfort (₹24,900)
   - Peripherals: prod_dell_wireless_mouse (₹699), prod_logitech_k380 (₹2,695), prod_keyboard_rgb (₹3,999), prod_logitech_mx_master_3s (₹8,995), prod_keychron_q1_pro (₹14,999)
   - Wearables: prod_noise_colorfit_pulse (₹1,499), prod_smartwatch_ultra (₹4,499), prod_oneplus_watch_2 (₹19,999), prod_samsung_galaxy_watch6 (₹24,999), prod_apple_watch_se (₹28,990)
   - Storage: prod_sandisk_cruzer_blade_128 (₹899), prod_crucial_p3_1tb (₹4,999), prod_ssd_portable_1tb (₹5,499), prod_samsung_t7_shield_2tb (₹15,499)
   - Gaming: prod_cosmicbyte_gamepad (₹1,499), prod_gaming_mouse_wireless (₹2,199), prod_hyperx_cloud_ii (₹7,990), prod_razer_blackwidow_v4 (₹18,999)
   - Footwear: prod_sparx_running_shoes (₹1,199), prod_puma_smash_sneakers (₹2,249), prod_adidas_runfalcon_5 (₹3,499), prod_asics_gel_contend_8 (₹4,499), prod_nike_air_max_sc (₹5,995), prod_nike_pegasus_41 (₹11,895)

5. SAFETY & LIMITS:
   - Maximum AI single order ceiling is ₹100,000.
   - All proposed orders require 1-click human approval before launching the secure Razorpay payment modal.
   - Keep responses concise, friendly, and structured with bullet points!`;

// --- Fast Smart Fallback Intent Parser (< 2ms) ---

async function runFallbackParser(userMessage: string) {
  const t0 = performance.now();
  console.log('🛡️ [SMART PARSER] Running fast NLP intent parser...');
  const q = userMessage.toLowerCase();
  const allProducts = await getProductsList();

  // Check for EXPLICIT order trigger phrases
  const isExplicitOrder =
    q.startsWith('order') ||
    q.startsWith('buy') ||
    q.includes('order it') ||
    q.includes('order that') ||
    q.includes('buy this') ||
    q.includes('proceed to checkout') ||
    q.includes('proceed');

  // Check for category navigation queries
  const isShoesQuery = q.includes('shoe') || q.includes('footwear') || q.includes('sneaker') || q.includes('running');
  const isAudioQuery = q.includes('earbud') || q.includes('headphone') || q.includes('audio') || q.includes('speaker');
  const isWatchQuery = q.includes('watch') || q.includes('smartwatch') || q.includes('wearable');
  const isStorageQuery = q.includes('ssd') || q.includes('drive') || q.includes('storage') || q.includes('pendrive');
  const isPeripheralsQuery = q.includes('keyboard') || q.includes('mouse') || q.includes('peripheral');
  const isGamingQuery = q.includes('game') || q.includes('controller') || q.includes('gamepad');

  // Extract quantity if mentioned
  const qtyMatch = q.match(/(?:order|buy|get|want)\s+(\d+)/i) || q.match(/(\d+)\s+(?:unit|piece|units|pieces|pair|pairs)/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

  // Check for review / rating queries
  const isReviewQuery =
    q.includes('review') ||
    q.includes('rating') ||
    q.includes('feedback') ||
    q.includes('is it good') ||
    q.includes('how good');

  // Handle Review Intent
  if (isReviewQuery) {
    let matchedProduct = allProducts.find((p) => q.includes(p.id.toLowerCase()));
    if (!matchedProduct) {
      matchedProduct = allProducts.find((p) => q.includes(p.name.toLowerCase()) || q.includes(p.brand.toLowerCase()));
    }
    if (!matchedProduct) {
      if (isShoesQuery) matchedProduct = allProducts.find((p) => p.category === 'Footwear');
      else if (isAudioQuery) matchedProduct = allProducts.find((p) => p.category === 'Audio');
      else if (isWatchQuery) matchedProduct = allProducts.find((p) => p.category === 'Wearables');
      else if (isPeripheralsQuery) matchedProduct = allProducts.find((p) => p.category === 'Peripherals');
      else if (isStorageQuery) matchedProduct = allProducts.find((p) => p.category === 'Storage');
      else if (isGamingQuery) matchedProduct = allProducts.find((p) => p.category === 'Gaming');
    }

    if (matchedProduct) {
      const reviewData = await executeGetProductReview({ productId: matchedProduct.id });
      return {
        response: `⭐ **${matchedProduct.name} Customer Reviews**:\n\n${reviewData.reviewSummary}\n\n• **Price**: ₹${matchedProduct.displayPrice.toLocaleString('en-IN')}\n• **Stock**: ${matchedProduct.inStock ? 'In Stock (Ready to Ship)' : 'Out of Stock'}\n\n👉 *Would you like to order this item? Just say "Order it"!*`,
        cart: null,
        categoryFilter: matchedProduct.category,
        history: [],
      };
    }
  }

  // 1. Handle Explicit Order
  if (isExplicitOrder) {
    let matchedProduct = allProducts.find((p) => q.includes(p.id.toLowerCase()));
    if (!matchedProduct) {
      matchedProduct = allProducts.find((p) => q.includes(p.name.toLowerCase()) || q.includes(p.brand.toLowerCase()));
    }
    if (!matchedProduct) {
      if (isShoesQuery) matchedProduct = allProducts.find((p) => p.id === 'prod_nike_air_max_sc') || allProducts.find((p) => p.category === 'Footwear');
      else if (isAudioQuery) matchedProduct = allProducts.find((p) => p.id === 'prod_earbuds_pro') || allProducts.find((p) => p.category === 'Audio');
      else if (isWatchQuery) matchedProduct = allProducts.find((p) => p.id === 'prod_smartwatch_ultra') || allProducts.find((p) => p.category === 'Wearables');
      else if (isPeripheralsQuery) matchedProduct = allProducts.find((p) => p.id === 'prod_keyboard_rgb') || allProducts.find((p) => p.category === 'Peripherals');
      else if (isStorageQuery) matchedProduct = allProducts.find((p) => p.id === 'prod_ssd_portable_1tb') || allProducts.find((p) => p.category === 'Storage');
      else if (isGamingQuery) matchedProduct = allProducts.find((p) => p.id === 'prod_gaming_mouse_wireless') || allProducts.find((p) => p.category === 'Gaming');
    }

    if (matchedProduct) {
      const cart = await executeProposeCart({
        items: [{ productId: matchedProduct.id, quantity }],
      });

      console.log(`⏱️ [TIMING: SMART_PARSER_ORDER] Order proposal created in ${(performance.now() - t0).toFixed(1)}ms`);
      return {
        response: `🛒 I have prepared an order proposal for **${quantity}x ${matchedProduct.name}** at **₹${((matchedProduct.price * quantity) / 100).toLocaleString('en-IN')}**.\n\nPlease review your items below and click **"Approve & Pay with Razorpay"** to complete your checkout!`,
        cart,
        categoryFilter: matchedProduct.category,
        history: [],
      };
    }
  }

  // 2. Handle Navigation Intent (Shoes, Audio, Wearables, etc.)
  if (isShoesQuery) {
    const shoes = allProducts.filter((p) => p.category === 'Footwear');
    return {
      response: `👟 **I've opened the Footwear & Lifestyle collection!**\n\nWe feature top styles from **Nike, Adidas, Puma, Asics, and Sparx**:\n• **Sparx SM-648** — ₹1,199 (Budget Pick)\n• **Puma Smashic Sneakers** — ₹2,249 (Trending)\n• **Nike Air Max SC** — ₹5,995 (Best Seller)\n\n👉 *What brand or price range (under ₹3,000 or premium) do you prefer? Or tell me "Order [Item]" to checkout!*`,
      cart: null,
      categoryFilter: 'Footwear',
      history: [],
    };
  }

  if (isAudioQuery) {
    return {
      response: `🎧 **I've opened our Audio Collection!**\n\nTop picks from **boAt, Sony, JBL, and Bose**:\n• **boAt BassHeads 100** — ₹499 (Budget)\n• **AuraPods Pro ANC** — ₹2,499 (Mid-Range)\n• **Sony WH-1000XM4** — ₹19,990 (Flagship ANC)\n\n👉 *Tell me your preferred budget or say "Order AuraPods Pro" to checkout!*`,
      cart: null,
      categoryFilter: 'Audio',
      history: [],
    };
  }

  if (isWatchQuery) {
    return {
      response: `⌚ **I've opened our Wearables Collection!**\n\nFeaturing **Noise, OnePlus, Samsung, and Apple**:\n• **Noise ColorFit Pulse 2** — ₹1,499\n• **PulseTrack Ultra AMOLED** — ₹4,499\n• **OnePlus Watch 2** — ₹19,999\n\n👉 *Which style or price band are you looking for?*`,
      cart: null,
      categoryFilter: 'Wearables',
      history: [],
    };
  }

  // General catalog recommendations
  const listToShow = allProducts.slice(0, 3);
  const itemsText = listToShow
    .map((p) => `• **${p.name}** — ₹${p.displayPrice.toLocaleString('en-IN')} (${p.brand})\n  _${p.description}_`)
    .join('\n\n');

  console.log(`⏱️ [TIMING: SMART_PARSER_REC] Recommendations generated in ${(performance.now() - t0).toFixed(1)}ms`);
  return {
    response: `Welcome! Here are top featured items from our store:\n\n${itemsText}\n\n👉 *You can tell me "I want to buy shoes" to navigate, or "Order [Item Name]" to create an instant order proposal!*`,
    cart: null,
    categoryFilter: null,
    history: [],
  };
}

// --- Main Chat Function ---

export async function runAgentChat(
  userMessage: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationHistory: Array<{ role: string; content?: string; parts?: Array<{ text: string }> }> = []
) {
  const totalStart = performance.now();
  const groqApiKey = process.env.GROQ_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  console.log(`\n🤖 [AI AGENT START] New Request: "${userMessage}"`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const h of conversationHistory) {
    if (h.content) {
      formattedMessages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
    } else if (h.parts && h.parts[0]?.text) {
      formattedMessages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.parts[0].text });
    }
  }

  formattedMessages.push({ role: 'user', content: userMessage });

  // 1. Try Groq LPU (Ultra-fast, sub-500ms)
  if (groqApiKey && groqApiKey.trim().startsWith('gsk_')) {
    const tGroq0 = performance.now();
    console.log('⚡ [AI: GROQ LPU] Dispatching request with model: llama-3.3-70b-versatile');
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: formattedMessages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const choice = groqData.choices?.[0];
        const message = choice?.message;
        console.log(`⏱️ [TIMING: GROQ_FIRST_PASS] Finished in ${(performance.now() - tGroq0).toFixed(1)}ms`);

        let proposedCart: Cart | null = null;

        if (message?.tool_calls && message.tool_calls.length > 0) {
          const tTools0 = performance.now();
          const toolResults = [];

          for (const call of message.tool_calls) {
            const funcName = call.function.name;
            const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;

            let result: unknown;
            if (funcName === 'search_products') {
              result = await executeSearchProducts(args);
            } else if (funcName === 'get_product_review') {
              result = await executeGetProductReview(args);
            } else if (funcName === 'propose_cart') {
              const cart = await executeProposeCart(args);
              proposedCart = cart;
              result = cart;
            } else {
              result = { error: 'Unknown tool' };
            }

            toolResults.push({
              tool_call_id: call.id,
              role: 'tool',
              name: funcName,
              content: JSON.stringify(result),
            });
          }
          console.log(`⏱️ [TIMING: TOOLS_EXECUTION] Completed in ${(performance.now() - tTools0).toFixed(1)}ms`);

          const followUpRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqApiKey.trim()}`,
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [...formattedMessages, message, ...toolResults],
              temperature: 0.2,
              max_tokens: 800,
            }),
          });

          if (followUpRes.ok) {
            const followUpData = await followUpRes.json();
            const finalReply = followUpData.choices?.[0]?.message?.content || 'Here is your order proposal:';
            console.log(`🚀 [AI AGENT TOTAL] Total latency: ${(performance.now() - totalStart).toFixed(1)}ms\n`);

            return {
              response: finalReply,
              cart: proposedCart,
              history: [
                ...formattedMessages.filter((m) => m.role !== 'system'),
                { role: 'assistant', content: finalReply },
              ],
            };
          }
        }

        if (message?.content) {
          console.log(`🚀 [AI AGENT TOTAL] Total latency: ${(performance.now() - totalStart).toFixed(1)}ms\n`);
          return {
            response: message.content,
            cart: proposedCart,
            history: [
              ...formattedMessages.filter((m) => m.role !== 'system'),
              { role: 'assistant', content: message.content },
            ],
          };
        }
      }
    } catch (groqErr) {
      console.warn('⚠️ [GROQ ERROR]', groqErr);
    }
  }

  // 2. Try OpenRouter
  if (openRouterApiKey && openRouterApiKey.trim().startsWith('sk-or-')) {
    console.log('⚡ [AI: OPENROUTER] Dispatching request with model: meta-llama/llama-3.3-70b-instruct');
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterApiKey.trim()}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'PrimeStore AI',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct',
          messages: formattedMessages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (orRes.ok) {
        const orData = await orRes.json();
        const choice = orData.choices?.[0];
        const message = choice?.message;

        let proposedCart: Cart | null = null;

        if (message?.tool_calls && message.tool_calls.length > 0) {
          const toolResults = [];
          for (const call of message.tool_calls) {
            const funcName = call.function.name;
            const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;

            let result: unknown;
            if (funcName === 'search_products') {
              result = await executeSearchProducts(args);
            } else if (funcName === 'get_product_review') {
              result = await executeGetProductReview(args);
            } else if (funcName === 'propose_cart') {
              const cart = await executeProposeCart(args);
              proposedCart = cart;
              result = cart;
            } else {
              result = { error: 'Unknown tool' };
            }

            toolResults.push({
              tool_call_id: call.id,
              role: 'tool',
              name: funcName,
              content: JSON.stringify(result),
            });
          }

          const followUpRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openRouterApiKey.trim()}`,
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'PrimeStore AI',
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-3.3-70b-instruct',
              messages: [...formattedMessages, message, ...toolResults],
              temperature: 0.2,
              max_tokens: 800,
            }),
          });

          if (followUpRes.ok) {
            const followUpData = await followUpRes.json();
            const finalReply = followUpData.choices?.[0]?.message?.content || 'Here is your order proposal:';
            return {
              response: finalReply,
              cart: proposedCart,
              history: [
                ...formattedMessages.filter((m) => m.role !== 'system'),
                { role: 'assistant', content: finalReply },
              ],
            };
          }
        }

        if (message?.content) {
          return {
            response: message.content,
            cart: proposedCart,
            history: [
              ...formattedMessages.filter((m) => m.role !== 'system'),
              { role: 'assistant', content: message.content },
            ],
          };
        }
      }
    } catch (orErr) {
      console.warn('⚠️ [OPENROUTER ERROR]', orErr);
    }
  }

  // 3. Ultra-fast local fallback (< 5ms)
  const fallbackResult = await runFallbackParser(userMessage);
  console.log(`🚀 [AI AGENT TOTAL: FALLBACK] Total latency: ${(performance.now() - totalStart).toFixed(1)}ms\n`);
  return fallbackResult;
}
