const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuració de la base de dades (PostgreSQL per a Render, SQLite per a local)
const isPg = !!process.env.DATABASE_URL;
let pool, sqliteDb;

if (isPg) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('🌐 Connectat a PostgreSQL (Modus Render)');
} else {
  const sqlite3 = require('sqlite3').verbose();
  sqliteDb = new sqlite3.Database(path.join(__dirname, 'avaluacio.db'));
  console.log('🏠 Connectat a SQLite local (avaluacio.db)');
}

// Inicialització de la base de dades
async function initDb() {
  const sqlPath = path.join(__dirname, 'sql', 'schema.sql');
  if (!fs.existsSync(sqlPath)) return;
  const sql = fs.readFileSync(sqlPath, 'utf8');

  if (isPg) {
    try {
      await pool.query(sql);
      console.log('✅ PostgreSQL inicialitzat');
    } catch (err) { console.error('❌ Error inicialitzant PG:', err.message); }
  } else {
    // SQLite necessita separar les comandes per ;
    const statements = sql.split(';').filter(s => s.trim());
    sqliteDb.serialize(() => {
      statements.forEach(s => sqliteDb.run(s));
    });
    console.log('✅ SQLite inicialitzat');
  }
}
initDb();

// Funció genèrica per fer queries (Abstracció PG / SQLite)
const query = (text, params = []) => {
  if (isPg) {
    return pool.query(text, params).catch(err => {
      console.error('❌ Error PG:', text, err.message);
      throw err;
    });
  } else {
    // Adaptació de sintaxi PG ($1) a SQLite (?)
    const sqliteSql = text.replace(/\$\d+/g, '?').replace(/RETURNING id/gi, '');
    
    return new Promise((resolve, reject) => {
      const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      } else {
        sqliteDb.run(sqliteSql, params, function(err) {
          if (err) reject(err);
          else resolve({ rows: [{ id: this.lastID }], rowCount: this.changes });
        });
      }
    }).catch(err => {
      console.error('❌ Error SQLite:', sqliteSql, err.message);
      throw err;
    });
  }
};

app.use(express.json({ limit: '10mb' }));

// Logging de peticions per depurar
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });

// Helpers de resposta
function ok(fn) {
  return async (req, res) => {
    try {
      res.json(await fn(req, res));
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  };
}

const tables = {
  grups: ['nom', 'curs', 'descripcio'],
  alumnes: ['numero', 'grup_id', 'nom', 'cognoms', 'data_naixement'],
  moduls: ['codi', 'nom', 'hores', 'curs', 'actiu', 'descripcio'],
  ras: ['modul_id', 'codi', 'descripcio', 'pes', 'nota_minima', 'actiu'],
  cas: ['ra_id', 'codi', 'descripcio', 'pes', 'actiu'],
  tipus_activitat: ['nom', 'pes_defecte', 'requereix_minim', 'nota_minima', 'limita_ra', 'descripcio', 'actiu'],
  projectes: ['modul_id', 'tipus_id', 'nom', 'descripcio', 'pes_global', 'data_inici', 'data_fi', 'es_sintesi', 'nota_minima'],
  projecte_ra: ['projecte_id', 'ra_id', 'pes'],
  projecte_ca: ['projecte_id', 'ca_id', 'pes'],
  notes_projecte: ['alumne_id', 'projecte_id', 'nota', 'observacions']
};

const listSql = {
  grups: 'SELECT g.*, (SELECT COUNT(*) FROM alumnes a WHERE a.grup_id=g.id) as alumnes FROM grups g ORDER BY g.nom',
  alumnes: 'SELECT a.*, g.nom as grup_nom FROM alumnes a LEFT JOIN grups g ON g.id=a.grup_id ORDER BY g.nom, a.cognoms, a.nom',
  moduls: 'SELECT * FROM moduls ORDER BY actiu DESC, codi',
  ras: 'SELECT r.*, m.codi as modul_codi, m.nom as modul_nom FROM ras r JOIN moduls m ON m.id=r.modul_id ORDER BY m.codi, r.codi',
  cas: 'SELECT c.*, r.codi as ra_codi, m.codi as modul_codi FROM cas c JOIN ras r ON r.id=c.ra_id JOIN moduls m ON m.id=r.modul_id ORDER BY m.codi, r.codi, c.codi',
  tipus_activitat: 'SELECT * FROM tipus_activitat ORDER BY actiu DESC, nom',
  projectes: 'SELECT p.*, m.codi as modul_codi, t.nom as tipus_nom, COALESCE(t.requereix_minim, 0) as tipus_requereix_minim, COALESCE(t.nota_minima, 5) as tipus_nota_minima, COALESCE(t.limita_ra, 0) as tipus_limita_ra FROM projectes p JOIN moduls m ON m.id=p.modul_id LEFT JOIN tipus_activitat t ON t.id=p.tipus_id ORDER BY m.codi, p.created_at, p.nom',
  projecte_ra: 'SELECT pr.*, p.nom as projecte_nom, r.codi as ra_codi FROM projecte_ra pr JOIN projectes p ON p.id=pr.projecte_id JOIN ras r ON r.id=pr.ra_id ORDER BY p.nom, r.codi',
  projecte_ca: 'SELECT pc.*, p.nom as projecte_nom, c.codi as ca_codi, r.codi as ra_codi FROM projecte_ca pc JOIN projectes p ON p.id=pc.projecte_id JOIN cas c ON c.id=pc.ca_id JOIN ras r ON r.id=c.ra_id ORDER BY p.nom, r.codi, c.codi',
  notes_projecte: 'SELECT n.*, a.nom as alumne_nom, a.cognoms as alumne_cognoms, p.nom as projecte_nom FROM notes_projecte n JOIN alumnes a ON a.id=n.alumne_id JOIN projectes p ON p.id=n.projecte_id ORDER BY a.cognoms, p.nom'
};


// Generació automàtica de CRUD
for (const [t, cols] of Object.entries(tables)) {
  app.get(`/api/${t}`, ok(async () => (await query(listSql[t] || `SELECT * FROM ${t}`)).rows));
  
  app.post(`/api/${t}`, ok(async req => {
    const data = req.body;
    const keys = cols.filter(c => data[c] !== undefined);
    const q = `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`;
    const r = await query(q, keys.map(k => data[k]));
    return { id: r.rows[0].id };
  }));

  app.put(`/api/${t}/:id`, ok(async req => {
    const data = req.body;
    const keys = cols.filter(c => data[c] !== undefined);
    const q = `UPDATE ${t} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1}`;
    await query(q, [...keys.map(k => data[k]), req.params.id]);
    return { ok: true };
  }));

  app.delete(`/api/${t}/:id`, ok(async req => {
    await query(`DELETE FROM ${t} WHERE id=$1`, [req.params.id]);
    return { ok: true };
  }));
}

app.get('/api/bootstrap', ok(async () => ({
  grups: (await query(listSql.grups)).rows,
  alumnes: (await query(listSql.alumnes)).rows,
  moduls: (await query(listSql.moduls)).rows,
  ras: (await query(listSql.ras)).rows,
  cas: (await query(listSql.cas)).rows,
  tipus_activitat: (await query(listSql.tipus_activitat)).rows,
  projectes: (await query(listSql.projectes)).rows,
  projecte_ra: (await query(listSql.projecte_ra)).rows,
  projecte_ca: (await query(listSql.projecte_ca)).rows,
  notes_projecte: (await query(listSql.notes_projecte)).rows,
  notes_ra_calculades: (await query(`
    SELECT n.*, a.nom as alumne_nom, a.cognoms as alumne_cognoms, r.codi as ra_codi, m.codi as modul_codi 
    FROM notes_ra_calculades n 
    JOIN alumnes a ON a.id=n.alumne_id 
    JOIN ras r ON r.id=n.ra_id 
    JOIN moduls m ON m.id=r.modul_id 
    ORDER BY a.cognoms, r.codi
  `)).rows
})));

app.post('/api/import/curriculum', upload.single('file'), ok(async req => {
  const rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  for (const row of rows) {
    const modulCodi = row.modul_codi || row.codi_modul;
    const modulNom = row.modul_nom || row.nom_modul;
    if (!modulCodi || !modulNom) continue;

    let m = (await query('SELECT id FROM moduls WHERE codi=$1', [modulCodi])).rows[0];
    if (!m) {
      m = (await query('INSERT INTO moduls(codi,nom,hores,curs,actiu) VALUES($1,$2,$3,$4,1) RETURNING id', [modulCodi, modulNom, row.modul_hores || null, row.modul_curs || ''])).rows[0];
    }
    
    if (row.ra_codi) {
      let ra = (await query('SELECT id FROM ras WHERE modul_id=$1 AND codi=$2', [m.id, row.ra_codi])).rows[0];
      if (!ra) {
        ra = (await query('INSERT INTO ras(modul_id,codi,descripcio,pes,nota_minima,actiu) VALUES($1,$2,$3,$4,$5,1) RETURNING id', [m.id, row.ra_codi, row.ra_descripcio || '', row.ra_pes || 0, row.ra_nota_minima || 5])).rows[0];
      }
      if (row.ca_codi) {
        await query('INSERT INTO cas(ra_id,codi,descripcio,pes,actiu) VALUES($1,$2,$3,$4,1) ON CONFLICT(ra_id,codi) DO UPDATE SET descripcio=EXCLUDED.descripcio, pes=EXCLUDED.pes', [ra.id, row.ca_codi, row.ca_descripcio || '', row.ca_pes || 0]);
      }
    }
  }
  return { ok: true };
}));

app.post('/api/notes_projecte/upsert', ok(async req => {
  const { alumne_id, projecte_id, nota, observacions } = req.body;
  
  // Intentem fer un UPSERT (Insert or Update)
  // En PostgreSQL usem ON CONFLICT, en SQLite usem INSERT OR REPLACE o ho fem manualment
  if (isPg) {
    const q = `
      INSERT INTO notes_projecte (alumne_id, projecte_id, nota, observacions)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (alumne_id, projecte_id)
      DO UPDATE SET nota = EXCLUDED.nota, observacions = EXCLUDED.observacions
      RETURNING id
    `;
    const r = await query(q, [alumne_id, projecte_id, nota, observacions]);
    return { id: r.rows[0].id };
  } else {
    // SQLite manual upsert
    const existing = (await query('SELECT id FROM notes_projecte WHERE alumne_id=$1 AND projecte_id=$2', [alumne_id, projecte_id])).rows[0];
    if (existing) {
      await query('UPDATE notes_projecte SET nota=$1, observacions=$2 WHERE id=$3', [nota, observacions, existing.id]);
      return { id: existing.id };
    } else {
      const r = await query('INSERT INTO notes_projecte (alumne_id, projecte_id, nota, observacions) VALUES ($1, $2, $3, $4)', [alumne_id, projecte_id, nota, observacions]);
      return { id: r.rows[0].id };
    }
  }
}));


app.post('/api/recalcular', ok(async () => {
  await query('DELETE FROM notes_ra_calculades');
  const alumnes = (await query('SELECT * FROM alumnes')).rows;
  const ras = (await query('SELECT * FROM ras WHERE actiu=1')).rows;
  const allNotes = (await query('SELECT n.*, pr.pes, pr.ra_id, t.requereix_minim, t.limita_ra, t.nota_minima as t_min FROM notes_projecte n JOIN projecte_ra pr ON pr.projecte_id=n.projecte_id JOIN projectes p ON p.id=n.projecte_id LEFT JOIN tipus_activitat t ON t.id=p.tipus_id')).rows;

  for (const a of alumnes) {
    for (const ra of ras) {
      const notes = allNotes.filter(n => n.alumne_id == a.id && n.ra_id == ra.id);
      let total = 0, pesTotal = 0, bloq = 0;
      for (const n of notes) {
        total += Number(n.nota) * Number(n.pes);
        pesTotal += Number(n.pes);
        if (n.requereix_minim && n.limita_ra && Number(n.nota) < Number(n.t_min || 5)) bloq = 1;
      }
      const calc = pesTotal > 0 ? total / pesTotal : null;
      let final = calc;
      let superat = (calc !== null && calc >= (ra.nota_minima || 5)) ? 1 : 0;
      if (calc !== null && bloq && calc >= 5) { final = 4; superat = 0; }
      if (calc !== null) {
        await query('INSERT INTO notes_ra_calculades(alumne_id, ra_id, nota_calculada, nota_final, superat, bloquejat_sintesi) VALUES($1,$2,$3,$4,$5,$6)', [a.id, ra.id, calc, final, superat, bloq]);
      }
    }
  }
  return { ok: true };
}));

app.post('/api/projectes/:id/normalitzar', ok(async (req) => {
  const { id } = req.params;
  // Normalitzar pesos de RA per aquesta activitat (o millor, per als RA que toca aquesta activitat)
  // En realitat la normalització hauria de ser per RA: "Totes les activitats que toquen el RA1 sumin 100%"
  return { ok: true };
}));

app.post('/api/ras/:id/normalitzar_projectes', ok(async (req) => {
  const { id } = req.params;
  const weights = (await query('SELECT id, pes FROM projecte_ra WHERE ra_id=$1', [id])).rows;
  if (!weights.length) return { ok: true };
  const total = weights.reduce((a, b) => a + Number(b.pes), 0);
  const factor = total > 0 ? 100 / total : (100 / weights.length);
  for (const w of weights) {
    const nouPes = total > 0 ? Math.round(w.pes * factor * 10) / 10 : Math.round((100 / weights.length) * 10) / 10;
    await query('UPDATE projecte_ra SET pes=$1 WHERE id=$2', [nouPes, w.id]);
  }
  return { ok: true };
}));


app.post('/api/moduls/:id/normalitzar', ok(async (req) => {
  const { id } = req.params;
  const ras = (await query('SELECT id, pes FROM ras WHERE modul_id=$1', [id])).rows;
  if (!ras.length) return { ok: true };
  const totalRas = ras.reduce((a, b) => a + Number(b.pes), 0);
  const factor = totalRas > 0 ? 100 / totalRas : (100 / ras.length);
  for (const ra of ras) {
    const nouPes = totalRas > 0 ? Math.round(ra.pes * factor * 10) / 10 : Math.round((100 / ras.length) * 10) / 10;
    await query('UPDATE ras SET pes=$1 WHERE id=$2', [nouPes, ra.id]);
    const cas = (await query('SELECT id, pes FROM cas WHERE ra_id=$1', [ra.id])).rows;
    if (cas.length) {
      const totalCas = cas.reduce((a, b) => a + Number(b.pes), 0);
      const fca = totalCas > 0 ? 100 / totalCas : (100 / cas.length);
      for (const ca of cas) {
        const nouPesCA = totalCas > 0 ? Math.round(ca.pes * fca * 10) / 10 : Math.round((100 / cas.length) * 10) / 10;
        await query('UPDATE cas SET pes=$1 WHERE id=$2', [nouPesCA, ca.id]);
      }
    }
  }
  return { ok: true };
}));

app.post('/api/tipus_activitat/normalitzar', ok(async () => {
  const tipus = (await query('SELECT id, pes_defecte FROM tipus_activitat')).rows;
  if (!tipus.length) return { ok: true };
  const total = tipus.reduce((a, b) => a + (Number(b.pes_defecte) || 0), 0);
  const factor = total > 0 ? 100 / total : (100 / tipus.length);
  for (const t of tipus) {
    const nouPes = total > 0 ? Math.round(Number(t.pes_defecte) * factor * 10) / 10 : Math.round((100 / tipus.length) * 10) / 10;
    await query('UPDATE tipus_activitat SET pes_defecte=$1 WHERE id=$2', [nouPes, t.id]);
  }
  return { ok: true };
}));

app.listen(PORT, () => console.log(`Servidor actiu a Render (Port ${PORT})`));

