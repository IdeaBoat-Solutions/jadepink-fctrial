/* §59 critical end-to-end acceptance — the whole Stage 2 → Stage 3 journey,
   run as a real signed-in FC so RLS + the atomic RPCs are genuinely exercised:

     walk-in (create_walk_in RPC)  -> visit IDENTIFYING + WALK_IN_RECORDED
     identify (attach_customer_to_visit RPC) -> customer linked, counter bumped
     assign FC        -> ASSIGNED + FC_ASSIGNED
     start visit      -> ACTIVE   + VISIT_STARTED
     scan N products  -> N visit_products (SELECTED)  [N = min(20, catalogue)]
     trial T          -> TRIAL_IN_PROGRESS -> TRIAL_COMPLETED
     like L / drop D  -> LIKED / DROPPED(+reason)
     summary          -> derived from visit_products, counts match what we did
     events           -> every milestone recorded
     cleanup          -> visit (cascades events + products) + temp customer

   Targets 20/10/6/4 like the spec; degrades to the catalogue size when the
   seeded catalogue is smaller, always asserting internal consistency.

   Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
   Usage: npm run verify:e2e */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

console.log(`\n=== §59 end-to-end acceptance (signed in as FC: ${FC_EMAIL}) ===\n`);

const { data: sess, error: loginErr } = await fc.auth.signInWithPassword({ email: FC_EMAIL, password: PASSWORD });
if (loginErr) {
  console.error(`Cannot sign in as ${FC_EMAIL}: ${loginErr.message}`);
  console.error("Run `npm run seed:auth` first.");
  process.exit(1);
}
const actor = sess.user.id;
const me = await fc.from("staff_profiles").select("store_id, role").eq("id", actor).single();
if (me.error || !me.data?.store_id) {
  console.error(`FC profile not readable / no store: ${me.error?.message ?? "store_id is null"}`);
  process.exit(1);
}
const storeId = me.data.store_id;
console.log(`Signed in: ${me.data.role} @ ${storeId}\n`);

let visitId = null;
let customerId = null;

try {
  // ---------- 1. Walk-in via the atomic RPC ----------
  const walk = await fc.rpc("create_walk_in", { p_store_id: storeId, p_actor: actor });
  check("create_walk_in RPC returns a visit", !walk.error && !!walk.data?.id, walk.error?.message);
  const visit = walk.data;
  visitId = visit?.id;
  check("walk-in lands in IDENTIFYING", visit?.status === "IDENTIFYING", visit?.status);

  const walkEv = await fc.from("visit_events").select("event_type").eq("visit_id", visitId).eq("event_type", "WALK_IN_RECORDED").maybeSingle();
  check("WALK_IN_RECORDED event written atomically", !!walkEv.data, walkEv.error?.message ?? "missing");

  // ---------- 2. Temp customer + attach via the atomic RPC ----------
  const mobile = `9${String(Date.now()).slice(-9)}`;
  const cIns = await fc.from("customers").insert({ name: "E2E Test Customer", mobile, normalized_phone: mobile, source: "Walk-in" }).select("id, visits").single();
  check("temp customer created", !cIns.error && !!cIns.data?.id, cIns.error?.message);
  customerId = cIns.data?.id;
  const beforeCount = cIns.data?.visits ?? 0;

  const att = await fc.rpc("attach_customer_to_visit", { p_visit_id: visitId, p_customer_id: customerId, p_actor: actor });
  check("attach_customer_to_visit RPC succeeds", !att.error && att.data?.customer_id === customerId, att.error?.message);

  const attEv = await fc.from("visit_events").select("event_type").eq("visit_id", visitId).eq("event_type", "CUSTOMER_ATTACHED").maybeSingle();
  check("CUSTOMER_ATTACHED event written atomically", !!attEv.data, attEv.error?.message ?? "missing");

  const cAfter = await fc.from("customers").select("visits").eq("id", customerId).single();
  check("first attach bumped customer visit counter atomically", (cAfter.data?.visits ?? 0) === beforeCount + 1, `before ${beforeCount}, after ${cAfter.data?.visits}`);

  // ---------- 3. Assign FC (mirror service: ASSIGNED + event) ----------
  const asg = await fc.from("visits").update({ assigned_salesperson_id: actor, assigned_at: nowIso(), status: "ASSIGNED" }).eq("id", visitId);
  check("assign FC → ASSIGNED", !asg.error, asg.error?.message);
  await fc.from("visit_events").insert({ visit_id: visitId, event_type: "FC_ASSIGNED", actor_id: actor, metadata: { salesperson_id: actor } });

  // ---------- 4. Start visit → ACTIVE ----------
  const start = await fc.from("visits").update({ status: "ACTIVE", started_at: nowIso() }).eq("id", visitId);
  check("start visit → ACTIVE", !start.error, start.error?.message);
  await fc.from("visit_events").insert({ visit_id: visitId, event_type: "VISIT_STARTED", actor_id: actor, metadata: {} });

  // ---------- 5. Scan N products ----------
  const { data: variants } = await fc.from("product_variants").select("id").eq("is_active", true).limit(20);
  const pool = variants ?? [];
  if (pool.length === 0) {
    console.log("  skip   scan/trial suite — no product_variants to scan. Run `npm run seed:sj`.");
  } else {
    const N = Math.min(20, pool.length);
    const T = Math.min(10, N);
    const L = Math.min(6, T);
    const D = Math.min(4, T - L);
    const scanned = [];
    for (let i = 0; i < N; i++) {
      const r = await fc.from("visit_products").insert({ visit_id: visitId, product_variant_id: pool[i].id }).select("id, status").single();
      if (r.error) { bad(`scan #${i + 1}`, r.error.message); break; }
      scanned.push(r.data.id);
    }
    check(`scanned ${N} products (all SELECTED)`, scanned.length === N, `only ${scanned.length}`);
    if (N < 20) console.log(`  note   catalogue has ${pool.length} variants — ran ${N}/10/${L}/${D} instead of 20/10/6/4.`);

    // trial T
    for (let i = 0; i < T; i++) {
      await fc.from("visit_products").update({ status: "TRIAL_IN_PROGRESS", trial_started_at: nowIso() }).eq("id", scanned[i]);
      await fc.from("visit_products").update({ status: "TRIAL_COMPLETED", trial_completed_at: nowIso() }).eq("id", scanned[i]);
    }
    // like L (first L of the trialled)
    for (let i = 0; i < L; i++) {
      await fc.from("visit_products").update({ status: "LIKED", liked_at: nowIso() }).eq("id", scanned[i]);
    }
    // drop D (next D of the trialled) with reason
    const { data: reason } = await fc.from("drop_reasons").select("id").eq("code", "PRICE").maybeSingle();
    for (let i = L; i < L + D; i++) {
      const dr = await fc.from("visit_products").update({ status: "DROPPED", dropped_at: nowIso(), drop_reason_id: reason?.id }).eq("id", scanned[i]);
      if (dr.error) { bad(`drop #${i}`, dr.error.message); break; }
    }

    // ---------- 6. Summary derived from visit_products ----------
    const { data: rows } = await fc.from("visit_products").select("status").eq("visit_id", visitId);
    const sum = { SELECTED: 0, TRIAL_IN_PROGRESS: 0, TRIAL_COMPLETED: 0, LIKED: 0, DROPPED: 0, PURCHASED: 0 };
    for (const r of rows ?? []) sum[r.status]++;
    const trialled = sum.TRIAL_IN_PROGRESS + sum.TRIAL_COMPLETED;
    check(`summary selected = ${N - T}`, sum.SELECTED === N - T, `got ${sum.SELECTED}`);
    check(`summary trialled = ${T - L - D} still in trial state`, trialled === T - L - D, `got ${trialled}`);
    check(`summary liked = ${L}`, sum.LIKED === L, `got ${sum.LIKED}`);
    check(`summary dropped = ${D}`, sum.DROPPED === D, `got ${sum.DROPPED}`);
  }

  // ---------- 7. Milestone events all present ----------
  const { data: evs } = await fc.from("visit_events").select("event_type").eq("visit_id", visitId);
  const types = new Set((evs ?? []).map((e) => e.event_type));
  for (const t of ["WALK_IN_RECORDED", "CUSTOMER_ATTACHED", "FC_ASSIGNED", "VISIT_STARTED"]) {
    check(`event ${t} recorded`, types.has(t), "missing");
  }
} catch (e) {
  bad("unexpected exception", e?.message ?? String(e));
} finally {
  // ---------- 8. Cleanup ----------
  if (visitId) {
    await fc.from("visit_products").delete().eq("visit_id", visitId);
    await fc.from("visit_events").delete().eq("visit_id", visitId);
    await fc.from("visits").delete().eq("id", visitId);
  }
  if (customerId) await fc.from("customers").delete().eq("id", customerId);
  await fc.auth.signOut();
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
