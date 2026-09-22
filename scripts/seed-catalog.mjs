/* Seeds the store row into Supabase (no Prisma).

   Run AFTER: migrations_010 + migrations_020 in SQL Editor.
   Env needed: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
   Usage: npm run seed:catalog (idempotent — the write is an upsert)

   This file used to also seed a demo catalogue (8 invented products, 6 fake
   categories, 4 invented suppliers, 31 synthetic variants with fabricated
   8900000000xx barcodes) and 5 fake customers with plausible Indian mobile
   numbers. All of it has been DELETED as unnecessary: fake customer PII has no
   place in a real database, and invented products/variants would pollute Stage 3
   trial analytics and the barcode collision checks with stock that doesn't exist.

   What seeds real data instead:
     npm run seed:sj    # the client's S J FASHIONS barcode export -> products
                        # (+ categories from Department, suppliers from Party)
     npm run seed:auth  # staff logins from scripts/staff.seed.json
   Idempotent — all writes are upserts. */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  console.error("Run via npm (uses --env-file=.env).");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function upsert(table, rows, onConflict) {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`${table}:`, error.message);
    process.exit(1);
  }
  console.log(`${table}: upserted ${rows.length}`);
}

/* The store is not demo data: staff_profiles.store_id FKs to it and every RLS
   policy scopes through it, so staff logins cannot work without this row. */
await upsert("stores", [
  { id: "store-thaltej", name: "JadePink Ahmedabad", code: "JP-AHM-01", city: "Ahmedabad", address: "G-8 Harmony Icon, near Baghban Party Plot, Hebatpur Road, Thaltej, Ahmedabad 380054", active: true },
], "id");

console.log("\nDone — store row only. Next: npm run seed:sj (real stock), then npm run seed:auth");
