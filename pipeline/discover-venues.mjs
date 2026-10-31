#!/usr/bin/env node
/*
 * discover-venues.mjs - descubre locales reales en OpenStreetMap (Overpass,
 * gratis) y genera el SQL para ampliar la tabla venues de D1.
 *
 * Reglas (Carol): solo fuentes abiertas y con licencia compatible (ODbL, OSM;
 * ver NOTICE.md), nada inventado: cada fila lleva source con fecha. La
 * categoria se deriva del tag cuisine de OSM; los platos NO se crean aqui,
 * los investigan pipeline/harvest-dishes.mjs y el cron del worker contra las
 * cartas oficiales. Locales sin web quedan con menu_url NULL: el cron los
 * revisa cuando el plato se encarga.
 *
 * Uso: node pipeline/discover-venues.mjs /tmp/dv.json /tmp/existing.json > /tmp/venues.sql
 */
import fs from "fs";

const overpass = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const existing = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

const SKIP = [/^banyi$/i]; // Banyi cerro (nov 2025); en su direccion abrio Izushi
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const km = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
function mapCats(cuisine, amenity) {
  const list = (cuisine || "").split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const cats = new Set();
  for (const c of list) {
    if (/sushi/.test(c)) cats.add("sushi");
    else if (c === "japanese" || c === "izakaya") { cats.add("japones"); cats.add("sushi"); }
    else if (/ramen|noodle/.test(c)) cats.add("ramen");
    else if (/burger|american|smash/.test(c)) cats.add("hamburguesas");
    else if (/pizza|italian|pasta/.test(c)) cats.add("pizza");
    else if (/breakfast|brunch/.test(c)) cats.add("brunch");
    else if (/coffee|cafe|cake|bakery|bubble_tea|ice_cream|tea|donut|dessert|pastry|chocolate|crepe|waffle/.test(c)) cats.add("cafe");
    else if (/mexican|tex-mex|taco|burrito|latin_american/.test(c)) cats.add("mexicana");
    else if (/vietnamese|pho/.test(c)) cats.add("vietnamita");
    else if (/indian|curry|pakistani|nepalese/.test(c)) cats.add("india");
    else if (/chinese|asian|thai|korean|malaysian|indonesian|pan-asian/.test(c)) cats.add("asiatica");
    else if (/kebab|turkish|shawarma|falafel|lebanese|mediterranean|middle_eastern|greek|persian/.test(c)) cats.add("kebab");
    else if (/chicken|fried_chicken|wings/.test(c)) cats.add("pollo");
    else if (/sandwich|deli|sub|bagel/.test(c)) cats.add("sandwich");
    else if (/seafood|fish/.test(c)) cats.add("pescado");
    else if (/steak|bbq|grill|barbecue|brazilian|argentinian/.test(c)) cats.add("parrilla");
    else if (/vegetarian|vegan|health_food|salad|poke/.test(c)) cats.add("veggie");
    else if (/tapas|spanish|portuguese/.test(c)) cats.add("tapas");
    else if (/pub|gastropub|irish/.test(c)) cats.add("pub");
    else if (/fish_and_chips/.test(c)) cats.add("chipper");
    else if (/french|european|fine_dining|international|fusion|regional|local/.test(c)) cats.add("restaurante");
  }
  if (!cats.size) cats.add(amenity === "cafe" ? "cafe" : amenity === "fast_food" ? "comida_rapida" : "restaurante");
  return [...cats];
}
const sql = (v) => v == null ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";

const out = [];
const seenNames = [];
let skipped = 0, dupExisting = 0, dupSelf = 0;
for (const el of overpass.elements) {
  const t = el.tags || {};
  const name = (t.name || "").trim();
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) { skipped++; continue; }
  if (SKIP.some((re) => re.test(name))) { skipped++; continue; }
  const n = norm(name);
  if (existing.some((v) => (norm(v.name) === n || norm(v.name).includes(n) || n.includes(norm(v.name))) && km(v, { lat, lon }) < 0.15)) { dupExisting++; continue; }
  if (seenNames.some((v) => norm(v.name) === n && km(v, { lat, lon }) < 0.15)) { dupSelf++; continue; }
  const web = t["contact:website"] || t.website || t.url || null;
  const cats = mapCats(t.cuisine, t.amenity);
  const addr = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || t["addr:city"] || null;
  const v = {
    id: "osm-" + el.type[0] + el.id,
    name, address: addr, lat, lon,
    cat: cats[0], cats,
    menu_url: web,
  };
  seenNames.push(v);
  out.push(v);
}
console.error(`candidatos: ${overpass.elements.length} | insertar: ${out.length} | dup existentes: ${dupExisting} | dup internos: ${dupSelf} | sin datos: ${skipped}`);
console.log("-- Locales descubiertos en OpenStreetMap (Overpass API, bbox condado de Dublin) el 2026-10-31.");
console.log("-- Fuente: © OpenStreetMap contributors (ODbL). Cada fila lleva su fuente y fecha.");
console.log("BEGIN TRANSACTION;");
for (const v of out) {
  console.log(`INSERT OR IGNORE INTO venues(id,name,address,lat,lon,rating,reviews,band,cat,cats,source,menu_url,created_at) VALUES(` +
    `${sql(v.id)},${sql(v.name)},${sql(v.address)},${v.lat},${v.lon},NULL,NULL,NULL,` +
    `${sql(v.cat)},${sql(JSON.stringify(v.cats))},${sql("OpenStreetMap (overpass-api.de), 31 oct 2026")},${sql(v.menu_url)},date('now'));`);
}
console.log("COMMIT;");
fs.writeFileSync("/tmp/venues_new.json", JSON.stringify(out, null, 1));
