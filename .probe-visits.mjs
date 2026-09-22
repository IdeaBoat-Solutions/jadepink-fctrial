import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await c.connect();
const v = await c.query("select id, status, assigned_salesperson_id from visits where id = '28e90037-5f66-4147-9bba-25d6b474b5f8'");
console.log("VISIT:", JSON.stringify(v.rows, null, 1));
const ev = await c.query("select event_type, created_at from visit_events where visit_id = '28e90037-5f66-4147-9bba-25d6b474b5f8' order by created_at");
console.log("EVENTS:", JSON.stringify(ev.rows, null, 1));
await c.end();
