// Antojo demo - busqueda por plato, precio, distancia y valoracion.
// 30 oct 2026 (2a iteracion, a peticion de Carol):
//  - comparacion del mismo plato entre locales con mapa coloreado por precio
//    (idea de cheapotle, sin licencia explicita: solo la idea, sin codigo)
//  - historico de precios por plato (campo hist) y cola de revalidacion
//    (ideas de PriceBite, GPL-3.0: solo ideas, sin codigo)
//  - frescura viva con la regla de 90 dias de Carol: la ficha avisa cuando
//    toca revalidar y marca el precio como no vigente al pasar la regla
//  - conteo local de busquedas ("se revalida primero lo mas buscado")
// 30 oct 2026 (3a iteracion, a peticion de Carol):
//  - busqueda por tokens con sinonimos ES<->EN y terminos de cocina:
//    "sushi" encuentra rolls/maki/nigiri aunque no lleven la palabra "sushi"
//  - sugerencias (autocompletado) desde los nombres reales de los platos,
//    para no escribir platos que no existen
//  - encargos: si el plato buscado no esta en la base, queda registrado
//    para investigacion (cola local; la investigacion automatica en vivo
//    es del backend de Fase 1, esta demo es estatica)
// Atribuciones completas en NOTICE.md.
(function () {
  var FRESH = (typeof FRESH_DAYS !== "undefined") ? FRESH_DAYS : 90;
  var SOON_DAYS = 15; // aviso de "revalidar pronto" en los ultimos 15 dias de vigencia
  var ref = { lat: DUBLIN_CENTER.lat, lon: DUBLIN_CENTER.lon, label: "Centro de Dublín" };
  var query = "";
  var sortBy = "distancia";
  var markers = [];
  var map = null;
  var searchTimer = null;
  // Backend Fase 1 (Worker + D1): la demo consulta primero la base propia en
  // vivo; si la API no responde, cae a los datos locales (data.js) y lo dice.
  var API_BASE = "https://antojo-api.caroldenissetorres.workers.dev";
  var liveRows = null, liveQuery = null, liveState = "local", liveCorrection = null;
  var liveSeq = 0, apiSuggest = [];
  // 31 oct 2026 (5a iteracion, a peticion de Carol):
//  - las categorias (chips) AHORA fijan la busqueda: al tocar Sushi se busca
//    "sushi" de verdad (antes solo filtraban datos locales y el mapa nunca
//    rebuscaba en la API al moverlo ni con "Buscar de nuevo")
//  - filtro de platos estricto: un plato coincide por su NOMBRE (con
//    sinonimos), no por la categoria del local ("sushi" ya no devuelve ramen)
//  - auto-busqueda al mover el mapa robusta: se distingue el movimiento del
//    usuario (originalEvent) del programado; el flag ya no puede tragarse
//    un movimiento manual
//  - "Mas buscado" fusiona prefijos ("sush" se suma a "sushi", no ensucia)
// 31 oct 2026 (4a iteracion, a peticion de Carol): busqueda interactiva.
  // Boton persistente "Buscar de nuevo" y auto-busqueda de la misma query al
  // mover/zoom del mapa (busca en la zona visible, no solo en el centro fijo
  // de Dublin), todo sin recargar la pagina.
  var mapMoveTimer = null;        // debounce del auto-search al mover el mapa
  var suppressMapMove = false;    // los movimientos programados (fitBounds/flyTo) no disparan busqueda
  // El flag se suelta solo a los 1,5 s: si el movimiento programado no llega
  // a mover el mapa no hay moveend y el flag podia quedarse "pegado" y
  // tragarse el primer arrastre del usuario (fallo visto el 31 oct 2026).
  function programarMovimiento(fn) {
    suppressMapMove = true;
    fn();
    setTimeout(function () { suppressMapMove = false; }, 1500);
  }
  var lastSearchCenter = null;    // para no rebuscar si el centro apenas se movio

  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function haversineKm(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function fmtKm(km) { return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km"; }
  function fmtEur(n) { return "€" + n.toFixed(2); }

  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fmtFecha(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MESES[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function addDiasIso(iso, dias) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + dias));
    return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
  }
  function diasDesde(iso) {
    var p = iso.split("-");
    var ahora = new Date();
    var hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    return Math.floor((hoy - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000);
  }
  // Estado de frescura: "none" (sin precio), "fresh", "soon" (quedan <=15 dias), "stale" (>90 dias).
  function freshState(d) {
    if (d.price == null || !d.chk) return "none";
    var dias = diasDesde(d.chk);
    if (dias > FRESH) return "stale";
    if (dias >= FRESH - SOON_DAYS) return "soon";
    return "fresh";
  }

  var CANALES = {
    carta: "carta oficial del restaurante",
    pdf: "carta oficial (PDF)",
    toast: "pedido online oficial (recogida)",
    square: "pedido online oficial (recogida)",
    web: "web oficial (pedidos)",
    agregador: "carta recopilada por terceros (agregador, sin fecha de carta)",
    deliveroo: "Deliveroo (entrega a domicilio)",
    foto: "carta en el local (foto de terceros)"
  };
  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function verifLine(d) {
    var st = freshState(d);
    if (st === "none") {
      return '<div class="verify no">sin precio verificado · pendiente de investigación</div>';
    }
    var dias = diasDesde(d.chk);
    var canal = CANALES[d.ch] || "fuente oficial";
    var src = ' · <a href="' + esc(d.src) + '" target="_blank" rel="noopener">fuente</a>';
    if (st === "stale") {
      // Regla de Carol: pasados 90 dias sin revalidar, el precio NUNCA se muestra como vigente.
      return '<div class="verify stale">⚠ sin revalidar desde hace ' + dias + ' días (regla: ' + FRESH +
        ') · último precio conocido, no vigente · ' + canal + src + '</div>';
    }
    var aviso = (st === "soon") ? ' · <strong>revalidar antes del ' + fmtFecha(addDiasIso(d.chk, FRESH)) + '</strong>' : '';
    return '<div class="verify ok">✓ verificado ' + fmtFecha(d.chk) + ' (hace ' + dias + ' días) · ' + canal + aviso + src + '</div>';
  }

  // Historico de precios (campo opcional hist, idea de PriceBite: solo la idea).
  function histLine(d) {
    if (!d.hist || !d.hist.length || d.price == null) return "";
    var prev = d.hist[d.hist.length - 1];
    var diff = d.price - prev.price;
    if (Math.abs(diff) < 0.005) {
      return '<div class="hist">= mismo precio que el ' + fmtFecha(prev.chk) + '</div>';
    }
    var up = diff > 0;
    return '<div class="hist ' + (up ? "up" : "down") + '">' + (up ? "▲" : "▼") +
      ' antes ' + fmtEur(prev.price) + ' (' + fmtFecha(prev.chk) + ') · ahora ' + fmtEur(d.price) + '</div>';
  }

  // --- Busquedas del dispositivo: "se revalida primero lo mas buscado" (Carol) ---
  var SEARCH_KEY = "antojo-searches-v1";
  function loadSearches() {
    try { return JSON.parse(localStorage.getItem(SEARCH_KEY)) || {}; } catch (e) { return {}; }
  }
  // Distancia de edicion 1: los errores de tecleo de un termino conocido se
  // fusionan con el ("suchi" suma a "sushi", no crea entrada nueva) (31 oct 2026).
  function esTipoDe(a, b) {
    if (a === b) return false;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1 || la < 4 || lb < 4) return false;
    var i = 0, j = 0, diffs = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diffs > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    if (i < la || j < lb) diffs++;
    return diffs <= 1;
  }
  function recordSearch(q) {
    q = norm(q).trim();
    if (q.length < 3) return;
    var s = loadSearches();
    // Teclear a medias ensucia el ranking ("sush · 1" junto a "sushi · 4"):
    // si un termino es prefijo de otro, se fusionan en el mas largo.
    var merged = 0;
    Object.keys(s).forEach(function (k) {
      if (k === q) return;
      if (q.indexOf(k) === 0 || k.indexOf(q) === 0) { merged += s[k]; delete s[k]; }
    });
    if (!s[q]) {
      var canon = Object.keys(s).concat(SUGGEST_TERMS.map(function (t) { return norm(t); }));
      for (var ci = 0; ci < canon.length; ci++) {
        if (esTipoDe(q, canon[ci])) {
          s[canon[ci]] = (s[canon[ci]] || 0) + 1 + merged;
          try { localStorage.setItem(SEARCH_KEY, JSON.stringify(s)); } catch (e) {}
          return;
        }
      }
    }
    s[q] = (s[q] || 0) + 1 + merged;
    try { localStorage.setItem(SEARCH_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function topSearches(n) {
    var s = loadSearches();
    return Object.keys(s).map(function (k) { return [k, s[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 4);
  }
  function renderTopSearches() {
    var el = document.getElementById("top-searches");
    if (!el) return;
    var top = topSearches(4);
    el.innerHTML = "";
    if (!top.length) return;
    var label = document.createElement("span");
    label.className = "ts-label";
    label.textContent = "Más buscado aquí:";
    el.appendChild(label);
    top.forEach(function (t) {
      var b = document.createElement("button");
      b.className = "chip small";
      b.textContent = t[0] + " · " + t[1];
      b.addEventListener("click", function () {
        document.getElementById("q").value = t[0];
        query = t[0];
        render();
      });
      el.appendChild(b);
    });
  }

  // --- Sinonimos y terminos de cocina (ES<->EN): un plato coincide si TODOS
  // los tokens de la busqueda aparecen (o alguno de sus sinonimos) en el
  // nombre del plato, el local o su categoria. Asi "sushi" encuentra rolls,
  // maki y nigiri aunque el nombre del plato no diga "sushi".
  var SINONIMOS = {
    sushi: ["sushi", "roll", "maki", "nigiri", "sashimi", "temaki", "futomaki", "hosomaki", "norimaki", "california", "japones", "japanese", "izakaya"],
    rolls: ["roll", "maki", "norimaki", "futomaki"],
    maki: ["maki", "roll", "norimaki", "hosomaki", "futomaki"],
    nigiri: ["nigiri", "sushi"],
    sashimi: ["sashimi", "sushi"],
    hamburguesa: ["hamburguesa", "burger", "hamburger", "cheeseburger", "smash"],
    hamburguesas: ["hamburguesa", "burger", "hamburger", "cheeseburger", "smash"],
    burger: ["burger", "hamburger", "cheeseburger", "smash", "hamburguesa"],
    pollo: ["pollo", "chicken", "katsu", "karaage"],
    gambas: ["gamba", "prawn", "shrimp", "ebi"],
    gamba: ["gamba", "prawn", "shrimp", "ebi"],
    cerdo: ["cerdo", "pork", "chashu", "bacon", "pancetta"],
    ternera: ["ternera", "beef", "angus", "brisket", "steak"],
    pescado: ["pescado", "fish", "salmon", "tuna", "seabass"],
    salmon: ["salmon", "sake"],
    atun: ["atun", "tuna", "maguro"],
    huevos: ["huevos", "egg", "benedict", "scrambled"],
    huevo: ["huevo", "egg", "benedict", "scrambled"],
    desayuno: ["desayuno", "breakfast", "brunch", "irish"],
    pancakes: ["pancake", "tortitas"],
    tortitas: ["pancake", "tortitas"],
    noodles: ["noodle", "ramen", "udon", "soba", "yaki"],
    fideos: ["noodle", "ramen", "udon", "soba", "fideos"],
    arroz: ["arroz", "rice", "donburi", "chahan", " don"],
    gyoza: ["gyoza", "dumpling"],
    dumplings: ["dumpling", "gyoza"],
    veggie: ["veggie", "vegetarian", "vegan", "veg ", "halloumi"],
    vegetariano: ["vegetarian", "vegan", "veggie", "veg ", "halloumi"],
    picante: ["picante", "spicy", "chilli", "chili", "hot"],
    cafe: ["cafe", "coffee"],
    croissant: ["croissant", "bolleria"],
    curry: ["curry", "katsu"],
    bao: ["bao", "bun"],
    brunch: ["brunch", "breakfast", "irish", "pancake", "egg"]
  };
  function terminosDe(t) {
    if (SINONIMOS[t]) return SINONIMOS[t];
    // plural simple: "rolls" -> "roll"
    if (t.length > 3 && t.charAt(t.length - 1) === "s" && SINONIMOS[t.slice(0, -1)]) return SINONIMOS[t.slice(0, -1)];
    return [t];
  }
  // Un plato coincide SOLO por su nombre (con sinonimos): si buscas "sushi"
  // no salen ramen ni gyoza de un local japones (Carol, 31 oct 2026).
  function haystack(x) {
    return norm(x.dish.name);
  }
  function matchesQuery(x, q) {
    var hay = haystack(x);
    var tokens = norm(q).split(/\s+/).filter(function (t) { return t.length > 0; });
    if (!tokens.length) return true;
    var frase = tokens.join(" ");
    if (frase.length >= 3 && hay.indexOf(frase) >= 0) return true;
    return tokens.every(function (t) {
      return terminosDe(t).some(function (term) { return hay.indexOf(term) >= 0; });
    });
  }

  function flatDishes() {
    var out = [];
    if (liveRows && liveQuery === norm(query)) {
      out = liveRows.slice();
    } else {
      VENUES.forEach(function (v) {
        v.dishes.forEach(function (d) {
          out.push({ venue: v, dish: d, km: haversineKm(ref, v) });
        });
      });
      if (query) {
        out = out.filter(function (x) { return matchesQuery(x, query); });
      }
    }
    function precioDe(x) { return x.dish ? x.dish.price : null; }
    var cmp;
    if (sortBy === "precio") cmp = function (a, b) {
      var ap = precioDe(a), bp = precioDe(b);
      if (ap == null && bp == null) return a.km - b.km;
      if (ap == null) return 1;
      if (bp == null) return -1;
      return ap - bp;
    };
    else if (sortBy === "valoracion") cmp = function (a, b) { return (b.venue.rating || 0) - (a.venue.rating || 0); };
    else cmp = function (a, b) { return a.km - b.km; };
    // Platos que coinciden siempre primero; los locales con carta pendiente
    // van despues, ordenados con el mismo criterio (31 oct 2026).
    var conPlato = out.filter(function (x) { return x.dish; }).sort(cmp);
    var sinPlato = out.filter(function (x) { return !x.dish; }).sort(cmp);
    return conPlato.concat(sinPlato);
  }

  // --- Comparacion del mismo plato entre locales (idea de cheapotle: solo la idea) ---
  function comparison(rows) {
    var q = norm(query).trim();
    if (q.length < 2) return null;
    // Solo platos cuyo NOMBRE coincide con la busqueda (no locales que coinciden por nombre).
    var priced = rows.filter(function (x) {
      return x.dish && x.dish.price != null && freshState(x.dish) !== "stale" && norm(x.dish.name).indexOf(q) >= 0;
    });
    var byVenue = {};
    priced.forEach(function (x) {
      if (!byVenue[x.venue.id] || x.dish.price < byVenue[x.venue.id].dish.price) byVenue[x.venue.id] = x;
    });
    var venues = Object.keys(byVenue).map(function (k) { return byVenue[k]; });
    if (venues.length < 2) return null;
    venues.sort(function (a, b) { return a.dish.price - b.dish.price; });
    return { venues: venues, min: venues[0], max: venues[venues.length - 1] };
  }
  function renderCompare(comp) {
    var el = document.getElementById("compare");
    if (!el) return;
    if (!comp) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = '<strong>«' + esc(query.trim()) + '»</strong>: ' + fmtEur(comp.min.dish.price) + ' – ' +
      fmtEur(comp.max.dish.price) + ' en ' + comp.venues.length + ' locales · el más barato: <strong>' +
      esc(comp.min.venue.name) + '</strong> (' + fmtEur(comp.min.dish.price) + ', a ' + fmtKm(comp.min.km) +
      ') · el mapa colorea cada local por precio';
  }
  // Escala verde (mas barato) -> rojo (mas caro) para los marcadores del mapa.
  function priceColor(t) {
    var r = Math.round(29 + t * (192 - 29));
    var g = Math.round(122 + t * (57 - 122));
    var b = Math.round(61 + t * (47 - 61));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // --- Encargos: platos buscados que no estan en la base (Carol, 30 oct 2026:
  // cualquier plato que busque se investiga). En esta demo estatica el encargo
  // se registra en el navegador y alimenta la cola de investigacion; la
  // investigacion automatica en vivo forma parte del backend de Fase 1.
  var ENC_KEY = "antojo-encargos-v1";
  function loadEnc() {
    try { return JSON.parse(localStorage.getItem(ENC_KEY)) || {}; } catch (e) { return {}; }
  }
  function recordEncargo(q) {
    q = norm(q).trim();
    if (q.length < 3) return;
    var known = SUGGEST_TERMS.map(function (t) { return norm(t); }).concat(Object.keys(loadSearches()));
    if (known.some(function (k) { return esTipoDe(q, k); })) return;
    var e = loadEnc();
    var it = e[q] || { n: 0, first: new Date().toISOString().slice(0, 10) };
    it.n += 1;
    it.last = new Date().toISOString().slice(0, 10);
    e[q] = it;
    try { localStorage.setItem(ENC_KEY, JSON.stringify(e)); } catch (err) {}
  }
  function renderEncargos(currentMiss) {
    var el = document.getElementById("encargos");
    if (!el) return;
    var e = loadEnc();
    var items = Object.keys(e).map(function (k) { return [k, e[k]]; })
      .sort(function (a, b) { return b[1].n - a[1].n; });
    var html = "";
    if (currentMiss) {
      if (liveState === "queued") {
        html += '<div class="encargo"><strong>«' + esc(currentMiss.trim()) + '» todavía no está en la base.</strong> ' +
          "El backend ya lo tiene encargado: se investiga en las cartas oficiales de los locales " +
          "registrados (cada 2 h, primero lo más buscado) y aparecerá aquí con fuente, fecha y canal. " +
          "Si ningún local registrado lo sirve, queda pendiente de ampliar el registro de locales.</div>";
      } else if (liveState === "offline") {
        html += '<div class="encargo"><strong>«' + esc(currentMiss.trim()) + '» todavía no está en la base.</strong> ' +
          "Queda encargado: se investiga en fuentes oficiales (carta web, PDF de carta, pedido online) " +
          "y se añade con fuente, fecha y canal. La API no responde ahora mismo, así que el encargo " +
          "se registra en este navegador y se reintentará en vivo al volver la conexión.</div>";
      } else {
        html += '<div class="encargo"><strong>«' + esc(currentMiss.trim()) + '» no está en la base todavía.</strong> ' +
          (liveCorrection ? "Quizás quisiste decir «" + esc(liveCorrection) + "»." : "Revisa la escritura o prueba con otro plato.") + "</div>";
      }
    }
    if (items.length) {
      html += '<div class="encargos-list">Encargos registrados: ' +
        items.slice(0, 6).map(function (it) { return esc(it[0]) + " ×" + it[1].n; }).join(" · ") + "</div>";
    }
    el.innerHTML = html;
  }

  // --- Autocompletado: sugerencias desde los nombres reales de los platos ---
  function dishNames() {
    var seen = {}, out = [];
    VENUES.forEach(function (v) {
      v.dishes.forEach(function (d) {
        var k = norm(d.name);
        if (!seen[k]) { seen[k] = 1; out.push(d.name); }
      });
    });
    return out;
  }
  var SUGGEST_TERMS = ["sushi", "ramen", "hamburguesa", "cheeseburger", "smash burger", "brunch",
    "full irish breakfast", "pancakes", "croissant", "gyoza", "california roll", "rainbow roll",
    "spicy tuna roll", "salmon roll", "sashimi", "curry", "bao", "katsu"];
  function suggestionsFor(q) {
    var nq = norm(q).trim();
    if (nq.length < 2) return [];
    var cands = apiSuggest.concat(SUGGEST_TERMS).concat(dishNames());
    var seen = {}, scored = [];
    cands.forEach(function (c) {
      var nc = norm(c);
      if (seen[nc] || nc === nq) return;
      var i = nc.indexOf(nq);
      if (i < 0) {
        // coinciden todos los tokens en cualquier orden
        var toks = nq.split(/\s+/).filter(Boolean);
        if (!toks.every(function (t) { return nc.indexOf(t) >= 0; })) return;
        i = 50;
      }
      seen[nc] = 1;
      scored.push([i, c]);
    });
    scored.sort(function (a, b) { return a[0] - b[0] || a[1].length - b[1].length; });
    return scored.slice(0, 7).map(function (x) { return x[1]; });
  }
  function renderSuggest() {
    var el = document.getElementById("suggest");
    if (!el) return;
    var items = suggestionsFor(query);
    el.innerHTML = "";
    if (!items.length) { el.hidden = true; return; }
    items.forEach(function (txt) {
      var li = document.createElement("li");
      li.textContent = txt;
      li.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        document.getElementById("q").value = txt;
        query = txt;
        el.hidden = true;
        render();
      });
      el.appendChild(li);
    });
    el.hidden = false;
  }

  // Consulta en vivo a la API (base propia): si no hay el plato, el backend
  // lo encarga e investiga en cartas oficiales (cron cada 2 h, lo mas buscado
  // primero). Solo cuentan las respuestas de la busqueda actual.
  function fetchLive(q, fit) {
    var nq = norm(q).trim();
    if (nq.length < 3) { liveRows = null; liveQuery = null; liveState = "local"; liveCorrection = null; return; }
    var seq = ++liveSeq;
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort(); }, 5000);
    fetch(API_BASE + "/api/search?q=" + encodeURIComponent(q) + "&lat=" + ref.lat + "&lon=" + ref.lon, { signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (j) {
        clearTimeout(to);
        if (seq !== liveSeq || norm(query).trim() !== nq) return;
        if (!j.ok) throw new Error("api");
        liveRows = (j.results || []).concat(j.venue_matches || []);
        liveQuery = nq; liveState = j.queued ? "queued" : "ok";
        liveCorrection = j.correction || null;
        lastSearchCenter = { lat: ref.lat, lon: ref.lon };
        render();
        if (fit !== false) fitMapToRows(flatDishes());
      })
      .catch(function () {
        clearTimeout(to);
        if (seq !== liveSeq) return;
        liveRows = null; liveQuery = null; liveState = "offline";
        render();
      });
  }
  function fetchSuggest(q) {
    if (norm(q).trim().length < 2) return;
    fetch(API_BASE + "/api/suggest?q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.suggestions && j.suggestions.length) {
          apiSuggest = j.suggestions;
          renderSuggest();
        }
      })
      .catch(function () {});
  }

  function render() {
    var rows = flatDishes();
    var dishRows = rows.filter(function (x) { return x.dish; });
    var soloLocales = rows.length - dishRows.length;
    var comp = comparison(rows);
    renderCompare(comp);
    var el = document.getElementById("results");
    var verificados = dishRows.filter(function (x) { var s = freshState(x.dish); return s === "fresh" || s === "soon"; }).length;
    var obsoletos = dishRows.filter(function (x) { return freshState(x.dish) === "stale"; }).length;
    var canalDatos = liveState === "ok" || liveState === "queued"
      ? " · base en vivo (API)"
      : (norm(query).trim().length >= 3 ? " · datos locales (API no disponible)" : "");
    document.getElementById("count").textContent =
      dishRows.length + (dishRows.length === 1 ? " plato" : " platos") + " cerca de " + ref.label +
      (soloLocales ? " + " + soloLocales + (soloLocales === 1 ? " local" : " locales") + " con carta pendiente" : "") +
      " · " + verificados + " con precio verificado" +
      (obsoletos ? " · " + obsoletos + " sin revalidar (>" + FRESH + " días)" : "") +
      canalDatos;
    renderEncargos(query.trim().length >= 3 && dishRows.length === 0 && soloLocales === 0 ? query : null);
    el.innerHTML = "";
    rows.forEach(function (x) {
      var card = document.createElement("article");
      var ratingHtml = x.venue.rating == null
        ? "<span>★ nuevo en Antojo</span>"
        : "<span>★ " + x.venue.rating.toFixed(1) + " (" + x.venue.reviews + ")</span>";
      var bandHtml = x.venue.band ? "<span>" + esc(x.venue.band) + "</span>" : "";
      if (!x.dish) {
        // Local registrado que encaja con la busqueda pero sin carta verificada
        // todavia (cobertura OpenStreetMap, 31 oct 2026): se muestra como
        // "carta pendiente" y el backend la investiga (cola + cron).
        card.className = "card venue-only";
        card.innerHTML =
          '<div class="dish">🍽 ' + esc(x.venue.name) + "</div>" +
          '<div class="venue">' + esc(x.venue.address || "Dublín") + "</div>" +
          '<div class="meta">' +
            "<span>📍 " + fmtKm(x.km) + "</span>" +
            ratingHtml +
            bandHtml +
          "</div>" +
          '<div class="verify no">' + (x.has_dishes
            ? "ya tiene carta verificada en Antojo · sus platos salen al buscarlos por nombre"
            : "carta pendiente de investigación · se añadirá con fuente, fecha y canal") + "</div>";
        el.appendChild(card);
        return;
      }
      var st = freshState(x.dish);
      card.className = "card";
      var precioHtml;
      if (x.dish.price == null) {
        precioHtml = '<span class="price none">sin precio verificado</span>';
      } else if (st === "stale") {
        precioHtml = '<span class="price stale">' + fmtEur(x.dish.price) + ' <em>sin revalidar</em></span>';
      } else {
        precioHtml = '<span class="price">' + fmtEur(x.dish.price) + "</span>";
      }
      card.innerHTML =
        '<div class="dish">' + esc(x.dish.name) + " " + precioHtml + "</div>" +
        '<div class="venue">' + esc(x.venue.name) + " · " + esc(x.venue.address) + "</div>" +
        '<div class="meta">' +
          "<span>📍 " + fmtKm(x.km) + "</span>" +
          ratingHtml +
          bandHtml +
        "</div>" +
        verifLine(x.dish) +
        histLine(x.dish);
      el.appendChild(card);
    });
    updateMap(rows, comp);
  }

  function initMap() {
    if (typeof maplibregl === "undefined") { document.getElementById("map").style.display = "none"; return; }
    map = new maplibregl.Map({
      container: "map",
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256,
          attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      },
      center: [ref.lon, ref.lat],
      zoom: 14
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Al mover o hacer zoom en el mapa, se busca la MISMA query en la zona
    // visible (debounce 700 ms, sin recargar la pagina). Los movimientos
    // programados (fitBounds/flyTo) no disparan busqueda.
    map.on("moveend", function (e) {
      // Movimiento del usuario (arrastre/pellizco lleva originalEvent) vs
      // programado (fitBounds/flyTo). El flag solo traga movimientos
      // programados; un arrastre manual SIEMPRE rebusca (31 oct 2026).
      var delUsuario = !!(e && e.originalEvent);
      if (suppressMapMove && !delUsuario) { suppressMapMove = false; return; }
      suppressMapMove = false;
      var c = map.getCenter();
      var centro = { lat: c.lat, lon: c.lng };
      ref = { lat: c.lat, lon: c.lng, label: "la zona del mapa" };
      var q = norm(query).trim();
      if (q.length < 3) { render(); return; } // sin busqueda activa: solo recentra distancias
      if (liveQuery === q && lastSearchCenter && haversineKm(lastSearchCenter, centro) < 0.25) { render(); return; }
      if (mapMoveTimer) clearTimeout(mapMoveTimer);
      mapMoveTimer = setTimeout(function () {
        fetchLive(query, false);
      }, 700);
    });
  }

  function updateMap(rows, comp) {
    if (!map) return;
    markers.forEach(function (m) { m.remove(); });
    markers = [];
    var compByVenue = {};
    var pMin = Infinity, pMax = -Infinity;
    if (comp) {
      comp.venues.forEach(function (x) {
        compByVenue[x.venue.id] = x;
        if (x.dish.price < pMin) pMin = x.dish.price;
        if (x.dish.price > pMax) pMax = x.dish.price;
      });
    }
    var seen = {};
    rows.forEach(function (x) {
      if (seen[x.venue.id]) return;
      seen[x.venue.id] = true;
      var m;
      var cx = compByVenue[x.venue.id];
      if (cx) {
        var t = (pMax > pMin) ? (cx.dish.price - pMin) / (pMax - pMin) : 0;
        var pel = document.createElement("div");
        pel.className = "price-marker";
        pel.style.background = priceColor(t);
        pel.textContent = fmtEur(cx.dish.price);
        m = new maplibregl.Marker({ element: pel })
          .setLngLat([x.venue.lon, x.venue.lat])
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(
            x.venue.name + " - " + cx.dish.name + " " + fmtEur(cx.dish.price)))
          .addTo(map);
      } else {
        m = new maplibregl.Marker()
          .setLngLat([x.venue.lon, x.venue.lat])
          .setPopup(new maplibregl.Popup({ offset: 18 }).setText(x.venue.name + " - " + x.venue.address))
          .addTo(map);
      }
      markers.push(m);
    });
  }

  // Encuadre del mapa: SOLO en busquedas nuevas (texto o carga inicial), nunca
  // cuando la busqueda la dispara el propio movimiento del mapa.
  function fitMapToRows(rows) {
    if (!map) return;
    var pts = rows.map(function (x) { return [x.venue.lon, x.venue.lat]; });
    pts.push([ref.lon, ref.lat]);
    if (pts.length > 1) {
      var bounds = pts.reduce(function (b, p) { return b.extend(p); }, new maplibregl.LngLatBounds(pts[0], pts[0]));
      programarMovimiento(function () {
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 });
      });
    }
  }

  function setRef(lat, lon, label) {
    ref = { lat: lat, lon: lon, label: label };
    render();
    if (map) { programarMovimiento(function () { map.flyTo({ center: [lon, lat], zoom: 14 }); }); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMap();
    render();
    fitMapToRows(flatDishes());
    renderTopSearches();

    var qInput = document.getElementById("q");
    qInput.addEventListener("input", function (e) {
      query = e.target.value.trim();
      render();
      renderSuggest();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        recordSearch(query);
        renderTopSearches();
        fetchLive(query);
        fetchSuggest(query);
        var rows = flatDishes();
        if (query.trim().length >= 3 && rows.length === 0) {
          recordEncargo(query);
          renderEncargos(query);
        }
      }, 900);
    });
    qInput.addEventListener("blur", function () {
      setTimeout(function () {
        var el = document.getElementById("suggest");
        if (el) el.hidden = true;
      }, 150);
    });
    qInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var el = document.getElementById("suggest");
        if (el && !el.hidden && el.firstChild) {
          qInput.value = el.firstChild.textContent;
          query = qInput.value;
          el.hidden = true;
          render();
        }
      }
    });
    document.getElementById("sort").addEventListener("change", function (e) {
      sortBy = e.target.value;
      render();
    });
    // Las categorias fijan la busqueda de verdad: tocar "Sushi" busca
    // "sushi" en la API (platos verificados + locales de la zona con carta
    // pendiente), igual que escribirlo. Asi el mapa y "Buscar de nuevo"
    // siempre trabajan sobre la consulta activa (Carol, 31 oct 2026).
    Array.prototype.forEach.call(document.querySelectorAll(".chip:not(.small)"), function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".chip:not(.small)"), function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
        var cat = chip.getAttribute("data-cat");
        query = (cat === "todo") ? "" : cat;
        document.getElementById("q").value = query;
        render();
        if (norm(query).trim().length >= 3) {
          recordSearch(query);
          renderTopSearches();
          fetchLive(query);
        }
      });
    });
    document.getElementById("redo").addEventListener("click", function () {
      // Boton persistente: repite la busqueda actual en la zona visible del
      // mapa (o en la referencia activa), sin recargar la pagina.
      var b = this;
      b.disabled = true;
      b.textContent = "🔄 Buscando…";
      if (map) {
        var c = map.getCenter();
        ref = { lat: c.lat, lon: c.lng, label: "la zona del mapa" };
      }
      liveRows = null; liveQuery = null; // fuerza consulta fresca a la API
      fetchLive(query, false);
      render();
      setTimeout(function () { b.disabled = false; b.textContent = "🔄 Buscar de nuevo"; }, 1200);
    });
    document.getElementById("geo").addEventListener("click", function () {
      if (!navigator.geolocation) { setRef(DUBLIN_CENTER.lat, DUBLIN_CENTER.lon, "Centro de Dublín"); return; }
      document.getElementById("geo").textContent = "Localizando…";
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          document.getElementById("geo").textContent = "📍 Usar mi ubicación";
          setRef(pos.coords.latitude, pos.coords.longitude, "tu ubicación");
        },
        function () {
          document.getElementById("geo").textContent = "📍 Usar mi ubicación";
          setRef(DUBLIN_CENTER.lat, DUBLIN_CENTER.lon, "Centro de Dublín");
        },
        { timeout: 8000 }
      );
    });
  });
})();
