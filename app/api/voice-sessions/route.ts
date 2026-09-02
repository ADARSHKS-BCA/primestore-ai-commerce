import { NextResponse } from 'next/server';
import { saveAuditLog } from '@/lib/dbStore';
import { COLLECTIONS } from '@/lib/constants';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/voice-sessions — Save a completed voice session log
 * GET  /api/voice-sessions — Retrieve voice session logs (with optional filters)
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.id || !body.transcript) {
      return NextResponse.json({ error: 'id and transcript are required' }, { status: 400 });
    }

    // Sanitize: strip any payment-related data from transcript
    const sanitizedTranscript = body.transcript.map(
      (entry: { role: string; text: string; timestamp: string; intent?: string; slots?: Record<string, unknown>; state?: string }) => {
        // Remove any potential card/CVV/PIN data from text
        const cleanText = entry.text
          .replace(/\b\d{13,19}\b/g, '[REDACTED]')   // Card numbers
          .replace(/\b\d{3,4}\b(?=\s*cvv)/gi, '[REDACTED]') // CVV
          .replace(/\bpin\s*:?\s*\d{4,6}\b/gi, '[REDACTED]'); // PINs

        return {
          role: entry.role,
          text: cleanText,
          timestamp: entry.timestamp,
          intent: entry.intent,
          state: entry.state,
          // Explicitly exclude slots that might contain sensitive data
          slots: entry.slots ? sanitizeSlots(entry.slots) : undefined,
        };
      }
    );

    const sessionLog = {
      id: body.id,
      userId: body.userId || null,
      userName: body.userName || null,
      startedAt: body.startedAt,
      endedAt: body.endedAt || new Date().toISOString(),
      transcript: sanitizedTranscript,
      outcome: body.outcome || 'abandoned',
      orderId: body.orderId || null,
      statesVisited: body.statesVisited || [],
    };

    // Save to Firestore voice_sessions collection
    if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
      try {
        await adminDb.collection(COLLECTIONS.VOICE_SESSIONS).doc(sessionLog.id).set(sessionLog);
        console.log(`[VoiceSessions] Saved session ${sessionLog.id} to Firestore`);
      } catch (err) {
        console.warn('[VoiceSessions] Firestore write failed, logging to audit instead:', err);
      }
    }

    // Also write a summary audit log entry
    await saveAuditLog({
      id: `audit_vs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date(),
      actor: 'system',
      action: 'voice_session_completed',
      details: {
        sessionId: sessionLog.id,
        outcome: sessionLog.outcome,
        turnCount: sanitizedTranscript.length,
        statesVisited: sessionLog.statesVisited,
        orderId: sessionLog.orderId,
      },
      status: sessionLog.outcome === 'order_placed' ? 'executed' : 'executed',
      userId: sessionLog.userId || undefined,
      relatedOrderId: sessionLog.orderId || undefined,
    });

    return NextResponse.json({ success: true, id: sessionLog.id });
  } catch (error) {
    console.error('[VoiceSessions] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save voice session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const sessions: unknown[] = [];

    if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
      try {
        const snapshot = await adminDb
          .collection('voice_sessions')
          .orderBy('startedAt', 'desc')
          .limit(50)
          .get();

        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            sessions.push(doc.data());
          }
        }
      } catch {
        console.warn('[VoiceSessions] Firestore read failed, returning empty');
      }
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[VoiceSessions] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voice sessions' },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function sanitizeSlots(slots: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(slots)) {
    // Never log anything that looks like payment data
    if (/card|cvv|pin|secret|password|token/i.test(key)) continue;
    safe[key] = value;
  }
  return safe;
}
