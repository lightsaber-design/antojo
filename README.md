# Antojo — demo piloto Dublín

**Demo en vivo:** https://lightsaber-design.github.io/restaurant/

Demo funcional estática (GitHub Pages): búsqueda de restaurantes por **plato**,
precio, distancia y valoración. Piloto en el centro de Dublín.

- `index.html` + `app.js` + `data.js` + `styles.css` — sin build, sin backend.
- Mapa: OpenStreetMap vía MapLibre GL (CDN). Sin API keys en el cliente.

## Base semilla de precios reales (30 oct 2026)

Primera categoría armada: **hamburguesas** en el centro de Dublín — 20 locales
(Bunsen ×4, Handsome Burger, Dash Burger ×2, Mad Egg ×2, Wowburger ×2, Chimac,
Bóbós ×2, Elephant & Castle, Brannigans, Darkey Kelly's, Sheehans, Bison Bar,
The Bank on College Green). Ramen y brunch quedan como locales reales con
precios **pendientes de verificación** (nunca se muestran precios inventados).

Cada precio verificado guarda:

- **Fuente oficial** (`src`): carta en la web del restaurante, PDF de carta
  publicado por el restaurante, o su pedido online oficial (Toast / web propia).
- **Fecha de verificación** (`chk`): cuándo se leyó la fuente.
- **Canal** (`ch`): carta del local, PDF, o pedido online. Ojo: el precio de
  pedido online puede ser de recogida y no garantiza el precio en mesa
  (ej. Handsome Burger marca "Pickup Only").

Regla de frescura (acordada con Carol): un precio guardado se revalida a los
**90 días**; si no se puede revalidar, se marca obsoleto y nunca se muestra como
vigente. La revalidación se hace por antigüedad, **empezando por los platos más
buscados** (las búsquedas dicen qué investigar; la carta del restaurante
demuestra cuánto cuesta). Próxima revalidación de esta semilla: 28 ene 2027.

Fuentes excluidas a propósito: Deliveroo / Just Eat / Uber Eats (precios
distintos al local y riesgo de términos) y menús de terceros sin evidencia
oficial. The Church y Eddie Rocket's quedaron fuera de la semilla por no tener
precio de hamburguesa verificable en su web oficial hoy.

El plan completo del producto está en [PLAN.md](PLAN.md).
