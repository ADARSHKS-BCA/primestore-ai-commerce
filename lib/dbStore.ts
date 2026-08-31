import { adminDb } from './firebaseAdmin';
import { COLLECTIONS } from './constants';
import { PRODUCTS_CATALOG, CatalogProduct } from './productsData';
import { Cart, Order, AuditLogEntry, Product } from './schemas';

// In-memory fallback stores
const memoryCarts = new Map<string, Cart>();
const memoryOrders = new Map<string, Order>();
const memoryAuditLogs: AuditLogEntry[] = [];

// Performance Cache for Products
let cachedProducts: CatalogProduct[] | null = null;
let productsCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

/**
 * Timeout wrapper to prevent gRPC Firestore network hanging
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 800): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

/**
 * Get all available in-stock products with high-speed memory cache
 */
export async function getProductsList(): Promise<CatalogProduct[]> {
  const t0 = performance.now();
  const now = Date.now();

  if (cachedProducts && now - productsCacheTime < CACHE_TTL_MS) {
    console.log(`⚡ [TIMING: DB_PRODUCTS] Cache HIT (took ${(performance.now() - t0).toFixed(2)}ms)`);
    return cachedProducts;
  }

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const snapshot = await withTimeout(
        adminDb.collection(COLLECTIONS.PRODUCTS).where('inStock', '==', true).get(),
        1000
      );

      if (!snapshot.empty) {
        const dbProducts = snapshot.docs.map((doc) => doc.data() as Product);
        cachedProducts = PRODUCTS_CATALOG.map((catItem) => {
          const found = dbProducts.find((p) => p.id === catItem.id);
          return found ? { ...catItem, ...found } : catItem;
        });
        productsCacheTime = now;
        console.log(`⏱️ [TIMING: DB_PRODUCTS] Cloud Firestore read completed in ${(performance.now() - t0).toFixed(1)}ms`);
        return cachedProducts;
      }
    } catch (err) {
      console.warn('⚠️ [DB_PRODUCTS] Cloud fetch timed out, serving fast catalog fallback');
    }
  }

  cachedProducts = PRODUCTS_CATALOG;
  productsCacheTime = now;
  console.log(`⚡ [TIMING: DB_PRODUCTS] In-memory catalog returned in ${(performance.now() - t0).toFixed(2)}ms`);
  return cachedProducts;
}

/**
 * Find single product by ID
 */
export async function getProductById(productId: string): Promise<CatalogProduct | null> {
  const t0 = performance.now();
  const products = await getProductsList();
  const found = products.find((p) => p.id === productId);
  console.log(`⏱️ [TIMING: DB_PRODUCT_LOOKUP] Looked up ${productId} in ${(performance.now() - t0).toFixed(2)}ms`);
  return found || null;
}

/**
 * Save cart
 */
export async function saveCart(cart: Cart): Promise<void> {
  const t0 = performance.now();
  memoryCarts.set(cart.id, cart);

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await withTimeout(adminDb.collection(COLLECTIONS.CARTS).doc(cart.id).set(cart), 1000);
      console.log(`⏱️ [TIMING: DB_SAVE_CART] Cloud Firestore saved cart in ${(performance.now() - t0).toFixed(1)}ms`);
    } catch {
      console.log(`⚡ [TIMING: DB_SAVE_CART] Memory fallback saved cart in ${(performance.now() - t0).toFixed(1)}ms`);
    }
  }
}

/**
 * Get cart by ID
 */
export async function getCartById(cartId: string): Promise<Cart | null> {
  const t0 = performance.now();
  const inMemory = memoryCarts.get(cartId);
  if (inMemory) {
    console.log(`⚡ [TIMING: DB_GET_CART] Memory cache HIT in ${(performance.now() - t0).toFixed(2)}ms`);
    return inMemory;
  }

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const doc = await withTimeout(adminDb.collection(COLLECTIONS.CARTS).doc(cartId).get(), 1000);
      if (doc.exists) {
        const data = doc.data() as Cart;
        memoryCarts.set(cartId, data);
        console.log(`⏱️ [TIMING: DB_GET_CART] Cloud Firestore fetched cart in ${(performance.now() - t0).toFixed(1)}ms`);
        return data;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Update cart
 */
export async function updateCart(cartId: string, updates: Partial<Cart>): Promise<void> {
  const t0 = performance.now();
  const existing = memoryCarts.get(cartId);
  if (existing) {
    memoryCarts.set(cartId, { ...existing, ...updates });
  }

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await withTimeout(adminDb.collection(COLLECTIONS.CARTS).doc(cartId).update(updates), 1000);
      console.log(`⏱️ [TIMING: DB_UPDATE_CART] Cloud Firestore updated cart in ${(performance.now() - t0).toFixed(1)}ms`);
    } catch {
      console.log(`⚡ [TIMING: DB_UPDATE_CART] Memory fallback updated cart in ${(performance.now() - t0).toFixed(1)}ms`);
    }
  }
}

/**
 * Save order
 */
export async function saveOrder(order: Order): Promise<void> {
  const t0 = performance.now();
  memoryOrders.set(order.id, order);

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await withTimeout(adminDb.collection(COLLECTIONS.ORDERS).doc(order.id).set(order), 1000);
      console.log(`⏱️ [TIMING: DB_SAVE_ORDER] Cloud Firestore saved order in ${(performance.now() - t0).toFixed(1)}ms`);
    } catch {
      console.log(`⚡ [TIMING: DB_SAVE_ORDER] Memory fallback saved order in ${(performance.now() - t0).toFixed(1)}ms`);
    }
  }
}

/**
 * Find order by Razorpay Order ID
 */
export async function getOrderByRazorpayId(razorpayOrderId: string): Promise<Order | null> {
  const t0 = performance.now();
  for (const order of memoryOrders.values()) {
    if (order.razorpayOrderId === razorpayOrderId) {
      console.log(`⚡ [TIMING: DB_GET_ORDER] Memory cache HIT in ${(performance.now() - t0).toFixed(2)}ms`);
      return order;
    }
  }

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const snapshot = await withTimeout(
        adminDb
          .collection(COLLECTIONS.ORDERS)
          .where('razorpayOrderId', '==', razorpayOrderId)
          .limit(1)
          .get(),
        1000
      );

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as Order;
        memoryOrders.set(data.id, data);
        console.log(`⏱️ [TIMING: DB_GET_ORDER] Cloud Firestore fetched order in ${(performance.now() - t0).toFixed(1)}ms`);
        return data;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Update order
 */
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
  const t0 = performance.now();
  const existing = memoryOrders.get(orderId);
  if (existing) {
    memoryOrders.set(orderId, { ...existing, ...updates });
  }

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await withTimeout(adminDb.collection(COLLECTIONS.ORDERS).doc(orderId).update(updates), 1000);
      console.log(`⏱️ [TIMING: DB_UPDATE_ORDER] Cloud Firestore updated order in ${(performance.now() - t0).toFixed(1)}ms`);
    } catch {
      console.log(`⚡ [TIMING: DB_UPDATE_ORDER] Memory fallback updated order in ${(performance.now() - t0).toFixed(1)}ms`);
    }
  }
}

/**
 * Save audit log entry
 */
export async function saveAuditLog(entry: AuditLogEntry): Promise<void> {
  const t0 = performance.now();
  memoryAuditLogs.unshift(entry);

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await withTimeout(adminDb.collection(COLLECTIONS.AUDIT_LOGS).doc(entry.id).set(entry), 1000);
      console.log(`⏱️ [TIMING: DB_SAVE_AUDIT] Cloud Firestore saved audit in ${(performance.now() - t0).toFixed(1)}ms`);
    } catch {
      console.log(`⚡ [TIMING: DB_SAVE_AUDIT] Memory fallback saved audit in ${(performance.now() - t0).toFixed(1)}ms`);
    }
  }
}

/**
 * Get all audit log entries
 */
export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const t0 = performance.now();

  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const snapshot = await withTimeout(
        adminDb
          .collection(COLLECTIONS.AUDIT_LOGS)
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get(),
        1000
      );

      if (!snapshot.empty) {
        const logs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.timestamp?.toDate?.()
              ? data.timestamp.toDate().toISOString()
              : data.timestamp,
          } as AuditLogEntry;
        });
        console.log(`⏱️ [TIMING: DB_GET_AUDIT] Cloud Firestore fetched ${logs.length} audit logs in ${(performance.now() - t0).toFixed(1)}ms`);
        return logs;
      }
    } catch {
      // Fallback
    }
  }

  console.log(`⚡ [TIMING: DB_GET_AUDIT] Memory fallback returned ${memoryAuditLogs.length} audit logs in ${(performance.now() - t0).toFixed(1)}ms`);
  return memoryAuditLogs;
}
