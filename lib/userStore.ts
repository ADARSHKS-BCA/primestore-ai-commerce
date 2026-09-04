import { createHash } from 'crypto';
import { adminDb } from './firebaseAdmin';
import { supabaseAdmin } from './supabaseAdmin';
import { COLLECTIONS } from './constants';

export interface DBUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

// In-memory fallback map for dev / offline resilience
const memoryUsers = new Map<string, DBUser>();

/**
 * Hash password securely with SHA-256
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password + '_primestore_salt_2026').digest('hex');
}

/**
 * Find user by email across Supabase, Cloud Firestore & memory store
 */
export async function findUserByEmail(email: string): Promise<DBUser | null> {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Check Supabase (if configured)
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash || data.passwordHash || '',
          fullName: data.full_name || data.fullName || '',
          phone: data.phone || '',
          address: data.address || '',
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('[UserStore] Supabase user query failed:', err);
    }
  }

  // 2. Check Cloud Firestore
  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const snapshot = await adminDb
        .collection('users')
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          passwordHash: data.passwordHash || '',
          fullName: data.fullName || '',
          phone: data.phone || '',
          address: data.address || '',
          createdAt: data.createdAt || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('[UserStore] Firestore user query failed:', err);
    }
  }

  // 3. Check memory store
  for (const user of memoryUsers.values()) {
    if (user.email.toLowerCase() === cleanEmail) {
      return user;
    }
  }

  return null;
}

/**
 * Find user by ID across Supabase, Cloud Firestore & memory store
 */
export async function findUserById(id: string): Promise<DBUser | null> {
  // 1. Check Supabase
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash || '',
          fullName: data.full_name || '',
          phone: data.phone || '',
          address: data.address || '',
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('[UserStore] Supabase user lookup by ID failed:', err);
    }
  }

  // 2. Check Cloud Firestore
  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const doc = await adminDb.collection('users').doc(id).get();
      if (doc.exists) {
        const data = doc.data()!;
        return {
          id: doc.id,
          email: data.email,
          passwordHash: data.passwordHash || '',
          fullName: data.fullName || '',
          phone: data.phone || '',
          address: data.address || '',
          createdAt: data.createdAt || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('[UserStore] Firestore user lookup by ID failed:', err);
    }
  }

  // 3. Check memory store
  return memoryUsers.get(id) || null;
}

/**
 * Register and save a new user into Database
 */
export async function registerUser(
  email: string,
  passwordPlain: string,
  fullName: string
): Promise<DBUser> {
  const cleanEmail = email.toLowerCase().trim();
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const passwordHash = hashPassword(passwordPlain);
  const now = new Date().toISOString();

  const newUser: DBUser = {
    id: userId,
    email: cleanEmail,
    passwordHash,
    fullName: fullName.trim(),
    phone: '',
    address: '',
    createdAt: now,
  };

  // 1. Save to Memory store
  memoryUsers.set(userId, newUser);

  // 2. Save to Cloud Firestore
  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await adminDb.collection('users').doc(userId).set({
        id: userId,
        email: cleanEmail,
        passwordHash,
        fullName: fullName.trim(),
        phone: '',
        address: '',
        createdAt: now,
      });
      console.log(`[UserStore] User ${cleanEmail} successfully created in Firestore.`);
    } catch (err) {
      console.warn('[UserStore] Firestore user save failed:', err);
    }
  }

  // 3. Save to Supabase (if configured)
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('users').upsert({
        id: userId,
        email: cleanEmail,
        password_hash: passwordHash,
        full_name: fullName.trim(),
        created_at: now,
      });
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: cleanEmail,
        full_name: fullName.trim(),
        created_at: now,
      });
      console.log(`[UserStore] User ${cleanEmail} created in Supabase.`);
    } catch (err) {
      console.warn('[UserStore] Supabase user save failed:', err);
    }
  }

  return newUser;
}

/**
 * Update user profile details
 */
export async function updateUserProfileInDB(
  userId: string,
  updates: { fullName?: string; phone?: string; address?: string }
): Promise<void> {
  const user = await findUserById(userId);
  if (user) {
    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.address !== undefined) user.address = updates.address;
    memoryUsers.set(userId, user);
  }

  // Update in Firestore
  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      await adminDb.collection('users').doc(userId).set(
        {
          ...(updates.fullName !== undefined ? { fullName: updates.fullName } : {}),
          ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
          ...(updates.address !== undefined ? { address: updates.address } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[UserStore] Firestore user profile update failed:', err);
    }
  }

  // Update in Supabase
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('profiles').upsert(
        {
          id: userId,
          ...(updates.fullName !== undefined ? { full_name: updates.fullName } : {}),
          ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
          ...(updates.address !== undefined ? { address: updates.address } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (err) {
      console.warn('[UserStore] Supabase profile update failed:', err);
    }
  }
}
