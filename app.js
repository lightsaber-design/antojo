// Antojo demo - busqueda por plato, precio, distancia y valoracion.
// 30 oct 2026 (2a iteracion, a peticion de Carol):
//  - comparacion del mismo plato entre locales con mapa coloreado por precio
//    (idea de cheapotle, sin licencia explicita: solo la idea, sin codigo)
//  - historico de precios por plato (campo hist) y cola de revalidacion
//    (ideas de PriceBite, GPL-3.0: solo ideas, sin codigo)
//  - frescura viva con la regla de 90 dias de Carol: la ficha avisa cuando
//    toca revalidar y marca el precio como no vigente al pasar la regla
//  - conteo local de busquedas ("se revalida primero lo mas buscado")
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

  function flatDishes() {
    var out = [];
    VENUES.forEach(function (v) {
      if (activeCat !== "todo" && v.cat !== activeCat) return;
      v.dishes.forEach(function (d) {
        out.push({ venue: v, dish: d, km: haversineKm(ref, v) });
      });
    });
    if (query) {
      var q = norm(query);
      out = out.filter(function (x) {
        return norm(x.dish.name).indexOf(q) >= 0 || norm(x.venue.name).indexOf(q) >= 0;
      });
    }
    if (sortBy === "precio") out.sort(function (a, b) {
      if (a.dish.price == null && b.dish.price == null) return a.km - b.km;
      if (a.dish.price == null) return 1;
      if (b.dish.price == null) return -1;
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
      return x.dish.price != null && freshState(x.dish) !== "stale" && norm(x.dish.name).indexOf(q) >= 0;
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
    el.innerHTML = "";
    rows.forEach(function (x) {
      var st = freshState(x.dish);
      var card = document.createElement("article");
      card.className = "card";
      var precioHtml;
      if (x.dish.price == null) {
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
        '<div class="dish">' + esc(x.dish.name) + " " + precioHtml + "</div>" +
        '<div class="venue">' + esc(x.venue.name) + " · " + esc(x.venue.address) + "</div>" +
        '<div class="meta">' +
          "<span>📍 " + fmtKm(x.km) + "</span>" +
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
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 });
    }
  }

  function setRef(lat, lon, label) {
    ref = { lat: lat, lon: lon, label: label };
    render();
    if (map) map.flyTo({ center: [lon, lat], zoom: 14 });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMap();
    render();
    renderTopSearches();

    document.getElementById("q").addEventListener("input", function (e) {
      query = e.target.value.trim();
      render();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        recordSearch(query);
        renderTopSearches();
      }, 900);
    });
    document.getElementById("sort").addEventListener("change", function (e) {
      sortBy = e.target.value;
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll(".chip:not(.small)"), function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".chip:not(.small)"), function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
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
