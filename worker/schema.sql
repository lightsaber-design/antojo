-- Antojo backend (Fase 1): base propia de platos y precios.
-- Reglas de Carol: cada precio lleva fuente (src), fecha (chk) y canal (ch);
-- revalidacion a 90 dias, primero lo mas buscado; nada inventado.
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  lat REAL, lon REAL,
  rating REAL, reviews INTEGER, band TEXT,
  cat TEXT, cats TEXT,            -- cats: JSON array opcional
  source TEXT,                    -- ficha de terceros (Yelp) si aplica
  menu_url TEXT,                  -- carta oficial a re-fetch para investigar/revalidar
  created_at TEXT DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id TEXT NOT NULL REFERENCES venues(id),
  name TEXT NOT NULL,
  price REAL,                     -- NULL = sin precio verificado
  src TEXT,                       -- URL de la fuente
  ch TEXT,                        -- canal: carta, pdf, toast, square, web, agregador, deliveroo, foto
  chk TEXT,                       -- fecha de verificacion YYYY-MM-DD
  hist TEXT,                      -- JSON: observaciones anteriores [{price,chk,src,ch}]
  note TEXT,                      -- fragmento de la fuente (auditoria)
  created_at TEXT DEFAULT (date('now')),
  updated_at TEXT DEFAULT (date('now')),
  UNIQUE(venue_id, name)
);
CREATE TABLE IF NOT EXISTS searches (
  term TEXT PRIMARY KEY,          -- normalizado
  display TEXT,                   -- tal como lo escribio el usuario
  count INTEGER DEFAULT 0,
  last_at TEXT DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS queue (
  term TEXT PRIMARY KEY,
  display TEXT,
  priority INTEGER DEFAULT 0,     -- n de busquedas (primero lo mas buscado)
  status TEXT DEFAULT 'pending',  -- pending | done | needs_review
  attempts INTEGER DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (date('now')),
  updated_at TEXT DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_dishes_venue ON dishes(venue_id);
CREATE INDEX IF NOT EXISTS idx_dishes_chk ON dishes(chk);
