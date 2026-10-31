import fs from "fs";
import { createRequire } from "module";
const require = createRequire("/tmp/");
const { norm, dishKeyTokens, tokensMatch, dishNameClean, isJunkDishName, dishCategory } = require("/tmp/worker-fns.cjs");

const APPLY = process.argv.includes("--apply");
const CF = fs.readFileSync("/home/sandbox/.vault/cloudflare-api-token-antojo-backend-workers-d1-90d-exp-24-en-c25df7/password","utf8").trim();
const ACC = "141942ccf46ef90151a898a59500a34a";
const DB = "db8bb701-8381-4c7d-945f-06884e4bae16";
const URLQ = `https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`;
async function sql(s){
  const r = await fetch(URLQ, { method:"POST", headers:{ Authorization:`Bearer ${CF}`, "Content-Type":"application/json" }, body: JSON.stringify({ sql: s }) });
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors).slice(0,300) + " :: " + s.slice(0,120));
  return d.result[0].results;
}
const q = s => "'" + String(s).replace(/'/g,"''") + "'";
const lit = v => v == null ? "NULL" : (typeof v === "number" ? String(v) : q(v));

const dishes = await sql("SELECT id, venue_id, name, price, src, ch, chk, hist FROM dishes ORDER BY venue_id, id");
console.log("total dishes:", dishes.length);

const byVenue = new Map();
for (const d of dishes) { if (!byVenue.has(d.venue_id)) byVenue.set(d.venue_id, []); byVenue.get(d.venue_id).push(d); }

const deletes = new Set();       // ids
const updates = new Map();       // id -> row patch
let junkDeleted = 0, junkMerged = 0, mergeGroups = 0;
const samples = [];

function badChars(n){ let c=0; for (const ch of n) if (ch==="\uFFFD" || ch.charCodeAt(0)<32) c++; return c; }
function parseHist(h){ try { const a = JSON.parse(h||"[]"); return Array.isArray(a)?a:[]; } catch(e){ return []; } }

for (const [venue, rows] of byVenue) {
  const clean = [], junk = [];
  for (const r of rows) (isJunkDishName(r.name) ? junk : clean).push(r);
  // cluster clean rows
  const clusters = []; // {toks, members:[]}
  for (const r of clean) {
    const toks = dishKeyTokens(r.name);
    if (!toks.length) { // name reduces to nothing: junk only if tiny fragment; else keep as singleton
      if (r.name.trim().length <= 4) { junk.push(r); continue; }
      clusters.push({ toks: [], members: [r] }); continue;
    }
    const c = clusters.find(c => tokensMatch(c.toks, toks));
    if (c) c.members.push(r); else clusters.push({ toks, members:[r] });
  }
  // attach junk rows to a matching cluster, else drop if >=2 bad chars
  for (const j of junk) {
    const toks = dishKeyTokens(j.name);
    const c = toks.length ? clusters.find(c => tokensMatch(c.toks, toks)) : null;
    if (c) { c.members.push(j); junkMerged++; }
    else if (badChars(j.name) >= 2 || !toks.length || (/[()]/.test(j.name) && !/[a-z]/.test(j.name))) { deletes.add(j.id); junkDeleted++; if (samples.length<30) samples.push(`JUNK DELETE ${venue}: ${JSON.stringify(j.name)}`); }
    // single bad char, no partner: leave as-is
  }
  for (const c of clusters) {
    if (c.members.length < 2) continue;
    mergeGroups++;
    const mem = c.members;
    // survivor: freshest chk, then has price, then cleanest name
    const surv = [...mem].sort((a,b) =>
      (b.chk||"").localeCompare(a.chk||"") || ((b.price!=null)-(a.price!=null)) || (dishNameClean(b.name)-dishNameClean(a.name)) || (a.id-b.id))[0];
    // final name: cleanest name among members
    const cap = n => /[A-ZÁÉÍÓÚÑ]/.test(n) ? 1 : 0;
    const bc = n => badChars(n);
    const bestName = [...mem].sort((a,b) => (bc(a.name)-bc(b.name)) || (cap(b.name)-cap(a.name)) || (a.name.length-b.name.length))[0].name.trim();
    // final price: latest chk among priced members
    const priced = mem.filter(m => m.price != null).sort((a,b) => (b.chk||"").localeCompare(a.chk||""));
    const pv = priced[0] || null;
    // merged hist
    let hist = [];
    for (const m of mem) hist = hist.concat(parseHist(m.hist));
    for (const m of mem) {
      if (m.price != null && (!pv || m.id !== pv.id)) {
        const e = { price: m.price, src: m.src, ch: m.ch, chk: m.chk };
        if (!hist.some(h => h.price===e.price && h.chk===e.chk && h.src===e.src)) hist.push(e);
      }
    }
    hist = hist.filter(h => !(pv && h.price===pv.price && h.chk===pv.chk && h.src===pv.src)).slice(-20);
    const dcat = dishCategory(bestName);
    updates.set(surv.id, { name: bestName, price: pv?pv.price:null, src: pv?pv.src:null, ch: pv?pv.ch:null, chk: pv?pv.chk:null, hist: JSON.stringify(hist), dcat });
    for (const m of mem) if (m.id !== surv.id) deletes.add(m.id);
    if (samples.length < 15) samples.push(`${venue}: [${mem.map(m=>m.name).join(" | ")}] -> "${bestName}" (${pv?pv.price+"€ "+pv.chk:"sin precio"})`);
  }
}

console.log("merge groups:", mergeGroups, "| rows to delete:", deletes.size, "(junk-only:", junkDeleted, ", junk merged into survivors:", junkMerged+")", "| survivors to update:", updates.size);
console.log(samples.join("\n"));
// check name collisions after merge within venue
const finalNames = new Map();
for (const [venue, rows] of byVenue) {
  const names = new Set();
  for (const r of rows) {
    if (deletes.has(r.id)) continue;
    const n = updates.has(r.id) ? updates.get(r.id).name : r.name;
    const key = norm(n);
    if (names.has(key)) console.log("COLLISION:", venue, n);
    names.add(key);
  }
}

if (APPLY) {
  let done = 0;
  for (const id of deletes) { await sql(`DELETE FROM dishes WHERE id=${id}`); if (++done % 100 === 0) console.log("deleted", done); }
  console.log("deletes done:", done);
  done = 0;
  for (const [id, u] of updates) {
    await sql(`UPDATE dishes SET name=${lit(u.name)}, price=${lit(u.price)}, src=${lit(u.src)}, ch=${lit(u.ch)}, chk=${lit(u.chk)}, hist=${lit(u.hist)}, dcat=${lit(u.dcat)}, updated_at=date('now') WHERE id=${id}`);
    if (++done % 100 === 0) console.log("updated", done);
  }
  console.log("updates done:", done);
  const after = await sql("SELECT COUNT(*) c FROM dishes");
  console.log("dishes after:", after[0].c);
}
