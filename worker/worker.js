// Antojo API (Fase 1) - Cloudflare Worker + D1. Sin dependencias.
// Busqueda por plato con precio, distancia y frescura (regla de 90 dias);
// lo que no esta en la base queda encargado (queue) y un cron lo investiga
// en las cartas oficiales de los locales registrados. Nada de precios
// inventados: todo lo que entra lleva src (URL), chk (fecha) y ch (canal).
// Metodologia de extraccion adaptada de deielurbe/amsterdam-menus (MIT) - ver NOTICE.md.
// 31 oct 2026 (5a iteracion): los platos coinciden SOLO por nombre (con
// sinonimos): "sushi" ya no devuelve ramen de locales japoneses; los locales
// se siguen emparejando por nombre+categoria (carta pendiente / verificada).
const CENTER = { lat: 53.3498, lon: -6.2603 };
const FRESH_DAYS = 90;
const MAX_FETCH_BYTES = 900000;

const SINONIMOS = {
  sushi: ["sushi","roll","maki","nigiri","sashimi","temaki","futomaki","hosomaki","norimaki","california","japones","japanese","izakaya"],
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

// --- Categorias de plato (reglas por nombre, gratuitas) ---
// Cada plato hereda UNA categoria al insertarse; las busquedas genericas
// ("sushi", "hamburguesas"...) la usan y los chips se generan de ella.
// Orden: lo mas especifico primero (sushi antes que pescado, burger antes
// que steak) para que "Salmon Norimaki" sea sushi y "Beef Burger" hamburguesa.
const CATEGORIAS = [
  ["sushi",      ["sushi","maki","nigiri","sashimi","temaki","futomaki","hosomaki","norimaki","uramaki","gunkan","onigiri","omakase","california","dragon roll","rainbow roll"]],
  ["ramen",      ["ramen"]],
  ["noodles",    ["noodle","udon","soba","yakisoba","pad thai","pad see","chow mein","wok"]],
  ["pizza",      ["pizza","margherita","napoletana","romana","diavola","capricciosa","calzone"]],
  ["pasta",      ["pasta","spaghetti","tagliatelle","penne","ravioli","lasagna","lasagne","gnocchi","carbonara","pesto","rigatoni","fettuccine","cacio"]],
  ["mexicana",   ["taco","tacos","birria","quesadilla","al pastor","carnitas","fajita","fajitas","nachos","burrito","enchilada"]],
  ["kebab",      ["kebab","doner","shawarma","durum","falafel"]],
  ["hamburguesas",["hamburguesa","burger","cheeseburger","smash","slider"]],
  ["pollo",      ["chicken","pollo","katsu","karaage","wings","alitas","goujons","nuggets"," tenders"]],
  ["parrilla",   ["steak","angus","brisket","ribeye","sirloin","entrecote","ribs","costillas","bbq"]],
  ["pescado",    ["salmon","tuna","maguro","seabass","cod","bacalao","prawn","shrimp","gamba","ebi","mussels","mejillones","calamari","seafood","fish","trout","hake","monkfish","crab","lobster","oyster","scallop","poke"]],
  ["brunch",     ["brunch","breakfast","full irish","pancake","tortitas","waffle","french toast","benedict","scrambled","omelette","omelet","granola","porridge","avocado toast"]],
  ["tapas",      ["tapas","raciones","pintxos","croqueta","patatas bravas"]],
  ["ensaladas",  ["ensalada","salad","caesar","buddha bowl"]],
  ["sandwiches", ["sandwich","bocadillo","toastie","panini","wrap","bagel","club sandwich"]],
  ["curry",      ["curry","masala","tikka","balti","vindaloo","korma","jalfrezi","biryani","dahl","dal"]],
  ["postres",    ["postre","dessert","cake","tarta","brownie","cheesecake","tiramisu","ice cream","helado","mochi","churros","donut","doughnut","muffin","panna cotta","profiteroles","sticky toffee","crumble","sundae","affogato","cookie"]],
  ["veggie",     ["vegetarian","vegan","veggie","halloumi","tofu","seitan"]]
];
function dishCategory(name){
  const hay = " " + norm(name) + " ";
  for (const [cat, kws] of CATEGORIAS) {
    for (const kw of kws) {
      if (kw.includes(" ") || kw.includes("roll")) { if (hay.includes(kw)) return cat; }
      else {
        const words = hay.split(/[^a-z0-9ñ]+/).filter(Boolean);
        if (words.some(w => w === kw || w === kw + "s")) return cat;
      }
    }
  }
  return null;
}
// Alias genericos de busqueda -> categoria. Solo terminos genericos amplian
// por categoria; un plato concreto ("tiramisu") sigue casando por nombre.
const ALIAS_CATEGORIA = {
  sushi: "sushi", sashimi: "sushi", maki: "sushi", rolls: "sushi",
  ramen: "ramen", noodles: "noodles", fideos: "noodles", udon: "noodles",
  pizza: "pizza", pizzas: "pizza", pasta: "pasta",
  mexicana: "mexicana", tacos: "mexicana", burritos: "mexicana",
  kebab: "kebab", kebabs: "kebab",
  hamburguesa: "hamburguesas", hamburguesas: "hamburguesas", burger: "hamburguesas", burgers: "hamburguesas",
  pollo: "pollo", chicken: "pollo", wings: "pollo", alitas: "pollo",
  parrilla: "parrilla", steak: "parrilla", steaks: "parrilla",
  pescado: "pescado", marisco: "pescado", seafood: "pescado", fish: "pescado", poke: "pescado",
  brunch: "brunch", breakfast: "brunch", desayuno: "brunch", pancakes: "brunch",
  tapas: "tapas", ensalada: "ensaladas", ensaladas: "ensaladas", salad: "ensaladas",
  sandwich: "sandwiches", sandwiches: "sandwiches", bocadillo: "sandwiches", wrap: "sandwiches", wraps: "sandwiches",
  curry: "curry", postre: "postres", postres: "postres", dessert: "postres", desserts: "postres", dulce: "postres", dulces: "postres",
  veggie: "veggie", vegetariano: "veggie", vegano: "veggie", vegan: "veggie"
};
function termCategory(nq){
  return ALIAS_CATEGORIA[nq] || null;
}


// --- Dedupe de platos (31 oct 2026): mismo plato, varias escrituras ---
// Antes de insertar se compara con los platos del local: clave = tokens
// ordenados, traducidos (ES/EN/IT/FR/JP romanizado) y sin articulos; dos
// platos son el mismo si sus tokens casan uno a uno (exacto o errata de
// edicion 1 en tokens de 4+ letras). Al fusionar, el precio/fecha/fuente del
// duplicado se conserva en hist y gana la escritura mas limpia.
const TOKEN_CANON = {};
[["chicken",["chicken","pollo","poulet"]],
 ["beef",["beef","ternera","boeuf","manzo","carne"]],
 ["pork",["pork","cerdo","porc","maiale"]],
 ["prawn",["prawn","prawns","gamba","gambas","shrimp","shrimps","ebi","crevette","crevettes","gamberi"]],
 ["salmon",["salmon"]], ["tuna",["tuna","atun","thon","maguro"]],
 ["fish",["fish","pescado","poisson","pesce"]],
 ["rice",["rice","arroz","riz","riso","gohan"]],
 ["noodle",["noodle","noodles","fideos","nouilles"]],
 ["egg",["egg","eggs","huevo","huevos","oeuf","oeufs","uovo","uova","tamago"]],
 ["cheese",["cheese","queso","fromage","formaggio"]],
 ["veg",["vegetable","vegetables","verdura","verduras","legumes","verdure","yasai","veg"]],
 ["spicy",["spicy","picante","epice","epicee","piccante"]],
 ["crispy",["crispy","crujiente","crujientes","croustillant","croccante"]],
 ["fried",["fried","frito","frita","frit","fritto","fritta"]],
 ["grilled",["grilled","grill","plancha","grille","griglia"]],
 ["roll",["roll","rolls","rollo"]],
 ["salad",["salad","ensalada","salade","insalata"]],
 ["soup",["soup","sopa","soupe","zuppa"]],
 ["bread",["bread","pan","pain","pane"]],
 ["potato",["potato","potatoes","patata","patatas","patate"]],
 ["chips",["chips","fries"]],
 ["sauce",["sauce","salsa"]],
 ["burger",["burger","burgers"]], ["hamburger",["hamburger","hamburguesa","hamburguesas"]], ["cheeseburger",["cheeseburger"]],
 ["dumpling",["dumpling","dumplings","gyoza","gyozas"]],
 ["duck",["duck","pato","canard","anatra"]],
 ["lamb",["lamb","cordero","agneau","agnello"]],
 ["bacon",["bacon","pancetta","beicon"]],
 ["octopus",["octopus","pulpo","poulpe","polpo","tako"]],
 ["squid",["squid","calamari","calamar","calamares","ika"]],
 ["seaweed",["seaweed","algas","wakame"]],
 ["cake",["cake","tarta","gateau","torta"]],
 ["sweet",["sweet","dulce","sucre","dolce"]]
].forEach(([canon, arr]) => arr.forEach(w => { TOKEN_CANON[w] = canon; }));
const STOPWORDS_DISH = new Set(["the","a","an","el","la","los","las","de","del","con","with","au","aux",
  "di","al","alla","en","y","e","et","and","und","of","in","on","le","les","il","lo","i","gli","un","una","des","du"]);
function dishKeyTokens(name){
  const cleaned = norm(name).replace(/[\uFFFD\u0000-\u001F]/g, " ").replace(/[^a-z0-9ñ ]/g, " ");
  return cleaned.split(/\s+/).filter(Boolean)
    .map(t => TOKEN_CANON[t] || t)
    .filter(t => !STOPWORDS_DISH.has(t) && (t.length > 1 || /\d/.test(t)))
    .sort();
}
function tokensMatch(a, b){
  if (!a.length || a.length !== b.length) return false;
  const used = new Array(b.length).fill(false);
  for (const t of a) {
    let hit = -1;
    for (let j = 0; j < b.length; j++) {
      if (used[j]) continue;
      if (b[j] === t || esTipoDe(t, b[j])) { hit = j; break; }
    }
    if (hit < 0) return false;
    used[hit] = true;
  }
  return true;
}
function dishNameClean(n){
  let s = 0;
  for (const ch of n) { if (ch === "\uFFFD" || ch.charCodeAt(0) < 32) s -= 3; }
  return s - n.length / 100;
}
// Inserta o fusiona: si el local ya tiene ese plato (escrito distinto),
// actualiza esa fila y no crea duplicado. Devuelve "inserted"|"merged".
async function upsertDish(env, venueId, name, price, src, ch, dcat, known){
  const toks = dishKeyTokens(name);
  const hit = (known || []).find(k => tokensMatch(k.toks, toks));
  const note = "auto-extraido de la fuente oficial (bot, revision pendiente)";
  if (hit) {
    await env.DB.prepare(
      "UPDATE dishes SET price=?, src=?, ch=?, chk=date('now'), note=?, dcat=?, updated_at=date('now') " +
      "WHERE venue_id=? AND name=?"
    ).bind(price, src, ch, note, dcat, venueId, hit.name).run();
    return "merged";
  }
  await env.DB.prepare(
    "INSERT INTO dishes(venue_id,name,price,src,ch,chk,note,dcat) VALUES(?,?,?,?,?,date('now'),?,?) " +
    "ON CONFLICT(venue_id,name) DO UPDATE SET price=excluded.price, src=excluded.src, " +
    "ch=excluded.ch, chk=excluded.chk, note=excluded.note, dcat=excluded.dcat, updated_at=date('now')"
  ).bind(venueId, name, price, src, ch, note, dcat).run();
  if (known) known.push({ name, toks });
  return "inserted";
}
async function venueDishKeys(env, venueId){
  const { results } = await env.DB.prepare("SELECT name FROM dishes WHERE venue_id=?").bind(venueId).all();
  return (results || []).map(r => ({ name: r.name, toks: dishKeyTokens(r.name) }));
}
function isJunkDishName(n){
  if (/[\uFFFD\u0000-\u001F]/.test(n)) return true;
  // Restos de etiquetas de alergenos: solo siglas en mayusculas con parentesis.
  if (/[()]/.test(n) && !/[a-z]/.test(n) &&
      n.split(/[^A-Z0-9]+/).filter(Boolean).every(w => w.length <= 3)) return true;
  return false;
}

function venueCats(v){ try { return v.cats ? JSON.parse(v.cats) : [v.cat]; } catch(e){ return [v.cat]; } }
// Distancia de edicion 1 entre terminos (letra cambiada, de mas o de menos):
// los errores de tecleo de un termino conocido se fusionan con el y no se
// registran ni se encargan como busquedas nuevas (31 oct 2026).
function esTipoDe(a, b){
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1 || la < 4 || lb < 4) return false;
  let i = 0, j = 0, diffs = 0;
  while (i < la && j < lb){
    if (a[i] === b[j]){ i++; j++; continue; }
    if (++diffs > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  if (i < la || j < lb) diffs++;
  return diffs <= 1;
}
// Coincidencia por palabra (no subcadena): "rolling" ya no casa con "roll";
// admite plural simple ("rolls"="roll") y prefijos de terminos largos (31 oct 2026).
function wordMatch(hay, term){
  const words = hay.split(/[^a-z0-9ñ]+/).filter(Boolean);
  return words.some(w => w === term || w === term + "s" || (w.length > 3 && w + "s" === term) ||
    (term.length >= 5 && w.startsWith(term)) ||
    (term.length >= 6 && w.length >= term.length - 1 && term.startsWith(w)));
}
// Un plato coincide SOLO por su nombre (con sinonimos), nunca por la
// categoria del local: "sushi" devuelve sushi/maki/nigiri/rolls, no ramen.
function dishMatches(dishName, q){
  const hay = norm(dishName);
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const frase = tokens.join(" ");
  if (frase.length >= 3 && hay.includes(frase)) return true;
  return tokens.every(t => terminosDe(t).some(term => wordMatch(hay, term)));
}
function matchesQuery(dishName, venueName, cats, q){
  const hay = norm(dishName + " " + venueName + " " + (cats||[]).join(" "));
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const frase = tokens.join(" ");
  if (frase.length >= 3 && hay.includes(frase)) return true;
  return tokens.every(t => terminosDe(t).some(term => wordMatch(hay, term)));
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

async function handleSearch(env, url, ctx){
  const q = (url.searchParams.get("q")||"").trim();
  const nq = norm(q);
  if (nq.length < 2) return json({ ok:true, results:[], queued:false });
  const lat = parseFloat(url.searchParams.get("lat")), lon = parseFloat(url.searchParams.get("lon"));
  const ref = (isFinite(lat) && isFinite(lon)) ? { lat, lon } : CENTER;
  const today = new Date().toISOString().slice(0,10);
  const { results } = await env.DB.prepare(
    "SELECT d.*, v.name vname, v.address, v.lat, v.lon, v.rating, v.reviews, v.band, v.cat, v.cats, v.source vsource " +
    "FROM dishes d JOIN venues v ON v.id = d.venue_id"
  ).all();
  const catQ = termCategory(nq);
  let rows = results.filter(r => dishMatches(r.name, q) || (catQ && r.dcat === catQ))
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
  // Registrar la busqueda (alimenta "primero lo mas buscado"). Si el termino
  // es un error de tecleo de uno conocido, suma al conocido y no crea entrada.
  const { results: previas } = await env.DB.prepare("SELECT term FROM searches").all();
  const conocido = (previas || []).find(s => esTipoDe(nq, s.term));
  if (conocido) {
    await env.DB.prepare("UPDATE searches SET count=count+1, last_at=? WHERE term=?").bind(today, conocido.term).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO searches(term,display,count,last_at) VALUES(?,?,1,?) " +
      "ON CONFLICT(term) DO UPDATE SET count=count+1, display=excluded.display, last_at=excluded.last_at"
    ).bind(nq, q, today).run();
  }
  let queued = false, investigating = false;
  if (vigentes.length === 0 && !conocido) {
    // Encargo: se investiga AHORA en segundo plano (fuentes oficiales gratuitas)
    // y el cron cada 2 h queda de refuerzo. Primero lo mas buscado.
    const s = await env.DB.prepare("SELECT count FROM searches WHERE term=?").bind(nq).first();
    const prev = await env.DB.prepare("SELECT status, updated_at FROM queue WHERE term=?").bind(nq).first();
    await env.DB.prepare(
      "INSERT INTO queue(term,display,priority,status) VALUES(?,?,?,'pending') " +
      "ON CONFLICT(term) DO UPDATE SET priority=excluded.priority, display=excluded.display, " +
      "status=CASE WHEN queue.status IN ('done','needs_review') THEN 'pending' ELSE queue.status END, updated_at=date('now')"
    ).bind(nq, q, (s && s.count) || 1).run();
    queued = true;
    // Disparo inmediato si hoy no se ha investigado ya este termino (evita
    // relanzar en cada busqueda repetida el mismo dia). Como mucho 1 termino
    // por peticion, pocas cartas por termino: coste cero y rapido.
    if (ctx && (!prev || prev.updated_at !== today)) {
      investigating = true;
      ctx.waitUntil(investigateTerm(env, { term: nq, display: q, attempts: 0 }, 25)
        .catch(() => null));
    }
  }
  // Locales registrados que encajan con la busqueda (nombre o categoria) pero
  // sin platos verificados todavia: se muestran como "carta pendiente" para
  // que el mapa tenga cobertura real; el cron investiga sus cartas oficiales.
  const { results: allVenues } = await env.DB.prepare("SELECT * FROM venues").all();
  const withDish = new Set(rows.map(r => r.venue.id));
  const dishCountByVenue = {};
  results.forEach(r => { dishCountByVenue[r.venue_id] = (dishCountByVenue[r.venue_id] || 0) + 1; });
  let venueMatches = allVenues
    .filter(v => !withDish.has(v.id) && v.lat != null && matchesQuery("", v.name, venueCats(v), q))
    .map(v => ({ venue: { id: v.id, name: v.name, address: v.address, lat: v.lat, lon: v.lon,
        rating: v.rating, reviews: v.reviews, band: v.band, cat: v.cat,
        cats: v.cats ? JSON.parse(v.cats) : null, source: v.source },
      dish: null, km: haversineKm(ref, { lat: v.lat, lon: v.lon }),
      has_dishes: !!dishCountByVenue[v.id] }));
  venueMatches.sort((a,b) => a.km - b.km);
  venueMatches = venueMatches.slice(0, 25);
  return json({ ok:true, results: cut, venue_matches: venueMatches, queued, investigating, correction: conocido ? conocido.term : null });
}

async function handleSuggest(env, url){
  const q = norm((url.searchParams.get("q")||"").trim());
  if (q.length < 2) return json({ ok:true, suggestions: [] });
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT name FROM dishes WHERE lower(name) LIKE ? ORDER BY length(name) LIMIT 7"
  ).bind("%" + q + "%").all();
  return json({ ok:true, suggestions: results.map(r => r.name) });
}


async function handleCategories(env){
  const { results } = await env.DB.prepare(
    "SELECT dcat, COUNT(*) n, COUNT(DISTINCT venue_id) locales FROM dishes " +
    "WHERE dcat IS NOT NULL AND price IS NOT NULL GROUP BY dcat ORDER BY n DESC"
  ).all();
  return json({ ok:true, categories: results });
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

// PDF de carta: extrae texto de los streams FlateDecode (Tj/TJ). Sin librerias:
// DecompressionStream('deflate') entiende el formato zlib de FlateDecode.
// Los marcadores stream/endstream se buscan a nivel de BYTES (sin decodificar:
// una vuelta latin1 corrompe el 0x9C del encabezado zlib). Las cadenas pueden
// venir WinAnsi o con códigos de fuente (1 o 2 bytes) que exigen el mapa
// ToUnicode de SU fuente: como cada fuente trae el suyo, se prueba cada mapa
// y gana la decodificacion mas legible. Un PDF de solo imagenes devuelve "".
function indexOfBytes(hay, needle, from){
  outer: for (let i = from || 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
function parseToUnicodeCMap(txt){
  const map = {};
  let m;
  const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[((?:\s*<[0-9A-Fa-f]+>)*)\])/g;
  while ((m = rangeRe.exec(txt))) {
    const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
    if (hi - lo > 4096) continue;
    if (m[3]) { const base = parseInt(m[3], 16); for (let c = lo; c <= hi; c++) map[c] = String.fromCharCode(base + (c - lo)); }
    else if (m[4]) { [...m[4].matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((x, i) => { map[lo + i] = String.fromCharCode(parseInt(x[1], 16)); }); }
  }
  const charSec = (txt.split("beginbfchar")[1] || "").split("endbfchar")[0];
  const charRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  while ((m = charRe.exec(charSec))) map[parseInt(m[1], 16)] = String.fromCharCode(parseInt(m[2], 16));
  return map;
}
function scoreText(t){
  let s = 0;
  for (const ch of t) {
    if (/[\p{L}\p{N}€$£.,()&'’\-\/+ ]/u.test(ch)) s += 2;
    else if (ch === "\n") s += 0;
    else s -= 3;
  }
  return s;
}
function decodePdfString(rawStr, cmaps){
  let best = rawStr, bestScore = scoreText(rawStr);
  for (const cmap of cmaps) {
    let o1 = "";
    for (let i = 0; i < rawStr.length; i++) o1 += cmap[rawStr.charCodeAt(i)] || "�";
    const s1 = scoreText(o1);
    if (s1 > bestScore) { best = o1; bestScore = s1; }
    if (rawStr.length >= 2) {
      let o2 = "";
      for (let i = 0; i + 1 < rawStr.length; i += 2) o2 += cmap[(rawStr.charCodeAt(i) << 8) | rawStr.charCodeAt(i + 1)] || "�";
      const s2 = scoreText(o2);
      if (s2 > bestScore) { best = o2; bestScore = s2; }
    }
  }
  return best;
}
async function pdfToText(buf){
  const bytes = new Uint8Array(buf);
  const STREAM = [115,116,114,101,97,109], END = [101,110,100,115,116,114,101,97,109];
  const contents = [], cmaps = [];
  let pos = 0, n = 0;
  while (n < 300) {
    const si = indexOfBytes(bytes, STREAM, pos);
    if (si < 0) break;
    let start = si + 6;
    if (bytes[start] === 13 && bytes[start + 1] === 10) start += 2;
    else if (bytes[start] === 10) start += 1;
    const ei = indexOfBytes(bytes, END, start);
    if (ei < 0) break;
    pos = ei + 9; n++;
    let e = ei;
    if (bytes[e - 1] === 10) e--; if (bytes[e - 1] === 13) e--;
    try {
      const ab = await new Response(
        new Blob([bytes.slice(start, e)]).stream().pipeThrough(new DecompressionStream("deflate"))
      ).arrayBuffer();
      const txt = new TextDecoder("latin1").decode(ab);
      if (/\)\s*Tj|\]\s*TJ/.test(txt)) contents.push(txt);
      else if (txt.includes("beginbfchar") || txt.includes("beginbfrange")) cmaps.push(txt);
    } catch (err) { /* stream no flate: fuera */ }
  }
  const maps = cmaps.map(parseToUnicodeCMap).filter(m => Object.keys(m).length);
  const out = [];
  const strRe = /\((?:\\.|[^\\()])*\)/g;
  for (const p of contents) {
    let sm;
    while ((sm = strRe.exec(p))) {
      const rawStr = sm[0].slice(1, -1).replace(/\\([()\\])/g, "$1");
      const t = decodePdfString(rawStr, maps);
      if (t.trim() && scoreText(t) > 0) out.push(t);
    }
  }
  return out.join("\n");
}
async function fetchMenuText(u){
  const res = await fetch(u, {
    headers: { "user-agent": "AntojoBot/0.1 (+https://github.com/lightsaber-design/restaurant)",
      "accept": "text/html,application/pdf,text/plain,*/*" },
    redirect: "follow", signal: AbortSignal.timeout(9000)
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const ct = res.headers.get("content-type") || "";
  const buf = await res.arrayBuffer();
  if (/pdf/i.test(ct) || /\.pdf(\?|#|$)/i.test(u)) {
    const text = await pdfToText(buf.slice(0, 4 * MAX_FETCH_BYTES));
    if (!text.trim()) throw new Error("pdf sin texto extraible (¿escaneado?)");
    return { text, ch: "pdf", html: null };
  }
  if (!/text|html|json/.test(ct)) throw new Error("content-type " + ct);
  const html = new TextDecoder().decode(buf.slice(0, MAX_FETCH_BYTES));
  return { text: html, ch: "carta", html };
}
// En una web oficial, busca el enlace a la carta (o PDF de carta) del propio
// sitio: mejora menu_url sola durante el uso normal. Mismo dominio solamente.
function menuLinkFromHtml(html, base){
  try {
    const b = new URL(base);
    const re = /href=["']([^"']+)["']/gi;
    let m, best = null;
    while ((m = re.exec(html))) {
      let href = m[1];
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
      let abs;
      try { abs = new URL(href, b); } catch (e) { continue; }
      if (abs.hostname !== b.hostname) continue;
      const p = abs.pathname.toLowerCase();
      if (/\.pdf$/.test(p) && /menu|carta|carta|food|eat/.test(p)) return abs.href;
      if (/menu|carta|food-menu|our-food|la-carta/.test(p) && !best) best = abs.href;
    }
    return best;
  } catch (e) { return null; }
}
async function collectBatch(env, maxTerms){
  const { results: terms } = await env.DB.prepare(
    "SELECT term, display, attempts FROM queue WHERE status='pending' ORDER BY priority DESC, updated_at ASC LIMIT ?"
  ).bind(maxTerms || 3).all();
  const report = [];
  for (const t of terms) {
    report.push(await investigateTerm(env, t));
  }
  return report;
}
// Investiga UN termino en las cartas oficiales registradas (fuentes gratuitas:
// carta web, PDF, pedido online; nunca APIs de pago). Lo usan el cron cada 2 h
// y el disparo inmediato cuando una busqueda no encuentra nada (31 oct 2026).
async function investigateTerm(env, t, maxFetches){
  const cap = maxFetches || 6;
  const { results: venues } = await env.DB.prepare(
    "SELECT id, name, cat, cats, menu_url FROM venues WHERE menu_url IS NOT NULL"
  ).all();
  // Candidatos: primero locales cuya categoria encaja con el termino.
  const scored = venues.map(v => {
    const hay = norm(v.name + " " + venueCats(v).join(" "));
    const toks = norm(t.term).split(/\s+/).filter(Boolean);
    const hit = toks.some(tok => terminosDe(tok).some(term => wordMatch(hay, term)));
    return { v, score: hit ? 1 : 0 };
  }).sort((a,b) => b.score - a.score);
  let found = 0, fetched = 0, lastErr = null;
  async function probeVenue(v){
    const got = await fetchMenuText(v.menu_url);
    const cands = extractCandidates(htmlToText(got.text));
    // Auto-siembra con dedupe: TODO plato de una carta oficial leida entra en
    // la base con fuente/fecha/canal; si el local ya lo tenia escrito distinto
    // (otro idioma, errata, puntuacion), se fusiona y no duplica (31 oct 2026).
    const known = await venueDishKeys(env, v.id);
    let added = 0, termHits = 0;
    for (const c of cands) {
      if (c.name.length < 3 || isJunkDishName(c.name)) continue;
      const hit = matchesQuery(c.name, v.name, venueCats(v), t.term);
      await upsertDish(env, v.id, c.name, c.price, v.menu_url, got.ch, dishCategory(c.name), known);
      added++;
      if (hit) termHits++;
    }
    // Mejora continua de menu_url: si la pagina enlaza su carta/PDF, sube a ella.
    if (got.html) {
      const better = menuLinkFromHtml(got.html, v.menu_url);
      if (better && better !== v.menu_url) {
        await env.DB.prepare("UPDATE venues SET menu_url=? WHERE id=?").bind(better, v.id).run();
      }
    }
    return termHits;
  }
  // Fetches en paralelo de 5 en 5: el disparo inmediato cubre mas cartas
  // (cap mas alto) sin alargar la espera de quien busca.
  const queueV = scored.map(s => s.v);
  while (queueV.length && fetched < cap && found < 8) {
    const chunk = queueV.splice(0, Math.min(5, cap - fetched));
    fetched += chunk.length;
    const rs = await Promise.allSettled(chunk.map(probeVenue));
    for (const r of rs) {
      if (r.status === "fulfilled") found += r.value;
      else lastErr = String(r.reason && r.reason.message || r.reason);
    }
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
  return { term: t.display, fetched, found };
}
async function revalidateBatch(env, limit){
  // Prioridad inteligente: primero lo vencido que toca lo mas buscado
  // (coincidencia por nombre o categoria con los 10 terminos top), luego
  // por antiguedad. Asi el precio que caduca y mas se consulta se revierte
  // antes que el de un plato que nadie busca (31 oct 2026).
  const { results: staleAll } = await env.DB.prepare(
    "SELECT d.id, d.venue_id, d.name, d.price, d.src, d.ch, d.chk, d.dcat FROM dishes d " +
    "WHERE d.chk < date('now','-90 days') AND d.src IS NOT NULL ORDER BY d.chk ASC LIMIT 60"
  ).all();
  const { results: top } = await env.DB.prepare(
    "SELECT term FROM searches ORDER BY count DESC LIMIT 10"
  ).all();
  const topCats = new Set((top || []).map(s => termCategory(s.term)).filter(Boolean));
  const topTerms = (top || []).map(s => s.term);
  const scoredStale = (staleAll || []).map(d => {
    const hot = topCats.has(d.dcat) || topTerms.some(t => dishMatches(d.name, t));
    return { d, hot };
  }).sort((a, b) => (b.hot - a.hot) || (a.d.chk < b.d.chk ? -1 : 1));
  const stale = scoredStale.slice(0, limit || 10).map(x => x.d);
  let updated = 0, kept = 0;
  for (const d of stale) {
    try {
      const got = await fetchMenuText(d.src);
      const text = htmlToText(got.text);
      const cands = extractCandidates(text);
      // Auto-siembra tambien al revalidar: todo plato nuevo entra, con dedupe.
      const knownR = await venueDishKeys(env, d.venue_id);
      for (const c of cands) {
        if (c.name.length < 3 || isJunkDishName(c.name)) continue;
        await upsertDish(env, d.venue_id, c.name, c.price, d.src, got.ch, dishCategory(c.name), knownR);
      }
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


// Google Places (New): investigación de locales bajo demanda (no automática;
// cada llamada se factura por solicitud, así que solo corre vía POST con clave).
async function handlePlaces(env, url){
  if (!env.GOOGLE_PLACES_API_KEY)
    return json({ ok:false, error: "GOOGLE_PLACES_API_KEY no configurada en el worker" }, 501);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ ok:false, error: "falta q (texto a buscar, p. ej. «Musashi Blanchardstown»)" }, 400);
  const body = {
    textQuery: q,
    maxResultCount: 5,
    languageCode: "es",
    locationBias: { circle: { center: { latitude: 53.3881, longitude: -6.3756 }, radius: 10000.0 } }
  };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.businessStatus"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    return json({ ok:false, error: `places ${res.status}: ${data.error?.message || "error"}`, detail: data.error || null }, 502);
  const places = (data.places || []).map(p => ({
    id: p.id, nombre: p.displayName?.text || null, direccion: p.formattedAddress || null,
    lat: p.location?.latitude ?? null, lon: p.location?.longitude ?? null,
    rating: p.rating ?? null, votos: p.userRatingCount ?? null,
    web: p.websiteUri || null, maps: p.googleMapsUri || null,
    tel: p.nationalPhoneNumber || null, estado: p.businessStatus || null
  }));
  return json({ ok:true, q, fuente: "Google Places API (New), clave antojo-places-01 (proyecto macd-infra)", ts: new Date().toISOString(), places });
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({});
    try {
      if (url.pathname === "/api/search") return await handleSearch(env, url, ctx);
      if (url.pathname === "/api/suggest") return await handleSuggest(env, url);
      if (url.pathname === "/api/stats") return await handleStats(env);
      if (url.pathname === "/api/categories") return await handleCategories(env);
      if (url.pathname === "/api/queue") return await handleQueue(env);
      if (url.pathname === "/api/collect" && request.method === "POST") {
        if (!env.COLLECT_KEY || request.headers.get("x-antojo-key") !== env.COLLECT_KEY)
          return json({ ok:false, error: "no autorizado" }, 401);
        const rep = await collectBatch(env, parseInt(url.searchParams.get("n") || "3", 10));
        return json({ ok:true, report: rep });
      }
      if (url.pathname === "/api/places" && request.method === "POST") {
        if (!env.COLLECT_KEY || request.headers.get("x-antojo-key") !== env.COLLECT_KEY)
          return json({ ok:false, error: "no autorizado" }, 401);
        return await handlePlaces(env, url);
      }
      if (url.pathname === "/" || url.pathname === "/api") {
        return json({ ok:true, service: "antojo-api", fase: 1,
          endpoints: ["/api/search?q=", "/api/suggest?q=", "/api/stats", "/api/queue", "POST /api/collect", "POST /api/places?q="] });
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
