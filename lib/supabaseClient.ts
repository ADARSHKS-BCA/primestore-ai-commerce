import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client SDK (Browser & Client Safe).
 * 
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Provides resilient mock fallback if keys are not yet provided in .env.local.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

let _supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const supabase = _supabaseClient;
