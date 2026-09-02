/**
 * VoiceSessionLogger — Accumulates voice session transcript and writes
 * completed sessions to the Firestore `voice_sessions` collection.
 *
 * Used by FloatingAssistant to log every voice interaction for admin audit.
 */

import { VoiceSession, TranscriptEntry } from './voiceStateMachine';
import { VoiceSessionLog } from './schemas';

export type { VoiceSessionLog };

/**
 * Convert a VoiceSession into a serializable VoiceSessionLog.
 */
export function buildSessionLog(
  session: VoiceSession,
  outcome: 'order_placed' | 'abandoned' | 'payment_failed' | 'error',
  orderId: string | null,
  razorpayOrderId?: string | null,
  razorpayPaymentId?: string | null
): VoiceSessionLog {
  const statesVisited = session.transcript
    .filter((t) => t.state)
    .map((t) => t.state as string);
  const uniqueStates = [...new Set(statesVisited)];

  const total = session.cart?.totalDisplay || session.selectedProduct?.displayPrice || null;

  return {
    id: session.sessionId,
    userId: session.userId,
    userName: session.userName,
    startedAt: session.startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    transcript: session.transcript.map((t: TranscriptEntry) => ({
      role: t.role,
      text: t.text,
      timestamp: t.timestamp.toISOString(),
      intent: t.intent,
      slots: t.slots,
      state: t.state,
      reasoning: t.reasoning,
    })),
    outcome,
    orderId,
    razorpayOrderId: razorpayOrderId || null,
    razorpayPaymentId: razorpayPaymentId || null,
    statesVisited: uniqueStates,
    upsellOffered: session.upsellOffered,
    upsellAccepted: session.upsellAccepted ?? undefined,
    upsellItem: session.upsellItem
      ? { name: session.upsellItem.name, displayPrice: session.upsellItem.displayPrice }
      : null,
    orderTotalDisplay: total,
  };
}

/**
 * Save a completed voice session log via the API.
 */
export async function saveVoiceSessionLog(log: VoiceSessionLog): Promise<void> {
  try {
    const res = await fetch('/api/voice-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) {
      console.warn('[VoiceSessionLogger] Failed to save session log:', await res.text());
    } else {
      console.log(`[VoiceSessionLogger] Session ${log.id} saved (outcome: ${log.outcome}, upsell: ${log.upsellAccepted ? 'accepted' : 'declined/none'})`);
    }
  } catch (err) {
    console.warn('[VoiceSessionLogger] Error saving session log:', err);
  }
}
