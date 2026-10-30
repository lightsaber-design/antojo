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
  var activeCat = "todo";
  var query = "";
  var sortBy = "distancia";
  var markers = [];
  var map = null;
  var searchTimer = null;
  var renderTimer = null;

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
  function diasDesde(iso) { return AntojoPriceRules.ageDays(iso); }
  function freshState(d) { return AntojoPriceRules.state(d, FRESH, SOON_DAYS); }
  function currentPrice(d) {
    var state = freshState(d);
    return state === "fresh" || state === "soon";
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
  function recordSearch(q) {
    q = norm(q).trim();
    if (q.length < 3) return;
    var s = loadSearches();
    s[q] = (s[q] || 0) + 1;
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
    sushi: ["sushi", "roll", "maki", "nigiri", "sashimi", "temaki", "futomaki", "hosomaki", "norimaki", "california"],
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
  function venueCats(v) { return v.cats || [v.cat]; }
  function haystack(x) {
    return norm(x.dish.name + " " + x.venue.name + " " + venueCats(x.venue).join(" "));
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
    VENUES.forEach(function (v) {
      if (activeCat !== "todo" && venueCats(v).indexOf(activeCat) < 0) return;
      v.dishes.forEach(function (d) {
        out.push({ venue: v, dish: d, km: haversineKm(ref, v) });
      });
    });
    if (query) {
      out = out.filter(function (x) { return matchesQuery(x, query); });
    }
    if (sortBy === "precio") out.sort(function (a, b) {
      if (!currentPrice(a.dish) && !currentPrice(b.dish)) return a.km - b.km;
      if (!currentPrice(a.dish)) return 1;
      if (!currentPrice(b.dish)) return -1;
      return a.dish.price - b.dish.price;
    });
    else if (sortBy === "valoracion") out.sort(function (a, b) { return (b.venue.rating || 0) - (a.venue.rating || 0); });
    else out.sort(function (a, b) { return a.km - b.km; });
    return out;
  }

  // --- Comparacion del mismo plato entre locales (idea de cheapotle: solo la idea) ---
  function comparison(rows) {
    var q = norm(query).trim();
    if (q.length < 2) return null;
    // Solo platos cuyo NOMBRE coincide con la busqueda (no locales que coinciden por nombre).
    var priced = rows.filter(function (x) {
      return currentPrice(x.dish) && norm(x.dish.name).indexOf(q) >= 0;
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
      fmtEur(comp.max.dish.price) + ' en ' + comp.venues.length + ' locales · menor precio encontrado: <strong>' +
      esc(comp.min.venue.name) + '</strong> (' + fmtEur(comp.min.dish.price) + ', a ' + fmtKm(comp.min.km) +
      ') · opciones distintas: pueden variar plato, ración y canal; no es una comparación equivalente';
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
      html += '<div class="encargo"><strong>«' + esc(currentMiss.trim()) + '» todavía no está en la base.</strong> ' +
        "Puedes guardar el término para investigar en fuentes oficiales (carta web, PDF de carta, pedido online) " +
        "y añadirlo con fuente, fecha y canal. En esta demo el encargo solo se registra aquí y necesita exportación manual para la " +
        "próxima investigación; no se envía a ningún equipo ni se busca automáticamente.</div>";
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
    var cands = SUGGEST_TERMS.concat(dishNames());
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
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = txt;
      li.appendChild(button);
      button.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      button.addEventListener("click", function (ev) {
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

  function render() {
    var rows = flatDishes();
    var comp = comparison(rows);
    renderCompare(comp);
    var el = document.getElementById("results");
    var verificados = rows.filter(function (x) { var s = freshState(x.dish); return s === "fresh" || s === "soon"; }).length;
    var obsoletos = rows.filter(function (x) { return freshState(x.dish) === "stale"; }).length;
    document.getElementById("count").textContent =
      rows.length + (rows.length === 1 ? " plato" : " platos") + " cerca de " + ref.label +
      " · " + verificados + " con precio verificado" +
      (obsoletos ? " · " + obsoletos + " sin revalidar (>" + FRESH + " días)" : "");
    renderEncargos(query.trim().length >= 3 && rows.length === 0 ? query : null);
    el.innerHTML = "";
    rows.forEach(function (x) {
      var st = freshState(x.dish);
      var card = document.createElement("article");
      card.className = "card";
      var precioHtml;
      if (st === "none") {
        precioHtml = '<span class="price none">sin precio verificado</span>';
      } else if (st === "stale") {
        precioHtml = '<span class="price stale">' + fmtEur(x.dish.price) + ' <em>sin revalidar</em></span>';
      } else {
        precioHtml = '<span class="price">' + fmtEur(x.dish.price) + "</span>";
      }
      var ratingHtml = x.venue.rating == null
        ? "<span>★ nuevo en Antojo</span>"
        : "<span>★ " + x.venue.rating.toFixed(1) + " (" + x.venue.reviews + ")</span>";
      card.innerHTML =
        '<h2 class="dish">' + esc(x.dish.name) + " " + precioHtml + "</h2>" +
        '<div class="venue">' + esc(x.venue.name) + " · " + esc(x.venue.address) + "</div>" +
        '<div class="meta">' +
          "<span>📍 " + fmtKm(x.km) + " en línea recta</span>" +
          ratingHtml +
          "<span>" + esc(x.venue.band) + "</span>" +
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
    var pts = rows.map(function (x) { return [x.venue.lon, x.venue.lat]; });
    pts.push([ref.lon, ref.lat]);
    if (pts.length > 1) {
      var bounds = pts.reduce(function (b, p) { return b.extend(p); }, new maplibregl.LngLatBounds(pts[0], pts[0]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400 });
    }
  }

  function setRef(lat, lon, label) {
    ref = { lat: lat, lon: lon, label: label };
    render();
    if (map) map.flyTo({ center: [lon, lat], zoom: 14 });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Results and controls must survive a missing CDN or unavailable WebGL.
    render();
    try {
      initMap();
      updateMap(flatDishes(), comparison(flatDishes()));
    } catch (error) {
      if (map) { try { map.remove(); } catch (ignored) {} }
      map = null;
      document.getElementById("map").hidden = true;
    }
    renderTopSearches();

    var qInput = document.getElementById("q");
    qInput.addEventListener("input", function (e) {
      query = e.target.value.trim();
      clearTimeout(renderTimer);
      renderTimer = setTimeout(function () { render(); }, 120);
      renderSuggest();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        recordSearch(query);
        renderTopSearches();
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
        if (el && !el.contains(document.activeElement)) el.hidden = true;
      }, 150);
    });
    qInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        document.getElementById("suggest").hidden = true;
        return;
      }
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
    Array.prototype.forEach.call(document.querySelectorAll(".chip:not(.small)"), function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".chip:not(.small)"), function (c) { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); });
        chip.classList.add("on");
        chip.setAttribute("aria-pressed", "true");
        activeCat = chip.getAttribute("data-cat");
        render();
      });
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
