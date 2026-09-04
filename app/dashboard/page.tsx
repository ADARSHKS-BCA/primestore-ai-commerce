'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuditLogTable from '@/components/AuditLogTable';
import ApprovalQueue from '@/components/ApprovalQueue';
import VoiceSessionTable from '@/components/VoiceSessionTable';
import ThemeToggle from '@/components/ThemeToggle';

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleManualRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <header className="navbar-container">
        <div className="navbar-top">
          <Link href="/" className="brand-logo">
            <span>prime<span className="brand-highlight">store</span></span>
            <span className="brand-badge">Merchant Console</span>
          </Link>

          <div className="navbar-actions">
            <ThemeToggle />
            <button
              onClick={handleManualRefresh}
              className="nav-link-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              Auto-Sync Active (Refresh)
            </button>
            <Link href="/" className="nav-link-btn">
              Storefront
            </Link>
            <Link href="/account" className="nav-link-btn">
              Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '1300px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Merchant Dashboard &amp; Real-Time Audit
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Live pending orders, Firestore approval queue, Supabase audit stream, and AI explainable logs.
          </p>
        </div>

        <div key={refreshKey} className="dashboard-grid">
          <ApprovalQueue />
          <AuditLogTable />
        </div>

        {/* Voice Session Audit Trail */}
        <div style={{ marginTop: '2rem' }}>
          <VoiceSessionTable key={`voice-${refreshKey}`} />
        </div>
      </div>
    </div>
  );
}


