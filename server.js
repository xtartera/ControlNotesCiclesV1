const express=require('express');const sqlite3=require('sqlite3').verbose();const fs=require('fs');const path=require('path');const multer=require('multer');const {parse}=require('csv-parse/sync');
const app=express();const PORT=process.env.PORT||3000;const DB=path.join(__dirname,'avaluacio.db');
const db=new sqlite3.Database(DB);db.serialize(()=>{db.exec(fs.readFileSync(path.join(__dirname,'sql/schema.sql'),'utf8'));db.run('ALTER TABLE ras ADD COLUMN actiu INTEGER DEFAULT 1',()=>{});db.run('ALTER TABLE cas ADD COLUMN actiu INTEGER DEFAULT 1',()=>{});db.run('ALTER TABLE tipus_activitat ADD COLUMN actiu INTEGER DEFAULT 1',()=>{});db.exec(fs.readFileSync(path.join(__dirname,'samples/seed.sql'),'utf8'));});
app.use(express.json({limit:'10mb'}));app.use(express.static(path.join(__dirname,'public')));const upload=multer({storage:multer.memoryStorage()});
const run=(sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res({id:this.lastID,changes:this.changes})}));
const all=(sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r)));const get=(sql,p=[])=>new Promise((res,rej)=>db.get(sql,p,(e,r)=>e?rej(e):res(r)));
function ok(fn){return async(req,res)=>{try{res.json(await fn(req,res))}catch(e){console.error(e);res.status(400).json({error:e.message})}}}
const tables={grups:['nom','curs','descripcio'],alumnes:['numero','grup_id','nom','cognoms','data_naixement'],moduls:['codi','nom','hores','curs','actiu','descripcio'],ras:['modul_id','codi','descripcio','pes','nota_minima','actiu'],cas:['ra_id','codi','descripcio','pes','actiu'],tipus_activitat:['nom','pes_defecte','requereix_minim','nota_minima','limita_ra','descripcio','actiu'],projectes:['modul_id','tipus_id','nom','descripcio','pes_global','data_inici','data_fi','es_sintesi','nota_minima'],projecte_ra:['projecte_id','ra_id','pes'],projecte_ca:['projecte_id','ca_id','pes'],notes_projecte:['alumne_id','projecte_id','nota','observacions']};
const listSql={
 grups:'SELECT g.*, COUNT(a.id) alumnes FROM grups g LEFT JOIN alumnes a ON a.grup_id=g.id GROUP BY g.id ORDER BY g.nom',
 alumnes:'SELECT a.*, g.nom grup_nom FROM alumnes a LEFT JOIN grups g ON g.id=a.grup_id ORDER BY g.nom,a.cognoms,a.nom',
 moduls:'SELECT * FROM moduls ORDER BY actiu DESC,codi',
 ras:'SELECT r.*,m.codi modul_codi,m.nom modul_nom FROM ras r JOIN moduls m ON m.id=r.modul_id ORDER BY m.codi,r.codi',
 cas:'SELECT c.*,r.codi ra_codi,m.codi modul_codi FROM cas c JOIN ras r ON r.id=c.ra_id JOIN moduls m ON m.id=r.modul_id ORDER BY m.codi,r.codi,c.codi',
 tipus_activitat:'SELECT *, COALESCE(actiu,1) actiu FROM tipus_activitat ORDER BY COALESCE(actiu,1) DESC, nom',
 projectes:'SELECT p.*,m.codi modul_codi,t.nom tipus_nom,COALESCE(t.requereix_minim,p.es_sintesi,0) tipus_requereix_minim,COALESCE(t.nota_minima,p.nota_minima,5) tipus_nota_minima,COALESCE(t.limita_ra,p.es_sintesi,0) tipus_limita_ra FROM projectes p JOIN moduls m ON m.id=p.modul_id LEFT JOIN tipus_activitat t ON t.id=p.tipus_id ORDER BY m.codi,COALESCE(p.data_fi,p.data_inici,p.created_at),p.nom',
 projecte_ra:'SELECT pr.*,p.nom projecte_nom,r.codi ra_codi FROM projecte_ra pr JOIN projectes p ON p.id=pr.projecte_id JOIN ras r ON r.id=pr.ra_id ORDER BY p.nom,r.codi',
 projecte_ca:'SELECT pc.*,p.nom projecte_nom,c.codi ca_codi,r.codi ra_codi FROM projecte_ca pc JOIN projectes p ON p.id=pc.projecte_id JOIN cas c ON c.id=pc.ca_id JOIN ras r ON r.id=c.ra_id ORDER BY p.nom,r.codi,c.codi',
 notes_projecte:'SELECT n.*,a.nom alumne_nom,a.cognoms alumne_cognoms,p.nom projecte_nom FROM notes_projecte n JOIN alumnes a ON a.id=n.alumne_id JOIN projectes p ON p.id=n.projecte_id ORDER BY a.cognoms,p.nom'
};
for(const [t,cols] of Object.entries(tables)){app.get('/api/'+t,ok(()=>all(listSql[t]||`SELECT * FROM ${t}`)));app.post('/api/'+t,ok(async req=>{const data=req.body;const keys=cols.filter(c=>data[c]!==undefined);const q=`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`;const r=await run(q,keys.map(k=>data[k]));return {id:r.id}}));app.put('/api/'+t+'/:id',ok(async req=>{const data=req.body;const keys=cols.filter(c=>data[c]!==undefined);await run(`UPDATE ${t} SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`,[...keys.map(k=>data[k]),req.params.id]);return {ok:true}}));app.delete('/api/'+t+'/:id',ok(async req=>{await run(`DELETE FROM ${t} WHERE id=?`,[req.params.id]);return {ok:true}}));}
app.get('/api/bootstrap',ok(async()=>({grups:await all(listSql.grups),alumnes:await all(listSql.alumnes),moduls:await all(listSql.moduls),ras:await all(listSql.ras),cas:await all(listSql.cas),tipus_activitat:await all(listSql.tipus_activitat),projectes:await all(listSql.projectes),projecte_ra:await all(listSql.projecte_ra),projecte_ca:await all(listSql.projecte_ca),notes_projecte:await all(listSql.notes_projecte),notes_ra_calculades:await all('SELECT n.*,a.nom alumne_nom,a.cognoms alumne_cognoms,r.codi ra_codi,m.codi modul_codi FROM notes_ra_calculades n JOIN alumnes a ON a.id=n.alumne_id JOIN ras r ON r.id=n.ra_id JOIN moduls m ON m.id=r.modul_id ORDER BY a.cognoms,r.codi')})));

app.post('/api/import/curriculum',upload.single('file'),ok(async req=>{
  const rows=parse(req.file.buffer.toString('utf8'),{columns:true,skip_empty_lines:true,trim:true});
  let moduls=0,rasCount=0,casCount=0;
  for(const row of rows){
    const modulCodi=row.modul_codi||row.codi_modul||row.module_code;
    const modulNom=row.modul_nom||row.nom_modul||row.module_name;
    const raCodi=row.ra_codi||row.codi_ra;
    const caCodi=row.ca_codi||row.codi_ca;
    if(!modulCodi||!modulNom||!raCodi) continue;
    let m=await get('SELECT id FROM moduls WHERE codi=?',[modulCodi]);
    if(!m){const r=await run('INSERT INTO moduls(codi,nom,hores,curs,actiu,descripcio) VALUES(?,?,?,?,1,?)',[modulCodi,modulNom,row.modul_hores||null,row.modul_curs||'',row.modul_descripcio||'']);m={id:r.id};moduls++;}
    else {await run('UPDATE moduls SET nom=COALESCE(NULLIF(?,\'\'),nom), hores=COALESCE(NULLIF(?,\'\'),hores), curs=COALESCE(NULLIF(?,\'\'),curs) WHERE id=?',[modulNom,row.modul_hores||'',row.modul_curs||'',m.id]);}
    let ra=await get('SELECT id FROM ras WHERE modul_id=? AND codi=?',[m.id,raCodi]);
    if(!ra){const r=await run('INSERT INTO ras(modul_id,codi,descripcio,pes,nota_minima,actiu) VALUES(?,?,?,?,?,1)',[m.id,raCodi,row.ra_descripcio||'',row.ra_pes||0,row.ra_nota_minima||5]);ra={id:r.id};rasCount++;}
    else {await run('UPDATE ras SET descripcio=COALESCE(NULLIF(?,\'\'),descripcio), pes=COALESCE(NULLIF(?,\'\'),pes), nota_minima=COALESCE(NULLIF(?,\'\'),nota_minima) WHERE id=?',[row.ra_descripcio||'',row.ra_pes||'',row.ra_nota_minima||'',ra.id]);}
    if(caCodi){
      let ca=await get('SELECT id FROM cas WHERE ra_id=? AND codi=?',[ra.id,caCodi]);
      if(!ca){await run('INSERT INTO cas(ra_id,codi,descripcio,pes,actiu) VALUES(?,?,?,?,1)',[ra.id,caCodi,row.ca_descripcio||'',row.ca_pes||0]);casCount++;}
      else {await run('UPDATE cas SET descripcio=COALESCE(NULLIF(?,\'\'),descripcio), pes=COALESCE(NULLIF(?,\'\'),pes) WHERE id=?',[row.ca_descripcio||'',row.ca_pes||'',ca.id]);}
    }
  }
  return {files:rows.length,moduls_creats:moduls,ras_creats:rasCount,cas_creats:casCount};
}));


app.post('/api/moduls/:id/normalitzar', ok(async req=>{
  const modulId=req.params.id;
  const ras=await all('SELECT * FROM ras WHERE modul_id=? AND actiu=1 ORDER BY codi',[modulId]);
  const pesRa=ras.length?100/ras.length:0;
  for(const ra of ras){
    await run('UPDATE ras SET pes=? WHERE id=?',[pesRa,ra.id]);
    const cas=await all('SELECT * FROM cas WHERE ra_id=? AND actiu=1 ORDER BY codi',[ra.id]);
    const pesCa=cas.length?100/cas.length:0;
    for(const ca of cas){ await run('UPDATE cas SET pes=? WHERE id=?',[pesCa,ca.id]); }
  }
  await run('UPDATE ras SET pes=0 WHERE modul_id=? AND actiu=0',[modulId]);
  await run('UPDATE cas SET pes=0 WHERE ra_id IN (SELECT id FROM ras WHERE modul_id=?) AND actiu=0',[modulId]);
  return {ok:true,ras:ras.length};
}));


app.post('/api/projectes/:id/ponderacions', ok(async req=>{
  const projecteId=req.params.id;
  const raItems=Array.isArray(req.body.ras)?req.body.ras:[];
  const caItems=Array.isArray(req.body.cas)?req.body.cas:[];
  const sumRa=raItems.reduce((a,x)=>a+Number(x.pes||0),0);
  const sumCa=caItems.reduce((a,x)=>a+Number(x.pes||0),0);
  if(raItems.length && sumRa>100.0001) throw new Error('La ponderació dels RA supera el 100%.');
  if(caItems.length && sumCa>100.0001) throw new Error('La ponderació dels CA supera el 100%.');
  await run('DELETE FROM projecte_ra WHERE projecte_id=?',[projecteId]);
  await run('DELETE FROM projecte_ca WHERE projecte_id=?',[projecteId]);
  for(const item of raItems){
    if(Number(item.pes||0)>0) await run('INSERT INTO projecte_ra(projecte_id,ra_id,pes) VALUES(?,?,?)',[projecteId,item.ra_id,Number(item.pes)]);
  }
  for(const item of caItems){
    if(Number(item.pes||0)>0) await run('INSERT INTO projecte_ca(projecte_id,ca_id,pes) VALUES(?,?,?)',[projecteId,item.ca_id,Number(item.pes)]);
  }
  return {ok:true,ras:raItems.length,cas:caItems.length,sumRa,sumCa};
}));

app.post('/api/import/alumnes',upload.single('file'),ok(async req=>{const rows=parse(req.file.buffer.toString('utf8'),{columns:true,skip_empty_lines:true,trim:true});let count=0;for(const row of rows){let g=await get('SELECT id FROM grups WHERE nom=?',[row.grup_classe||row.grup||row.grup_nom]);if(!g){const r=await run('INSERT INTO grups(nom) VALUES(?)',[row.grup_classe||row.grup||'Sense grup']);g={id:r.id}}await run('INSERT INTO alumnes(numero,grup_id,nom,cognoms,data_naixement) VALUES(?,?,?,?,?)',[row.numero||'',g.id,row.nom,row.cognoms,row.data_naixement||null]);count++;}return {importats:count}}));

app.post('/api/import/projectes', upload.single('file'), ok(async req => {
  const rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  let count = 0;
  const projectCache = {}; // modulCodi:nom -> projectId

  for (const row of rows) {
    const modulCodi = row.modul_codi || row.codi_modul;
    const tipusNom = row.tipus_nom || row.tipus;
    const nom = row.projecte_nom || row.nom;
    if (!modulCodi || !nom) continue;

    const cacheKey = `${modulCodi}:${nom}`;
    let projectId = projectCache[cacheKey];

    const m = await get('SELECT id FROM moduls WHERE codi=?', [modulCodi]);
    if (!m) continue;

    if (!projectId) {
      // Intentar buscar-lo si ja existia d'abans de la importació
      const existing = await get('SELECT id FROM projectes WHERE modul_id=? AND nom=?', [m.id, nom]);
      if (existing) {
        projectId = existing.id;
      } else {
        let t = await get('SELECT id FROM tipus_activitat WHERE nom=?', [tipusNom]);
        if (!t && tipusNom) {
          const r = await run('INSERT INTO tipus_activitat(nom, actiu) VALUES(?,1)', [tipusNom]);
          t = { id: r.id };
        }
        const r = await run('INSERT INTO projectes(modul_id, tipus_id, nom, descripcio) VALUES(?,?,?,?)', [
          m.id, t ? t.id : null, nom, row.descripcio || ''
        ]);
        projectId = r.id;
        count++;
      }
      projectCache[cacheKey] = projectId;
    }

    // Processar RA si n'hi ha
    if (row.ra_codi && projectId) {
      const ra = await get('SELECT id FROM ras WHERE modul_id=? AND codi=?', [m.id, row.ra_codi]);
      if (ra) {
        const pesRa = Number(String(row.ra_pes || 0).replace(',', '.'));
        await run('INSERT INTO projecte_ra(projecte_id, ra_id, pes) VALUES(?,?,?) ON CONFLICT(projecte_id, ra_id) DO UPDATE SET pes=excluded.pes', [projectId, ra.id, pesRa]);
        
        // Processar CA si n'hi ha
        if (row.ca_codi) {
          const ca = await get('SELECT id FROM cas WHERE ra_id=? AND codi=?', [ra.id, row.ca_codi]);
          if (ca) {
            const pesCa = Number(String(row.ca_pes || 0).replace(',', '.'));
            await run('INSERT INTO projecte_ca(projecte_id, ca_id, ra_id, pes) VALUES(?,?,?,?) ON CONFLICT(projecte_id, ca_id) DO UPDATE SET pes=excluded.pes', [projectId, ca.id, ra.id, pesCa]);
          }
        }
      }
    }
  }
  return { importats: count };
}));

app.post('/api/notes_projecte/upsert', ok(async req=>{
  const {alumne_id,projecte_id,nota,observacions}=req.body;
  if(!alumne_id||!projecte_id) throw new Error('Falten alumne o projecte.');
  if(nota===null || nota===undefined || nota===''){
    await run('DELETE FROM notes_projecte WHERE alumne_id=? AND projecte_id=?',[alumne_id,projecte_id]);
    return {ok:true,deleted:true};
  }
  const n=Number(String(nota).replace(',','.'));
  if(!Number.isFinite(n)||n<0||n>10) throw new Error('La nota ha d’estar entre 0 i 10.');
  await run(`INSERT INTO notes_projecte(alumne_id,projecte_id,nota,observacions,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(alumne_id,projecte_id) DO UPDATE SET nota=excluded.nota, observacions=excluded.observacions, updated_at=CURRENT_TIMESTAMP`,
    [alumne_id,projecte_id,n,observacions||'']);
  return {ok:true};
}));
async function recalc(){
  await run('DELETE FROM notes_ra_calculades');
  const alumnes=await all('SELECT * FROM alumnes ORDER BY cognoms,nom');
  const ras=await all('SELECT * FROM ras WHERE COALESCE(actiu,1)=1 ORDER BY modul_id,codi');
  for(const a of alumnes){
    for(const ra of ras){
      const ev=await all(`SELECT n.nota,p.nom,COALESCE(p.data_fi,p.data_inici,p.created_at) ordre,
        COALESCE(t.requereix_minim,p.es_sintesi,0) requereix_minim,
        COALESCE(t.limita_ra,p.es_sintesi,0) limita_ra,
        COALESCE(t.nota_minima,p.nota_minima,5) nota_minima,
        COALESCE(pr.pes,0) pes
        FROM notes_projecte n
        JOIN projectes p ON p.id=n.projecte_id
        JOIN projecte_ra pr ON pr.projecte_id=p.id
        LEFT JOIN tipus_activitat t ON t.id=p.tipus_id
        WHERE n.alumne_id=? AND pr.ra_id=? AND n.nota IS NOT NULL
        ORDER BY ordre,p.id`,[a.id,ra.id]);
      let total=0,pes=0,bloq=0,det=[];
      for(const e of ev){
        total+=Number(e.nota)*Number(e.pes); pes+=Number(e.pes);
        det.push(`${e.nom}: ${e.nota} x ${e.pes}%`);
        if(Number(e.requereix_minim)&&Number(e.limita_ra)&&Number(e.nota)<Number(e.nota_minima||5)) bloq=1;
      }
      const calc=pes?total/pes:null;
      let final=calc,superat=calc!==null && calc>=Number(ra.nota_minima||5)?1:0;
      if(calc!==null&&bloq&&calc>=5){final=4;superat=0}else if(calc!==null&&bloq&&calc<5){final=calc;superat=0}
      await run('INSERT INTO notes_ra_calculades(alumne_id,ra_id,nota_calculada,nota_final,superat,bloquejat_sintesi,detall) VALUES(?,?,?,?,?,?,?)',[a.id,ra.id,calc,final,superat,bloq,det.join('; ')]);
    }
  }
  return all('SELECT n.*,a.nom alumne_nom,a.cognoms alumne_cognoms,r.codi ra_codi,m.codi modul_codi FROM notes_ra_calculades n JOIN alumnes a ON a.id=n.alumne_id JOIN ras r ON r.id=n.ra_id JOIN moduls m ON m.id=r.modul_id ORDER BY a.cognoms,a.nom,m.codi,r.codi')
}
app.post('/api/recalcular',ok(recalc));

app.get('/api/informe/alumne/:id', ok(async req => {
  const alumneId = req.params.id;
  const a = await get('SELECT a.*, g.nom as grup_nom FROM alumnes a LEFT JOIN grups g ON g.id=a.grup_id WHERE a.id=?', [alumneId]);
  if (!a) throw new Error('Alumne no trobat');

  const ras = await all('SELECT r.*, m.codi as modul_codi FROM ras r JOIN moduls m ON m.id=r.modul_id WHERE COALESCE(r.actiu,1)=1 ORDER BY m.codi, r.codi');
  const resultats = [];

  for (const ra of ras) {
    // Nota del RA (de la taula calculada)
    const notaRa = await get('SELECT * FROM notes_ra_calculades WHERE alumne_id=? AND ra_id=?', [alumneId, ra.id]);
    
    // Notes dels CA del RA
    const cas = await all('SELECT * FROM cas WHERE ra_id=? AND COALESCE(actiu,1)=1 ORDER BY codi', [ra.id]);
    const desglossamentCa = [];
    
    for (const ca of cas) {
      const evCa = await all(`
        SELECT n.nota, pca.pes
        FROM notes_projecte n
        JOIN projecte_ca pca ON pca.projecte_id = n.projecte_id
        WHERE n.alumne_id=? AND pca.ca_id=? AND n.nota IS NOT NULL
      `, [alumneId, ca.id]);
      
      let total = 0, pesTotal = 0;
      for (const e of evCa) {
        total += Number(e.nota) * Number(e.pes);
        pesTotal += Number(e.pes);
      }
      const notaCa = pesTotal > 0 ? total / pesTotal : null;
      desglossamentCa.push({
        id: ca.id,
        codi: ca.codi,
        descripcio: ca.descripcio,
        nota: notaCa,
        superat: notaCa !== null && notaCa >= 5
      });
    }

    resultats.push({
      ra_id: ra.id,
      ra_codi: ra.codi,
      modul_codi: ra.modul_codi,
      descripcio: ra.descripcio,
      nota_final: notaRa ? notaRa.nota_final : null,
      superat: notaRa ? notaRa.superat : false,
      bloquejat: notaRa ? notaRa.bloquejat_sintesi : false,
      cas: desglossamentCa
    });
  }

  return { alumne: a, resultats };
}));

app.listen(PORT,()=>console.log('App local v11: http://localhost:'+PORT));
