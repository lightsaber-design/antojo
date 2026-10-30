# Despliegue del backend (Cloudflare, free tier)

Token de API en el vault de Instinct: "Cloudflare API token
antojo-backend-workers-d1" (Workers Scripts Edit + D1 Edit, solo su cuenta,
caduca 28 ene 2027). Cuenta: 141942ccf46ef90151a898a59500a34a.
D1: antojo-db = db8bb701-8381-4c7d-945f-06884e4bae16.
Worker: antojo-api → https://antojo-api.caroldenissetorres.workers.dev

- Esquema: schema.sql (aplicado una vez por REST /d1/database/{id}/query).
- Semilla: CF_TOKEN=... CF_ACCOUNT=... CF_D1=... node seed.mjs (desde data.js).
- Subir worker: PUT /accounts/{acc}/workers/scripts/antojo-api (multipart
  metadata+worker.js; bindings: DB→d1, compat 2026-10-30).
- Crons: PUT .../schedules con body JSON array (no objeto):
  [{"cron":"7 */2 * * *"},{"cron":"21 4 * * *"}]
- Secreto COLLECT_KEY: PUT .../secrets (disparo manual de /api/collect).
