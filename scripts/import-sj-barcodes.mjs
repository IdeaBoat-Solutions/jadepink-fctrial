/* Imports the S J FASHIONS "Barcode Search" export (live client records) into Supabase.
   Usage:
     node scripts/import-sj-barcodes.mjs --file supabase/seeds/sj_barcodes_sample.csv
     node scripts/import-sj-barcodes.mjs --file "C:/exports/SJ Barcode Search.csv" --dry-run
     npm run seed:sj -- --file supabase/seeds/sj_barcodes_sample.csv
   Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
   Idempotent: upserts categories (Department), suppliers (Party/Brand),
   products keyed on Barcode. Re-run safe. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback = undefined) => {
  const i = args.findIndex((a) => a === name || a.startsWith(name + "="));
  if (i === -1) return fallback;
  const a = args[i];
  if (a.includes("=")) return a.slice(name.length + 1);
  return args[i + 1] ?? fallback;
};
const FILE = opt("--file", "supabase/seeds/sj_barcodes_sample.csv");
const DRY = args.includes("--dry-run");
const BATCH = Number(opt("--batch", "200")) || 200;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

/* ---------- minimal CSV parser (handles quoted commas) ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c === "\r") { /* skip */ }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[,₹\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const str = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "." || s === "-" || s === "--") return null;
  return s;
};
const dateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const slug = (s, fb) =>
  String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fb;

let raw;
try {
  raw = readFileSync(FILE, "utf8");
} catch {
  console.error(`Cannot read --file ${FILE}`);
  process.exit(1);
}
// Strip BOM, drop the report title line if present ("S J FASHIONS / Barcode Search")
raw = raw.replace(/^\uFEFF/, "");
const table = parseCSV(raw);
if (!table.length) { console.error("Empty CSV"); process.exit(1); }
let headerIdx = table.findIndex((r) => r.some((c) => /barcode/i.test(String(c))) && r.some((c) => /brand/i.test(String(c))));
if (headerIdx === -1) headerIdx = 0;
const header = table[headerIdx].map((h) => String(h).trim());
const data = table.slice(headerIdx + 1);
const col = (...names) => {
  for (const n of names) {
    const i = header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
    if (i !== -1) return i;
  }
  const n0 = names[0].toLowerCase();
  return header.findIndex((h) => h.toLowerCase().includes(n0));
};
const C = {
  barcode: col("Barcode"),
  companyBarcode: col("Company Barcode"),
  branch: col("Branch Name"),
  dept: col("Department"),
  brand: col("Brand Name"),
  product: col("Product Name"),
  itemId: col("Item ID"),
  item: col("Item"),
  itemGroup: col("ItemGroup Name"),
  hsn: col("HSN Code"),
  party: col("Party Name"),
  city: col("City Name"),
  agent: col("Agent Name"),
  design: col("Design No."),
  lot: col("Lot No"),
  color: col("Color"),
  size: col("Size"),
  season: col("Season"),
  sub2: col("SubCategory2"),
  sub3: col("SubCategory3"),
  qty: col("Qty"),
  salesRate: col("Sales Rate"),
  dayBook: col("Day Book"),
  inVchNo: col("Inward Vch No."),
  inVchDate: col("Inward Vch Date"),
  purcBill: col("Purc BillNo"),
  purVchNo: col("Purchase Vch No."),
  purVchDt: col("Purchase Vch Dt"),
  purRate: col("Pur. Rate"),
  purNet: col("Pur.Net Rate"),
  purCost: col("PurCost. Rate"),
  purExp: col("Pur Exp. Rate"),
  markup: col("Mark Up %"),
  markdown: col("Mark Down %"),
  images: col("image_urls", "Image Urls"),
};
const get = (row, i) => (i === -1 || i === undefined ? "" : (row[i] ?? ""));

let skipped = 0;
const products = [];
const catMap = new Map(); // dept -> {id,name,slug}
const supMap = new Map(); // party -> {...}
for (const row of data) {
  const barcode = str(get(row, C.barcode));
  if (!barcode) { skipped++; continue; }
  const dept = str(get(row, C.dept)) || "Uncategorised";
  const brand = str(get(row, C.brand));
  const party = str(get(row, C.party)) || brand || "S J FASHIONS";
  const item = str(get(row, C.item)) || str(get(row, C.product)) || "Item";
  const design = str(get(row, C.design));
  const size = str(get(row, C.size));
  const color = str(get(row, C.color));
  const salesRate = num(get(row, C.salesRate));
  const qty = num(get(row, C.qty));
  const purNet = num(get(row, C.purNet));
  const purCost = num(get(row, C.purCost));
  const purRate = num(get(row, C.purRate));

  const catId = "cat-" + slug(dept, "uncategorised").slice(0, 40);
  if (!catMap.has(catId)) catMap.set(catId, { id: catId, name: dept, slug: slug(dept, "uncategorised").slice(0, 60) });
  const supId = "sup-" + slug(party, "sj").slice(0, 40);
  if (!supMap.has(supId)) {
    supMap.set(supId, { id: supId, name: party, contact: str(get(row, C.agent)), city: str(get(row, C.city)), rating: 4.5 });
  }

  const price = Math.round(salesRate ?? purCost ?? purNet ?? 0) || 1;
  const cost = Math.round(purCost ?? purNet ?? purRate ?? 0) || 0;
  const stock = Math.max(0, Math.round(qty ?? 1));
  const name = [item, design].filter(Boolean).join(" · ") || item;
  const imagesRaw = str(get(row, C.images));
  const image_urls = imagesRaw ? imagesRaw.split("|").map((s) => s.trim()).filter(Boolean) : [];

  products.push({
    id: `sj-${barcode}`,
    sku: str(get(row, C.companyBarcode)) || barcode,
    name: name.slice(0, 200),
    category_id: catId,
    price,
    mrp: price,
    cost,
    stock,
    low_stock_at: 1,
    sizes: size || "F",
    colors: color || "",
    supplier_id: supId,
    barcode,
    company_barcode: str(get(row, C.companyBarcode)),
    branch_name: str(get(row, C.branch)) || "HO",
    department: dept,
    brand_name: brand,
    item_id: str(get(row, C.itemId)),
    item_group_name: str(get(row, C.itemGroup)),
    hsn_code: str(get(row, C.hsn)),
    party_name: party,
    party_city: str(get(row, C.city)),
    agent_name: str(get(row, C.agent)),
    design_no: design,
    lot_no: str(get(row, C.lot)),
    color,
    size,
    season: str(get(row, C.season)),
    subcategory2: str(get(row, C.sub2)),
    subcategory3: str(get(row, C.sub3)),
    qty: qty ?? 1,
    sales_rate: salesRate,
    day_book: str(get(row, C.dayBook)),
    inward_vch_no: str(get(row, C.inVchNo)),
    inward_vch_date: dateOrNull(get(row, C.inVchDate)),
    purc_bill_no: str(get(row, C.purcBill)),
    purchase_vch_no: str(get(row, C.purVchNo)),
    purchase_vch_date: dateOrNull(get(row, C.purVchDt)),
    pur_rate: purRate,
    pur_net_rate: purNet,
    pur_cost_rate: purCost,
    pur_exp_rate: num(get(row, C.purExp)),
    markup_pct: num(get(row, C.markup)),
    markdown_pct: num(get(row, C.markdown)),
    image_url: image_urls[0] ?? null,
    image_urls,
  });
}

console.log(`Parsed ${products.length} live records (${skipped} skipped), ${catMap.size} departments, ${supMap.size} parties.`);
// De-dupe by barcode (last row wins, mirrors Tally-style re-exports)
const byBarcode = new Map(products.map((p) => [p.barcode, p]));
const uniq = [...byBarcode.values()];
console.log(`Unique barcodes: ${uniq.length}`);

if (DRY) {
  console.log("Dry run — first 3 rows:");
  console.log(JSON.stringify(uniq.slice(0, 3), null, 2));
  process.exit(0);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const chunk = (arr, n) => arr.reduce((a, _, i) => (i % n === 0 ? [...a, arr.slice(i, i + n)] : a), []);
for (const b of chunk([...catMap.values()], BATCH)) {
  const { error } = await admin.from("categories").upsert(b, { onConflict: "id" });
  if (error) { console.error("categories:", error.message); process.exit(1); }
}
console.log(`categories: upserted ${catMap.size}`);
for (const b of chunk([...supMap.values()], BATCH)) {
  const { error } = await admin.from("suppliers").upsert(b, { onConflict: "id" });
  if (error) { console.error("suppliers:", error.message); process.exit(1); }
}
console.log(`suppliers: upserted ${supMap.size}`);
let done = 0;
for (const b of chunk(uniq, BATCH)) {
  const { error } = await admin.from("products").upsert(b, { onConflict: "barcode" });
  if (error) { console.error("products:", error.message); process.exit(1); }
  done += b.length;
  console.log(`products: ${done}/${uniq.length}`);
}
console.log("\nDone. Verify: select count(*) from products where id like 'sj-%';");
