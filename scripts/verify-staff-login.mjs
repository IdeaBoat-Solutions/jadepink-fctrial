/* Smoke-test that seeded staff logins actually authenticate (not just that rows exist).
   Proves: password login works + RLS lets an FC read their own staff_profiles row.
   Env needed: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
   Usage: npm run verify:logins                      # tests the 3 demo FCs
          VERIFY_EMAILS=a@x.com,b@y.com npm run verify:logins   # test specific emails */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PASSWORD = process.env.TEMP_STAFF_PASSWORD || "JadePink123!";

if (!URL || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const emails = (process.env.VERIFY_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const targets = emails.length
  ? emails
  : [
      "fc-aakash@jadepink.test",
      "fc-zoya@jadepink.test",
      "fc-rohan@jadepink.test",
    ];

const { createClient } = await import("@supabase/supabase-js");

let failures = 0;

for (const email of targets) {
  // Fresh client per account so sessions never leak between checks.
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });

  if (error) {
    failures++;
    console.log(`  FAIL  ${email}  ->  ${error.message}`);
    continue;
  }

  const { data: profile, error: profErr } = await c
    .from("staff_profiles")
    .select("name, role, store_id, active")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    failures++;
    console.log(`  FAIL  ${email}  ->  signed in but cannot read staff_profiles: ${profErr?.message ?? "no rows"}`);
    await c.auth.signOut();
    continue;
  }

  // The reads Stage 2's routes perform; RLS recursion surfaced here as 42P17.
  const probes = [];
  for (const tbl of ["visits", "visit_events", "products", "v_salespeople"]) {
    const r = await c.from(tbl).select("id", { count: "exact", head: true });
    if (r.error) probes.push(`${tbl}:${r.error.code}`);
  }

  if (probes.length) {
    failures++;
    console.log(`  FAIL  ${email}  ->  ${profile.name} | RLS errors: ${probes.join(", ")}`);
  } else {
    console.log(
      `  OK    ${email}  ->  ${profile.name} | ${profile.role} | ${profile.store_id} | active=${profile.active}`
    );
  }
  await c.auth.signOut();
}

console.log(
  `\n${targets.length - failures}/${targets.length} logins working (password: ${PASSWORD}).`
);
if (failures) process.exit(1);
