import { NextResponse } from 'next/server';
import { runAgentChat } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationHistory } = body;

    console.log(`\n📥 [POST /api/agent/chat] Incoming message: "${message}"`);

    if (!message || typeof message !== 'string') {
      console.warn('⚠️ [POST /api/agent/chat] Invalid or missing message');
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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
