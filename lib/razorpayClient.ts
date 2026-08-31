'use client';

/**
 * Client-side Razorpay Checkout Helper.
 * 
 * Securely triggers the Razorpay modal using the public Key ID (rzp_test_...)
 * and submits authorized payment data to /api/payments/verify.
 */

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (data?: unknown) => void) => void;
    };
  }
}

export interface LaunchCheckoutParams {
  orderId: string;
  razorpayOrderId: string;
  amount: number;       // in paise (e.g. 499800 = ₹4,998)
  currency?: string;    // e.g. "INR"
  onSuccess: (data: { orderId: string; razorpayOrderId: string; razorpayPaymentId: string }) => void;
  onError?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

/**
 * Dynamically loads the Razorpay checkout.js script if not already loaded.
 */
export function ensureRazorpayScriptLoaded(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    // Check if script element already exists
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => {
        resolve(true);
      });
      existing.addEventListener('error', () => {
        resolve(false);
      });
      if (window.Razorpay) {
        resolve(true);
        return;
      }
    }

    console.log('⏳ [RAZORPAY SDK] Dynamically injecting https://checkout.razorpay.com/v1/checkout.js...');
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('✅ [RAZORPAY SDK] Script loaded successfully into DOM.');
      resolve(true);
    };
    script.onerror = () => {
      console.error('❌ [RAZORPAY SDK] Failed to load checkout.js from CDN.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  orderId,
  razorpayOrderId,
  amount,
  currency = 'INR',
  onSuccess,
  onError,
  onDismiss,
}: LaunchCheckoutParams): Promise<boolean> {
  console.log(`\n💳 [CLIENT CHECKOUT] Initializing Razorpay Checkout Modal...`);
  console.log(`   Internal Order ID: ${orderId}`);
  console.log(`   Razorpay Order ID: ${razorpayOrderId}`);
  console.log(`   Amount: ₹${amount / 100} (${amount} paise)`);

  // 1. Ensure Razorpay SDK is fully loaded
  const isLoaded = await ensureRazorpayScriptLoaded();
  if (!isLoaded || !window.Razorpay) {
    const errorMsg = 'Razorpay payment gateway failed to load. Please check your internet connection and refresh.';
    console.error('❌ [CLIENT CHECKOUT] Error:', errorMsg);
    onError?.(errorMsg);
    return false;
  }

  // 2. Resolve Public Key ID with fallback
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TWFIWyJbeifjwU';
  console.log(`   Using Key ID: ${keyId}`);

  // 3. Construct Checkout Options (Verified against Razorpay Checkout API)
  const options = {
    key: keyId, // Public Key ID ONLY
    amount: amount,
    currency: currency || 'INR',
    name: 'PrimeStore AI Commerce',
    description: `Payment for Order #${orderId}`,
    order_id: razorpayOrderId,
    handler: async (response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      console.log('✅ [CLIENT CHECKOUT] Payment authorized in modal! Submitting for signature verification...', response);
      try {
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verifyData.error || 'Server rejected payment signature');
        }

        console.log('🎉 [CLIENT CHECKOUT] Payment verified server-side! Order successfully completed.');
        onSuccess({
          orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment verification failed';
        console.error('❌ [CLIENT CHECKOUT] Verification error:', errorMsg);
        onError?.(errorMsg);
      }
    },
    prefill: {
      name: 'Test Customer',
      email: 'customer@primestore.com',
      contact: '9876543210',
    },
    theme: {
      color: '#ff9900',
    },
    modal: {
      ondismiss: () => {
        console.log('ℹ️ [CLIENT CHECKOUT] Customer dismissed or closed the checkout modal.');
        onDismiss?.();
      },
    },
  };

  // 4. Instantiate & Open
  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (failData) => {
      console.warn('⚠️ [CLIENT CHECKOUT] Payment failed inside modal:', failData);
      onError?.('Payment failed or was declined in modal.');
    });

    console.log('🚀 [CLIENT CHECKOUT] Executing rzp.open()...');
    rzp.open();
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to instantiate Razorpay modal';
    console.error('❌ [CLIENT CHECKOUT] Exception during rzp.open():', err);
    onError?.(errorMsg);
    return false;
  }
}
