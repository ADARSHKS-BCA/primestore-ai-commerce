import { NextResponse } from 'next/server';
import { runAgentChat, executeProposeCart } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, items, conversationHistory, userId } = body;

    console.log(`\n📥 [POST /api/agent/chat] Incoming message: "${message || ''}" items:`, items);

    // If explicit items are passed, propose cart directly with zero ambiguity
    if (items && Array.isArray(items) && items.length > 0) {
      const cart = await executeProposeCart({ items, userId });
      const itemNames = cart.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
      return NextResponse.json({
        response: `I have prepared your order proposal for **${itemNames}** at **₹${cart.totalDisplay.toLocaleString('en-IN')}**.\n\nPlease review below and click **"Approve & Pay with Razorpay"** to complete checkout!`,
        cart,
        categoryFilter: null,
        history: [],
      });
    }

    if (!message || typeof message !== 'string') {
      console.warn('⚠️ [POST /api/agent/chat] Invalid or missing message');
      return NextResponse.json({ error: 'Message or items is required' }, { status: 400 });
    }

    const result = await runAgentChat(message, conversationHistory || []);

    console.log(`📤 [POST /api/agent/chat] Success! Cart proposed: ${result.cart ? result.cart.id : 'None'}`);

    return NextResponse.json({
      response: result.response,
      cart: result.cart,
      categoryFilter: (result as { categoryFilter?: string | null }).categoryFilter || null,
      history: result.history,
    });
  } catch (error) {
    console.error('❌ [POST /api/agent/chat] Unhandled error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
