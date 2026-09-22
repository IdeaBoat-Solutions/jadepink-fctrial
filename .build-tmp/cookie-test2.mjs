import { createServerClient } from "@supabase/ssr";

const SB = "https://qseqafaysxulbchvsdym.supabase.co";
const ANON = "sb_publishable_3wyG5dzUsuLp6tLLnJlRUg_FembWnai";
const REF = "qseqafaysxulbchvsdym";

const lr = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "kkshah2005@gmail.com", password: "JadePink123!" }),
});
const sess = await lr.json();

const json = JSON.stringify(sess);
const b64 = Buffer.from(json, "utf8").toString("base64url");
const value = "base64-" + b64;

// what the real browser writes: chunked with .0/.1 suffixes
const cookies = [];
for (let i = 0, p = 0; p < value.length; i++, p += 3180) {
  cookies.push({ name: `sb-${REF}-auth-token.${i}`, value: value.slice(p, p + 3180) });
}
console.log("chunks:", cookies.length, "first 40 chars:", cookies[0].value.slice(0, 40));

const supabase = createServerClient(SB, ANON, {
  cookies: {
    getAll: () => cookies,
    setAll: () => {},
  },
});

const gs = await supabase.auth.getSession();
console.log("getSession data:", gs.data?.session?.user?.id ?? null, "error:", gs.error?.message ?? null);
const gu = await supabase.auth.getUser();
console.log("getUser:", gu.data?.user?.id ?? null, "error:", gu.error?.message ?? null);
