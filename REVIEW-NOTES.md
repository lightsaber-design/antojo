# Price trust and accessibility proposal

This is a small technical proposal on top of the sushi/synonym update. It keeps the existing Spanish product and visual language. No restaurant prices or source dates have been changed or independently reverified.

## Changes

- Shared browser/CLI rules reject missing, impossible or future dates, non-finite/negative prices, non-HTTPS sources and unknown channels. Day 90 remains valid; day 91 is stale, preserving the existing boundary.
- Only fresh/soon prices enter the range or lead price sorting. Historical prices stay visible but marked stale.
- Broad searches show a range of different options, not a claim of equivalent dishes, portions or sales channels. Canonical dish/portion/channel grouping remains future work.
- Persistent search label, pressed category state, live result count, dish headings, keyboard-focusable suggestions and Escape dismissal. Existing search synonyms are preserved, not reimplemented.
- Render results before map setup; a missing CDN or WebGL failure cannot disable the list. Debounce rendering by 120 ms and respect reduced motion.
- Explain straight-line distances, local-only search/request storage and lack of automatic research or repricing. No network automation is introduced.

## Verification

`node test-price-rules.cjs` runs 12 dependency-free cases; `node --check app.js`, `node --check price-rules.js`, and `node pipeline/revalidate.js` check syntax and current seed processing. Additional browser checks were run at 320, 390 and 1280 px, including missing CDN, a thrown WebGL constructor, Spanish search, keyboard dismissal and category pressed state. The screenshots in the PR show the real proposed product with the MapLibre CDN deliberately unavailable (list fallback), not GitHub. Emoji fallback squares come from the test environment fonts, not changed product text.

## Deliberate limits

No redesign, framework migration, new backend, external account, paid service, scheduled scraper, changes to deployment, or automatic merge. Search popularity and requests still need a manual export process. This is not a complete accessibility/security audit or a Core Web Vitals measurement. CDN SRI/CSP, canonical comparisons, structured data and a full data-review workflow should be separate decisions.
