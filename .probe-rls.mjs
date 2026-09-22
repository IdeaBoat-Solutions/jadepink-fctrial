import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await c.connect();
const fns = await c.query("select p.proname, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ilike any(array['%manager%','%store%','%staff%'])");
console.log(fns.rows.map((r) => r.def).join("\n\n"));
const pols = await c.query("select tablename, policyname, cmd, qual from pg_policies where tablename in ('visits','customers') order by tablename, policyname");
console.log(JSON.stringify(pols.rows, null, 1));
await c.end();
