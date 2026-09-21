/* Stage 3 database acceptance test — run as a real signed-in FC, not service role,
   so it exercises the actual RLS path (visit_products -> visit -> store).

   Covers:
     1. resolveProduct(): barcode first, then SKU, plus unknown-identifier miss
     2. addProductToVisit(): SELECTED default + PRODUCT_ADDED event w/ entity refs
     3. duplicate scan rejected by UNIQUE(visit_id, product_variant_id)
     4. trial lifecycle SELECTED -> TRIAL_IN_PROGRESS -> TRIAL_COMPLETED -> LIKED
     5. DROPPED without a reason rejected by CHECK (on a row that is genuinely
        in TRIAL_COMPLETED, so the constraint trips for the right reason)
     6. DROPPED with a seeded reason accepted
     7. per-visit summary computable from visit_products (never stored on visits)
     8. cross-store isolation: an FC cannot see or write another store's visit
     9. cleanup

   Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY (only to *fabricate* the foreign store for #8)
   Usage: npm run verify:stage3 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.TEMP_STAFF_PASSWORD || "JadePink123!";
const FC_EMAIL = process.env.VERIFY_FC_EMAIL || "fc-aakash@jadepink.test";

if (!URL || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const ok = (l) => { pass++; console.log(`  ok     ${l}`); };
const bad = (l, d) => { fail++; console.log(`  FAILED ${l}${d ? ` -> ${d}` : ""}`); };
const check = (l, c, d) => (c ? ok(l) : bad(l, d));
const nowIso = () => new Date().toISOString();

const fc = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

console.log(`\n=== Stage 3 DB acceptance (signed in as FC: ${FC_EMAIL}) ===\n`);

// ---------- 0. Authenticate as an FC so RLS is genuinely in force ----------
const { data: sess, error: loginErr } = await fc.auth.signInWithPassword({
  email: FC_EMAIL,
  password: PASSWORD,
});
if (loginErr) {
  console.error(`Cannot sign in as ${FC_EMAIL}: ${loginErr.message}`);
  console.error("Run `npm run seed:auth` first.");
  process.exit(1);
}
const me = await fc.from("staff_profiles").select("store_id, role").eq("id", sess.user.id).single();
if (me.error || !me.data?.store_id) {
  console.error(`FC profile not readable / no store: ${me.error?.message ?? "store_id is null"}`);
  console.error("This is the RLS recursion bug — re-apply supabase/migrations_020_security.sql.");
  process.exit(1);
}
const storeId = me.data.store_id;
console.log(`Signed in: ${me.data.role} @ ${storeId}\n`);

let visitId = null;
let foreignStoreId = null;
let foreignVisitId = null;

try {
  // ---------- 1. resolveProduct ----------
  const { data: v } = await fc
    .from("product_variants")
    .select("id, sku, barcode, size, colour, price, product_id")
    .limit(1)
    .maybeSingle();
  if (!v) {
    console.log("  skip   entire scan/trial suite - no product_variants rows to scan.");
    console.log("         Import real stock with: npm run seed:sj -- --file \"<client export>.csv\"");
    await fc.auth.signOut();
    process.exit(0);
  }

  const byBarcode = await fc.from("product_variants").select("id").eq("barcode", v.barcode).maybeSingle();
  check("resolveProduct by barcode", byBarcode.data?.id === v.id, byBarcode.error?.message ?? "no match");

  const bySku = await fc.from("product_variants").select("id").eq("sku", v.sku).maybeSingle();
  check("resolveProduct by sku", bySku.data?.id === v.id, bySku.error?.message ?? "no match");

  const miss = await fc.from("product_variants").select("id").eq("barcode", "0000000000000").maybeSingle();
  check("unknown barcode resolves to nothing", !miss.error && !miss.data, miss.error?.message);

  // ---------- 2. ACTIVE visit to attach products to ----------
  // Status is set directly here because this test targets the DB layer only;
  // the app must reach ACTIVE through the visit state machine.
  const { data: visit, error: vErr } = await fc
    .from("visits")
    .insert({ store_id: storeId, status: "ACTIVE", started_at: nowIso() })
    .select("id")
    .single();
  if (vErr || !visit) throw new Error(`visit insert failed: ${vErr?.message}`);
  visitId = visit.id;
  ok(`created ACTIVE visit ${String(visitId).slice(0, 8)}`);

  // ---------- 3. addProductToVisit + audit event ----------
  const { data: vp, error: insErr } = await fc
    .from("visit_products")
    .insert({ visit_id: visitId, product_variant_id: v.id })
    .select("id, status")
    .single();
  if (insErr) throw new Error(`visit_products insert failed: ${insErr.message}`);
  check("new visit_product defaults to SELECTED", vp.status === "SELECTED", vp.status);

  await fc.from("visit_events").insert({
    visit_id: visitId,
    event_type: "PRODUCT_ADDED",
    actor_id: sess.user.id,
    entity_type: "VISIT_PRODUCT",
    entity_id: vp.id,
    metadata: { sku: v.sku, product_variant_id: v.id },
  });
  const ev = await fc
    .from("visit_events")
    .select("event_type, entity_type, entity_id")
    .eq("visit_id", visitId)
    .eq("event_type", "PRODUCT_ADDED")
    .maybeSingle();
  check(
    "PRODUCT_ADDED carries entity_type + entity_id",
    ev.data?.entity_id === vp.id && ev.data?.entity_type === "VISIT_PRODUCT",
    JSON.stringify(ev.data ?? ev.error)
  );

  // ---------- 4. Duplicate scan ----------
  const { error: dupErr } = await fc
    .from("visit_products")
    .insert({ visit_id: visitId, product_variant_id: v.id });
  check(
    "duplicate scan blocked by UNIQUE(visit_id, variant)",
    dupErr?.code === "23505",
    dupErr ? `${dupErr.code}` : "insert unexpectedly succeeded"
  );

  // ---------- 5. Trial lifecycle on row #1 ----------
  const s1 = await fc.from("visit_products").update({ status: "TRIAL_IN_PROGRESS", trial_started_at: nowIso() }).eq("id", vp.id);
  check("SELECTED -> TRIAL_IN_PROGRESS", !s1.error, s1.error?.message);
  const s2 = await fc.from("visit_products").update({ status: "TRIAL_COMPLETED", trial_completed_at: nowIso() }).eq("id", vp.id);
  check("TRIAL_IN_PROGRESS -> TRIAL_COMPLETED", !s2.error, s2.error?.message);
  const s3 = await fc.from("visit_products").update({ status: "LIKED", liked_at: nowIso() }).eq("id", vp.id);
  check("TRIAL_COMPLETED -> LIKED", !s3.error, s3.error?.message);

  // ---------- 6. Drop rules, on an independent row in TRIAL_COMPLETED ----------
  const { data: alt } = await fc.from("product_variants").select("id").neq("id", v.id).limit(1).maybeSingle();
  check("a second variant exists", !!alt?.id, "catalogue too small to test drops");

  if (alt?.id) {
    const { data: vp2, error: e2 } = await fc
      .from("visit_products")
      .insert({ visit_id: visitId, product_variant_id: alt.id })
      .select("id")
      .single();
    if (e2) bad("second visit_product insert", e2.message);
    else {
      await fc.from("visit_products").update({ status: "TRIAL_IN_PROGRESS", trial_started_at: nowIso() }).eq("id", vp2.id);
      await fc.from("visit_products").update({ status: "TRIAL_COMPLETED", trial_completed_at: nowIso() }).eq("id", vp2.id);
      const st = await fc.from("visit_products").select("status").eq("id", vp2.id).single();
      check("row #2 is genuinely TRIAL_COMPLETED first", st.data?.status === "TRIAL_COMPLETED", st.data?.status);

      const noReason = await fc
        .from("visit_products")
        .update({ status: "DROPPED", dropped_at: nowIso(), drop_reason_id: null })
        .eq("id", vp2.id);
      check(
        "DROPPED without reason rejected by CHECK",
        noReason.error?.code === "23514",
        noReason.error ? noReason.error.code : "update unexpectedly succeeded"
      );

      const { data: price } = await fc.from("drop_reasons").select("id").eq("code", "PRICE").maybeSingle();
      check("drop reason PRICE is seeded", !!price?.id, "missing");

      if (price?.id) {
        const withReason = await fc
          .from("visit_products")
          .update({ status: "DROPPED", dropped_at: nowIso(), drop_reason_id: price.id })
          .eq("id", vp2.id);
        check("DROPPED with reason PRICE accepted", !withReason.error, withReason.error?.message);
      }
    }
  }

  // ---------- 7. Summary is derived, not stored ----------
  const { data: rows } = await fc.from("visit_products").select("status").eq("visit_id", visitId);
  const counts = {};
  for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  check("summary computable from visit_products", Object.keys(counts).length > 0, JSON.stringify(counts));
  console.log(`         summary: ${JSON.stringify(counts)}`);
  const cols = await fc.from("visits").select("liked_count, dropped_count, selected_count").eq("id", visitId).maybeSingle();
  check("visits has NO counter columns (derived, per spec §27)", !!cols.error, "unexpected stored counter column");

  // ---------- 8. Cross-store isolation ----------
  if (!SERVICE) {
    console.log("  skip   cross-store isolation (no SUPABASE_SERVICE_ROLE_KEY to fabricate a foreign store)");
  } else {
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    foreignStoreId = "store-isolation-probe";
    await admin.from("stores").upsert({ id: foreignStoreId, name: "Isolation Probe", active: true }, { onConflict: "id" });
    const { data: fv, error: fve } = await admin
      .from("visits")
      .insert({ store_id: foreignStoreId, status: "ACTIVE" })
      .select("id")
      .single();
    if (fve) bad("fabricate foreign visit", fve.message);
    else {
      foreignVisitId = fv.id;
      const seen = await fc.from("visits").select("id").eq("id", foreignVisitId).maybeSingle();
      check("FC cannot READ another store's visit", !seen.error && !seen.data, seen.error?.code ?? "leak: row visible");

      const touched = await fc.from("visit_products").insert({ visit_id: foreignVisitId, product_variant_id: v.id });
      check("FC cannot WRITE into another store's visit", !!touched.error, touched.error?.code ?? "leak: insert allowed");
    }
  }
} finally {
  if (visitId) {
    await fc.from("visit_products").delete().eq("visit_id", visitId);
    await fc.from("visit_events").delete().eq("visit_id", visitId);
    const { error } = await fc.from("visits").delete().eq("id", visitId);
    console.log(error ? `\n  WARN cleanup: ${error.message}` : `\n  cleaned up probe visit ${String(visitId).slice(0, 8)}`);
  }
  if (foreignVisitId || foreignStoreId) {
    const admin = SERVICE ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : null;
    if (admin) {
      if (foreignVisitId) await admin.from("visits").delete().eq("id", foreignVisitId);
      await admin.from("stores").delete().eq("id", foreignStoreId);
      console.log("  cleaned up isolation probe store");
    }
  }
  await fc.auth.signOut();
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
