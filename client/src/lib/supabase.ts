import { createClient } from "@supabase/supabase-js";

// The Supabase publishable key is designed to be embedded in browser applications.
// Row Level Security protects all user-owned data in the database.
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://qjvpwwhecpzhcbvnranr.supabase.co";
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  "sb_publishable_4wqVg7TugLNxnDcLYdNg2g_ar-Q9rW6";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
