'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CatalogProduct } from '@/lib/productsData';
import { openRazorpayCheckout } from '@/lib/razorpayClient';

export interface CartItemData {
  productId: string;
  name: string;
  brand: string;
  price: number; // in paise
  displayPrice: number; // in rupees
  imageUrl: string;
  quantity: number;
  category?: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItemData[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onPaymentSuccess?: (orderId: string, razorpayPaymentId: string) => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPaymentSuccess,
}: CartDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalPaise = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDisplay = totalPaise / 100;
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (items.length === 0 || loading) return;
    setLoading(true);
    setErrorMsg(null);
    setCheckoutSuccess(null);

    try {
      const savedUser = typeof window !== 'undefined' ? localStorage.getItem('primestore_user') : null;
      let userId: string | undefined = undefined;
      if (savedUser) {
        try {
          userId = JSON.parse(savedUser).id;
        } catch {}
      }

      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize checkout');

      // Launch Razorpay modal
      await openRazorpayCheckout({
        orderId: data.orderId,
        razorpayOrderId: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency || 'INR',
        onSuccess: (paymentData) => {
          setCheckoutSuccess(`Payment Successful! Order #${data.orderId} is confirmed.`);
          onClearCart();
          onPaymentSuccess?.(data.orderId, paymentData.razorpayPaymentId);
        },
        onError: (err) => {
          setErrorMsg(err || 'Payment was declined or cancelled.');
        },
        onDismiss: () => {
          setErrorMsg('Checkout window was closed before completion.');
        },
      });
    } catch (err: unknown) {
      console.error('Cart payment error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        animation: 'fade-in 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
          animation: 'slide-left 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Shopping Cart
            </h3>
            <span
              style={{
                background: 'var(--accent-primary)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Success Alert */}
        {checkoutSuccess && (
          <div
            style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem 1rem',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#10b981',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              fontWeight: 700,
            }}
          >
            {checkoutSuccess}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem 1rem',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid var(--accent-rose)',
              color: 'var(--accent-rose)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.7 }}>🛒</div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Your cart is empty</h4>
              <p style={{ fontSize: '0.85rem', maxWidth: '280px', margin: '0 auto 1.5rem' }}>
                Add products from the catalog to save them for later or checkout instantly.
              </p>
              <button
                onClick={onClose}
                className="btn-auth-primary"
                style={{ width: 'auto', padding: '0.6rem 1.5rem', margin: '0 auto' }}
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((item) => (
                <div
                  key={item.productId}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '0.85rem',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    position: 'relative',
                  }}
                >
                  {/* Item Image */}
                  <div
                    style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {item.brand}
                    </div>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '2px' }}>
                      ₹{item.displayPrice.toLocaleString('en-IN')}
                    </div>

                    {/* Quantity Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, -1)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: '18px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, 1)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveItem(item.productId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      padding: '4px',
                      alignSelf: 'flex-start',
                    }}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer & Checkout Action */}
        {items.length > 0 && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Subtotal ({totalItemCount} items)</span>
              <span>₹{totalDisplay.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Delivery</span>
              <span style={{ color: '#10b981', fontWeight: 700 }}>FREE Instant</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '1px dashed var(--border-color)',
                marginBottom: '1.25rem',
                fontWeight: 800,
                fontSize: '1.1rem',
                color: 'var(--text-primary)',
              }}
            >
              <span>Total Amount</span>
              <span style={{ color: 'var(--accent-gold)' }}>₹{totalDisplay.toLocaleString('en-IN')}</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="btn-auth-primary"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                padding: '0.85rem',
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Preparing Razorpay Checkout...' : `Pay with Razorpay (₹${totalDisplay.toLocaleString('en-IN')})`}
            </button>

            <button
              onClick={onClearCart}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                marginTop: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
