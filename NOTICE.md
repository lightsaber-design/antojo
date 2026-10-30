# NOTICE - atribuciones de Antojo

Carol (30 oct 2026): reutilizar todo el código que las licencias permitan, con
atribución; el código GPL o sin licencia sirve solo como fuente de ideas.

## Metodología adaptada (licencia MIT)

### deielurbe/amsterdam-menus
<https://github.com/deielurbe/amsterdam-menus>

Qué se tomó: la metodología del pipeline de cartas - la fuente es primero la
web del propio local (descubierta también vía OpenStreetMap), la carta se
convierte en platos estructurados y se aplica higiene de precios (importes
plausibles, deduplicado, registro de lo descartado). La implementación en
`pipeline/extract-menu.js` es propia, en JavaScript: la etapa de captura de
ese proyecto no está publicada, así que no hay código copiado, pero la
atribución se mantiene por la metodología. Licencia original:

MIT License

Copyright (c) 2026 Dei M. Elurbe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Solo ideas (sin código)

### primetime43/PriceBite-public - GPL-3.0
<https://github.com/primetime43/PriceBite-public> (<https://pricebite.org>)

Ideas tomadas: histórico de precios por plato (campo `hist` en `data.js`) y
refresco/revalidación programada (`pipeline/revalidate.js`). Su README además
documenta qué cadenas tienen protección anti-bot, útil si Antojo algún día
automatiza capturas. La licencia GPL-3.0 no permite copiar código a esta app:
se implementó todo de cero.

### akulanikhil/cheapotle - sin licencia explícita
<https://github.com/akulanikhil/cheapotle>

Idea tomada: comparar el precio del mismo plato entre locales cercanos y
mostrarlo en el mapa (barra de comparación + marcadores coloreados por precio
en `app.js`). Sin licencia explícita no se puede reutilizar código: solo la idea.

## Explorados, sin uso por ahora

- acst52/EatsMatch y YuruHuang/Online-food-delivery: comparación de precios
  entre plataformas de delivery.
- jadaradix/deliveroo-scraper, omkarcloud/uber-eats-scraper y Apify Restaurant
  Menu Scraper: scrapers de plataformas. Revisar licencia y términos de cada
  plataforma antes de usar nada de esto.
