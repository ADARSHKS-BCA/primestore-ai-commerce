'use client';

import { useState } from 'react';
import { openRazorpayCheckout } from '@/lib/razorpayClient';

interface CheckoutButtonProps {
  orderId: string;
  razorpayOrderId: string;
  amount: number;       // in paise
  currency: string;
  onSuccess: () => void;
  autoOpen?: boolean;
}

export default function CheckoutButton({
  orderId,
  razorpayOrderId,
  amount,
  currency,
  onSuccess,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const opened = await openRazorpayCheckout({
        orderId,
        razorpayOrderId,
        amount,
        currency,
        onSuccess: () => {
          setLoading(false);
          onSuccess();
        },
        onError: (errMsg) => {
          setLoading(false);
          setError(errMsg);
        },
        onDismiss: () => {
          setLoading(false);
        },
      });

      if (!opened) {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Checkout failed');
    }
  };

  return (
    <div className="checkout-section">
      {error && <div className="cart-error">⚠️ {error}</div>}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="btn btn-checkout"
      >
        {loading ? '⏳ Opening Gateway...' : `💳 Pay ₹${(amount / 100).toLocaleString('en-IN')} with Razorpay`}
      </button>
      <p className="checkout-note">
        🔒 Powered by Razorpay Secured Test Sandbox
      </p>
    </div>
  );
}
