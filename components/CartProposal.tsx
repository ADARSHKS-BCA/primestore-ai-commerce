'use client';

import { useState } from 'react';
import { Cart } from '@/lib/schemas';
import { openRazorpayCheckout } from '@/lib/razorpayClient';

interface CartProposalProps {
  cart: Cart;
  onPaymentSuccess?: (paymentDetails?: { razorpayOrderId: string; razorpayPaymentId: string }) => void;
  onPaymentFailure?: (reason: string) => void;
}

export default function CartProposal({ cart, onPaymentSuccess, onPaymentFailure }: CartProposalProps) {
  const [status, setStatus] = useState<string>(cart.status);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launchPayment = async (order: {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  }) => {
    setError(null);
    await openRazorpayCheckout({
      orderId: order.orderId,
      razorpayOrderId: order.razorpayOrderId,
      amount: order.amount,
      currency: order.currency,
      onSuccess: (data) => {
        setStatus('checked_out');
        onPaymentSuccess?.({
          razorpayOrderId: data.razorpayOrderId,
          razorpayPaymentId: data.razorpayPaymentId,
        });
      },
      onError: (err) => {
        setError(err);
        setStatus('payment_failed');
        onPaymentFailure?.(err);
      },
      onDismiss: () => {
        console.log('User closed modal, ready to re-open');
        setStatus('payment_failed');
        onPaymentFailure?.('Checkout window closed before payment was completed');
      },
    });
  };

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`💳 [UI Cart] Approving cart: ${cart.id}`);
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: cart.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      console.log('✅ [UI Cart] Order created. Opening Razorpay modal immediately...', data);
      setStatus('approved');
      setOrderData(data);

      // Launch Razorpay modal immediately
      launchPayment(data);
    } catch (err) {
      console.error('❌ [UI Cart] Approval error:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve order');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`❌ [UI Cart] Rejecting cart: ${cart.id}`);
      const res = await fetch('/api/orders/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: cart.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      console.log('✅ [UI Cart] Cart marked rejected.');
      setStatus('rejected');
    } catch (err) {
      console.error('❌ [UI Cart] Rejection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject cart');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-cart-proposal">
      <div className="proposal-header">
        <div className="proposal-title-box">
          <div>
            <h4 className="proposal-title">AI Order Proposal</h4>
            <span className="proposal-subtitle">Review items before creating order</span>
          </div>
        </div>
        <span className={`status-badge status-${status}`}>{status}</span>
      </div>

      <div className="proposal-items-list">
        {cart.items.map((item, i) => (
          <div key={i} className="proposal-item-row">
            <div className="item-details">
              <span className="item-name">{item.name}</span>
              <span className="item-meta">
                Qty: <strong>{item.quantity}</strong> × ₹{(item.price / 100).toLocaleString('en-IN')}
              </span>
            </div>
            <span className="item-subtotal">
              ₹{((item.price * item.quantity) / 100).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>

      <div className="proposal-total-row">
        <span>Order Total</span>
        <span className="proposal-total-amount">₹{cart.totalDisplay.toLocaleString('en-IN')}</span>
      </div>

      {error && <div className="cart-error">{error}</div>}

      {status === 'proposed' && (
        <div className="proposal-actions">
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="btn-proposal-approve"
          >
            {loading ? 'Preparing Razorpay Checkout...' : 'Approve & Pay with Razorpay'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="btn-proposal-reject"
          >
            {loading ? '...' : 'Reject'}
          </button>
        </div>
      )}

      {(status === 'approved' || status === 'payment_failed') && orderData && (
        <div className="checkout-trigger-container">
          <div className="approval-confirmed-banner" style={status === 'payment_failed' ? { borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.1)' } : undefined}>
            {status === 'payment_failed'
              ? 'Payment was interrupted or declined. Cart is saved!'
              : `Order #${orderData.orderId} is active (Razorpay: ${orderData.razorpayOrderId})`}
          </div>
          <button
            type="button"
            onClick={() => launchPayment(orderData)}
            className="btn btn-checkout"
            style={status === 'payment_failed' ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' } : undefined}
          >
            {status === 'payment_failed' ? 'Retry Razorpay Payment' : 'Open Razorpay Checkout Modal'} (₹{(orderData.amount / 100).toLocaleString('en-IN')})
          </button>
        </div>
      )}

      {status === 'checked_out' && (
        <div className="cart-success">
          <strong>Payment Successful!</strong> Your order has been placed and verified.
        </div>
      )}

      {status === 'rejected' && (
        <div className="cart-rejected">
          Proposal was rejected. Tell the AI if you want to modify your order.
        </div>
      )}
    </div>
  );
}
