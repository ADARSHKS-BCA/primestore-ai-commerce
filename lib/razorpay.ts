import Razorpay from 'razorpay';

/**
 * Razorpay server-side SDK instance — SERVER-ONLY.
 * 
 * This module must NEVER be imported from client-side code.
 * RAZORPAY_KEY_SECRET must remain server-side at all times.
 */

let razorpayInstance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'Missing Razorpay credentials. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local'
    );
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance;
}
