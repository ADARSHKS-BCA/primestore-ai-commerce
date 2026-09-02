import AuditLogTable from '@/components/AuditLogTable';
import ApprovalQueue from '@/components/ApprovalQueue';
import VoiceSessionTable from '@/components/VoiceSessionTable';

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>🏪 Merchant Dashboard</h1>
        <a href="/" className="nav-link">← Back to Shop</a>
      </header>

      <div className="dashboard-grid">
        <ApprovalQueue />
        <AuditLogTable />
      </div>

      {/* Voice Session Audit Trail */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem 2rem' }}>
        <VoiceSessionTable />
      </div>
    </div>
  );
}

