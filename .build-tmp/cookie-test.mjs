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

const enc = (s) => Buffer.from(s).toString("base64url");
const full = enc(JSON.stringify(sess));
console.log("encoded length:", full.length, "→ chunked:", full.length > 3180);

const makeCookies = (style) => {
  const parts = [];
  if (style === "chunked") {
    for (let i = 0, p = 0; p < full.length; i++, p += 3180) parts.push({ name: `sb-${REF}-auth-token.${i}`, value: full.slice(p, p + 3180) });
  } else {
    parts.push({ name: `sb-${REF}-auth-token`, value: full });
  }
  return parts;
};

for (const style of ["single", "chunked"]) {
  const supabase = createServerClient(SB, ANON, {
    cookies: {
      getAll: () => makeCookies(style),
      setAll: () => {},
    },
  });
  const { data, error } = await supabase.auth.getUser();
  console.log(style, "→ user:", data?.user?.id ?? null, "error:", error?.message ?? null);
}
