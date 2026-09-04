'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { CustomerOrder } from '@/lib/supabaseStore';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchUserDataAndOrders = async (userId: string, isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      // Fetch user profile from Supabase
      const profileRes = await fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`);
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.profile) {
          if (data.profile.fullName) setFullName(data.profile.fullName);
          if (data.profile.phone) setPhone(data.profile.phone);
          if (data.profile.address) setAddress(data.profile.address);
        }
      }

      // Fetch user order history from Supabase / Firestore
      const ordersRes = await fetch(`/api/orders/user?userId=${encodeURIComponent(userId)}`);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        if (data.orders && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (err) {
      console.warn('Auto-refresh sync error:', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('primestore_user');
    if (!savedUser) {
      router.replace('/auth/login');
      return;
    }

    let currentUser: { id: string; email: string; name: string };
    try {
      currentUser = JSON.parse(savedUser);
    } catch {
      router.replace('/auth/login');
      return;
    }

    setUser(currentUser);
    setFullName(currentUser.name || '');
    setEmail(currentUser.email || '');

    fetchUserDataAndOrders(currentUser.id);

    // Auto-refresh interval (every 10 seconds)
    const interval = setInterval(() => {
      if (autoRefresh && document.visibilityState === 'visible') {
        fetchUserDataAndOrders(currentUser.id);
      }
    }, 10000);

    // Auto-refresh on tab focus / visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUserDataAndOrders(currentUser.id);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [router, autoRefresh]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileSavedMsg(false);

    const updatedUser = {
      ...user,
      name: fullName.trim() || 'Shopper',
      email: email.trim(),
    };

    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: updatedUser.email,
          fullName: updatedUser.name,
          phone,
          address,
        }),
      });

      localStorage.setItem('primestore_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setProfileSavedMsg(true);
      setTimeout(() => setProfileSavedMsg(false), 3500);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('primestore_user');
    router.push('/auth/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '4rem' }}>
      {/* Header Bar */}
      <header className="navbar-container">
        <div className="navbar-top">
          <Link href="/" className="brand-logo">
            <span>prime<span className="brand-highlight">store</span></span>
            <span className="brand-badge">Account</span>
          </Link>

          <div className="navbar-actions">
            <ThemeToggle />
            <Link href="/" className="nav-link-btn">
              Storefront
            </Link>
            <Link href="/dashboard" className="nav-link-btn">
              Dashboard
            </Link>
            <button onClick={handleLogout} className="nav-link-btn" style={{ color: 'var(--accent-rose)' }}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Account Dashboard */}
      <main className="account-dashboard-page" style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* User Profile Overview */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--bg-card), var(--bg-secondary))',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                color: '#ffffff',
                fontWeight: 800,
              }}
            >
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {user?.name || 'Shopper'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                {user?.email || 'customer@primestore.ai'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Orders
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {orders.length}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            marginBottom: '2.5rem',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Profile Details
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Update your contact info and default delivery address used for voice checkout.
            </p>
          </div>

          {profileSavedMsg && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
              }}
            >
              Profile successfully updated!
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="auth-form-group">
                <label className="auth-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="auth-input"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="auth-input"
                  placeholder="9876543210"
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Delivery Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="auth-input"
                  placeholder="Flat / House No, Street, City, State - PIN"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn-auth-primary"
              style={{ width: 'auto', padding: '0.65rem 1.75rem', cursor: 'pointer' }}
            >
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Section Header */}
        <div className="account-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Order & Payment History
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Real-time records for your account backed by Supabase & Razorpay Test Mode.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                background: autoRefresh ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                border: `1px solid ${autoRefresh ? '#10b981' : 'var(--border-color)'}`,
                color: autoRefresh ? '#10b981' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: autoRefresh ? '#10b981' : 'var(--text-muted)' }} />
              {autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: PAUSED'}
            </button>

            <button
              onClick={() => user?.id && fetchUserDataAndOrders(user.id, true)}
              disabled={refreshing}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {refreshing ? 'Syncing...' : 'Refresh Now'}
            </button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading your orders...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3.5rem 2rem',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>No orders placed yet</h4>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.88rem' }}>
              Use our AI Shopping Copilot on the storefront to place your first order.
            </p>
            <Link
              href="/"
              className="btn-auth-primary"
              style={{ display: 'inline-block', width: 'auto', padding: '0.65rem 1.5rem', marginTop: '1rem', textDecoration: 'none' }}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map((order) => (
              <div key={order.id} className="order-history-card">
                <div className="order-card-top">
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ORDER #{order.id} • {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {order.razorpayPaymentId && (
                      <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                        Razorpay ID: {order.razorpayPaymentId}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        background: order.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: order.status === 'paid' ? '#10b981' : '#f59e0b',
                        border: `1px solid ${order.status === 'paid' ? '#10b981' : '#f59e0b'}`,
                      }}
                    >
                      {order.status}
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹{order.totalDisplay.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Item Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.88rem',
                        padding: '0.4rem 0',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.quantity}x</strong> {item.name}
                      </div>
                      <div>₹{((item.price * item.quantity) / 100).toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
