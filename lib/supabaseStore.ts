import { supabaseAdmin } from './supabaseAdmin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  userId?: string | null;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number; // in paise
  totalDisplay: number; // in Rupees
  currency: string;
  status: 'created' | 'paid' | 'failed';
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  createdAt: string;
}

// In-memory / local session fallback for orders
const localOrdersStore: CustomerOrder[] = [
  {
    id: 'ord_demo_101',
    userId: 'demo-user-1',
    razorpayOrderId: 'order_TWGmfvAj077h20',
    razorpayPaymentId: 'pay_TWH8b15dxnIQf7',
    amount: 249900,
    totalDisplay: 2499,
    currency: 'INR',
    status: 'paid',
    items: [
      {
        productId: 'prod_earbuds_pro',
        name: 'AuraPods Pro Active Noise Cancelling Earbuds',
        price: 249900,
        quantity: 1,
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

/**
 * Save customer order into Supabase
 */
export async function saveCustomerOrderToSupabase(order: CustomerOrder): Promise<void> {
  localOrdersStore.unshift(order);

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('orders').insert({
        id: order.id,
        user_id: order.userId || null,
        razorpay_order_id: order.razorpayOrderId,
        razorpay_payment_id: order.razorpayPaymentId || null,
        amount: order.amount,
        total_display: order.totalDisplay,
        currency: order.currency,
        status: order.status,
        items: order.items,
        created_at: order.createdAt,
      });
      console.log(`☁️ [SUPABASE STORE] Order ${order.id} saved to Supabase.`);
    } catch (err) {
      console.warn('⚠️ [SUPABASE STORE] Supabase order write failed, using local fallback:', err);
    }
  }
}

/**
 * Get all customer orders for a given user ID (or all recent orders)
 */
export async function getCustomerOrders(userId?: string | null): Promise<CustomerOrder[]> {
  if (supabaseAdmin && userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          userId: d.user_id,
          razorpayOrderId: d.razorpay_order_id,
          razorpayPaymentId: d.razorpay_payment_id,
          amount: d.amount,
          totalDisplay: d.total_display || d.amount / 100,
          currency: d.currency || 'INR',
          status: d.status,
          items: d.items || [],
          createdAt: d.created_at,
        }));
      }
    } catch (err) {
      console.warn('⚠️ [SUPABASE STORE] Supabase query failed, using local fallback:', err);
    }
  }

  return localOrdersStore;
}

// In-memory fallback for user delivery addresses
const localAddressStore: Record<string, string> = {
  'demo-user-1': 'Flat 402, Sunshine Heights, Indiranagar, Bengaluru, Karnataka - 560038',
  'user_adarsh_1': 'Flat 402, Sunshine Heights, Indiranagar, Bengaluru, Karnataka - 560038',
};

/**
 * Retrieve saved delivery address for a user
 */
export async function getUserAddress(userId?: string | null): Promise<string | null> {
  if (!userId) return null;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('address')
        .eq('id', userId)
        .single();

      if (!error && data?.address) {
        return data.address;
      }
    } catch (err) {
      console.warn('⚠️ [SUPABASE STORE] Address fetch failed, using local fallback:', err);
    }
  }

  return localAddressStore[userId] || null;
}

/**
 * Save or update user delivery address
 */
export async function saveUserAddress(userId: string, address: string): Promise<void> {
  localAddressStore[userId] = address;

  if (supabaseAdmin && userId) {
    try {
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, address }, { onConflict: 'id' });
      console.log(`☁️ [SUPABASE STORE] Address saved for user ${userId}`);
    } catch (err) {
      console.warn('⚠️ [SUPABASE STORE] Address save failed, using local fallback:', err);
    }
  }
}

