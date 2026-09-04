import { supabaseAdmin } from './supabaseAdmin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  createdAt?: string;
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
const localOrdersStore: CustomerOrder[] = [];
const localProfilesStore = new Map<string, UserProfile>();

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

      if (!error && data && data.length > 0) {
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

  if (userId) {
    return localOrdersStore.filter((o) => o.userId === userId || !o.userId);
  }

  return localOrdersStore;
}

/**
 * Retrieve saved profile for a user
 */
export async function getUserProfile(userId?: string | null): Promise<UserProfile | null> {
  if (!userId) return null;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email || '',
          fullName: data.full_name || data.fullName || '',
          phone: data.phone || '',
          address: data.address || '',
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('⚠️ [SUPABASE STORE] Profile fetch failed, using local fallback:', err);
    }
  }

  return localProfilesStore.get(userId) || null;
}

/**
 * Save or update user profile
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  localProfilesStore.set(profile.id, profile);

  if (supabaseAdmin && profile.id) {
    try {
      await supabaseAdmin.from('profiles').upsert(
        {
          id: profile.id,
          email: profile.email,
          full_name: profile.fullName,
          phone: profile.phone || null,
          address: profile.address || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      console.log(`☁️ [SUPABASE STORE] Profile saved for user ${profile.id}`);
    } catch (err) {
      console.warn('⚠️ [SUPABASE STORE] Profile save failed, using local fallback:', err);
    }
  }
}

/**
 * Retrieve saved delivery address for a user
 */
export async function getUserAddress(userId?: string | null): Promise<string | null> {
  const profile = await getUserProfile(userId);
  return profile?.address || null;
}

/**
 * Save or update user delivery address
 */
export async function saveUserAddress(userId: string, address: string): Promise<void> {
  const existing = (await getUserProfile(userId)) || { id: userId, email: '', fullName: 'Shopper' };
  await saveUserProfile({ ...existing, address });
}
