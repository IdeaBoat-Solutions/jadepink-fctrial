/* Supabase env guard. Server routes/services need the URL + anon key;
   seed scripts need the service-role key. Importing this module never throws. */

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (!url) throw new Error("Supabase URL is not set. Copy .env.example -> .env and fill NEXT_PUBLIC_SUPABASE_URL.");
  return url;
}
