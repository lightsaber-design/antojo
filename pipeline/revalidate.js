#!/usr/bin/env node
/*
 * revalidate.js - cola de revalidacion de precios.
 *
 * Regla de Carol: un precio guardado se revalida a los 90 dias; si no se puede
 * revalidar, se marca obsoleto y NUNCA se muestra como vigente. La cola se
 * ordena por urgencia y, dentro de cada tramo, por lo mas buscado ("los
 * precios viejos se vuelven a buscar, primero los mas buscados").
 * (Refresco programado: idea de PriceBite, GPL-3.0, solo ideas - ver NOTICE.md.)
 *
 * Uso:
 *   node pipeline/revalidate.js [--data ruta/a/data.js] [--searches busquedas.json]
 *
 * --searches: JSON {"termino": conteo}. La demo guarda las busquedas del
 * dispositivo en localStorage (clave "antojo-searches-v1"); exportalas a un
 * JSON para priorizar la cola con lo que se busca de verdad.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
let dataPath = path.join(__dirname, "..", "data.js");
let searchesPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--data") dataPath = args[++i];
  else if (args[i] === "--searches") searchesPath = args[++i];
}

const code = fs.readFileSync(dataPath, "utf8");
const load = new Function(code + "\n;return { VENUES: VENUES, FRESH: (typeof FRESH_DAYS !== 'undefined') ? FRESH_DAYS : 90 };");
const data = load();
const VENUES = data.VENUES, FRESH = data.FRESH;

let searches = {};
if (searchesPath) searches = JSON.parse(fs.readFileSync(searchesPath, "utf8"));

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function searchScore(dishName) {
  let score = 0;
  for (const term of Object.keys(searches)) {
    const t = norm(String(term).trim());
    if (t && norm(dishName).indexOf(t) >= 0) score += searches[term] || 0;
  }
  return score;
}

const ahora = new Date();
const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
const rows = [];
for (const v of VENUES) {
  for (const d of v.dishes) {
    const hits = searchScore(d.name);
    if (d.price == null || !d.chk) {
      rows.push({ venue: v.name, dish: d.name, price: null, chk: d.chk || "-", days: null, estado: "pendiente", hits });
      continue;
    }
    const p = d.chk.split("-");
    const days = Math.floor((hoy - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000);
    const estado = days > FRESH ? "OBSOLETO" : (days >= FRESH - 15 ? "revalidar pronto" : "fresco");
    rows.push({ venue: v.name, dish: d.name, price: d.price, chk: d.chk, days, estado, hits });
  }
}
const rank = (r) => (r.estado === "OBSOLETO" ? 0 : r.estado === "revalidar pronto" ? 1 : r.estado === "fresco" ? 2 : 3);
rows.sort((a, b) => rank(a) - rank(b) || b.hits - a.hits || (b.days == null ? -1 : b.days) - (a.days == null ? -1 : a.days) || a.venue.localeCompare(b.venue));

const cuenta = { OBSOLETO: 0, "revalidar pronto": 0, fresco: 0, pendiente: 0 };
rows.forEach((r) => cuenta[r.estado]++);
console.log("Cola de revalidacion Antojo (regla: " + FRESH + " dias; primero lo mas buscado)");
console.log("Resumen: " + cuenta.OBSOLETO + " obsoletos, " + cuenta["revalidar pronto"] + " por revalidar pronto, " +
  cuenta.fresco + " frescos, " + cuenta.pendiente + " pendientes de fuente.");
if (searchesPath) console.log("Priorizando con busquedas de " + searchesPath);
console.log("");
for (const r of rows) {
  const dias = r.days == null ? "  -" : String(r.days).padStart(3);
  const hits = searchesPath ? (" buscado:" + r.hits) : "";
  const precio = r.price == null ? "sin precio" : "€" + r.price.toFixed(2);
  console.log(r.estado.toUpperCase().padEnd(17) + " " + dias + "d  " + r.venue + " - " + r.dish + " (" + precio + ", " + r.chk + ")" + hits);
}
const frescos = rows.filter((r) => r.days != null);
if (frescos.length) {
  const minChk = frescos.map((r) => r.chk).sort()[0];
  const p = minChk.split("-");
  const limite = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + FRESH));
  console.log("\nLa verificacion mas antigua es " + minChk + "; su limite de revalidacion es " + limite.toISOString().slice(0, 10) + ".");
}
