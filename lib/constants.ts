/** App-wide constants — single source of truth */

/** Maximum order amount in paise (₹10,000 = 10,00,000 paise) */
export const ORDER_LIMIT_PAISE = 1_000_000;

/** Display-friendly order limit in rupees */
export const ORDER_LIMIT_DISPLAY = 10_000;

/** Currency code for Razorpay */
export const CURRENCY = 'INR';

/** Firestore collection names */
export const COLLECTIONS = {
  PRODUCTS: 'products',
  CARTS: 'carts',
  ORDERS: 'orders',
  AUDIT_LOGS: 'audit_logs',
} as const;
