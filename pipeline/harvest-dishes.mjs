#!/usr/bin/env node
/*
 * harvest-dishes.mjs - cosecha platos+precios de las cartas OFICIALES de los
 * locales descubiertos (pipeline/discover-venues.mjs), para las cocinas que
 * Carol pidio ampliar (31 oct 2026: sushi primero; tambien pho y tacos, los
 * encargos que el backend marco "needs_review").
 *
 * Misma higiene que worker/extractCandidates (metodologia adaptada de
 * deielurbe/amsterdam-menus, MIT - ver NOTICE.md): nombre 3-60 sin digitos,
 * precio 1.5-80 EUR, deduplicado por local. Cada plato entra con src (URL de
 * la carta oficial), chk (fecha de hoy), ch ("carta") y nota "extraido por
 * bot, revision pendiente": NADA inventado. Los sitios que son PDF o JS puro
 * quedan para el cron del worker.
 *
 * Uso: node pipeline/harvest-dishes.mjs /tmp/venues_new.json > /tmp/dishes.sql
 */
import fs from "fs";

const venues = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const HOY = new Date().toISOString().slice(0, 10);
const MAX_BYTES = 900000;

const GRUPOS = {
  sushi: ["sushi","roll","maki","nigiri","sashimi","temaki","futomaki","hosomaki","norimaki","california","uramaki","gyoza","edamame","tataki","poke","bento","dragon","rainbow","temari","kimono","volcano"],
  vietnamita: ["pho","bun cha","banh mi","goi cuon","spring roll","rollito","summer roll"],
  mexicana: ["taco","burrito","quesadilla","enchilada","fajita","nachos","birria","pastor","carnitas","guacamole","chimichanga","tostada","tinga","elote"],
};
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|td|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&euro;/g, "€").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ");
}
function extractCandidates(text) {
  const out = []; const seen = {};
  function push(name, price) {
    name = name.trim().replace(/\s+/g, " ").replace(/^[·\-\u2013\u2014: ]+/, "");
    if (name.length < 3 || name.length > 60) return;
    if (/\d/.test(name)) return;
    if (!(price >= 1.5 && price <= 80)) return;
    const k = norm(name);
    if (seen[k]) return;
    seen[k] = 1; out.push({ name, price });
  }
  const re = /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü'&’()\- ]{2,60}?)\s*[·\-–—:]?\s*(?:€|EUR\s?)(\d{1,2}[.,]\d{1,2})/g;
  let m;
  while ((m = re.exec(text)) && out.length < 300) push(m[1], parseFloat(m[2].replace(",", ".")));
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const priceLine = /^(?:€\s?)(\d{1,2}[.,]\d{1,2})$/;
  const nameLine = /^[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü'&’()\- ]{2,60}$/;
  for (let i = 0; i < lines.length && out.length < 400; i++) {
    const pm = lines[i].match(priceLine);
    if (!pm) continue;
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (nameLine.test(lines[j]) && !/\(.*?\d.*?\)/.test(lines[j])) { push(lines[j], parseFloat(pm[1].replace(",", "."))); break; }
      if (priceLine.test(lines[j])) break;
    }
  }
  return out;
}
async function fetchRaw(u) {
  const res = await fetch(u, {
    headers: { "user-agent": "AntojoBot/0.1 (+https://github.com/lightsaber-design/restaurant)", accept: "text/html,*/*" },
    redirect: "follow", signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const ct = res.headers.get("content-type") || "";
  if (!/text|html/.test(ct)) throw new Error("content-type " + ct);
  const buf = await res.arrayBuffer();
  return new TextDecoder().decode(buf.slice(0, MAX_BYTES));
}
const fetchText = async (u) => htmlToText(await fetchRaw(u));
// Enlaces internos que pintan a carta (un nivel de profundidad).
function menuLinks(html, base) {
  const out = []; const seen = {};
  const re = /href=["']([^"'#]+)["'][^>]*>([^<]{0,60})</gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1], texto = norm(m[2]);
    if (!/menu|carta|food|comida|eat|takeaway|para-llevar|order/.test(norm(url) + " " + texto)) continue;
    if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|webp)(\?|$)/i.test(url)) continue;
    let abs;
    try { abs = new URL(url, base).href; } catch (e) { continue; }
    if (!/^https?:/.test(abs)) continue;
    if (/facebook\.com|instagram\.com|twitter\.com|deliveroo|just-eat|ubereats/.test(abs)) continue;
    if (seen[abs]) continue;
    seen[abs] = 1; out.push(abs);
    if (out.length >= 4) break;
  }
  return out;
}
const targets = venues.filter((v) => {
  if (!v.menu_url || /facebook\.com|instagram\.com/.test(v.menu_url)) return false;
  return Object.keys(GRUPOS).some((g) => v.cats.includes(g));
});
console.error("objetivos: " + targets.length);
const rows = [];
let done = 0, conPlatos = 0;
async function work(v) {
  const grupo = Object.keys(GRUPOS).find((g) => v.cats.includes(g));
  const terminos = GRUPOS[grupo];
  let urls = [v.menu_url, v.menu_url.replace(/\/$/, "") + "/menu"];
  try {
    // Un nivel de profundidad: de la portada a los enlaces que pintan a carta.
    const home = await fetchRaw(v.menu_url);
    urls = urls.concat(menuLinks(home, v.menu_url));
  } catch (e) { /* abajo se reintenta la portada como texto */ }
  const probadas = new Set();
  for (const u of urls.slice(0, 6)) {
    if (probadas.has(u)) continue;
    probadas.add(u);
    try {
      const text = await fetchText(u);
      const cands = extractCandidates(text).filter((c) => terminos.some((t) => norm(c.name).includes(norm(t))));
      if (cands.length) {
        for (const c of cands.slice(0, 12)) rows.push({ venue_id: v.id, name: c.name, price: c.price, src: u });
        conPlatos++;
        return;
      }
    } catch (e) { /* el cron lo reintenta */ }
  }
}
const CONC = 8;
for (let i = 0; i < targets.length; i += CONC) {
  await Promise.all(targets.slice(i, i + CONC).map(work));
  done = Math.min(i + CONC, targets.length);
  process.stderr.write("\r" + done + "/" + targets.length + " locales, " + rows.length + " platos");
}
console.error("\nlocales con platos: " + conPlatos + " | platos: " + rows.length);
const sql = (v) => v == null ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";
console.log("-- Platos cosechados de cartas oficiales (bot, revision pendiente) el " + HOY);
console.log("BEGIN TRANSACTION;");
for (const r of rows) {
  console.log(`INSERT OR IGNORE INTO dishes(venue_id,name,price,src,ch,chk,note,created_at,updated_at) VALUES(` +
    `${sql(r.venue_id)},${sql(r.name)},${r.price},${sql(r.src)},'carta','${HOY}',` +
    `${sql("extraido de la carta oficial (bot, revision pendiente)")},date('now'),date('now'));`);
}
console.log("COMMIT;");
