import { NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/dbStore';

export async function GET() {
  try {
    const logs = await getAuditLogs();
    console.log(`📋 [GET /api/audit] Returned ${logs.length} audit log entries.`);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
