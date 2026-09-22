/* Creates staff logins (FC / STORE_MANAGER) in Supabase Auth + staff_profiles.
   Run AFTER: migrations_010 + migrations_020 in SQL editor, then npm run seed:catalog
   Env needed: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
   Optional: TEMP_STAFF_PASSWORD (default JadePink123!), STORE_ID (default store-thaltej)

   Accounts live in scripts/staff.seed.json (add rows there - no code edits).
   Usage:
     npm run seed:auth                     # seed everyone in the file (LIVE writes)
     npm run seed:auth -- --list           # read-only: list current staff from the DB
     npm run seed:auth -- --plan           # show what WOULD happen, write nothing
     SEED_DRY_RUN=1 npm run seed:auth      # same as --plan
     npm run seed:auth -- --email x@y.com  # seed one account only
   Avoid `--dry-run`: npm intercepts that flag and the script runs LIVE. */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const STAFF_FILE = join(HERE, "staff.seed.json");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEMP_PASSWORD = process.env.TEMP_STAFF_PASSWORD || "JadePink123!";
const DEFAULT_STORE = process.env.STORE_ID || "store-thaltej";

/* ---------- CLI flags ---------- */
/* NOTE: do NOT use `--dry-run` through npm - npm owns that flag and eats it,
   which silently turns a "dry run" into a live write. Use `--plan` or SEED_DRY_RUN=1. */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const val = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};
const DRY = flag("plan") || flag("dry-run") || ["1", "true"].includes((process.env.SEED_DRY_RUN || "").toLowerCase());
const LIST_ONLY = flag("list") || flag("report");
const FORCE_NAMES = flag("force-names");
const ONLY_EMAIL = val("email");

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run via npm (uses --env-file=.env), or: node --env-file=.env scripts/seed-auth.mjs"
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ---------- Load accounts: JSON file, else built-in fallback ---------- */
function loadStaff() {
  if (existsSync(STAFF_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(STAFF_FILE, "utf8"));
      const rows = Array.isArray(parsed) ? parsed : parsed.staff;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("no `staff` array");
      const seen = new Set();
      return rows
        .filter((s) => s?.email)
        .filter((s) => {
          const key = s.email.toLowerCase();
          if (seen.has(key)) return false; // de-dupe by email, first wins
          seen.add(key);
          return true;
        })
        .map((s) => ({
          email: String(s.email).trim().toLowerCase(),
          name: String(s.name || String(s.email).split("@")[0]).trim(),
          role: String(s.role || "FC").toUpperCase(),
          store_id: s.store_id || DEFAULT_STORE,
          phone: s.phone || null,
          active: s.active !== false,
        }));
    } catch (e) {
      console.error(`Could not read ${STAFF_FILE}: ${e.message}`);
      process.exit(1);
    }
  }
  // Fallback so the script still works without the file
  return [
    { email: "iamsmit05@gmail.com", name: "Smit", role: "STORE_MANAGER", store_id: DEFAULT_STORE, phone: null, active: true },
    { email: "kkshah2005@gmail.com", name: "KK Shah", role: "FC", store_id: DEFAULT_STORE, phone: null, active: true },
  ];
}

/* ---------- Full user list (paginated: listUsers defaults to ~50) ---------- */
async function allAuthUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`listUsers page ${page}: ${error.message}`);
      process.exit(1);
    }
    const batch = data?.users ?? [];
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return all;
}

async function reportViews() {
  const { data: fc } = await admin.from("v_salespeople").select("id, name, email, store_id");
  const { data: mgr } = await admin.from("v_store_managers").select("id, name, email, store_id");
  console.log("\n--- Current floor team (from role views) ---");
  console.log(`FCs (v_salespeople): ${fc?.length ?? 0}`);
  for (const r of fc ?? []) console.log(`  - ${r.name} <${r.email}> store=${r.store_id}`);
  console.log(`Managers (v_store_managers): ${mgr?.length ?? 0}`);
  for (const r of mgr ?? []) console.log(`  - ${r.name} <${r.email}> store=${r.store_id}`);
}

/* ---------- Main ---------- */
let staff = loadStaff();
if (ONLY_EMAIL) staff = staff.filter((s) => s.email === ONLY_EMAIL.toLowerCase());

if (LIST_ONLY) {
  await reportViews();
  process.exit(0);
}

if (staff.length === 0) {
  console.error(ONLY_EMAIL ? `No entry for ${ONLY_EMAIL} in ${STAFF_FILE}` : "No staff to seed.");
  process.exit(1);
}

const ROLE_STORE = {
  FC: "v_salespeople",
  STORE_MANAGER: "v_store_managers",
  ADMIN: "v_floor_team",
  MANAGEMENT: "v_floor_team",
};

console.log(`Mode: ${DRY ? "PLAN ONLY (nothing will be written)" : "LIVE WRITE"} | store default: ${DEFAULT_STORE}`);
console.log(`Accounts in file: ${staff.length}\n`);

const existing = await allAuthUsers();
const byEmail = new Map(existing.map((u) => [(u.email || "").toLowerCase(), u]));

let created = 0;
let skipped = 0;
let failed = 0;

for (const s of staff) {
  const bucket = ROLE_STORE[s.role] || "v_floor_team";
  const found = byEmail.get(s.email);

  if (DRY) {
    console.log(
      found
        ? `[skip auth] ${s.email} exists (${s.role}) -> profile upsert, active=${s.active}, store=${s.store_id}`
        : `[create]    ${s.email} (${s.role}) name="${s.name}" store=${s.store_id} -> appears in ${bucket}`
    );
    continue;
  }

  // 1. Auth user
  let userId = found?.id;
  if (!found) {
    const { data, error } = await admin.auth.admin.createUser({
      email: s.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { name: s.name, role: s.role },
    });
    if (error) {
      console.error(`createUser ${s.email}: ${error.message}`);
      failed++;
      continue;
    }
    userId = data.user.id;
    console.log(`Auth created: ${s.email} (${s.role})`);
    created++;
  } else {
    console.log(`Auth exists:  ${s.email}`);
    skipped++;
  }

  // 2. Profile row. `name` is only set when creating: it is editable live data
  //    (Dashboard or a future staff-settings screen), and re-seeding must not
  //    revert a real rename. Pass --force-names to push names from the file.
  const { data: hadProfile } = await admin
    .from("staff_profiles").select("id").eq("id", userId).maybeSingle();
  /* Existing profile (name possibly renamed live): UPDATE the mutable fields
     only. An upsert would attempt an INSERT first, and `staff_profiles.name`
     is NOT NULL with no default — so omitting it fails on the not-null
     constraint before the id conflict is ever resolved. */
  const { error: upErr } = hadProfile && !FORCE_NAMES
    ? await admin
        .from("staff_profiles")
        .update({ email: s.email, role: s.role, store_id: s.store_id, active: s.active })
        .eq("id", userId)
    : await admin
        .from("staff_profiles")
        .upsert({ id: userId, email: s.email, name: s.name, role: s.role, store_id: s.store_id, active: s.active }, { onConflict: "id" });
  if (upErr) {
    console.error(`profile ${s.email}: ${upErr.message}`);
    failed++;
    continue;
  }
  const kept = hadProfile && !FORCE_NAMES ? " (name left as-is)" : "";
  console.log(`Profile upserted: ${s.email} -> ${s.role} / ${s.store_id} -> ${bucket}${kept}`);
}

if (DRY) {
  console.log(`\nDry run complete - ${staff.length} account(s) planned. Nothing written.`);
  process.exit(0);
}

console.log(`\nSeeded: ${created} created, ${skipped} already existed, ${failed} failed.`);
if (failed) process.exitCode = 1;
else console.log(`Temp password for new logins: ${TEMP_PASSWORD} (change in Dashboard > Authentication)`);

await reportViews();
console.log("\nSign in with any of these at /login.");
