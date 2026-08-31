import { saveAuditLog } from './dbStore';
import { AuditActor, AuditStatus, AuditLogEntry } from './schemas';

/**
 * Helper to write audit log entries to Firestore with resilient in-memory fallback.
 * Every AI/human/system action flows through this function.
 */
export async function writeAuditLog(params: {
  actor: AuditActor;
  action: string;
  details: Record<string, unknown>;
  status: AuditStatus;
  userId?: string;
  relatedCartId?: string;
  relatedOrderId?: string;
}): Promise<string> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const entry: AuditLogEntry = {
    id,
    timestamp: new Date(),
    actor: params.actor,
    action: params.action,
    details: params.details,
    status: params.status,
    userId: params.userId,
    relatedCartId: params.relatedCartId,
    relatedOrderId: params.relatedOrderId,
  };

  await saveAuditLog(entry);
  return id;
}
