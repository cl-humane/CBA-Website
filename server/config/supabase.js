// server/config/supabase.js
// Creates and exports a single Supabase client instance for the entire server.
// Uses the ANON key — Row-Level Security (RLS) policies enforce data access.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl         = process.env.SUPABASE_URL;
const supabaseAnonKey     = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

// Public client — used for Auth (signInWithPassword, signOut)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — bypasses RLS, used only in server-side controllers
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export default supabase;