'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { clientDb } from '@/lib/firebaseClient';
import { COLLECTIONS } from '@/lib/constants';
import CheckoutButton from './CheckoutButton';
import { openRazorpayCheckout } from '@/lib/razorpayClient';

interface CartEntry {
  id: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  totalPaise: number;
  totalDisplay: number;
  status: string;
  createdAt: string | { seconds: number };
}

export default function ApprovalQueue() {
  const [pendingCarts, setPendingCarts] = useState<CartEntry[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<Record<string, {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(clientDb, COLLECTIONS.CARTS),
      where('status', 'in', ['proposed', 'approved']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const carts = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          } as CartEntry;
        });
        setPendingCarts(carts);
      },
      (error) => {
        console.error('Approval queue subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleApprove = async (cartId: string) => {
    setProcessing(cartId);
    setError(null);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOrderData(prev => ({ ...prev, [cartId]: data }));

      // Automatically launch checkout modal
      await openRazorpayCheckout({
        orderId: data.orderId,
        razorpayOrderId: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        onSuccess: () => {
          console.log('Payment completed from merchant approval queue');
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (cartId: string) => {
    setProcessing(cartId);
    setError(null);
    try {
      const res = await fetch('/api/orders/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (ts: string | { seconds: number }) => {
    try {
      const date = typeof ts === 'string' ? new Date(ts) : new Date(ts.seconds * 1000);
      return date.toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="approval-queue-section">
      <h2>🔔 Pending Approvals</h2>

      {error && <div className="cart-error">⚠️ {error}</div>}

      {pendingCarts.length === 0 ? (
        <p className="audit-empty">No pending carts. AI cart proposals will appear here.</p>
      ) : (
        <div className="approval-cards">
          {pendingCarts.map((cart) => (
            <div key={cart.id} className="approval-card">
              <div className="approval-card-header">
                <span className="approval-time">{formatTime(cart.createdAt)}</span>
                <span className={`status-badge status-${cart.status}`}>
                  {cart.status}
                </span>
              </div>

              <table className="cart-table cart-table-compact">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>₹{((item.price * item.quantity) / 100).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>Total</strong></td>
                    <td><strong>₹{cart.totalDisplay.toLocaleString('en-IN')}</strong></td>
                  </tr>
                </tfoot>
              </table>

              {cart.status === 'proposed' && (
                <div className="cart-actions">
                  <button
                    onClick={() => handleApprove(cart.id)}
                    disabled={processing === cart.id}
                    className="btn btn-approve"
                  >
                    {processing === cart.id ? '⏳' : '✅ Approve & Pay'}
                  </button>
                  <button
                    onClick={() => handleReject(cart.id)}
                    disabled={processing === cart.id}
                    className="btn btn-reject"
                  >
                    {processing === cart.id ? '⏳' : '❌ Reject'}
                  </button>
                </div>
              )}

              {cart.status === 'approved' && orderData[cart.id] && (
                <CheckoutButton
                  orderId={orderData[cart.id].orderId}
                  razorpayOrderId={orderData[cart.id].razorpayOrderId}
                  amount={orderData[cart.id].amount}
                  currency={orderData[cart.id].currency}
                  onSuccess={() => {}}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
