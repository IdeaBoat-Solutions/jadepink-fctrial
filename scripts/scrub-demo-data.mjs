/* Scrub pushed demo/placeholder data from the live Supabase database.

   KEEP (not demo data):
     stores          - staff_profiles.store_id FKs here; deleting it orphans logins
     staff_profiles  - the FC + manager accounts (explicitly excluded from scrub)
     drop_reasons    - Stage 3 controlled vocabulary; the UI and the
                       visit_products CHECK constraint depend on it

   DELETE (in FK-safe order):
     visit_products, visit_events, visits, order_items, orders, stock_movements,
     product_images, product_variants, products, suppliers, categories, customers

   Safety rails:
     * dry run unless --apply is passed
     * every row is written to supabase/backups/scrub-<stamp>.json BEFORE deleting
     * single transaction: any failure rolls the whole scrub back
     * refuses to run if S J FASHIONS-imported catalogue rows exist (id like
       'sj-%'), because those are real client stock, not placeholders.
       Override with --allow-real-catalogue only if you truly mean it.

   Usage:
     npm run db:scrub            # preview: what exists, what would go
     npm run db:scrub:apply      # back up, then delete */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_DIR = join(ROOT, "supabase", "backups");

const CONN = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!CONN) {
  console.error("Missing DIRECT_URL / DATABASE_URL in .env (see .env.example).");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const ALLOW_REAL = process.argv.includes("--allow-real-catalogue");

// Child tables first. Anything referenced by staff_profiles is never touched.
const TARGETS = [
  ["visit_products", "trial / like / drop records"],
  ["visit_events", "visit audit trail"],
  ["visits", "floor visits"],
  ["order_items", "order lines"],
  ["orders", "bills"],
  ["stock_movements", "stock in/out log"],
  ["product_images", "per-image rows (syncs products.image_urls)"],
  ["product_variants", "scannable size/colour variants"],
  ["products", "catalogue"],
  ["suppliers", "sourcing partners"],
  ["categories", "catalogue categories"],
  ["customers", "customer records (PII)"],
];

const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
await client.connect();

const count = async (t) => (await client.query(`select count(*)::int n from public.${t}`)).rows[0].n;

console.log(`Mode: ${APPLY ? "APPLY (rows will be deleted)" : "DRY RUN (nothing is deleted)"}\n`);

/* ---------- Detect real ERP stock (checked before reporting, enforced after) ---------- */
const real = await client.query(
  `select count(*)::int n from public.products where id like 'sj-%' or barcode is not null`
);
const realN = real.rows[0].n;

/* ---------- Report ---------- */
console.log("--- keep (untouched) ---");
for (const t of ["stores", "staff_profiles", "drop_reasons"]) {
  console.log(`   ${t.padEnd(16)} ${String(await count(t)).padStart(5)}  rows  ${t === "drop_reasons" ? "(Stage 3 vocabulary)" : ""}`);
}

console.log("\n--- to scrub ---");
const snapshot = {};
let total = 0;
for (const [t, why] of TARGETS) {
  const n = await count(t);
  total += n;
  console.log(`   ${t.padEnd(16)} ${String(n).padStart(5)}  rows  ${why}`);
  if (n > 0) {
    const { rows } = await client.query(`select * from public.${t}`);
    snapshot[t] = rows;
  }
}
console.log(`\n   total rows to delete: ${total}`);

if (realN > 0 && !ALLOW_REAL) {
  console.log(`\n   ${realN} products match real S J FASHIONS stock (id like 'sj-%' or a barcode).`);
  console.log("   Refusing to delete a client catalogue. If you are certain these are");
  console.log("   placeholders, re-run with --allow-real-catalogue.");
  await client.end();
  process.exit(1);
}

if (total === 0) {
  console.log("Nothing to scrub - database is already clean.");
  await client.end();
  process.exit(0);
}

/* ---------- Backup before any deletion ----------
   Only the real run writes a restore point: a dry run must not leave behind a
   file that looks like data was removed. */
let backupPath = null;
if (APPLY) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  backupPath = join(BACKUP_DIR, `scrub-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify({ generated_at: new Date().toISOString(), note: "Rows removed by scripts/scrub-demo-data.mjs. Restore by inserting in FK-parent order: categories, suppliers, products, product_variants, product_images, customers, orders, order_items, stock_movements, visits, visit_events, visit_products.", tables: snapshot }, null, 2),
    "utf8"
  );
  console.log(`\nBackup of all ${total} rows -> ${backupPath.replace(ROOT + "\\", "")}`);
} else {
  console.log("\nDry run: no restore point written (nothing will be deleted).");
}

if (!APPLY) {
  console.log("Plan complete. Nothing deleted. Re-run with --apply (npm run db:scrub:apply).");
  await client.end();
  process.exit(0);
}

/* ---------- Delete in one transaction ---------- */
try {
  await client.query("begin");
  for (const [t] of TARGETS) {
    const { rowCount } = await client.query(`delete from public.${t}`);
    if (rowCount) console.log(`   deleted ${String(rowCount).padStart(5)} from ${t}`);
  }
  await client.query("commit");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error(`\nFAILED, rolled back: ${e.message}`);
  await client.end();
  process.exit(1);
}

console.log("\n--- post-scrub counts ---");
for (const t of [...TARGETS.map((x) => x[0]), "stores", "staff_profiles", "drop_reasons"]) {
  console.log(`   ${t.padEnd(16)} ${String(await count(t)).padStart(5)}`);
}

await client.end();
console.log(`\nDone. Restore if needed from ${backupPath.replace(ROOT + "\\", "")}`);
console.log("NOTE: seed-catalog.mjs now seeds the store row only; real stock comes from npm run seed:sj.");
