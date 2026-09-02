import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Admin SDK — SERVER-ONLY.
 * 
 * Uses SUPABASE_SERVICE_ROLE_KEY for privileged server-side operations
 * (e.g. recording verified payments and writing orders under user IDs).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && serviceRoleKey && supabaseUrl.startsWith('http')) {
  _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin = _supabaseAdmin;
