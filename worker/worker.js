// Antojo API (Fase 1) - Cloudflare Worker + D1. Sin dependencias.
// Busqueda por plato con precio, distancia y frescura (regla de 90 dias);
// lo que no esta en la base queda encargado (queue) y un cron lo investiga
// en las cartas oficiales de los locales registrados. Nada de precios
// inventados: todo lo que entra lleva src (URL), chk (fecha) y ch (canal).
// Metodologia de extraccion adaptada de deielurbe/amsterdam-menus (MIT) - ver NOTICE.md.
const CENTER = { lat: 53.3498, lon: -6.2603 };
const FRESH_DAYS = 90;
const MAX_FETCH_BYTES = 900000;

const SINONIMOS = {
  sushi: ["sushi","roll","maki","nigiri","sashimi","temaki","futomaki","hosomaki","norimaki","california"],
  rolls: ["roll","maki","norimaki","futomaki"], maki: ["maki","roll","norimaki","hosomaki","futomaki"],
  nigiri: ["nigiri","sushi"], sashimi: ["sashimi","sushi"],
  hamburguesa: ["hamburguesa","burger","hamburger","cheeseburger","smash"],
  hamburguesas: ["hamburguesa","burger","hamburger","cheeseburger","smash"],
  burger: ["burger","hamburger","cheeseburger","smash","hamburguesa"],
  pollo: ["pollo","chicken","katsu","karaage"], gambas: ["gamba","prawn","shrimp","ebi"],
  gamba: ["gamba","prawn","shrimp","ebi"], cerdo: ["cerdo","pork","chashu","bacon","pancetta"],
  ternera: ["ternera","beef","angus","brisket","steak"],
  pescado: ["pescado","fish","salmon","tuna","seabass"], salmon: ["salmon","sake"],
  atun: ["atun","tuna","maguro"], huevos: ["huevos","egg","benedict","scrambled"],
  huevo: ["huevo","egg","benedict","scrambled"], desayuno: ["desayuno","breakfast","brunch","irish"],
  pancakes: ["pancake","tortitas"], tortitas: ["pancake","tortitas"],
  noodles: ["noodle","ramen","udon","soba","yaki"], fideos: ["noodle","ramen","udon","soba","fideos"],
  arroz: ["arroz","rice","donburi","chahan"," don"], gyoza: ["gyoza","dumpling"],
  dumplings: ["dumpling","gyoza"], veggie: ["veggie","vegetarian","vegan","veg ","halloumi"],
  vegetariano: ["vegetarian","vegan","veggie","veg ","halloumi"],
  picante: ["picante","spicy","chilli","chili","hot"], cafe: ["cafe","coffee"],
  croissant: ["croissant","bolleria"], curry: ["curry","katsu"], bao: ["bao","bun"],
  brunch: ["brunch","breakfast","irish","pancake","egg"],
  pizza: ["pizza","pizze","napoletana","romana","margherita"],
  pasta: ["pasta","spaghetti","tagliatelle","penne","ravioli","lasagna","gnocchi","carbonara","pesto"],
  tacos: ["taco","tacos","birria","al pastor","carnitas"], burrito: ["burrito","burritos"],
  tapas: ["tapas","raciones","pintxos"], pho: ["pho","viet"],
  kebab: ["kebab","doner","shawarma","durum"], falafel: ["falafel"],
  wings: ["wings","alitas","buffalo"], alitas: ["alitas","wings","buffalo"],
  steak: ["steak","ternera","beef","entrecote","ribeye","sirloin"],
  poke: ["poke","poké"], sandwich: ["sandwich","bocadillo","toastie","sándwich"],
  bocadillo: ["bocadillo","sandwich","toastie"], ensalada: ["ensalada","salad"],
  salad: ["salad","ensalada"], postre: ["postre","dessert","cake","tarta","brownie"],
  dessert: ["dessert","postre","cake","tarta","brownie"],
  vino: ["vino","wine"], wine: ["wine","vino"], cerveza: ["cerveza","beer","ipa","lager","stout"],
  beer: ["beer","cerveza","ipa","lager","stout"],
  marisco: ["marisco","seafood","gambas","prawn","mussels","mejillones","calamari"],
  seafood: ["seafood","marisco","prawn","mussels","calamari"]
};
function norm(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
function terminosDe(t){
  if (SINONIMOS[t]) return SINONIMOS[t];
  if (t.length > 3 && t.endsWith("s") && SINONIMOS[t.slice(0,-1)]) return SINONIMOS[t.slice(0,-1)];
  return [t];
}
function venueCats(v){ try { return v.cats ? JSON.parse(v.cats) : [v.cat]; } catch(e){ return [v.cat]; } }
function matchesQuery(dishName, venueName, cats, q){
  const hay = norm(dishName + " " + venueName + " " + (cats||[]).join(" "));
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const frase = tokens.join(" ");
  if (frase.length >= 3 && hay.includes(frase)) return true;
  return tokens.every(t => terminosDe(t).some(term => hay.includes(term)));
}
function haversineKm(a, b){
  const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLon=(b.lon-a.lon)*Math.PI/180;
  const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180;
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function daysSince(iso){
  if (!iso) return 99999;
  const p = iso.split("-");
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - Date.UTC(+p[0], +p[1]-1, +p[2]))/86400000);
}
function json(obj, status, extraHeaders){
  return new Response(JSON.stringify(obj), { status: status||200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-antojo-key",
      "cache-control": "public, max-age=30" }, extraHeaders||{}) });
}
function rowToResult(r, ref){
  let hist = null;
  try { hist = r.hist ? JSON.parse(r.hist) : null; } catch(e) {}
  return {
    venue: { id: r.venue_id, name: r.vname, address: r.address, lat: r.lat, lon: r.lon,
      rating: r.rating, reviews: r.reviews, band: r.band, cat: r.cat,
      cats: r.cats ? JSON.parse(r.cats) : null, source: r.vsource },
    dish: { name: r.name, price: r.price, src: r.src, ch: r.ch, chk: r.chk, hist: hist },
    km: haversineKm(ref, { lat: r.lat, lon: r.lon })
  };
}

async function handleSearch(env, url){
  const q = (url.searchParams.get("q")||"").trim();
  const nq = norm(q);
  if (nq.length < 2) return json({ ok:true, results:[], queued:false });
  const lat = parseFloat(url.searchParams.get("lat")), lon = parseFloat(url.searchParams.get("lon"));
  const ref = (isFinite(lat) && isFinite(lon)) ? { lat, lon } : CENTER;
  const today = new Date().toISOString().slice(0,10);
  // Registrar la busqueda (alimenta "primero lo mas buscado")
  await env.DB.prepare(
    "INSERT INTO searches(term,display,count,last_at) VALUES(?,?,1,?) " +
    "ON CONFLICT(term) DO UPDATE SET count=count+1, display=excluded.display, last_at=excluded.last_at"
  ).bind(nq, q, today).run();
  const { results } = await env.DB.prepare(
    "SELECT d.*, v.name vname, v.address, v.lat, v.lon, v.rating, v.reviews, v.band, v.cat, v.cats, v.source vsource " +
    "FROM dishes d JOIN venues v ON v.id = d.venue_id"
  ).all();
  let rows = results.filter(r => matchesQuery(r.name, r.vname, venueCats(r), q))
                    .map(r => rowToResult(r, ref));
  rows.sort((a,b) => {
    const ap = a.dish.price, bp = b.dish.price;
    if (ap == null && bp == null) return a.km - b.km;
    if (ap == null) return 1; if (bp == null) return -1;
    return ap - bp;
  });
  // Con referencia (mapa o GPS), el corte prioriza lo cercano para que la
  // busqueda por zona no se quede sin los locales del area (31 oct 2026).
  const hasRef = isFinite(lat) && isFinite(lon);
  const cut = hasRef ? rows.slice().sort((a,b) => a.km - b.km).slice(0, 120) : rows.slice(0, 60);
  const vigentes = rows.filter(x => x.dish.price != null && daysSince(x.dish.chk) <= FRESH_DAYS);
  let queued = false;
  if (vigentes.length === 0) {
    // Encargo: se investiga en fuentes oficiales (cron), primero lo mas buscado
    const s = await env.DB.prepare("SELECT count FROM searches WHERE term=?").bind(nq).first();
    await env.DB.prepare(
      "INSERT INTO queue(term,display,priority,status) VALUES(?,?,?,'pending') " +
      "ON CONFLICT(term) DO UPDATE SET priority=excluded.priority, display=excluded.display, " +
      "status=CASE WHEN queue.status='done' THEN 'pending' ELSE queue.status END, updated_at=date('now')"
    ).bind(nq, q, (s && s.count) || 1).run();
    queued = true;
  }
  // Locales registrados que encajan con la busqueda (nombre o categoria) pero
  // sin platos verificados todavia: se muestran como "carta pendiente" para
  // que el mapa tenga cobertura real; el cron investiga sus cartas oficiales.
  const { results: allVenues } = await env.DB.prepare("SELECT * FROM venues").all();
  const withDish = new Set(rows.map(r => r.venue.id));
  let venueMatches = allVenues
    .filter(v => !withDish.has(v.id) && v.lat != null && matchesQuery("", v.name, venueCats(v), q))
    .map(v => ({ venue: { id: v.id, name: v.name, address: v.address, lat: v.lat, lon: v.lon,
        rating: v.rating, reviews: v.reviews, band: v.band, cat: v.cat,
        cats: v.cats ? JSON.parse(v.cats) : null, source: v.source },
      dish: null, km: haversineKm(ref, { lat: v.lat, lon: v.lon }) }));
  venueMatches.sort((a,b) => a.km - b.km);
  venueMatches = venueMatches.slice(0, 15);
  return json({ ok:true, results: cut, venue_matches: venueMatches, queued });
}

async function handleSuggest(env, url){
  const q = norm((url.searchParams.get("q")||"").trim());
  if (q.length < 2) return json({ ok:true, suggestions: [] });
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT name FROM dishes WHERE lower(name) LIKE ? ORDER BY length(name) LIMIT 7"
  ).bind("%" + q + "%").all();
  return json({ ok:true, suggestions: results.map(r => r.name) });
}

async function handleStats(env){
  const v = await env.DB.prepare("SELECT COUNT(*) n FROM venues").first();
  const d = await env.DB.prepare("SELECT COUNT(*) n FROM dishes").first();
  const stale = await env.DB.prepare("SELECT COUNT(*) n FROM dishes WHERE chk < date('now','-90 days')").first();
  const q = await env.DB.prepare("SELECT COUNT(*) n FROM queue WHERE status='pending'").first();
  const top = await env.DB.prepare("SELECT display, count FROM searches ORDER BY count DESC LIMIT 5").all();
  return json({ ok:true, venues: v.n, dishes: d.n, stale_90d: stale.n, queue_pending: q.n,
    most_searched: top.results });
}
async function handleQueue(env){
  const { results } = await env.DB.prepare(
    "SELECT display, priority, status, attempts, updated_at FROM queue ORDER BY status='pending' DESC, priority DESC, updated_at ASC LIMIT 30"
  ).all();
  return json({ ok:true, queue: results });
}

// --- Investigacion automatica (cron + disparo manual protegido) ---
function htmlToText(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&euro;/g, "€").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ");
}
// Candidatos "Nombre ... €12,50" con higiene: nombre 3-60, precio 1.5-80,
// sin digitos en el nombre. Nada entra sin coincidir con el plato buscado.
function extractCandidates(text){
  const out = []; const seen = {};
  function push(name, price){
    name = name.trim().replace(/\s+/g, " ").replace(/^[·\-\u2013\u2014: ]+/, "");
    if (name.length < 3 || name.length > 60) return;
    if (/\d/.test(name)) return;
    if (!(price >= 1.5 && price <= 80)) return;
    const k = norm(name);
    if (seen[k]) return;
    seen[k] = 1; out.push({ name, price });
  }
  // 1) "Nombre ... €12,50" en la misma linea
  const re = /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü'&’()\- ]{2,60}?)\s*[·\-–—:]?\s*(?:€|EUR\s?)(\d{1,2}[.,]\d{1,2})/g;
  let m;
  while ((m = re.exec(text)) && out.length < 300) push(m[1], parseFloat(m[2].replace(",", ".")));
  // 2) Precio solo en su linea: el nombre es la linea corta sin digitos mas cercana encima
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const priceLine = /^(?:€\s?)(\d{1,2}[.,]\d{1,2})$/;
  const nameLine = /^[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü'&’()\- ]{2,60}$/;
  for (let i = 0; i < lines.length && out.length < 400; i++) {
    const pm = lines[i].match(priceLine);
    if (!pm) continue;
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (nameLine.test(lines[j]) && !/\(.*?\d.*?\)/.test(lines[j])) {
        push(lines[j], parseFloat(pm[1].replace(",", ".")));
        break;
      }
      if (priceLine.test(lines[j])) break;
    }
  }
  return out;
}
async function fetchMenuText(u){
  const res = await fetch(u, {
    headers: { "user-agent": "AntojoBot/0.1 (+https://github.com/lightsaber-design/restaurant)",
      "accept": "text/html,text/plain,*/*" },
    redirect: "follow", signal: AbortSignal.timeout(9000)
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const ct = res.headers.get("content-type") || "";
  if (!/text|html|json/.test(ct)) throw new Error("content-type " + ct);
  const buf = await res.arrayBuffer();
  return new TextDecoder().decode(buf.slice(0, MAX_FETCH_BYTES));
}
async function collectBatch(env, maxTerms){
  const { results: terms } = await env.DB.prepare(
    "SELECT term, display, attempts FROM queue WHERE status='pending' ORDER BY priority DESC, updated_at ASC LIMIT ?"
  ).bind(maxTerms || 3).all();
  const report = [];
  for (const t of terms) {
    const { results: venues } = await env.DB.prepare(
      "SELECT id, name, cat, cats, menu_url FROM venues WHERE menu_url IS NOT NULL"
    ).all();
    // Candidatos: primero locales cuya categoria encaja con el termino; limite 6 fetches por termino
    const scored = venues.map(v => {
      const hay = norm(v.name + " " + venueCats(v).join(" "));
      const toks = norm(t.term).split(/\s+/).filter(Boolean);
      const hit = toks.some(tok => terminosDe(tok).some(term => hay.includes(term)));
      return { v, score: hit ? 1 : 0 };
    }).sort((a,b) => b.score - a.score);
    let found = 0, fetched = 0, lastErr = null;
    for (const { v } of scored) {
      if (fetched >= 6 || found >= 8) break;
      fetched++;
      try {
        const text = htmlToText(await fetchMenuText(v.menu_url));
        const cands = extractCandidates(text);
        for (const c of cands) {
          if (!matchesQuery(c.name, v.name, venueCats(v), t.term)) continue;
          await env.DB.prepare(
            "INSERT INTO dishes(venue_id,name,price,src,ch,chk,note) VALUES(?,?,?,?,?,date('now'),?) " +
            "ON CONFLICT(venue_id,name) DO UPDATE SET price=excluded.price, src=excluded.src, " +
            "ch=excluded.ch, chk=excluded.chk, note=excluded.note, updated_at=date('now')"
          ).bind(v.id, c.name, c.price, v.menu_url, "carta", "extraido de la carta oficial (bot, revision pendiente)").run();
          found++;
        }
      } catch (e) { lastErr = String(e && e.message || e); }
    }
    if (found > 0) {
      await env.DB.prepare("UPDATE queue SET status='done', note=?, updated_at=date('now') WHERE term=?")
        .bind(found + " plato(s) encontrados en cartas oficiales", t.term).run();
    } else {
      const attempts = (t.attempts || 0) + 1;
      const status = attempts >= 3 ? "needs_review" : "pending";
      await env.DB.prepare("UPDATE queue SET status=?, attempts=?, note=?, updated_at=date('now') WHERE term=?")
        .bind(status, attempts,
          "sin coincidencias en " + fetched + " cartas oficiales" + (lastErr ? "; ultimo error: " + lastErr : "") +
          (status === "needs_review" ? "; ampliar el registro de locales" : ""), t.term).run();
    }
    report.push({ term: t.display, fetched, found });
  }
  return report;
}
async function revalidateBatch(env, limit){
  const { results: stale } = await env.DB.prepare(
    "SELECT d.id, d.venue_id, d.name, d.price, d.src, d.ch, d.chk FROM dishes d " +
    "WHERE d.chk < date('now','-90 days') AND d.src IS NOT NULL ORDER BY d.chk ASC LIMIT ?"
  ).bind(limit || 10).all();
  let updated = 0, kept = 0;
  for (const d of stale) {
    try {
      const text = htmlToText(await fetchMenuText(d.src));
      const cands = extractCandidates(text);
      const hit = cands.find(c => norm(c.name) === norm(d.name));
      if (hit) {
        const hist = JSON.stringify([{ price: d.price, chk: d.chk, src: d.src, ch: d.ch }]);
        await env.DB.prepare(
          "UPDATE dishes SET price=?, chk=date('now'), hist=?, updated_at=date('now') WHERE id=?"
        ).bind(hit.price, hist, d.id).run();
        updated++;
      } else { kept++; }
    } catch (e) { kept++; }
  }
  return { checked: stale.length, updated, unchanged: kept };
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({});
    try {
      if (url.pathname === "/api/search") return await handleSearch(env, url);
      if (url.pathname === "/api/suggest") return await handleSuggest(env, url);
      if (url.pathname === "/api/stats") return await handleStats(env);
      if (url.pathname === "/api/queue") return await handleQueue(env);
      if (url.pathname === "/api/collect" && request.method === "POST") {
        if (!env.COLLECT_KEY || request.headers.get("x-antojo-key") !== env.COLLECT_KEY)
          return json({ ok:false, error: "no autorizado" }, 401);
        const rep = await collectBatch(env, parseInt(url.searchParams.get("n") || "3", 10));
        return json({ ok:true, report: rep });
      }
      if (url.pathname === "/" || url.pathname === "/api") {
        return json({ ok:true, service: "antojo-api", fase: 1,
          endpoints: ["/api/search?q=", "/api/suggest?q=", "/api/stats", "/api/queue"] });
      }
      return json({ ok:false, error: "ruta desconocida" }, 404);
    } catch (e) {
      return json({ ok:false, error: String(e && e.message || e) }, 500);
    }
  },
  async scheduled(event, env, ctx){
    if (event.cron === "21 4 * * *") {
      ctx.waitUntil(revalidateBatch(env, 10));
    } else {
      ctx.waitUntil(collectBatch(env, 3));
    }
  }
};
