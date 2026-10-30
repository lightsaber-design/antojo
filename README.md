# Antojo — demo piloto Dublín

**Demo en vivo:** https://lightsaber-design.github.io/restaurant/

Demo funcional estática (GitHub Pages): búsqueda de restaurantes por **plato**,
precio, distancia y valoración. Piloto en el centro de Dublín.

- `index.html` + `app.js` + `data.js` + `styles.css` — sin build, sin backend.
- Mapa: OpenStreetMap vía MapLibre GL (CDN). Sin API keys en el cliente.

## Backend Fase 1 (30 oct 2026, noche): base propia en vivo

Carol aprobó el backend: cualquier plato que busque un usuario se investiga
bajo demanda, no solo los precargados. Arquitectura gratuita (€0, dentro de
los free tiers y de su cuenta de Cloudflare existente):

- **API**: Cloudflare Worker `antojo-api` (`worker/worker.js`, sin deps) en
  https://antojo-api.caroldenissetorres.workers.dev — `GET /api/search`,
  `/api/suggest`, `/api/stats`, `/api/queue`. CORS abierto (datos públicos).
- **Base de datos**: D1 (`antojo-db`, SQLite): `venues`, `dishes` (con
  src/chk/ch/hist), `searches` (lo más buscado) y `queue` (encargos).
- **Investigación automática**: cron cada 2 h (`7 */2 * * *`) procesa la cola
  —primero lo más buscado— descargando las cartas oficiales de los locales
  registrados y extrayendo plato+precio (higiene de precios, dedupe; entra
  marcado con fuente, fecha y canal, nota de auditoría). Lo que no se
  encuentra tras 3 intentos queda `needs_review` (ampliar registro de
  locales: el Worker no descubre locales nuevos por sí solo a coste €0).
- **Revalidación (regla 90 días)**: cron diario (`21 4 * * *`) re-fetch de
  los precios más antiguos; actualiza precio+fecha (guardando histórico) o
  el precio queda marcado como sin revalidar y no se muestra como vigente.
- **Front**: la demo consulta primero la API y cae a `data.js` si la API no
  responde, diciéndolo («base en vivo (API)» vs «datos locales»).
- Disparo manual del colector: `POST /api/collect` con cabecera
  `x-antojo-key` (secreto COLLECT_KEY en el Worker).
- Despliegue: API REST de Cloudflare con token de API acotado
  (Workers Scripts + D1, solo su cuenta, 90 días, guardado en el vault de
  Instinct). D1 se siembra desde `data.js` con `worker/seed.mjs`.

## Qué hace hoy (30 oct 2026)

- 87 platos en 35 locales del centro (hamburguesas, ramen y brunch); 85 con
  precio real verificado y 2 pendientes de Banyi (fuentes agotadas: web rota y
  pedido online caído).
- **Comparación del mismo plato entre locales**: escribe un plato (ej.
  «cheeseburger») y verás el rango de precios, el local más barato y el mapa
  coloreado por precio (verde = más barato, rojo = más caro).
- **Frescura viva (regla de 90 días)**: cada ficha calcula los días desde su
  verificación; al acercarse a 90 avisa «revalidar antes de…» y al pasarlos el
  precio se marca «sin revalidar» y deja de contar como vigente.
- **Histórico de precios por plato** (campo `hist`): cuando un plato tiene
  observaciones anteriores, la ficha muestra la evolución («antes €X · ahora €Y»).
- **Lo más buscado**: la demo cuenta las búsquedas del dispositivo
  (localStorage, nada sale del navegador) y las muestra como atajos;
  `pipeline/revalidate.js` las usa para ordenar la cola («primero lo más buscado»).

## Reglas de datos (acordadas con Carol)

- Nada de precios inventados: sin fuente, `price: null` y «sin precio verificado».
- Cada precio guarda fuente (`src`), fecha (`chk`) y canal (`ch`): carta
  oficial, PDF oficial, pedido online oficial (recogida), Deliveroo (entrega a
  domicilio, puede llevar sobreprecio) o foto de la carta en el local.
- Un plato solo queda pendiente tras agotar fuentes (web oficial, pedido
  online, plataformas de delivery, cartas de terceros).
- Revalidación a los **90 días**; lo no revalidable se marca obsoleto y nunca
  se muestra como vigente. Se revalida por antigüedad, empezando por lo más
  buscado. Próxima revalidación de esta base: 28 ene 2027.

## Pipeline (cero dependencias, Node 18+)

- `pipeline/revalidate.js` — cola de revalidación: estado de cada precio
  (fresco / revalidar pronto / OBSOLETO / pendiente), ordenada por urgencia y
  por lo más buscado (`--searches busquedas.json`).
- `pipeline/extract-menu.js` — candidatos de platos+precios desde la web
  oficial de un restaurante (o un PDF vía `pdftotext`), marcados CANDIDATO
  para revisión: nada entra en `data.js` sin verificarse contra la fuente.

## Créditos y licencias

Ver [NOTICE.md](NOTICE.md): metodología de extracción adaptada de
deielurbe/amsterdam-menus (MIT); histórico y refresco inspirados en PriceBite
(GPL-3.0 — solo ideas, sin código); comparación del mismo plato en mapa
inspirada en cheapotle (sin licencia — solo la idea).

El plan completo del producto está en [PLAN.md](PLAN.md).
