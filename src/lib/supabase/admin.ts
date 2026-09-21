import { createClient } from "@supabase/supabase-js";

/* Service-role client for trusted server work (seed verification, admin reads).
   Never import from client components. Returns null when env is missing. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
