/* Backfills one product_variant per S J FASHIONS product (live client records).
   SJ barcode rows are already variant-level (size/colour/design per barcode),
   so each sj-* product gets exactly one variant keyed on its barcode.
   Idempotent: upserts on id. Run AFTER scripts/import-sj-barcodes.mjs.
   Usage: npm run seed:sj-variants */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Page through all sj-* products (PostgREST caps at 1000 rows per request).
const products = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin
    .from("products")
    .select("id,sku,barcode,company_barcode,price,size,color")
    .like("id", "sj-%")
    .order("id")
    .range(from, from + 999);
  if (error) { console.error("products:", error.message); process.exit(1); }
  products.push(...data);
  if (data.length < 1000) break;
}
console.log(`sj products: ${products.length}`);

// De-dupe SKUs (variant.sku is unique + not null).
const seenSku = new Set();
const variants = [];
let skipped = 0;
for (const p of products) {
  if (!p.barcode) { skipped++; continue; }
  let sku = (p.company_barcode || p.barcode || "").trim();
  if (!sku) { skipped++; continue; }
  if (seenSku.has(sku)) sku = `${sku}~${p.barcode}`;
  seenSku.add(sku);
  variants.push({
    id: `pv-${p.barcode}`,
    product_id: p.id,
    sku,
    barcode: p.barcode,
    size: (p.size || "F").slice(0, 20),
    colour: (p.color || "ONE_COLOUR").slice(0, 40),
    price: p.price ?? 0,
    image_key: null,
    is_active: true,
  });
}
console.log(`variants to upsert: ${variants.length} (skipped ${skipped})`);

let done = 0;
for (let i = 0; i < variants.length; i += 200) {
  const batch = variants.slice(i, i + 200);
  const { error } = await admin.from("product_variants").upsert(batch, { onConflict: "id" });
  if (error) { console.error("product_variants:", error.message); process.exit(1); }
  done += batch.length;
  console.log(`product_variants: ${done}/${variants.length}`);
}
console.log("\nDone. Scan flow can now resolve every SJ barcode.");
