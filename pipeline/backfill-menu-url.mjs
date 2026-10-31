// Rellena menu_url (NULL) desde OSM: tags menu/contact:menu primero, luego
// website/contact:website/url. Uso: node backfill-menu-url.mjs overpass.json
// (genera UPDATEs SQL por stdout; solo toca venues con menu_url NULL).
import fs from "fs";
const overpass = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const sql = (v) => v == null ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";
let n = 0;
for (const el of overpass.elements || []) {
  const t = el.tags || {};
  const web = t["contact:menu"] || t.menu || t["contact:website"] || t.website || t.url || null;
  if (!web || !/^https?:\/\//i.test(web)) continue;
  const id = "osm-" + el.type[0] + el.id;
  console.log(`UPDATE venues SET menu_url=${sql(web)} WHERE id=${sql(id)} AND menu_url IS NULL;`);
  n++;
}
console.error(`updates: ${n}`);
