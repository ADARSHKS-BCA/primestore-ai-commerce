'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { clientDb } from '@/lib/firebaseClient';
import { COLLECTIONS } from '@/lib/constants';

interface AuditEntry {
  id: string;
  timestamp: string | { seconds: number; nanoseconds: number };
  actor: string;
  action: string;
  details: Record<string, unknown>;
  status: string;
  relatedCartId?: string;
  relatedOrderId?: string;
}

export default function AuditLogTable() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [useRealtime, setUseRealtime] = useState(true);

  useEffect(() => {
    if (useRealtime) {
      // Real-time Firestore subscription
      const q = query(
        collection(clientDb, COLLECTIONS.AUDIT_LOGS),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const entries = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate?.()
                ? data.timestamp.toDate().toISOString()
                : data.timestamp,
            } as AuditEntry;
          });
          setLogs(entries);
        },
        (error) => {
          console.error('Realtime subscription error:', error);
          setUseRealtime(false);
        }
      );

      return () => unsubscribe();
    } else {
      // Fallback: poll via API
      const fetchLogs = async () => {
        try {
          const res = await fetch('/api/audit');
          const data = await res.json();
          setLogs(data.logs || []);
        } catch (error) {
          console.error('Failed to fetch audit logs:', error);
        }
      };
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [useRealtime]);

  const formatTime = (ts: string | { seconds: number }) => {
    try {
      const date = typeof ts === 'string' ? new Date(ts) : new Date(ts.seconds * 1000);
      return date.toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'proposed': return 'status-proposed';
      case 'approved': return 'status-approved';
      case 'executed': return 'status-executed';
      case 'rejected': return 'status-rejected';
      case 'failed': return 'status-failed';
      default: return '';
    }
  };

  const getActorEmoji = (actor: string) => {
    switch (actor) {
      case 'ai': return '🤖';
      case 'human': return '👤';
      case 'system': return '⚙️';
      default: return '❓';
    }
  };

  return (
    <div className="audit-log-section">
      <div className="audit-header">
        <h2>Audit Trail</h2>
        <span className="realtime-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: useRealtime ? '#10b981' : '#f59e0b' }} />
          {useRealtime ? 'Live Real-time' : 'Polling Sync'}
        </span>
      </div>

      {logs.length === 0 ? (
        <p className="audit-empty">No audit entries yet. Interact with the AI to generate activity.</p>
      ) : (
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="audit-time">{formatTime(log.timestamp)}</td>
                  <td>{getActorEmoji(log.actor)} {log.actor}</td>
                  <td className="audit-action">{log.action}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="audit-details">
                    <code>{JSON.stringify(log.details, null, 0)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
