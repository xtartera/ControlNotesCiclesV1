-- Esquema per a PostgreSQL
CREATE TABLE IF NOT EXISTS grups (
  id SERIAL PRIMARY KEY, 
  nom TEXT NOT NULL UNIQUE, 
  curs TEXT, 
  descripcio TEXT, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alumnes (
  id SERIAL PRIMARY KEY, 
  numero TEXT, 
  grup_id INTEGER REFERENCES grups(id) ON DELETE SET NULL, 
  nom TEXT NOT NULL, 
  cognoms TEXT NOT NULL, 
  data_naixement DATE, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moduls (
  id SERIAL PRIMARY KEY, 
  codi TEXT NOT NULL UNIQUE, 
  nom TEXT NOT NULL, 
  hores INTEGER, 
  curs TEXT, 
  actiu INTEGER DEFAULT 1, 
  descripcio TEXT, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ras (
  id SERIAL PRIMARY KEY, 
  modul_id INTEGER NOT NULL REFERENCES moduls(id) ON DELETE CASCADE, 
  codi TEXT NOT NULL, 
  descripcio TEXT NOT NULL, 
  pes DECIMAL DEFAULT 0, 
  nota_minima DECIMAL DEFAULT 5, 
  actiu INTEGER DEFAULT 1, 
  UNIQUE(modul_id,codi)
);

CREATE TABLE IF NOT EXISTS cas (
  id SERIAL PRIMARY KEY, 
  ra_id INTEGER NOT NULL REFERENCES ras(id) ON DELETE CASCADE, 
  codi TEXT NOT NULL, 
  descripcio TEXT NOT NULL, 
  pes DECIMAL DEFAULT 0, 
  actiu INTEGER DEFAULT 1, 
  UNIQUE(ra_id,codi)
);

CREATE TABLE IF NOT EXISTS tipus_activitat (
  id SERIAL PRIMARY KEY, 
  nom TEXT NOT NULL UNIQUE, 
  pes_defecte DECIMAL DEFAULT 0, 
  requereix_minim INTEGER DEFAULT 0, 
  nota_minima DECIMAL DEFAULT 5, 
  limita_ra INTEGER DEFAULT 0, 
  descripcio TEXT, 
  actiu INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS projectes (
  id SERIAL PRIMARY KEY, 
  modul_id INTEGER NOT NULL REFERENCES moduls(id) ON DELETE CASCADE, 
  tipus_id INTEGER REFERENCES tipus_activitat(id) ON DELETE SET NULL, 
  nom TEXT NOT NULL, 
  descripcio TEXT, 
  pes_global DECIMAL DEFAULT 0, 
  data_inici DATE, 
  data_fi DATE, 
  es_sintesi INTEGER DEFAULT 0, 
  nota_minima DECIMAL DEFAULT 5, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projecte_ra (
  id SERIAL PRIMARY KEY, 
  projecte_id INTEGER NOT NULL REFERENCES projectes(id) ON DELETE CASCADE, 
  ra_id INTEGER NOT NULL REFERENCES ras(id) ON DELETE CASCADE, 
  pes DECIMAL DEFAULT 0, 
  UNIQUE(projecte_id,ra_id)
);

CREATE TABLE IF NOT EXISTS projecte_ca (
  id SERIAL PRIMARY KEY, 
  projecte_id INTEGER NOT NULL REFERENCES projectes(id) ON DELETE CASCADE, 
  ca_id INTEGER NOT NULL REFERENCES cas(id) ON DELETE CASCADE, 
  pes DECIMAL DEFAULT 0, 
  UNIQUE(projecte_id,ca_id)
);

CREATE TABLE IF NOT EXISTS notes_projecte (
  id SERIAL PRIMARY KEY, 
  alumne_id INTEGER NOT NULL REFERENCES alumnes(id) ON DELETE CASCADE, 
  projecte_id INTEGER NOT NULL REFERENCES projectes(id) ON DELETE CASCADE, 
  nota DECIMAL NOT NULL CHECK(nota>=0 AND nota<=10), 
  observacions TEXT, 
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  UNIQUE(alumne_id,projecte_id)
);

CREATE TABLE IF NOT EXISTS notes_ra_calculades (
  id SERIAL PRIMARY KEY, 
  alumne_id INTEGER NOT NULL REFERENCES alumnes(id) ON DELETE CASCADE, 
  ra_id INTEGER NOT NULL REFERENCES ras(id) ON DELETE CASCADE, 
  nota_calculada DECIMAL, 
  nota_final DECIMAL, 
  superat INTEGER, 
  bloquejat_sintesi INTEGER DEFAULT 0, 
  detall TEXT, 
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  UNIQUE(alumne_id,ra_id)
);

