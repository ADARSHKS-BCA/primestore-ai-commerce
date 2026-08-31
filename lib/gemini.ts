import { getProductsList, getProductById, saveCart } from './dbStore';
import { writeAuditLog } from './auditLog';
import { Product, CartItem, Cart } from './schemas';

/**
 * Multi-Provider Ultra-Fast AI Shopping Agent (Groq LPU / OpenRouter / Smart Fallback)
 * 
 * SERVER-ONLY module with precise latency timing logs.
 */

// --- Tool Declarations (OpenAI / OpenRouter / Groq Compatible) ---

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search the product catalog by keyword or category. Returns matching products with name, price, and availability.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keyword (e.g. "earbuds", "keyboard", "ssd", "smartwatch")',
          },
          category: {
            type: 'string',
            description: 'Category filter (e.g. "Audio", "Peripherals", "Wearables", "Storage", "Gaming", "Accessories")',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_cart',
      description: 'Create a cart proposal with selected products when the customer asks to order/buy or confirms purchase. Creates a DRAFT cart for human approval before payment. Max ₹10,000.',
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
                  description: 'The product ID from the catalog (e.g. "prod_earbuds_pro", "prod_keyboard_rgb")',
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
];

// --- Tool Implementations ---

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

  for (const item of args.items) {
    const product = await getProductById(item.productId);
    if (!product) {
      console.error(`❌ [TOOL: propose_cart] Product not found: ${item.productId}`);
      throw new Error(`Product not found: ${item.productId}`);
    }
    if (!product.inStock) {
      console.error(`❌ [TOOL: propose_cart] Product out of stock: ${product.name}`);
      throw new Error(`Product out of stock: ${product.name}`);
    }

    const quantity = Math.max(1, Math.floor(item.quantity || 1));
    cartItems.push({
      productId: item.productId,
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

const SYSTEM_PROMPT = `You are "PrimeStore AI Copilot", a fast and helpful AI Shopping Assistant docked next to an Amazon-style electronics store.

YOUR RESPONSIBILITIES:
1. When the user asks for recommendations, products, or deals, call search_products to find relevant items in the catalog.
2. Whenever the user explicitly asks to order, buy, purchase, or add an item to cart (e.g. "Order 2 earbuds", "Buy mechanical keyboard", "Please order 1 unit of ..."), find the matching product using search_products and IMMEDIATELY call propose_cart to build their order proposal.
3. Always show prices in ₹ (Indian Rupees).
4. The maximum order value is ₹10,000.
5. Emphasize that all proposed orders require 1-click human approval before launching the secure Razorpay payment modal.
6. Keep responses concise, friendly, and well-formatted with bullet points!`;

// --- Fast Smart Fallback Intent Parser (< 2ms) ---

async function runFallbackParser(userMessage: string) {
  const t0 = performance.now();
  console.log('🛡️ [SMART PARSER] Running fast NLP intent parser...');
  const q = userMessage.toLowerCase();
  const allProducts = await getProductsList();

  const isOrderIntent =
    q.includes('order') ||
    q.includes('buy') ||
    q.includes('purchase') ||
    q.includes('add to cart') ||
    q.includes('cart') ||
    q.includes('want');

  const qtyMatch = q.match(/(?:order|buy|get|want)\s+(\d+)/i) || q.match(/(\d+)\s+(?:unit|piece|units|pieces|pair|pairs)/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

  let matchedProduct = allProducts.find((p) => q.includes(p.id.toLowerCase()));
  if (!matchedProduct) {
    matchedProduct = allProducts.find((p) => q.includes(p.name.toLowerCase()));
  }
  if (!matchedProduct) {
    if (q.includes('earbud') || q.includes('audio') || q.includes('aurapods') || q.includes('headphone')) {
      matchedProduct = allProducts.find((p) => p.category === 'Audio') || allProducts[0];
    } else if (q.includes('keyboard') || q.includes('mech')) {
      matchedProduct = allProducts.find((p) => p.id === 'prod_keyboard_rgb') || allProducts[1];
    } else if (q.includes('watch') || q.includes('smartwatch')) {
      matchedProduct = allProducts.find((p) => p.category === 'Wearables') || allProducts[2];
    } else if (q.includes('ssd') || q.includes('storage') || q.includes('drive')) {
      matchedProduct = allProducts.find((p) => p.category === 'Storage') || allProducts[3];
    } else if (q.includes('hub') || q.includes('usb')) {
      matchedProduct = allProducts.find((p) => p.id === 'prod_usbc_hub') || allProducts[4];
    } else if (q.includes('webcam') || q.includes('camera')) {
      matchedProduct = allProducts.find((p) => p.id === 'prod_webcam_4k') || allProducts[5];
    } else if (q.includes('mouse') || q.includes('gaming')) {
      matchedProduct = allProducts.find((p) => p.category === 'Gaming') || allProducts[6];
    }
  }

  if (isOrderIntent && matchedProduct) {
    const cart = await executeProposeCart({
      items: [{ productId: matchedProduct.id, quantity }],
    });

    console.log(`⏱️ [TIMING: SMART_PARSER_ORDER] Completed in ${(performance.now() - t0).toFixed(1)}ms`);
    return {
      response: `🛒 I have prepared an order proposal for **${quantity}x ${matchedProduct.name}** at **₹${((matchedProduct.price * quantity) / 100).toLocaleString('en-IN')}**.\n\nPlease review the cart details below and click **"Approve & Pay with Razorpay"** to complete your purchase!`,
      cart,
      history: [],
    };
  }

  const matchingProducts = allProducts.filter(
    (p) =>
      q.includes(p.category.toLowerCase()) ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
  );

  const listToShow = matchingProducts.length > 0 ? matchingProducts.slice(0, 3) : allProducts.slice(0, 3);
  const itemsText = listToShow
    .map((p) => `• **${p.name}** — ₹${p.displayPrice.toLocaleString('en-IN')} (${p.rating}★)\n  _${p.description}_`)
    .join('\n\n');

  console.log(`⏱️ [TIMING: SMART_PARSER_REC] Recommendations generated in ${(performance.now() - t0).toFixed(1)}ms`);
  return {
    response: `Here are top recommendations from our catalog:\n\n${itemsText}\n\n👉 *Tell me "Order [Item Name]" to immediately create an order proposal!*`,
    cart: null,
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

  // 1. Try Groq LPU (Ultra-low latency, sub-500ms response)
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

          const tGroqFollow0 = performance.now();
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
            console.log(`⏱️ [TIMING: GROQ_SECOND_PASS] Finished in ${(performance.now() - tGroqFollow0).toFixed(1)}ms`);
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
      console.warn('⚠️ [GROQ ERROR] Falling back to OpenRouter...', groqErr);
    }
  }

  // 2. Try OpenRouter
  if (openRouterApiKey && openRouterApiKey.trim().startsWith('sk-or-')) {
    const tOr0 = performance.now();
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
        console.log(`⏱️ [TIMING: OPENROUTER_PASS] Completed in ${(performance.now() - tOr0).toFixed(1)}ms`);

        let proposedCart: Cart | null = null;

        if (message?.tool_calls && message.tool_calls.length > 0) {
          const toolResults = [];
          for (const call of message.tool_calls) {
            const funcName = call.function.name;
            const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;

            let result: unknown;
            if (funcName === 'search_products') {
              result = await executeSearchProducts(args);
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
    } catch (orErr) {
      console.warn('⚠️ [OPENROUTER ERROR]', orErr);
    }
  }

  // 3. Ultra-fast local fallback (< 5ms)
  const fallbackResult = await runFallbackParser(userMessage);
  console.log(`🚀 [AI AGENT TOTAL: FALLBACK] Total latency: ${(performance.now() - totalStart).toFixed(1)}ms\n`);
  return fallbackResult;
}
