// Semilla D1 desde data.js (la base verificada de la demo). Uso:
//   CF_TOKEN=... CF_ACCOUNT=... CF_D1=... node seed.mjs
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../data.js", import.meta.url), "utf8");
const mod = { exports: {} };
new Function("module", "exports", src + "\nmodule.exports = { VENUES, DUBLIN_CENTER };")(mod, mod.exports);
const { VENUES } = mod.exports;
const { CF_TOKEN, CF_ACCOUNT, CF_D1 } = process.env;
if (!CF_TOKEN || !CF_ACCOUNT || !CF_D1) { console.error("faltan CF_TOKEN/CF_ACCOUNT/CF_D1"); process.exit(1); }
async function q(sql, params = []) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${CF_D1}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${CF_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params })
  });
  const j = await res.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j;
}
function menuUrlOf(v) {
  // La fuente mas usada entre sus platos con precio = la carta a re-fetch
  const freq = {};
  for (const d of v.dishes) if (d.src) freq[d.src] = (freq[d.src] || 0) + 1;
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}
let nv = 0, nd = 0;
for (const v of VENUES) {
  await q(
    "INSERT INTO venues(id,name,address,lat,lon,rating,reviews,band,cat,cats,source,menu_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address,lat=excluded.lat,lon=excluded.lon," +
    "rating=excluded.rating,reviews=excluded.reviews,band=excluded.band,cat=excluded.cat,cats=excluded.cats," +
    "source=excluded.source,menu_url=excluded.menu_url",
    [v.id, v.name, v.address || null, v.lat, v.lon, v.rating ?? null, v.reviews ?? null, v.band || null,
     v.cat || null, v.cats ? JSON.stringify(v.cats) : null, v.source || null, menuUrlOf(v)]
  );
  nv++;
  for (const d of v.dishes) {
    await q(
      "INSERT INTO dishes(venue_id,name,price,src,ch,chk,hist) VALUES(?,?,?,?,?,?,?) " +
      "ON CONFLICT(venue_id,name) DO UPDATE SET price=excluded.price,src=excluded.src,ch=excluded.ch,chk=excluded.chk,hist=excluded.hist,updated_at=date('now')",
      [v.id, d.name, d.price ?? null, d.src || null, d.ch || null, d.chk || null, d.hist ? JSON.stringify(d.hist) : null]
    );
    nd++;
  }
  if (nv % 10 === 0) console.log(`venues ${nv}, dishes ${nd}`);
}
console.log(`OK: ${nv} locales, ${nd} platos`);
