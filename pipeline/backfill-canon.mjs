import fs from "fs";
import { createRequire } from "module";
const require = createRequire("/tmp/");
const { dishKeyTokens, tokensMatch, dishNameClean, isJunkDishName, canonKey, canonLookup } = require("/tmp/worker-fns.cjs");

const APPLY = process.argv.includes("--apply");
const CF = fs.readFileSync("/home/sandbox/.vault/cloudflare-api-token-antojo-backend-workers-d1-90d-exp-24-en-c25df7/password","utf8").trim();
const URLQ = "https://api.cloudflare.com/client/v4/accounts/141942ccf46ef90151a898a59500a34a/d1/database/db8bb701-8381-4c7d-945f-06884e4bae16/query";
async function sql(s){
  const r = await fetch(URLQ, { method:"POST", headers:{ Authorization:`Bearer ${CF}`, "Content-Type":"application/json" }, body: JSON.stringify({ sql: s }) });
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors).slice(0,200) + " :: " + s.slice(0,100));
  return d.result[0].results;
}
const q = s => "'" + String(s).replace(/'/g,"''") + "'";

const dishes = await sql("SELECT id, name, price, chk FROM dishes");
console.log("dishes:", dishes.length);
// Good rows first: priced, fresh, clean, short
dishes.sort((a,b) => ((b.price!=null)-(a.price!=null)) || (b.chk||"").localeCompare(a.chk||"") ||
  (dishNameClean(b.name)-dishNameClean(a.name)) || (a.name.length-b.name.length));

const registry = []; // {key,name,toks}
const assign = new Map(); // dish id -> canon key
let skipped = 0;
for (const d of dishes) {
  if (isJunkDishName(d.name)) { skipped++; continue; }
  const toks = dishKeyTokens(d.name);
  if (!toks.length) { skipped++; continue; }
  const hit = canonLookup(registry, toks);
  if (hit) {
    assign.set(d.id, hit.key);
    if (!hit.aliasSet.has(d.name) && hit.aliasSet.size < 20) hit.aliasSet.add(d.name);
  } else {
    const key = canonKey(toks);
    const entry = { key, name: d.name.trim(), toks, aliasSet: new Set([d.name.trim()]) };
    registry.push(entry);
    assign.set(d.id, key);
  }
}
console.log("canonical dishes:", registry.length, "| rows assigned:", assign.size, "| skipped(junk):", skipped);
const byCount = registry.map(c => ({ key: c.key, name: c.name, n: 0, aliases: [...c.aliasSet] }));
const countOf = {};
for (const k of assign.values()) countOf[k] = (countOf[k]||0)+1;
byCount.forEach(c => c.n = countOf[c.key]||0);
byCount.sort((a,b) => b.n - a.n);
console.log("\nTop 15 por filas:");
byCount.slice(0,15).forEach(c => console.log(` ${c.n}x ${c.name} [${c.key}]${c.aliases.length>1 ? " alias: "+c.aliases.slice(1,4).join(" | ") : ""}`));

if (APPLY) {
  await sql("DELETE FROM dish_canon");
  for (const c of registry) {
    await sql(`INSERT INTO dish_canon(key,name,toks,aliases) VALUES(${q(c.key)},${q(c.name)},${q(JSON.stringify(c.toks))},${q(JSON.stringify([...c.aliasSet]))})`);
  }
  console.log("canon rows inserted:", registry.length);
  let done = 0; const errs = [];
  const ids = [...assign.entries()];
  const pool = 6;
  for (let i = 0; i < ids.length; i += pool) {
    await Promise.all(ids.slice(i, i+pool).map(async ([id, key]) => {
      try { await sql(`UPDATE dishes SET canon=${q(key)} WHERE id=${id}`); } catch(e){ errs.push(id+":"+e.message.slice(0,60)); }
    }));
    done += pool;
    if (done % 300 < pool) console.log("updated ~", Math.min(done, ids.length), "/", ids.length);
  }
  console.log("updates done. errors:", errs.length, errs.slice(0,3));
}
