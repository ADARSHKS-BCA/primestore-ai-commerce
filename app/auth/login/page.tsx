'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // Fallback local session for demo
        localStorage.setItem(
          'primestore_user',
          JSON.stringify({
            id: 'demo_user_1',
            email: email || 'shopper@primestore.ai',
            name: 'Demo Shopper',
          })
        );
      }
      router.push('/account');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem(
      'primestore_user',
      JSON.stringify({
        id: 'guest_shopper_1',
        email: 'guest@primestore.ai',
        name: 'Guest Shopper',
      })
    );
    router.push('/account');
  };

  return (
    <div className="auth-card-container">
      <div className="auth-glass-box">
        <div className="auth-header">
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              prime<span style={{ color: 'var(--accent-gold)' }}>store</span>
            </span>
          </Link>
          <h2 style={{ marginTop: '0.75rem' }}>Welcome Back</h2>
          <p>Sign in to view your orders and personalized recommendations</p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid var(--accent-rose)',
              color: 'var(--accent-rose)',
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="auth-form-group">
            <label className="auth-label">Email Address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-auth-primary">
            {loading ? 'Signing in...' : 'Sign In to PrimeStore'}
          </button>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="btn-auth-guest"
          >
            🚀 Continue as Demo Guest
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
