'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { CustomerOrder } from '@/lib/supabaseStore';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check user session
    const savedUser = localStorage.getItem('primestore_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      // Default demo guest session if none
      const defaultUser = {
        id: 'user_adarsh_1',
        email: 'adarsh@primestore.ai',
        name: 'Adarsh Kumar (Prime Member)',
      };
      setUser(defaultUser);
      localStorage.setItem('primestore_user', JSON.stringify(defaultUser));
    }

    // Fetch user order history
    fetch('/api/orders/user')
      .then((res) => res.json())
      .then((data) => {
        if (data.orders) {
          setOrders(data.orders);
        }
      })
      .catch((err) => console.warn('Failed to load orders:', err))
      .finally(() => setLoading(false));
  }, []);

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
              🛍️ Storefront
            </Link>
            <Link href="/dashboard" className="nav-link-btn">
              🏪 Dashboard
            </Link>
            <button onClick={handleLogout} className="nav-link-btn" style={{ color: 'var(--accent-rose)' }}>
              🚪 Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Account Dashboard */}
      <main className="account-dashboard-page">
        {/* User Profile Banner */}
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
              {user?.name?.[0] || 'U'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {user?.name || 'Valued Prime Customer'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {user?.email || 'customer@primestore.ai'} • ⚡ Verified Shopper
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Orders
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {orders.length}
              </div>
            </div>
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Membership
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                Prime VIP
              </div>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="account-header">
          <div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              📦 Order &amp; Payment History
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Real-time records backed by Supabase &amp; Razorpay Test Mode
            </p>
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
              padding: '4rem 2rem',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
            <h4>No orders placed yet</h4>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Use our AI Shopping Copilot on the storefront to make your first purchase!
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
          <div>
            {orders.map((order) => (
              <div key={order.id} className="order-history-card">
                <div className="order-card-top">
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ORDER #{order.id} • {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {order.razorpayPaymentId && (
                      <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                        💳 Razorpay ID: {order.razorpayPaymentId}
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
                      ● {order.status}
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹{order.totalDisplay.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Item Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
