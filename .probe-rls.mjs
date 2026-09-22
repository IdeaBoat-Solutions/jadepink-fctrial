import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await c.connect();
const pol = await c.query("select policyname, cmd, qual from pg_policies where tablename = 'staff_profiles' order by policyname");
console.log(JSON.stringify(pol.rows, null, 1));
await c.end();
