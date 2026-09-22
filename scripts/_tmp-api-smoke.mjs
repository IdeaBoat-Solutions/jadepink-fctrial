/* API smoke test through the real running Next server, as a signed-in FC:
   login -> me -> roster (the /visits dropdown source) -> visits list ->
   walk-in -> attach -> ASSIGN -> cleanup. This is exactly the path
   FCQuickAssign + FcRoster take. */
const BASE = process.env.SMOKE_BASE || "http://localhost:3123";
const EMAIL = process.env.VERIFY_FC_EMAIL || "fc-aakash@jadepink.test";
const PASSWORD = process.env.TEMP_STAFF_PASSWORD || "JadePink123!";

let pass = 0, fail = 0;
const ok = (l) => { pass++; console.log(`  ok     ${l}`); };
const bad = (l, d) => { fail++; console.log(`  FAILED ${l}${d ? ` -> ${d}` : ""}`); };
const check = (l, c, d) => (c ? ok(l) : bad(l, d));

const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(jar.size ? { Cookie: cookieHeader() } : {}), ...init.headers },
  });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return res;
}

console.log(`\n=== API smoke as FC ${EMAIL} @ ${BASE} ===\n`);

// 1. Login + me
const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
check("login", login.ok, `${login.status}`);
const me = await api("/api/staff/me");
const meBody = await me.json().catch(() => ({}));
const profile = meBody?.profile ?? meBody?.data?.profile; // accept both shapes
check("me resolves profile", !!profile, JSON.stringify(meBody).slice(0, 120));
const storeId = profile?.storeId;
check("profile has storeId", !!storeId, "null storeId");

// 2. Roster — exactly what the /visits dropdown renders from
const roster = await api(`/api/salespersons?storeId=${encodeURIComponent(storeId)}`);
const rosterBody = await roster.json().catch(() => ({}));
check("GET /api/salespersons 200", roster.ok, `${roster.status} ${JSON.stringify(rosterBody).slice(0, 200)}`);
const spList = rosterBody?.data ?? [];
check("roster has >= 2 FCs (colleagues visible)", spList.length >= 2, `got ${spList.length}: ${spList.map((s) => s.name).join(", ")}`);

// 3. Visits list
const visits = await api(`/api/visits?storeId=${encodeURIComponent(storeId)}`);
const visitsBody = await visits.json().catch(() => ({}));
check("GET /api/visits 200", visits.ok, `${visits.status} ${JSON.stringify(visitsBody).slice(0, 200)}`);
const vList = visitsBody?.data ?? [];
check("visits list non-empty", vList.length > 0, "empty");

// 4. Full assign path as FC: walk-in -> temp customer -> attach -> ASSIGN COLLEAGUE
const walk = await api("/api/walk-ins", { method: "POST", body: JSON.stringify({ storeId }) });
const walkBody = await walk.json().catch(() => ({}));
check("POST /api/walk-ins", walk.ok, `${walk.status} ${JSON.stringify(walkBody).slice(0, 200)}`);
const visit = walkBody?.data;

const mobile = "9" + String(Date.now()).slice(-9);
const cRes = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "Smoke FCAssign", phone: mobile }) });
const cBody = await cRes.json().catch(() => ({}));
check("POST /api/customers", cRes.ok, `${cRes.status} ${JSON.stringify(cBody).slice(0, 200)}`);
const customerId = cBody?.data?.id;

const att = await api(`/api/visits/${visit.id}/attach`, { method: "POST", body: JSON.stringify({ customerId }) });
check("POST attach", att.ok, `${att.status}`);

const colleague = spList.find((s) => s.id !== profile.id) ?? spList[0];
const asg = await api(`/api/visits/${visit.id}/assign`, { method: "POST", body: JSON.stringify({ salespersonId: colleague.id }) });
const asgBody = await asg.json().catch(() => ({}));
check(`POST assign -> ${colleague.name} (a colleague, not self)`, asg.ok, `${asg.status} ${JSON.stringify(asgBody).slice(0, 200)}`);
check("assign response status ASSIGNED", asgBody?.data?.status === "ASSIGNED", asgBody?.data?.status);
check("assign response carries assignedSalespersonId", asgBody?.data?.assignedSalespersonId === colleague.id, asgBody?.data?.assignedSalespersonId);

// 5. Idempotency + reassign-guard sanity: FC picks the SAME fc again -> still ok
const again = await api(`/api/visits/${visit.id}/assign`, { method: "POST", body: JSON.stringify({ salespersonId: colleague.id }) });
check("idempotent re-pick same FC", again.ok, `${again.status}`);

// 6. Start visit to prove the assigned state is usable
const start = await api(`/api/visits/${visit.id}/start`, { method: "POST" });
check("POST start (ASSIGNED -> ACTIVE)", start.ok, `${start.status}`);

// 7. Cleanup
await api(`/api/visits/${visit.id}`, { method: "DELETE" });
await api(`/api/customers/${customerId}`, { method: "DELETE" }).catch(() => {});

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
