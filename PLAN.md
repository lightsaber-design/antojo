# Antojo - Plan de producto

> Fuente: [Google Doc](https://docs.google.com/document/d/12MsVLgTMcIXW7UK_vLV3TFIBtGldCYFJ6nz28aC9Dzw/edit) — guardado localmente el 2026-09-11.

## Visión

App global para buscar restaurantes por plato, precio, distancia y recomendación. Dublín es solo el piloto. El diferenciador: buscar por PLATO ("el mejor ramen cerca de mí"), no por restaurante. Nadie lo hace bien.

## Fase 1 - Piloto Dublín (MVP)

- Primero web PWA (sin app stores, sin los $99/año de Apple)
- Búsqueda por plato, precio, distancia y recomendación
- Categorías fuertes primero, expandible después sin rehacer nada
- Una zona piloto (sugerencia: centro de Dublín)
- Base de datos propia de platos y precios: el diferenciador que nadie tiene
- Consultar primero la base propia; buscar automáticamente lo que falta
- Sin carga manual de menús

## Fase posterior - App Android

- App nativa/híbrida para Android después del piloto PWA (deseo explícito de Carol)

## Plataformas

- Mapa: OpenStreetMap (gratis)
- Lugares y ratings: Google Places (el crédito gratis de ~€200/mes probablemente cubre todo el piloto)
- Platos y precios: base de datos propia (guardar place_id y reconsultar Google; frescura de 90 días)
- Nota: los términos de Places limitan almacenamiento permanente: guardar place_id y datos propios de menús/precios, reconsultar datos Google
- Costo estimado del piloto: €10-35/mes + ~€10/año de dominio, sin desarrolladores

## Servidor e infraestructura

- Regla: gratis o muy barato al inicio; migrar a plan pagado cuando crezca el tráfico
- Hosting front: Cloudflare Pages (decisión tomada: gratis y permite uso comercial desde el día 1; el plan gratis de Vercel es no-comercial)
- Base de datos: Supabase (decisión tomada; free tier, Postgres + PostGIS)
- La migración a plan pagado se evalúa cuando crezca el tráfico

## Stack técnico

- Front: Next.js (PWA) en Cloudflare Pages - gratis y permite uso comercial desde el día 1 (decisión de Carol sobre Vercel, cuyo plan gratis es no-comercial)
- Base de datos + auth: Supabase free tier - Postgres con PostGIS, búsquedas por distancia nativas ("a 500m de mí")
- Mapa: OpenStreetMap renderizado con MapLibre GL (gratis)
- Datos de restaurantes: Google Places con el crédito gratis (~€200/mes cubre el piloto)
- Todo el stack corre en €0 hasta que haya tráfico real; migración a planes pagados cuando crezca

## Fase 2

- Restaurantes reclaman su perfil y suben su propio menú (gratis para ellos, carga de datos sin costo)
- QR en las mesas que lleva directo al menú (€0)
- NFC premium de pago como diferenciador (tags comprados al por mayor; el restaurante crea su cuenta y el tag lleva al menú)

## Monetización (fase 2 en adelante)

- Menú siempre gratis (atrae restaurantes)
- Cobro por gestión de reservas (modelo OpenTable/TheFork)
- NFC premium de pago
- No monetizar antes de tener tráfico

## Reservas con abono por mesa

- El usuario paga un abono (depósito) al reservar mesa: protege al restaurante contra no-shows
- Monto mínimo sugerido: €10 fijo por mesa, o €5 por persona en grupos de 4+
- El abono se descuenta de la cuenta final: el cliente no siente que paga extra
- Procesador: Stripe - sin mensualidad, solo comisión por transacción, mantiene el stack en €0
- Conecta con la monetización de Fase 2: la gestión de reservas es el servicio pagado para restaurantes
- Nota: las reservas son parte del proyecto final de Carol

## Costos de crecimiento temprano

- ~€80-250/mes
- Places es el costo dominante a escala
- Controles: rotar/restringir la API key y alertas de $50

## Estado Fase 1 (30 oct 2026)

Backend en vivo sobre free tiers de su Cloudflare (Worker antojo-api + D1
antojo-db + crons de investigación y revalidación 90 días) en vez de
Supabase: mismo modelo (base propia, cola por demanda), sin alta nueva y a
€0. Detalles en README.md y worker/.

## Pendientes

- Elegir categoría y zona del piloto (sugerencias: ramen, hamburguesas o brunch en el centro de Dublín)
- Encargar Fase 0 a Codex
- Repositorio: https://github.com/lightsaber-design/antojo (público, auditado sin secretos expuestos)
