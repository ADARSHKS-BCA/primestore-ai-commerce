'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (supabase) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
      } else {
        // Local fallback
        localStorage.setItem(
          'primestore_user',
          JSON.stringify({
            id: `user_${Date.now()}`,
            email,
            name: fullName || 'New Shopper',
          })
        );
      }
      router.push('/account');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
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
          <h2 style={{ marginTop: '0.75rem' }}>Create an Account</h2>
          <p>Join PrimeStore for AI-assisted shopping and 1-click checkout</p>
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

        <form onSubmit={handleSignup}>
          <div className="auth-form-group">
            <label className="auth-label">Full Name</label>
            <input
              type="text"
              required
              placeholder="Adarsh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="auth-input"
            />
          </div>

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
            {loading ? 'Creating Account...' : 'Create PrimeStore Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
