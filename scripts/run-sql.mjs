/* Apply a .sql file to Supabase Postgres, with a rollback backup.
   Why this exists: supabase/*.sql are the source of truth, but this project has no
   migration tool - the README says "paste into SQL Editor". This makes that step
   scriptable and reviewable.

   Env: DIRECT_URL (preferred, session mode :5432) else DATABASE_URL (pooler :6543).
   Usage:
     npm run db:probe                                  # connect + dump current RLS backup
     npm run db:apply -- supabase/migrations_020_security.sql        # apply one file in ONE transaction
     npm run db:apply -- supabase/migrations_010_base_schema.sql supabase/migrations_020_security.sql   # in order */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const BACKUP_DIR = join(ROOT, "supabase", "backups");

const CONN = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!CONN) {
  console.error("Missing DIRECT_URL / DATABASE_URL in .env");
  process.exit(1);
}

const PROBE = process.argv.includes("--probe");
/* --rebaseline: accept the current repo file as the new checksum for anything
   already applied. Only safe when the live DB genuinely already matches the
   file (e.g. after a re-ordering or a no-op edit the DB already reflects). */
const REBASELINE = process.argv.includes("--rebaseline");
const FILES = process.argv.slice(2).filter((a) => a.endsWith(".sql"));

const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });

await client.connect();
const { rows } = await client.query("select current_database() as db, version() as ver, current_user as usr, current_setting('server_version') as sver");
const v = rows[0];
console.log(`Connected: db=${v.db} user=${v.usr} postgres=${v.sver} | endpoint=${CONN.includes("@") ? CONN.split("@").pop() : "?"}`);

/* ---------- Live schema dump: repo files drift from production; this is the ground truth ---------- */
async function dumpSchema() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(BACKUP_DIR, `schema-live-${stamp}.sql`);

  const tables = await client.query(`
    select c.relname, c.relkind,
           (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as cols
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m') order by c.relname`);

  const cols = await client.query(`
    select c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as type,
           case when a.attnotnull then 'not null' else '' end as nn,
           coalesce(pg_get_expr(d.adbin, d.adrelid), '') as def
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid and c.relkind in ('r','p')
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attnum > 0 and not a.attisdropped order by c.relname, a.attnum`);

  const cons = await client.query(`
    select c.relname as tbl, con.conname, con.contype, pg_get_constraintdef(con.oid) as def
    from pg_constraint con join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    order by c.relname, con.conname`);

  const idx = await client.query(`
    select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname`);

  const enums = await client.query(`
    select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
    group by t.typname order by t.typname`);

  const byTable = (rows, key) => {
    const m = new Map();
    for (const r of rows) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); }
    return m;
  };
  const colsBy = byTable(cols.rows, "tbl");
  const consBy = byTable(cons.rows, "tbl");
  const idxBy = byTable(idx.rows, "tablename");

  const L = [`-- LIVE schema of public schema — read from the database ${new Date().toISOString()}`,
    `-- This is ground truth. Compare against supabase/migrations_010_base_schema.sql before writing new migrations.`, ``];

  L.push(`-- ===== TABLES (${tables.rows.filter((t) => t.relkind === "r").length}) / VIEWS (${tables.rows.filter((t) => t.relkind === "v").length}) =====`);
  for (const t of tables.rows) {
    const kind = { r: "table", v: "view", m: "matview", p: "partitioned table" }[t.relkind];
    L.push(`-- ${t.relname.padEnd(24)} ${kind}${t.cols && t.cols > 0 ? ` (${t.cols} cols)` : ""}`);
  }
  if (enums.rows.length) {
    L.push(``, `-- ===== ENUM TYPES =====`);
    for (const e of enums.rows) L.push(`-- ${e.typname}: ${e.labels}`);
  }
  L.push(``, `-- ===== COLUMNS / CONSTRAINTS / INDEXES =====`);
  for (const t of tables.rows.filter((x) => x.relkind === "r")) {
    L.push(``, `-- ---- ${t.relname} ----`);
    for (const c of colsBy.get(t.relname) ?? []) L.push(`--   ${c.col.padEnd(26)} ${c.type.padEnd(24)} ${c.nn} ${c.def ? "default " + c.def : ""}`.trimEnd());
    for (const k of consBy.get(t.relname) ?? []) L.push(`--   constraint ${k.conname} [${k.contype}] ${k.def}`);
    for (const i of idxBy.get(t.relname) ?? []) L.push(`--   index ${i.indexdef}`);
  }
  L.push(``, `-- ===== ORPHAN INDEXES (not backing a constraint) =====`);
  for (const i of idx.rows.filter((x) => !x.indexdef.includes("PRIMARY KEY") && !x.indexdef.includes("UNIQUE CONSTRAINT"))) {
    L.push(`-- ${i.tablename} :: ${i.indexname}`);
  }
  writeFileSync(out, L.join("\n") + "\n", "utf8");
  console.log(`Schema: ${tables.rows.filter((t) => t.relkind === "r").length} tables, ${cols.rows.length} columns, ${cons.rows.length} constraints, ${idx.rows.length} indexes -> ${out.replace(ROOT + "\\", "")}`);
  return out;
}

if (process.argv.includes("--schema")) {
  await dumpSchema();
  await client.end();
  process.exit(0);
}

/* ---------- Backup: dump roles, policies, functions, views as recreatable DDL ---------- */
async function backup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(BACKUP_DIR, `rls-before-${stamp}.sql`);

  const pol = await client.query(`
    select c.relname as tbl, p.polname,
           case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE'
                         when 'd' then 'DELETE' when '*' then 'ALL' end as cmd,
           array(select r::regrole::text from unnest(p.polroles) r) as for_roles,
           pg_get_expr(p.polqual, p.polrelid) as using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
    order by c.relname, p.polname`);

  const fn = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' order by p.proname`);

  const vw = await client.query(`
    select c.relname,
           (select reloptions from pg_class where oid = c.oid) as reloptions,
           pg_get_viewdef(c.oid, true) as def
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v','m') order by c.relname`);

  const grant = await client.query(`
    select c.relname,
           pg_catalog.array_agg(
             a.privilege_type || ' to ' || coalesce(r.rolname, 'PUBLIC') ||
             case when a.is_grantable then ' with grant option' else '' end
             order by a.privilege_type
           ) as grants
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    left join lateral pg_catalog.aclexplode(c.relacl) a on true
    left join pg_roles r on r.oid = a.grantee
    where c.relkind in ('r','v','m')
    group by c.relname order by c.relname`);

  const lines = [
    `-- RLS snapshot before patch — generated ${new Date().toISOString()}`,
    `-- Restore guidance: re-create policies/functions/views from this file.`,
    ``,
    `-- ---------- policies (${pol.rows.length}) ----------`,
    ...pol.rows.map((r) =>
      `-- ${r.tbl} :: ${r.polname} :: ${r.cmd} to ${(r.for_roles || []).join(",") || "public"}\n` +
      `--   USING: ${r.using_expr ?? "(none)"}\n` +
      `--   CHECK: ${r.check_expr ?? "(none)"}`),
    ``,
    `-- ---------- functions (${fn.rows.length}) ----------`,
    ...fn.rows.map((r) => r.def + ";"),
    ``,
    `-- ---------- views (${vw.rows.length}) ----------`,
    ...vw.rows.map((r) => `-- ${r.relname} reloptions=${JSON.stringify(r.reloptions)}\n${r.def}`),
    ``,
    `-- ---------- table grants ----------`,
    ...grant.rows.map((r) => `-- ${r.relname}: ${(r.grants || []).join(" | ")}`),
    ``,
  ];
  writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`Backup: ${pol.rows.length} policies, ${fn.rows.length} functions, ${vw.rows.length} views -> ${out.replace(ROOT + "\\", "")}`);
  return out;
}

/* ---------- Migration ledger ----------
   Repo .sql files and the live database drift: a file can be applied twice, or
   a live table can already exist while the repo file has no CREATE ... IF NOT
   EXISTS. Without a ledger, a re-run either errors on already-applied DDL or
   silently skips changes. supabase_migrations records what actually ran, so
   db:migrate is idempotent and a failure in one file no longer hides the rest. */

const LEDGER_DDL = `
create table if not exists public.supabase_migrations (
  version text primary key,
  checksum text,
  applied_at timestamptz not null default now()
);`;

async function ensureLedger() {
  await client.query(LEDGER_DDL);
}

async function appliedVersions() {
  const { rows } = await client.query("select version from public.supabase_migrations");
  return new Set(rows.map((r) => r.version));
}

function versionOf(f) {
  return f.replace(/\\/g, "/").split("/").pop();
}

/** Cheap content hash — detects "this file changed after it was applied".
    Newlines are normalized first: git's CRLF checkout would otherwise report
    drift for a file nobody edited. */
function checksumOf(sql) {
  const text = sql.replace(/\r\n/g, "\n");
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/* ---------- Apply ---------- */
let failures = 0;
let skipped = 0;
await ensureLedger();
const already = await appliedVersions();

for (const f of FILES) {
  const version = versionOf(f);
  const path = isAbsolute(f) ? f : join(ROOT, f);
  let sql;
  try {
    sql = readFileSync(path, "utf8");
  } catch {
    console.error(`Cannot read ${f}`);
    failures++;
    continue;
  }

  if (already.has(version)) {
    const { rows } = await client.query("select checksum from public.supabase_migrations where version = $1", [version]);
    const current = checksumOf(sql);
    const drift = rows[0]?.checksum && rows[0].checksum !== current;
    if (drift && REBASELINE) {
      // Operator asserted the live DB already matches this file (e.g. the edit
      // was a re-ordering the DB already reflects). Accept the new baseline
      // instead of demanding a re-apply.
      await client.query("update public.supabase_migrations set checksum = $2 where version = $1", [version, current]);
      console.log(`Rebaselined: ${version}`);
      skipped++;
      continue;
    }
    console.log(`Skipped (already applied): ${version}${drift ? "  [!] file changed since it was applied" : ""}`);
    skipped++;
    if (drift) failures++;
    continue;
  }

  try {
    await client.query("begin");
    // One simple-protocol query => whole file executes in the open transaction.
    await client.query(sql);
    await client.query("insert into public.supabase_migrations (version, checksum) values ($1, $2) on conflict (version) do nothing", [version, checksumOf(sql)]);
    await client.query("commit");
    console.log(`Applied: ${version}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    // Drift signal: the live DB already has part of this file (e.g. a policy
    // that exists but is missing from the repo's drop list). Not fatal to the
    // rest of the run — report it and keep going.
    console.error(`FAILED ${version}: ${e.message}${e.position ? ` (near char ${e.position})` : ""}`);
    failures++;
  }
}

if (PROBE || FILES.length === 0) await backup();

await client.end();
if (skipped) console.log(`Ledger: ${skipped} already applied, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
