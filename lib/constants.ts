/** App-wide constants — single source of truth */

/** Maximum order amount in paise (₹100,000 = 10,000,000 paise) */
export const ORDER_LIMIT_PAISE = 10_000_000;

/** Display-friendly order limit in rupees */
export const ORDER_LIMIT_DISPLAY = 100_000;

/** Currency code for Razorpay */
export const CURRENCY = 'INR';

/** Firestore collection names */
export const COLLECTIONS = {
  PRODUCTS: 'products',
  CARTS: 'carts',
  ORDERS: 'orders',
  AUDIT_LOGS: 'audit_logs',
  VOICE_SESSIONS: 'voice_sessions',
} as const;
