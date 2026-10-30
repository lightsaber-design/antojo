// Antojo demo - busqueda por plato, precio, distancia y valoracion.
(function () {
  var ref = { lat: DUBLIN_CENTER.lat, lon: DUBLIN_CENTER.lon, label: "Centro de Dublín" };
  var activeCat = "todo";
  var query = "";
  var sortBy = "distancia";
  var markers = [];
  var map = null;

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
  var CANALES = {
    carta: "carta oficial del restaurante",
    pdf: "carta oficial (PDF)",
    toast: "pedido online oficial (recogida)",
    web: "web oficial (pedidos)"
  };
  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function verifLine(d) {
    if (d.price == null) {
      return '<div class="verify no">sin precio verificado · pendiente de investigación</div>';
    }
    var canal = CANALES[d.ch] || "fuente oficial";
    return '<div class="verify ok">✓ verificado ' + fmtFecha(d.chk) + ' · ' + canal +
      ' · <a href="' + esc(d.src) + '" target="_blank" rel="noopener">fuente</a></div>';
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

  function render() {
    var rows = flatDishes();
    var el = document.getElementById("results");
    var verificados = rows.filter(function (x) { return x.dish.price != null; }).length;
    document.getElementById("count").textContent =
      rows.length + (rows.length === 1 ? " plato" : " platos") + " cerca de " + ref.label +
      " · " + verificados + " con precio verificado";
    el.innerHTML = "";
    rows.forEach(function (x) {
      var card = document.createElement("article");
      card.className = "card";
      var precioHtml = x.dish.price == null
        ? '<span class="price none">sin precio verificado</span>'
        : '<span class="price">' + fmtEur(x.dish.price) + "</span>";
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
        verifLine(x.dish);
      el.appendChild(card);
    });
    updateMap(rows);
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

  function updateMap(rows) {
    if (!map) return;
    markers.forEach(function (m) { m.remove(); });
    markers = [];
    var seen = {};
    rows.forEach(function (x) {
      if (seen[x.venue.id]) return;
      seen[x.venue.id] = true;
      var m = new maplibregl.Marker()
        .setLngLat([x.venue.lon, x.venue.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(x.venue.name + " - " + x.venue.address))
        .addTo(map);
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

    document.getElementById("q").addEventListener("input", function (e) {
      query = e.target.value.trim();
      render();
    });
    document.getElementById("sort").addEventListener("change", function (e) {
      sortBy = e.target.value;
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (c) { c.classList.remove("on"); });
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
