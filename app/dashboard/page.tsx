import AuditLogTable from '@/components/AuditLogTable';
import ApprovalQueue from '@/components/ApprovalQueue';

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
    </div>
  );
}
