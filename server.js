const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// Connexió a PostgreSQL
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: No s\'ha trobat la variable DATABASE_URL.');
  console.log('💡 Si estàs en local, recorda configurar-la o passar-li al terminal.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});


// Inicialització de la base de dades
async function initDb() {
  if (!process.env.DATABASE_URL) return;
  try {
    const sqlPath = path.join(__dirname, 'sql', 'schema.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      console.log('✅ Base de dades inicialitzada correctament');
    }
  } catch (err) {
    console.error('❌ Error inicialitzant la base de dades:', err);
  }
}
initDb();


// Funció genèrica per fer queries
const query = (text, params) => {
  return pool.query(text, params).catch(err => {
    console.error('❌ Error en la query:', text);
    console.error('Detall:', err.message);
    throw err;
  });
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

