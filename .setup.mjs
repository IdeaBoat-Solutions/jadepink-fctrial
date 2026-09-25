const BASE = "http://localhost:3123";
const jar = {};
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (Object.keys(jar).length) headers.Cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { ...opts, headers });
  const scs = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of scs) { const m = sc.match(/^([^=]+)=([^;]*)/); if (m) jar[m[1]] = m[2]; }
  let json = {};
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const setupEmail = process.env.SETUP_EMAIL;
const setupPassword = process.env.SETUP_PASSWORD;
if (!setupEmail || !setupPassword) throw new Error("SETUP_EMAIL and SETUP_PASSWORD are required");
await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: setupEmail, password: setupPassword }) });
// find a customer with no live visit
const s = await api("/api/customers/search?name=" + encodeURIComponent("riya"));
console.log("search riya:", s.status, JSON.stringify(s.json)?.slice(0, 200));
const cust = (s.json?.data || [])[0];
if (!cust) { console.log("no riya; abort"); process.exit(0); }
const walk = await api("/api/walk-ins", { method: "POST", body: JSON.stringify({ storeId: "store-thaltej" }) });
const visitId = walk.json?.data?.id;
console.log("walk-in:", visitId);
const att = await api(`/api/visits/${visitId}/attach`, { method: "POST", body: JSON.stringify({ customerId: cust.id }) });
console.log("attach:", att.status);
console.log("SETUP_VISIT=" + visitId);
