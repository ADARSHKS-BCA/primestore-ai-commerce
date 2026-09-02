'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { clientDb } from '@/lib/firebaseClient';
import { COLLECTIONS } from '@/lib/constants';
import { VoiceSessionLog } from '@/lib/schemas';

export default function VoiceSessionTable() {
  const [sessions, setSessions] = useState<VoiceSessionLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [useRealtime, setUseRealtime] = useState(true);
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'order_placed' | 'upsell_accepted' | 'payment_failed' | 'abandoned'>('all');
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    if (useRealtime) {
      const q = query(
        collection(clientDb, COLLECTIONS.VOICE_SESSIONS),
        orderBy('startedAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const entries = snapshot.docs.map((doc) => doc.data() as VoiceSessionLog);
          setSessions(entries);
        },
        (error) => {
          console.error('Voice sessions realtime error:', error);
          setUseRealtime(false);
        }
      );

      return () => unsubscribe();
    } else {
      const fetchSessions = async () => {
        try {
          const res = await fetch('/api/voice-sessions');
          const data = await res.json();
          setSessions(data.sessions || []);
        } catch (error) {
          console.error('Failed to fetch voice sessions:', error);
        }
      };
      fetchSessions();
      const interval = setInterval(fetchSessions, 10000);
      return () => clearInterval(interval);
    }
  }, [useRealtime]);

  // Growth & Explainability Metrics
  const stats = useMemo(() => {
    const total = sessions.length;
    const ordersPlaced = sessions.filter((s) => s.outcome === 'order_placed').length;
    const upsellsOffered = sessions.filter((s) => s.upsellOffered).length;
    const upsellsAccepted = sessions.filter((s) => s.upsellAccepted).length;
    const upsellRate = upsellsOffered > 0 ? ((upsellsAccepted / upsellsOffered) * 100).toFixed(1) : '0';
    const failuresHandled = sessions.filter((s) => s.outcome === 'payment_failed').length;

    return { total, ordersPlaced, upsellsOffered, upsellsAccepted, upsellRate, failuresHandled };
  }, [sessions]);

  // Filtered Sessions
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (searchUser.trim()) {
        const u = searchUser.toLowerCase();
        const matchesName = (s.userName || '').toLowerCase().includes(u);
        const matchesId = (s.userId || '').toLowerCase().includes(u) || s.id.toLowerCase().includes(u);
        if (!matchesName && !matchesId) return false;
      }

      if (filterOutcome === 'order_placed') return s.outcome === 'order_placed';
      if (filterOutcome === 'upsell_accepted') return s.upsellAccepted === true;
      if (filterOutcome === 'payment_failed') return s.outcome === 'payment_failed';
      if (filterOutcome === 'abandoned') return s.outcome === 'abandoned';
      return true;
    });
  }, [sessions, filterOutcome, searchUser]);

  const formatTime = (ts: string | null) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return 'N/A';
    }
  };

  const getOutcomeBadge = (outcome: string, upsellAccepted?: boolean) => {
    switch (outcome) {
      case 'order_placed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            ✓ Order Placed {upsellAccepted && '🔥 +Upsell'}
          </span>
        );
      case 'payment_failed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            ⚠️ Payment Interrupted (Saved)
          </span>
        );
      case 'abandoned':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            — Abandoned
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(148, 163, 184, 0.15)',
              color: '#94a3b8',
              border: '1px solid rgba(148, 163, 184, 0.3)',
            }}
          >
            {outcome}
          </span>
        );
    }
  };

  return (
    <div style={{ marginTop: '2.5rem' }}>
      {/* Header & Mode Pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎙️ Voice Shopping Audit Trail & AI Growth Logs
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Full explainable turn-by-turn reasoning, bounded-action confirmations, upsell conversions, and payment telemetry.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: useRealtime ? '#10b981' : '#f59e0b',
              boxShadow: useRealtime ? '0 0 8px #10b981' : 'none',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {useRealtime ? 'Live Realtime Stream' : 'Polling Sync'}
          </span>
        </div>
      </div>

      {/* AI Growth & Track Alignment KPI Banners */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Voice Sessions</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Across all shoppers</div>
        </div>

        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Orders Placed</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{stats.ordersPlaced}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Razorpay test-mode verified</div>
        </div>

        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '12px', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: 'rgba(168,85,247,0.15)', borderRadius: '50%', filter: 'blur(10px)' }} />
          <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase' }}>🔥 Upsell Accept Rate</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc', marginTop: '0.25rem' }}>{stats.upsellRate}%</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{stats.upsellsAccepted} of {stats.upsellsOffered} accepted</div>
        </div>

        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#fb7185', fontWeight: 600, textTransform: 'uppercase' }}>Graceful Failures Handled</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fb7185', marginTop: '0.25rem' }}>{stats.failuresHandled}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cart preserved & retry ready</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Filter by user or session ID..."
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          style={{
            flex: '1',
            minWidth: '220px',
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '0.5rem 0.85rem',
            color: '#fff',
            fontSize: '0.85rem',
          }}
        />

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {(
            [
              { key: 'all', label: 'All Sessions' },
              { key: 'order_placed', label: '✓ Orders' },
              { key: 'upsell_accepted', label: '🔥 Upsells Accepted' },
              { key: 'payment_failed', label: '⚠️ Payment Failures' },
              { key: 'abandoned', label: '— Abandoned' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterOutcome(tab.key)}
              style={{
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: filterOutcome === tab.key ? 'var(--primary, #6366f1)' : 'rgba(255,255,255,0.1)',
                background: filterOutcome === tab.key ? 'var(--primary, #6366f1)' : 'var(--bg-card, #1e293b)',
                color: filterOutcome === tab.key ? '#fff' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div
        style={{
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0, 0, 0, 0.2)' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Started</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>User / Session</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Outcome</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Growth (Upsell)</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Razorpay Order / Total</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Turns</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    No voice sessions found matching current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: expandedId === s.id ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {formatTime(s.startedAt)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{s.userName || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{s.id}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getOutcomeBadge(s.outcome, s.upsellAccepted)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                      {s.upsellOffered ? (
                        s.upsellAccepted ? (
                          <span style={{ color: '#c084fc', fontWeight: 600 }}>
                            🔥 Accepted (+₹{s.upsellItem?.displayPrice || '349'})
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Declined (1 turn)</span>
                        )
                      ) : (
                        <span style={{ color: '#64748b' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {s.orderTotalDisplay && (
                        <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                          ₹{s.orderTotalDisplay.toLocaleString('en-IN')}
                        </div>
                      )}
                      {s.razorpayOrderId ? (
                        <div style={{ fontSize: '0.75rem', color: '#10b981', fontFamily: 'monospace' }}>
                          {s.razorpayOrderId}
                        </div>
                      ) : s.orderId ? (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          #{s.orderId.slice(0, 8)}...
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                      {s.transcript?.length || 0} turns
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '0.35rem 0.75rem',
                          color: '#e2e8f0',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {expandedId === s.id ? '▲ Close Audit' : '▼ Inspect Reasoning'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Explainable Audit Drawer */}
      {expandedId && (
        <div
          style={{
            marginTop: '1rem',
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          {(() => {
            const current = sessions.find((s) => s.id === expandedId);
            if (!current) return null;

            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                      🔍 Explainable Audit Log — Session <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{current.id}</span>
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      Started at {formatTime(current.startedAt)} · User: {current.userName || 'Anonymous'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* State Machine Transition Path */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    State Machine Transition Flow
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {current.statesVisited?.map((state, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#a5b4fc',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                        }}
                      >
                        {state}
                        {idx < current.statesVisited.length - 1 && <span style={{ color: '#64748b' }}>→</span>}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Turn-by-Turn Transcript with Explainable Reasoning */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Turn-by-Turn Transcript with Explainable AI Reasoning
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      paddingRight: '0.5rem',
                    }}
                  >
                    {current.transcript?.map((turn, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.6rem 0.85rem',
                          borderRadius: '8px',
                          background:
                            turn.role === 'user'
                              ? 'rgba(56, 189, 248, 0.08)'
                              : 'rgba(255, 255, 255, 0.04)',
                          borderLeft:
                            turn.role === 'user'
                              ? '3px solid #38bdf8'
                              : '3px solid #a855f7',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: turn.role === 'user' ? '#38bdf8' : '#c084fc',
                            }}
                          >
                            {turn.role === 'user' ? '👤 Shopper (Spoken)' : '🤖 PrimeStore Voice Agent'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {formatTime(turn.timestamp)}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {turn.text}
                        </div>

                        {/* Intent & Explainable Reasoning Metadata */}
                        {(turn.intent || turn.reasoning || turn.state) && (
                          <div
                            style={{
                              marginTop: '0.4rem',
                              padding: '0.35rem 0.55rem',
                              background: 'rgba(0, 0, 0, 0.25)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              color: '#94a3b8',
                            }}
                          >
                            {turn.intent && (
                              <span>
                                <strong>Intent:</strong> <code style={{ color: '#38bdf8' }}>{turn.intent}</code>
                              </span>
                            )}
                            {turn.state && (
                              <span>
                                <strong>State:</strong> <code style={{ color: '#a5b4fc' }}>{turn.state}</code>
                              </span>
                            )}
                            {turn.reasoning && (
                              <span style={{ color: '#34d399' }}>
                                💡 <strong>Explainable Logic:</strong> {turn.reasoning}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
