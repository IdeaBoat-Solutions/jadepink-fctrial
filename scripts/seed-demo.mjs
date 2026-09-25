/* Demo dataset for the FC-trial build: products (with real Unsplash photos),
   customers, and live visits that reproduce the "JadePink Ops" mockup screens
   (fitting-room trial, walk-in identification, live floor, FC dashboard).

   Every row here is clearly synthetic: ids are prefixed `demo-`, phone
   numbers are obviously fabricated (9000000xxx block), and nothing overlaps
   the real S J FASHIONS catalogue seeded by `npm run seed:sj`. Safe to
   re-run — every write is an upsert keyed by a stable demo- id.

   Run AFTER: npm run db:migrate, npm run seed:catalog, npm run seed:auth
   (the FCs referenced here — Riya Sharma, Mehul Joshi, Aakash Verma,
   Neha Patel, manager Vikram Singhania — must already exist; seed-auth adds
   them via scripts/staff.seed.json).
   Usage: npm run seed:demo */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORE_ID = process.env.STORE_ID || "store-thaltej";
if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const db = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function upsert(table, rows, onConflict = "id") {
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) { console.error(`${table}:`, error.message); process.exit(1); }
  console.log(`${table}: upserted ${rows.length}`);
}

async function staffByEmail(email) {
  const { data, error } = await db.from("staff_profiles").select("id, name").eq("email", email).maybeSingle();
  if (error) { console.error(`staff_profiles ${email}:`, error.message); process.exit(1); }
  if (!data) { console.error(`Missing staff ${email} — run \`npm run seed:auth\` first.`); process.exit(1); }
  return data;
}

const img = (id, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const minAgo = (min) => ago(min);
const daysAgo = (d, hh, mm) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hh, mm, 0, 0);
  return t.toISOString();
};

console.log(`Seeding demo dataset into store=${STORE_ID}\n`);

/* ---------- 1. Staff we reference by name ---------- */
const riya = await staffByEmail("fc-riya@jadepink.test");
const mehul = await staffByEmail("fc-mehul@jadepink.test");
const aakashV = await staffByEmail("fc-aakashverma@jadepink.test");

/* ---------- 2. Categories + supplier ---------- */
await upsert("categories", [
  { id: "demo-cat-kurta", name: "Kurta Sets", slug: "kurta-sets" },
  { id: "demo-cat-dress", name: "Dresses", slug: "dresses" },
  { id: "demo-cat-jumpsuit", name: "Jumpsuits", slug: "jumpsuits" },
  { id: "demo-cat-sherwani", name: "Sherwani & Bandhgala", slug: "sherwani-bandhgala" },
]);
await upsert("suppliers", [
  { id: "demo-sup-atelier", name: "JadePink Atelier Partners", contact: "Studio Desk", phone: "+91 79000 10001", city: "Ahmedabad", rating: 4.8 },
]);

/* ---------- 3. Products (Unsplash photos, verified 200 OK) ---------- */
const products = [
  { id: "demo-prod-4091", sku: "JP-KUR-4091", name: "Rose Chanderi Embroidered Kurta Set", category_id: "demo-cat-kurta", price: 12490, mrp: 14500, sizes: "S,M,L", colors: "Dusty Rose", photo: "1441986300917-64674bd600d8" },
  { id: "demo-prod-1023", sku: "JP-FAD-1023", name: "Floral A-Line Organza Dress", category_id: "demo-cat-dress", price: 8490, mrp: 9990, sizes: "S,M,L", colors: "Pink", photo: "1594633312681-425c7b97ccd1" },
  { id: "demo-prod-3042", sku: "JP-RAW-3042", name: "Raw Silk Belted Jumpsuit", category_id: "demo-cat-jumpsuit", price: 14200, mrp: 15900, sizes: "S,M,L", colors: "Sage Green", photo: "1519657337289-077653f724ed" },
  { id: "demo-prod-5012", sku: "JP-MET-5012", name: "Pleated Metallic Maxi Dress", category_id: "demo-cat-dress", price: 16800, mrp: 18500, sizes: "S,M,L", colors: "Gold Metallic", photo: "1515372039744-b8f02a3ae446" },
  { id: "demo-prod-4028", sku: "JP-BL-4028", name: "Embroidered Raw Silk Sherwani", category_id: "demo-cat-sherwani", price: 68500, mrp: 74000, sizes: "38,40,42", colors: "Desert Ochre", photo: "1591047139829-d91aecb6caea" },
  { id: "demo-prod-1104", sku: "JP-WG-1104", name: "Rose Gold Zari Bandhgala", category_id: "demo-cat-sherwani", price: 44000, mrp: 48000, sizes: "38,40,42", colors: "Rose Gold", photo: "1583394838336-acd977736f90" },
  { id: "demo-prod-1981", sku: "JP-BND-1981", name: "Heritage Bandhgala Suit", category_id: "demo-cat-sherwani", price: 38000, mrp: 42000, sizes: "40,42,44", colors: "Maroon", photo: "1620799140408-edc6dcb6d633" },
  { id: "demo-prod-2210", sku: "JP-FSK-2210", name: "Festive Silk Kurta", category_id: "demo-cat-kurta", price: 9800, mrp: 11200, sizes: "S,M,L", colors: "Ivory", photo: "1554568218-0f1715e72254" },
];
await upsert(
  "products",
  products.map((p) => ({
    id: p.id, sku: p.sku, name: p.name, category_id: p.category_id,
    price: p.price, mrp: p.mrp, cost: Math.round(p.price * 0.55), stock: 6, low_stock_at: 2,
    sizes: p.sizes, colors: p.colors, supplier_id: "demo-sup-atelier", branch_name: "HO",
    image_url: img(p.photo), image_urls: [img(p.photo), img(p.photo, 1200)],
  })),
  "id"
);

/* ---------- 4. Product variants (what visit_products actually points at) ---------- */
const variants = [
  { id: "demo-var-4091-m", product_id: "demo-prod-4091", sku: "JP-KUR-4091-M", size: "M", colour: "Dusty Rose", price: 12490 },
  { id: "demo-var-1023-m", product_id: "demo-prod-1023", sku: "JP-FAD-1023-M-PNK", size: "M", colour: "Pink", price: 8490 },
  { id: "demo-var-3042-s", product_id: "demo-prod-3042", sku: "JP-RAW-3042-S-SGE", size: "S", colour: "Sage Green", price: 14200 },
  { id: "demo-var-5012-m", product_id: "demo-prod-5012", sku: "JP-MET-5012-M-GLD", size: "M", colour: "Gold Metallic", price: 16800 },
  { id: "demo-var-4028-40", product_id: "demo-prod-4028", sku: "JP-BL-4028-40", size: "40", colour: "Desert Ochre", price: 68500 },
  { id: "demo-var-1104-38", product_id: "demo-prod-1104", sku: "JP-WG-1104-38", size: "38", colour: "Rose Gold", price: 44000 },
  { id: "demo-var-1981-40r", product_id: "demo-prod-1981", sku: "JP-BND-1981-40R", size: "40R", colour: "Maroon", price: 38000 },
  { id: "demo-var-2210-m", product_id: "demo-prod-2210", sku: "JP-FSK-2210-M", size: "M", colour: "Ivory", price: 9800 },
];
await upsert("product_variants", variants, "id");

/* ---------- 5. Customers (names match the mockups) ---------- */
const customers = [
  { id: "demo-cust-priya", name: "Priya Shah", mobile: "+91 98250 14892", normalized_phone: "9825014892", city: "Ahmedabad", area: "Thaltej", tier: "Gold", source: "Walk-in", visits: 7, purchases: 4, budget: "₹15,000 – ₹25,000" },
  { id: "demo-cust-rahul", name: "Rahul Mehta", mobile: "+91 90000 10002", normalized_phone: "9000010002", city: "Ahmedabad", area: "Bodakdev", tier: null, source: "Referral", visits: 3, purchases: 1, budget: "₹30,000+" },
  { id: "demo-cust-kavita", name: "Kavita Reddy", mobile: "+91 90000 10003", normalized_phone: "9000010003", city: "Ahmedabad", area: "Satellite", tier: null, source: "Instagram", visits: 1, purchases: 0, budget: "₹10,000 – ₹15,000" },
  { id: "demo-cust-neha", name: "Neha Patel", mobile: "+91 90000 10004", normalized_phone: "9000010004", city: "Ahmedabad", area: "Vastrapur", tier: "Silver", source: "Walk-in", visits: 2, purchases: 1, budget: "₹40,000+" },
  { id: "demo-cust-ananya", name: "Ananya Roy", mobile: "+91 90000 10005", normalized_phone: "9000010005", city: "Ahmedabad", area: "Prahlad Nagar", tier: null, source: "Walk-by Street", visits: 1, purchases: 1, budget: "₹20,000 – ₹30,000" },
  { id: "demo-cust-tanvi", name: "Tanvi Deshmukh", mobile: "+91 90000 10006", normalized_phone: "9000010006", city: "Ahmedabad", area: "SG Highway", tier: null, source: "Friend / Bridal", visits: 1, purchases: 0, budget: "₹50,000+" },
];
await upsert("customers", customers, "id");

/* ---------- 6. Visits — reproduces each mockup's live-floor state ---------- */
const visits = [
  // img1/img3: Priya Shah, ACTIVE trial in Suite 03 with Riya, 18m in.
  { id: "demo-visit-priya", customer_id: "demo-cust-priya", store_id: STORE_ID, assigned_salesperson_id: riya.id, status: "ACTIVE", suite: "Suite 03", budget: "₹15,000 – ₹25,000", arrived_at: minAgo(23), identified_at: minAgo(22), assigned_at: minAgo(20), started_at: minAgo(19) },
  // img4: Rahul Mehta, ACTIVE trial in Suite 01 with Aakash Verma, 24m in.
  { id: "demo-visit-rahul", customer_id: "demo-cust-rahul", store_id: STORE_ID, assigned_salesperson_id: aakashV.id, status: "ACTIVE", suite: "Suite 01", arrived_at: minAgo(29), identified_at: minAgo(28), assigned_at: minAgo(26), started_at: minAgo(24) },
  // img4: Kavita Reddy, floor-browsing with Mehul, suite not yet assigned.
  { id: "demo-visit-kavita", customer_id: "demo-cust-kavita", store_id: STORE_ID, assigned_salesperson_id: mehul.id, status: "ASSIGNED", arrived_at: minAgo(13), identified_at: minAgo(12), assigned_at: minAgo(12) },
  // img4: Neha Patel, urgent wait — identified, no FC yet (3m12s).
  { id: "demo-visit-neha", customer_id: "demo-cust-neha", store_id: STORE_ID, assigned_salesperson_id: null, status: "ARRIVED", arrived_at: minAgo(3) },
  // img6: Ananya Roy, completed today, billed ₹24,800.
  { id: "demo-visit-ananya", customer_id: "demo-cust-ananya", store_id: STORE_ID, assigned_salesperson_id: riya.id, status: "COMPLETED", arrived_at: daysAgo(0, 12, 40), identified_at: daysAgo(0, 12, 41), assigned_at: daysAgo(0, 12, 42), started_at: daysAgo(0, 12, 45), completed_at: daysAgo(0, 13, 15) },
  // img6: Tanvi Deshmukh, identification pending, seated in Central Salon.
  { id: "demo-visit-tanvi", customer_id: "demo-cust-tanvi", store_id: STORE_ID, assigned_salesperson_id: null, status: "IDENTIFYING", arrived_at: minAgo(6) },
];
await upsert("visits", visits, "id");

/* ---------- 7. Visit products — Priya's fitting-room board (img1) ---------- */
const priyaProducts = [
  { id: "demo-vp-priya-1", visit_id: "demo-visit-priya", product_variant_id: "demo-var-4091-m", status: "TRIAL_IN_PROGRESS", added_at: minAgo(18), trial_started_at: minAgo(4) },
  { id: "demo-vp-priya-2", visit_id: "demo-visit-priya", product_variant_id: "demo-var-1023-m", status: "TRIAL_COMPLETED", added_at: minAgo(17), trial_started_at: minAgo(15), trial_completed_at: minAgo(3), staff_note: "Inquire on silhouette & comfort" },
  { id: "demo-vp-priya-3", visit_id: "demo-visit-priya", product_variant_id: "demo-var-3042-s", status: "LIKED", added_at: minAgo(16), trial_started_at: minAgo(14), trial_completed_at: minAgo(11), liked_at: minAgo(11), staff_note: "Pack with garment sleeve" },
  { id: "demo-vp-priya-4", visit_id: "demo-visit-priya", product_variant_id: "demo-var-2210-m", status: "LIKED", added_at: minAgo(15), trial_started_at: minAgo(13), trial_completed_at: minAgo(10), liked_at: minAgo(10) },
  {
    id: "demo-vp-priya-5", visit_id: "demo-visit-priya", product_variant_id: "demo-var-5012-m", status: "DROPPED",
    added_at: minAgo(14), trial_started_at: minAgo(12), trial_completed_at: minAgo(9), dropped_at: minAgo(9),
    drop_reason_id: "drop-fit", note: "Customer loved color, needs 2 inches hemmed",
  },
];
await upsert("visit_products", priyaProducts, "id");

/* ---------- 8. Rahul's board (img4 · 3 trialled, 2 liked, 1 dropped) ---------- */
const rahulProducts = [
  { id: "demo-vp-rahul-1", visit_id: "demo-visit-rahul", product_variant_id: "demo-var-1981-40r", status: "TRIAL_IN_PROGRESS", added_at: minAgo(20), trial_started_at: minAgo(6) },
  { id: "demo-vp-rahul-2", visit_id: "demo-visit-rahul", product_variant_id: "demo-var-4028-40", status: "LIKED", added_at: minAgo(22), trial_started_at: minAgo(19), trial_completed_at: minAgo(15), liked_at: minAgo(15) },
  { id: "demo-vp-rahul-3", visit_id: "demo-visit-rahul", product_variant_id: "demo-var-1104-38", status: "SELECTED", added_at: minAgo(10) },
];
await upsert("visit_products", rahulProducts, "id");

/* ---------- 9. Kavita's board — just browsing, 5 selected, none trialled ---------- */
const kavitaProducts = [
  { id: "demo-vp-kavita-1", visit_id: "demo-visit-kavita", product_variant_id: "demo-var-4091-m", status: "SELECTED", added_at: minAgo(9) },
  { id: "demo-vp-kavita-2", visit_id: "demo-visit-kavita", product_variant_id: "demo-var-2210-m", status: "SELECTED", added_at: minAgo(8) },
];
await upsert("visit_products", kavitaProducts, "id");

/* ---------- 10. Ananya's completed + billed board ---------- */
const ananyaProducts = [
  { id: "demo-vp-ananya-1", visit_id: "demo-visit-ananya", product_variant_id: "demo-var-4091-m", status: "PURCHASED", added_at: daysAgo(0, 12, 46), trial_started_at: daysAgo(0, 12, 48), trial_completed_at: daysAgo(0, 12, 55), liked_at: daysAgo(0, 12, 55), bill_number: "JP-BILL-10231", purchased_at: daysAgo(0, 13, 15) },
  { id: "demo-vp-ananya-2", visit_id: "demo-visit-ananya", product_variant_id: "demo-var-2210-m", status: "PURCHASED", added_at: daysAgo(0, 12, 47), trial_started_at: daysAgo(0, 12, 56), trial_completed_at: daysAgo(0, 13, 2), liked_at: daysAgo(0, 13, 2), bill_number: "JP-BILL-10231", purchased_at: daysAgo(0, 13, 15) },
];
await upsert("visit_products", ananyaProducts, "id");
await upsert("orders", [
  { id: "demo-order-ananya", code: "JP-BILL-10231", customer_id: "demo-cust-ananya", customer_name: "Ananya Roy", customer_phone: "+91 90000 10005", total: 24800, status: "completed", channel: "walk-in", fc_name: riya.name, staff_id: riya.id, store_id: STORE_ID, created_at: daysAgo(0, 13, 15) },
], "id");
await upsert("order_items", [
  { id: "demo-oi-ananya-1", order_id: "demo-order-ananya", product_id: "demo-prod-4091", product_name: "Rose Chanderi Embroidered Kurta Set", qty: 1, price: 12490 },
  { id: "demo-oi-ananya-2", order_id: "demo-order-ananya", product_id: "demo-prod-2210", product_name: "Festive Silk Kurta", qty: 1, price: 9800 },
  { id: "demo-oi-ananya-3", order_id: "demo-order-ananya", product_id: "demo-prod-2210", product_name: "Festive Silk Kurta (dupatta add-on)", qty: 1, price: 2510 },
], "id");

console.log("\nDone. Sign in as fc-riya@jadepink.test (or any seeded FC), password JadePink123!, to see Priya Shah's live trial.");
console.log("Manager view: manager-vikram@jadepink.test / JadePink123! -> /floor for the live-floor board.");
