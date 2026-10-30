#!/usr/bin/env node
/*
 * extract-menu.js - candidatos de platos+precios desde la web OFICIAL de un restaurante.
 *
 * Metodologia adaptada de deielurbe/amsterdam-menus (licencia MIT, ver NOTICE.md):
 *  - la fuente es primero la web del propio local, no agregadores,
 *  - la carta se convierte en platos estructurados {nombre, precio},
 *  - higiene de precios: importes implausibles y duplicados se descartan.
 * (Historico y refresco: ideas de PriceBite, GPL-3.0, solo ideas - ver NOTICE.md.)
 *
 * IMPORTANTE: la salida son CANDIDATOS para revision. Nada entra en data.js sin
 * contrastar con la fuente: cada linea sale marcada como CANDIDATO y con su URL.
 *
 * Uso:
 *   node pipeline/extract-menu.js <url-de-la-carta> [--ch carta] [--max 40]
 *   pdftotext carta.pdf - | node pipeline/extract-menu.js --stdin <url-origen> [--ch pdf]
 */
"use strict";
const fs = require("fs");

const args = process.argv.slice(2);
let url = null, ch = "carta", max = 40, useStdin = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ch") ch = args[++i];
  else if (args[i] === "--max") max = parseInt(args[++i], 10);
  else if (args[i] === "--stdin") useStdin = true;
  else if (!url) url = args[i];
}
if (!url) {
  console.error("Falta la URL de origen (se usa como src de cada candidato).");
  process.exit(2);
}

const PRICE_RE = /(?:€\s?(\d{1,3}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{2}))\s?€)/;
const RUIDO = /\b(total|subtotal|iva|vat|tel|telefono|reserv|copyright|www\.|https?|@)\b/i;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#8364;|&euro;/g, "€").replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ");
}

function candidatos(texto) {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const m = PRICE_RE.exec(linea);
    if (!m) continue;
    const precio = parseFloat((m[1] || m[2]).replace(",", "."));
    if (!(precio >= 2 && precio <= 150)) continue; // higiene: importe de plato plausible
    let nombre = linea.slice(0, m.index).replace(/[.\-—·•:]+$/, "").trim();
    if (nombre.length < 3 && i > 0) nombre = lineas[i - 1].trim(); // precio en linea aparte
    nombre = nombre.replace(/\s{2,}/g, " ").replace(/^[.\-—·•*\d]+\s*/, "").trim();
    if (nombre.length < 3 || nombre.length > 60 || RUIDO.test(nombre)) continue;
    const clave = nombre.toLowerCase();
    if (seen.has(clave)) continue; // deduplicado
    seen.add(clave);
    out.push({ nombre, precio });
    if (out.length >= max) break;
  }
  return out;
}

function emite(lista) {
  console.log("// CANDIDATOS extraidos de " + url + " el " + new Date().toISOString().slice(0, 10));
  console.log("// REVISAR contra la fuente antes de publicar: nada entra en data.js sin verificacion.");
  for (const c of lista) {
    console.log("dish(" + JSON.stringify(c.nombre) + ", " + c.precio.toFixed(2) + ", " +
      JSON.stringify(url) + ", " + JSON.stringify(ch) + "), // CANDIDATO - revisar");
  }
  console.error(lista.length + " candidatos (max " + max + ")");
}

(async () => {
  let texto;
  if (useStdin) {
    texto = fs.readFileSync(0, "utf8");
    if (/<[a-z][\s\S]*>/i.test(texto)) texto = htmlToText(texto); // por si llega HTML en vez de texto plano
  } else {
    const res = await fetch(url, { headers: { "user-agent": "AntojoBot/0.1 (+https://github.com/lightsaber-design/restaurant)" } });
    if (!res.ok) { console.error("HTTP " + res.status + " en " + url); process.exit(1); }
    const tipo = res.headers.get("content-type") || "";
    if (tipo.includes("pdf")) {
      console.error("Es un PDF: descargalo y usa: pdftotext carta.pdf - | node pipeline/extract-menu.js --stdin " + url + " --ch pdf");
      process.exit(1);
    }
    texto = htmlToText(await res.text());
  }
  emite(candidatos(texto));
})().catch((e) => { console.error("Error: " + e.message); process.exit(1); });
