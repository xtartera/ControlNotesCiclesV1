const $ = s => document.querySelector(s);
let S = { editingGroupId: null, editingAlumneId: null, filterGroupId: null, selectedAlumneIdForReport: null };



// --- CONFIGURACIÓ SUPABASE ---
const SUPABASE_URL = 'https://cuvpsnbtsylmqtgiekko.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dnBzbmJ0c3lsbXF0Z2lla2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ1NzAsImV4cCI6MjA5MzY1MDU3MH0.hfZaycaGNh6vSUgko5_LOpriW98zl-pvhSVP3GQXdF8';
let supabase = null;

function initSupabase() {
  if (supabase) return true;
  try {
    if (window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return true;
    }
  } catch (e) {
    console.error("Error inicialitzant Supabase:", e);
  }
  return false;
}
// -----------------------------




const tabConfig = {
  'Resum': { icon: 'home', desc: 'Visió general del curs i estadístiques clau.' },
  'Currículum': { icon: 'book-open', desc: 'Configuració visual de mòduls, RA i criteris d’avaluació.' },
  'Tipus activitat': { icon: 'settings', desc: 'Defineix les categories d’activitats i les seves regles.' },
  'Activitats': { icon: 'clipboard-list', desc: 'Crea i configura les activitats i les seves ponderacions.' },
  'Gestió de grups': { icon: 'users', desc: 'Organitza els teus grups i classes.' },
  'Gestió usuaris': { icon: 'user-plus', desc: 'Gestiona la fitxa de l’alumnat i la importació.' },
  'Notes': { icon: 'edit-3', desc: 'Introdueix les qualificacions directament per activitat.' },
  'Seguiment': { icon: 'table', desc: 'Visió global de totes les notes per projecte i alumne.' },
  'Resultats': { icon: 'bar-chart-2', desc: 'Consulta els resultats calculats i l’estat dels RA.' },
  'Informes': { icon: 'file-text', desc: 'Genera fitxes de seguiment detallades per alumne.' }
};

const tabs = Object.keys(tabConfig);
let tab = 'Resum';
let selectedModulId = null;
let selectedProjectId = null;

async function api(url, opt) {
  try {
    const r = await fetch(url, opt);
    const contentType = r.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const j = await r.json();
      if (!r.ok) throw Error(j.error || 'Error del servidor');
      return j;
    } else {
      if (!r.ok) throw Error(`Error ${r.status}: El servidor no ha respost correctament.`);
      return {};
    }
  } catch (e) {
    toast(e.message, 'error');
    throw e;
  }
}

let loadRetries = 0;
async function load() {
  renderTabs();
  render();

  if (!initSupabase()) {
    loadRetries++;
    if (loadRetries > 20) { // 10 segons
      const tagEl = $('#modul-active-tag');
      if (tagEl) tagEl.innerText = "ERROR: No s'ha pogut carregar Supabase.";
      return;
    }
    setTimeout(load, 500);
    return;
  }

  try {
    // Carreguem totes les taules en paral·lel
    const tables = ['grups', 'alumnes', 'moduls', 'ras', 'cas', 'tipus_activitat', 'projectes', 'projecte_ra', 'projecte_ca', 'notes_projecte'];
    const results = await Promise.all(tables.map(t => supabase.from(t).select('*')));

    const data = {};
    tables.forEach((t, i) => {
      if (results[i].error) throw results[i].error;
      data[t] = results[i].data;
    });

    // Cas especial per a les notes calculades (ja que abans es feia al servidor)
    const { data: notesCalc, error: errCalc } = await supabase.from('notes_ra_calculades').select('*, alumnes(nom, cognoms), ras(codi), moduls(codi)');
    if (errCalc) console.warn("Encara no hi ha notes calculades");
    data.notes_ra_calculades = (notesCalc || []).map(n => ({
      ...n,
      alumne_nom: n.alumnes?.nom,
      alumne_cognoms: n.alumnes?.cognoms,
      ra_codi: n.ras?.codi,
      modul_codi: n.moduls?.codi
    }));

    // Enriquiment de dades (el que abans feia el SQL amb JOINS)
    data.alumnes = data.alumnes.map(a => ({ ...a, grup_nom: data.grups.find(g => g.id == a.grup_id)?.nom }));
    data.projectes = data.projectes.map(p => {
      const t = data.tipus_activitat.find(x => x.id == p.tipus_id);
      return {
        ...p,
        modul_codi: data.moduls.find(m => m.id == p.modul_id)?.codi,
        tipus_nom: t?.nom,
        tipus_requereix_minim: t?.requereix_minim || 0,
        tipus_nota_minima: t?.nota_minima || 5
      };
    });

    S = { ...S, ...data };
    renderTabs();
    render();
  } catch (e) {
    console.error("Error carregant dades de Supabase:", e);
    toast("Error de connexió: " + e.message, 'error');
  }
}

function renderTabs() {
  console.log("Iniciant renderTabs... Estat actual:", tab);
  try {
    const tabsEl = $('#tabs');
    if (!tabsEl) {
      console.error("No s'ha trobat l'element #tabs!");
      return;
    }

    let html = '';
    tabs.forEach(t => {
      const config = tabConfig[t] || { icon: 'help-circle' };
      const activeClass = t === tab ? 'active' : '';
      html += `
        <button class="nav-item ${activeClass}" onclick="changeTab('${t}')">
          <i data-lucide="${config.icon}"></i>
          <span>${t}</span>
        </button>
      `;
    });
    tabsEl.innerHTML = html;

    // Barra superior
    const currentCfg = tabConfig[tab] || { icon: 'home', desc: '' };
    const titleEl = $('#current-tab-title');
    const descEl = $('#current-tab-desc');
    if (titleEl) titleEl.innerText = tab;
    if (descEl) descEl.innerText = currentCfg.desc;

    const tagEl = $('#modul-active-tag');
    if (tagEl) {
      const activeModul = (S.moduls || []).find(m => m.id == selectedModulId);
      tagEl.innerText = activeModul ? activeModul.nom : 'Cap mòdul seleccionat';
    }

    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
    console.log("renderTabs finalitzat amb èxit.");
  } catch (e) {
    console.error("Error a renderTabs:", e);
    alert("Error de menú: " + e.message);
  }
}

function changeTab(t) {
  tab = t;
  renderTabs();
  render();
}

function toast(msg, type = 'success') {
  try {
    const container = $('#toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    t.innerHTML = `<i data-lucide="${icon}"></i> <span>${msg}</span>`;
    container.appendChild(t);
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
    setTimeout(() => t.remove(), 4000);
  } catch (e) {
    console.warn("Error mostrant toast:", e);
    alert(msg); // Fallback si el sistema de toast falla
  }
}

function fmt(n) { return n == null ? '—' : Number(n).toFixed(2) }
function opts(arr, label = 'nom') { return arr.map(x => `<option value="${x.id}">${x.codi ? x.codi + ' - ' : ''}${x[label] || x.descripcio || x.nom}</option>`).join('') }
function val(id) { return document.getElementById(id)?.value || '' }
function num(id) { const v = val(id); return v === '' ? null : Number(String(v).replace(',', '.')) }
function parseWeight(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
function showWeight(v) { const n = parseWeight(v); return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100) }
function setWeight(el, v) { if (el) el.value = Number(v || 0).toFixed(2) }

async function create(t, data) {
  const { error } = await supabase.from(t).insert([data]);
  if (error) throw error;
  toast('S’ha creat el registre correctament.');
  await load()
}

async function del(t, id) {
  if (confirm('Eliminar registre?')) {
    const { error } = await supabase.from(t).delete().eq('id', id);
    if (error) throw error;
    toast('Registre eliminat.');
    await load()
  }
}

async function upd(t, id, data) {
  const { error } = await supabase.from(t).update(data).eq('id', id);
  if (error) throw error;
  toast('Canvis desats.');
  await load()
}

function render() {
  try {
    const A = $('#app');
    if (!A) return;

    // Actualitzar Top Bar amb seguretat
    const currentCfg = tabConfig[tab] || { desc: '' };
    const titleEl = $('#current-tab-title');
    const descEl = $('#current-tab-desc');
    if (titleEl) titleEl.textContent = tab;
    if (descEl) descEl.textContent = currentCfg.desc;

    if (!selectedModulId && (S.moduls || []).length) selectedModulId = S.moduls[0].id;
    const activeModul = (S.moduls || []).find(m => m.id == selectedModulId);
    const tagEl = $('#modul-active-tag');
    if (tagEl) {
      tagEl.textContent = activeModul ? `${activeModul.codi} · ${activeModul.nom}` : 'Cap mòdul seleccionat';
    }

    // Selecció de vista
    let html = '';
    if (tab == 'Resum') html = dashboardView();
    else if (tab == 'Currículum') html = curriculumView();
    else if (tab == 'Tipus activitat') html = tipusActivitatView();
    else if (tab == 'Activitats') html = activitatsView();
    else if (tab == 'Gestió de grups') html = grupsView();
    else if (tab == 'Gestió usuaris') html = usuarisView();
    else if (tab == 'Notes') html = notesView();
    else if (tab == 'Seguiment') html = seguimentView();
    else if (tab == 'Resultats') html = resultatsMatrixView();
    else if (tab == 'Informes') html = informesView();

    A.innerHTML = html;

    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (e) {
    console.error("Error crític en render:", e);
    const A = $('#app');
    if (A) A.innerHTML = `<div class="status warn">Error al dibuixar la vista: ${e.message}</div>`;
  }
}

function dashboardView() {
  return `
    <div class="grid">
      ${card('Mòduls', S.moduls?.length || 0, 'book')}
      ${card('Projectes', S.projectes?.length || 0, 'clipboard')}
      ${card('Usuaris', S.alumnes?.length || 0, 'user')}
      ${card('Grups', S.grups?.length || 0, 'users')}
    </div>
    <div class="card" style="margin-top: 24px">
      <h2><i data-lucide="info"></i> Estat de l’avaluació</h2>
      <p>Actualment l’aplicació v12 gestiona <strong>${S.ras?.length || 0} RA</strong> i <strong>${S.cas?.length || 0} CA</strong> repartits en <strong>${S.moduls?.length || 0} mòduls</strong>.</p>
      <div class="actions">
        <button onclick="tab='Activitats';renderTabs();render()">Gestionar Activitats</button>
        <button class="secondary" onclick="recalc()">Actualitzar Notes</button>
      </div>
    </div>
  `;
}

function card(t, n, icon) {
  return `
    <div class="card" style="display: flex; align-items: center; justify-content: space-between">
      <div>
        <small style="color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 11px">${t}</small>
        <h2 style="margin: 4px 0 0; font-size: 32px">${n}</h2>
      </div>
      <div style="background: var(--primary-light); color: var(--primary); padding: 12px; border-radius: 12px">
        <i data-lucide="${icon || 'box'}"></i>
      </div>
    </div>
  `;
}

function wrap(title, html, icon) {
  return `<section class="card"><h2><i data-lucide="${icon || 'circle'}"></i> ${title}</h2>${html}</section>`
}

function curriculumView() {
  return `
    <div class="notice"><b>Currículum visual:</b> importa el currículum per CSV i treballa el mòdul amb targetes RA/CA.</div>
    ${importCurriculum()}
    ${moduleManager()}
  `;
}

function moduleManager() {
  const mods = S.moduls || [];
  const m = mods.find(x => String(x.id) === String(selectedModulId)) || mods[0];
  if (!m) return wrap('Gestió del mòdul', '<p>No hi ha mòduls definits.</p>', 'package');
  selectedModulId = m.id;
  const ras = S.ras.filter(r => r.modul_id == m.id);
  const activeRas = ras.filter(r => Number(r.actiu) !== 0);
  const totalRa = activeRas.reduce((a, r) => a + Number(r.pes || 0), 0);
  return wrap('Gestió visual del mòdul', `
    <div class="module-toolbar">
      <div><label>Mòdul actiu</label><select id="modsel" onchange="selectedModulId=this.value;render()">${mods.map(x => `<option value="${x.id}" ${x.id == m.id ? 'selected' : ''}>${x.codi} · ${x.nom}</option>`).join('')}</select></div>
      <div class="module-summary"><strong>${m.codi}</strong><span>${m.nom}</span><small>${m.hores || '—'} h · ${m.curs || ''}</small></div>
      <div class="actions">
        <button onclick="normalitzarModul(${m.id})">Repartir automàticament</button>
        <button class="secondary" onclick="tab='Activitats';renderTabs();render()">Configurar activitats</button>
      </div>
    </div>
    <div class="status ${Math.abs(totalRa - 100) < 0.05 ? 'ok' : 'warn'}">
      <span>Ponderació RA actius: <strong>${totalRa.toFixed(2)}%</strong></span>
    </div>
    <div class="ra-grid">${ras.map(raCard).join('') || '<p class="muted">Aquest mòdul encara no té RA.</p>'}</div>
  `, 'layers');
}

function raCard(ra) {
  const cas = S.cas.filter(c => c.ra_id == ra.id);
  const activeCas = cas.filter(c => Number(c.actiu) !== 0);
  const totalCa = activeCas.reduce((a, c) => a + Number(c.pes || 0), 0);
  return `
    <article class="ra-card ${Number(ra.actiu) === 0 ? 'off' : ''}">
      <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
        <label class="check-title" style="margin:0"><input type="checkbox" ${Number(ra.actiu) !== 0 ? 'checked' : ''} onchange="toggleRA(${ra.id},this.checked)"><span class="ra-badge">${ra.codi}</span></label>
        <div style="display: flex; align-items: center; gap: 8px">
          <input class="weight-input" style="width: 70px; margin:0; text-align: right; font-weight: 700; color: var(--primary)" type="number" step="0.01" value="${ra.pes ?? 0}" onchange="upd('ras',${ra.id},{pes:Number(this.value)}).then(load)">
          <span style="font-size: 12px; color: var(--text-muted); font-weight: 600">%</span>
        </div>
      </header>
      <div class="ra-desc-box">
        <p class="desc-tiny" style="margin:0">${ra.descripcio || 'Sense descripció'}</p>
      </div>
      <div class="status ${Math.abs(totalCa - 100) < 0.05 || activeCas.length === 0 ? 'ok' : 'warn'}" style="padding: 6px 10px; font-size: 12px; margin-bottom: 12px">
        <span>CA actius: <strong>${totalCa.toFixed(2)}%</strong></span>
      </div>
      <div class="ca-list" style="display: flex; flex-direction: column; gap: 6px">
        ${cas.map(c => `
          <div class="ca-row ${Number(c.actiu) === 0 ? 'off' : ''}" style="display: flex; gap: 10px; align-items: flex-start; background: #f8fafc; padding: 10px; border-radius: 10px">
            <input type="checkbox" style="width: auto; margin: 4px 0 0" ${Number(c.actiu) !== 0 ? 'checked' : ''} onchange="toggleCA(${c.id},${ra.id},this.checked)">
            <div style="flex: 1">
              <strong style="font-size: 12px; display: block; color: var(--text-main)">${c.codi}</strong>
              <p class="desc-tiny" style="margin: 2px 0 0; line-height: 1.3">${c.descripcio || 'Sense descripció'}</p>
            </div>
            <input type="number" style="width: 55px; margin:0; padding: 4px; font-size: 12px; text-align: center" step="0.01" value="${c.pes ?? 0}" onchange="upd('cas',${c.id},{pes:Number(this.value)}).then(load)">
          </div>
        `).join('')}
      </div>
      <button class="secondary mini" style="width: 100%; margin-top: 12px; justify-content: center" onclick="normalitzarCA(${ra.id})">
        <i data-lucide="refresh-cw" style="width: 14px; height: 14px"></i> Repartir CA
      </button>
    </article>
  `;
}

async function toggleRA(id, checked) { await upd('ras', id, { actiu: checked ? 1 : 0 }); await normalitzarModul(selectedModulId, false) }
async function toggleCA(id, raId, checked) { await upd('cas', id, { actiu: checked ? 1 : 0 }); await normalitzarCA(raId, false) }
async function normalitzarModul(modulId, show = true) {
  const ras = S.ras.filter(r => r.modul_id == modulId && Number(r.actiu) !== 0);
  if (!ras.length) return;
  const pes = 100 / ras.length;
  for (const r of ras) {
    await supabase.from('ras').update({ pes }).eq('id', r.id);
  }
  if (show) toast('Ponderació repartida.');
  await load();
}
async function normalitzarCA(raId, show = true) { const cas = S.cas.filter(c => c.ra_id == raId); const act = cas.filter(c => Number(c.actiu) !== 0); const pes = act.length ? 100 / act.length : 0; for (const c of cas) { await upd('cas', c.id, { pes: Number(c.actiu) !== 0 ? pes : 0 }) } if (show) toast('Ponderació dels CA repartida.'); await load() }

function importCurriculum() { return wrap('Importació CSV Currículum', `<p class="muted small">Format: modul_codi,modul_nom,modul_hores,modul_curs,ra_codi,ra_pes,ra_nota_minima,ra_descripcio,ca_codi,ca_pes,ca_descripcio</p><input id="csvcurr" type="file" accept=".csv"><button onclick="importarCurriculum()">Importar</button>`, 'upload-cloud') }
async function importarCurriculum() {
  const f = $('#csvcurr').files[0];
  if (!f) { toast('Selecciona un fitxer.', 'error'); return }

  const text = await f.text();
  // Utilitzem una llibreria simple per parsejar CSV si la tinguéssim, 
  // però com que és un entorn tancat, farem un parse manual bàsic:
  const rows = text.split('\n').map(r => r.split(',')).filter(r => r.length > 1);
  const headers = rows.shift();

  toast('Important currículum...');
  for (const row of rows) {
    const r = {}; headers.forEach((h, i) => r[h.trim()] = row[i]?.trim());

    // 1. Mòdul
    let { data: m } = await supabase.from('moduls').select('id').eq('codi', r.modul_codi).single();
    if (!m) {
      const { data: newM } = await supabase.from('moduls').insert([{ codi: r.modul_codi, nom: r.modul_nom, hores: r.modul_hores, curs: r.modul_curs }]).select().single();
      m = newM;
    }

    // 2. RA
    let { data: ra } = await supabase.from('ras').select('id').eq('modul_id', m.id).eq('codi', r.ra_codi).single();
    if (!ra) {
      const { data: newRa } = await supabase.from('ras').insert([{ modul_id: m.id, codi: r.ra_codi, descripcio: r.ra_descripcio, pes: r.ra_pes, nota_minima: r.ra_nota_minima }]).select().single();
      ra = newRa;
    }

    // 3. CA
    if (r.ca_codi) {
      await supabase.from('cas').upsert([{ ra_id: ra.id, codi: r.ca_codi, descripcio: r.ca_descripcio, pes: r.ca_pes }], { onConflict: 'ra_id,codi' });
    }
  }

  toast('Currículum importat correctament.');
  await load();
}

function activitatsView() {
  if (!selectedProjectId && S.projectes?.length) selectedProjectId = S.projectes[0].id;
  const p = S.projectes.find(x => String(x.id) === String(selectedProjectId));

  return `
    <div class="activities-layout">
      <div class="sidebar-content">
        ${formProjectes()}
        ${wrap('Llistat d’activitats', `
          <div class="project-list-rich">
            ${(S.projectes || []).map(x => `
              <div class="project-card-item ${x.id == selectedProjectId ? 'active' : ''}" onclick="selectedProjectId=${x.id};render()">
                <div class="project-card-icon">
                  <i data-lucide="${x.tipus_nom?.toLowerCase().includes('sintesi') ? 'star' : 'file-text'}"></i>
                </div>
                <div class="project-card-info">
                  <strong>${x.nom}</strong>
                  <div class="project-card-meta">
                    <span class="pill mini">${x.modul_codi}</span>
                    <span class="type-tag">${x.tipus_nom || 'Genèrica'}</span>
                  </div>
                </div>
                <button class="btn-icon-danger" onclick="event.stopPropagation();del('projectes',${x.id})"><i data-lucide="trash-2"></i></button>
              </div>
            `).join('') || '<div class="notice">No hi ha activitats creades.</div>'}
          </div>
        `, 'list')}
      </div>
      <div class="main-content-scroll">
        ${p ? ponderacionsComponent(p) : `
          <div class="empty-state">
            <i data-lucide="target" size="48"></i>
            <h3>Selecciona una activitat</h3>
            <p>Tria una activitat de la llista per configurar les seves ponderacions i criteris d'avaluació.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function formProjectes() {
  return wrap('Nova activitat', `
    <div class="grid" style="grid-template-columns: 1fr">
      <div><label>Mòdul</label><select id="pm">${opts(S.moduls)}</select></div>
      <div><label>Tipus</label><select id="pt">${S.tipus_activitat.filter(t => Number(t.actiu) !== 0).map(t => `<option value="${t.id}">${t.nom}</option>`).join('')}</select></div>
      <div><label>Nom</label><input id="pn"></div>
    </div>
    <button style="width: 100%" onclick="create('projectes',{modul_id:num('pm'),tipus_id:num('pt'),nom:val('pn'),descripcio:val('pd')})">Afegir</button>
    <div class="import-zone" style="margin-top: 16px">
      <label>Importar CSV</label>
      <input id="csvproj" type="file" accept=".csv">
      <button class="secondary mini" onclick="importarProjectes()">Importar</button>
    </div>
  `, 'plus-circle')
}

async function importarProjectes() {
  const f = $('#csvproj').files[0];
  if (!f) return toast('Selecciona un fitxer.', 'error');

  const text = await f.text();
  const rows = text.split('\n').map(r => r.split(',')).filter(r => r.length > 1);
  const headers = rows.shift();

  toast('Important activitats...');
  for (const row of rows) {
    const r = {}; headers.forEach((h, i) => r[h.trim()] = row[i]?.trim());
    if (!r.modul_codi || !r.nom) continue;

    const { data: m } = await supabase.from('moduls').select('id').eq('codi', r.modul_codi).single();
    if (!m) continue;

    // Busquem o creem el tipus d'activitat
    let { data: t } = await supabase.from('tipus_activitat').select('id').eq('nom', r.tipus_nom || r.tipus).single();
    if (!t && (r.tipus_nom || r.tipus)) {
      const { data: newT } = await supabase.from('tipus_activitat').insert([{ nom: r.tipus_nom || r.tipus, actiu: 1 }]).select().single();
      t = newT;
    }

    // Creem l'activitat (projecte)
    const { data: p } = await supabase.from('projectes').insert([{
      modul_id: m.id,
      tipus_id: t?.id,
      nom: r.nom,
      descripcio: r.descripcio || ''
    }]).select().single();

    // Si el CSV porta RA/CA, els assignem
    if (r.ra_codi && p) {
      const { data: ra } = await supabase.from('ras').select('id').eq('modul_id', m.id).eq('codi', r.ra_codi).single();
      if (ra) {
        await supabase.from('projecte_ra').insert([{ projecte_id: p.id, ra_id: ra.id, pes: Number(r.ra_pes || 0) }]);
        if (r.ca_codi) {
          const { data: ca } = await supabase.from('cas').select('id').eq('ra_id', ra.id).eq('codi', r.ca_codi).single();
          if (ca) {
            await supabase.from('projecte_ca').insert([{ projecte_id: p.id, ca_id: ca.id, pes: Number(r.ca_pes || 0) }]);
          }
        }
      }
    }
  }
  toast('Activitats importades.');
  await load();
}

function ponderacionsComponent(p) {
  const ras = S.ras.filter(r => r.modul_id == p.modul_id && Number(r.actiu) !== 0);
  const raWeights = {}; (S.projecte_ra || []).filter(x => x.projecte_id == p.id).forEach(x => raWeights[x.ra_id] = Number(x.pes || 0));
  const caWeights = {}; (S.projecte_ca || []).filter(x => x.projecte_id == p.id).forEach(x => caWeights[x.ca_id] = Number(x.pes || 0));
  const totalRa = Object.values(raWeights).reduce((a, b) => a + Number(b || 0), 0);
  const caWarnings = projectCaWarningsStatic(ras, raWeights, caWeights);

  return `
    <div class="card">
      <div class="module-toolbar" style="grid-template-columns: 1fr auto">
        <div class="module-summary">
          <strong>${p.nom}</strong><span>${p.modul_codi} · ${p.tipus_nom || ''}</span>
        </div>
        <div class="actions">
          <label class="switch-row"><input id="autoRepartiment" type="checkbox" checked onchange="updateAutoModeLabel()"><span class="switch-ui"></span><strong id="autoModeText" style="font-size: 12px">Auto</strong></label>
          <button onclick="autoProjectWeights()">Repartir</button>
          <button onclick="saveProjectWeights(${p.id})">Gravar</button>
        </div>
      </div>
      <div class="dual-status" style="margin: 16px 0">
        <div class="status ${totalRa <= 100.0001 ? 'ok' : 'warn'}"><span>Total RA: <strong>${totalRa.toFixed(2)}%</strong></span></div>
        <div class="status ${caWarnings.length === 0 ? 'ok' : 'warn'}"><span>Estat CA: <strong>${caWarnings.length ? 'Revisar' : 'OK'}</strong></span></div>
      </div>
      <div class="ra-grid">
        ${ras.map(ra => projectRaCard(ra, raWeights, caWeights)).join('') || '<p class="muted">Aquest mòdul no té RA actius.</p>'}
      </div>
    </div>
  `;
}

function projectCaWarningsStatic(ras, raWeights, caWeights) {
  const errors = [];
  ras.forEach(ra => {
    const topall = Number(raWeights[ra.id] || 0);
    const total = (S.cas || []).filter(c => c.ra_id == ra.id).reduce((a, c) => a + Number(caWeights[c.id] || 0), 0);
    if (total > topall + 0.0001) errors.push({ ra: ra.id, total, topall });
  });
  return errors;
}

function projectRaCard(ra, raWeights, caWeights) {
  const cas = S.cas.filter(c => c.ra_id == ra.id && Number(c.actiu) !== 0);
  const rw = raWeights[ra.id] || 0;
  const selected = rw > 0;
  const caTotal = cas.reduce((a, c) => a + Number(caWeights[c.id] || 0), 0);
  const invalid = caTotal > rw + 0.0001;
  const progress = Math.min(100, rw);

  return `
    <article class="ra-card-premium ${selected ? 'selected' : ''} ${invalid ? 'invalid' : ''}" data-ra="${ra.id}" onclick="toggleProjectRAFromCard(event,${ra.id})">
      <header class="ra-card-header">
        <div class="ra-title-group">
          <input type="checkbox" class="pra-check" data-id="${ra.id}" ${selected ? 'checked' : ''} onchange="onProjectSelectionChanged('ra')">
          <span class="ra-badge-premium">${ra.codi}</span>
        </div>
        <div class="ra-weight-input-group">
          <input class="pra-weight premium-input" data-id="${ra.id}" type="text" inputmode="decimal" value="${showWeight(rw)}" onclick="event.stopPropagation()" oninput="markRAByWeight(${ra.id});updateProjectTotals()">
          <span class="unit">%</span>
        </div>
      </header>
      
      <p class="desc-tiny ra-desc-box">${ra.descripcio || ''}</p>

      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${progress}%"></div>
      </div>

      <div class="ca-list-premium">
        ${cas.map(c => {
    const cw = caWeights[c.id] || 0;
    return `
            <div class="ca-item-premium ${cw > 0 ? 'selected' : ''}" data-ca="${c.id}" onclick="toggleProjectCAFromRow(event,${c.id},${ra.id})">
              <div class="ca-check-group-premium">
                <input type="checkbox" class="pca-check" data-id="${c.id}" data-ra="${ra.id}" ${cw > 0 ? 'checked' : ''} onchange="onProjectSelectionChanged('ca',${ra.id})">
                <div class="ca-text-content">
                  <span class="ca-codi">${c.codi}</span>
                  <span class="desc-tiny">${c.descripcio || ''}</span>
                </div>
              </div>
              <div class="ca-input-group-premium">
                <input class="pca-weight premium-input-sm" data-id="${c.id}" data-ra="${ra.id}" type="text" value="${showWeight(cw)}" onclick="event.stopPropagation()" oninput="markCAByWeight(${c.id},${ra.id});updateProjectTotals()">
              </div>
            </div>
          `
  }).join('')}
      </div>
    </article>
  `;
}

// Lògica de clics (Mantenida intacta)
function toggleProjectRAFromCard(ev, raId) { if (ev.target.matches('input,select,button,label')) return; const chk = document.querySelector(`.pra-check[data-id="${raId}"]`); if (chk) { chk.checked = !chk.checked; onProjectSelectionChanged('ra'); } }
function toggleProjectCAFromRow(ev, caId, raId) { if (ev.target.matches('input,select,button,label')) return; const raChk = document.querySelector(`.pra-check[data-id="${raId}"]`); if (raChk && !raChk.checked) raChk.checked = true; const chk = document.querySelector(`.pca-check[data-id="${caId}"]`); if (chk) { chk.checked = !chk.checked; onProjectSelectionChanged('ca', raId); } }
function markRAByWeight(raId) { const w = parseWeight(document.querySelector(`.pra-weight[data-id="${raId}"]`)?.value || 0); const chk = document.querySelector(`.pra-check[data-id="${raId}"]`); if (chk) chk.checked = w > 0; }
function markCAByWeight(caId, raId) { const w = parseWeight(document.querySelector(`.pca-weight[data-id="${caId}"]`)?.value || 0); const chk = document.querySelector(`.pca-check[data-id="${caId}"]`); if (chk) chk.checked = w > 0; const raChk = document.querySelector(`.pra-check[data-id="${raId}"]`); if (raChk && w > 0) raChk.checked = true; }
function selectedInputs(cls) { return [...document.querySelectorAll(cls)].filter(x => x.checked) }
function autoModeEnabled() { const el = document.getElementById('autoRepartiment'); return !el || el.checked }
function updateAutoModeLabel() { const t = document.getElementById('autoModeText'); if (t) t.textContent = autoModeEnabled() ? 'Auto' : 'Manual'; updateProjectTotals() }
function onProjectSelectionChanged(kind, raId = null) {
  if (kind === 'ra') { if (autoModeEnabled()) { rebalanceProjectRA(); rebalanceAllCAWithinRA(); } else { document.querySelectorAll('.pra-weight').forEach(i => { const chk = document.querySelector(`.pra-check[data-id="${i.dataset.id}"]`); if (!chk?.checked && parseWeight(i.value) > 0) setWeight(i, 0); }); } }
  if (kind === 'ca') { if (raId) { const raChk = document.querySelector(`.pra-check[data-id="${raId}"]`); if (raChk) raChk.checked = true; } if (autoModeEnabled()) rebalanceCAForRA(raId); else document.querySelectorAll(`.pca-weight[data-ra="${raId}"]`).forEach(i => { const chk = document.querySelector(`.pca-check[data-id="${i.dataset.id}"]`); if (!chk?.checked && parseWeight(i.value) > 0) setWeight(i, 0); }); }
  updateProjectTotals();
}
function rebalanceProjectRA() { const checks = selectedInputs('.pra-check'); const each = checks.length ? 100 / checks.length : 0; document.querySelectorAll('.pra-weight').forEach(i => { const checked = [...checks].some(c => c.dataset.id === i.dataset.id); setWeight(i, checked ? each : 0) }); }
function rebalanceCAForRA(raId) { if (!raId) return; const topall = parseWeight(document.querySelector(`.pra-weight[data-id="${raId}"]`)?.value || 0); const checks = [...document.querySelectorAll(`.pca-check[data-ra="${raId}"]`)].filter(x => x.checked); const each = checks.length ? topall / checks.length : 0; document.querySelectorAll(`.pca-weight[data-ra="${raId}"]`).forEach(i => { const checked = checks.some(c => c.dataset.id === i.dataset.id); setWeight(i, checked ? each : 0) }); }
function rebalanceAllCAWithinRA() { [...document.querySelectorAll('.pra-weight')].forEach(i => rebalanceCAForRA(i.dataset.id)); }
function autoProjectWeights() { rebalanceProjectRA(); rebalanceAllCAWithinRA(); updateProjectTotals() }
function clearProjectWeights() { document.querySelectorAll('.pra-check,.pca-check').forEach(x => x.checked = false); document.querySelectorAll('.pra-weight,.pca-weight').forEach(x => setWeight(x, 0)); updateProjectTotals() }
function sumWeights(sel) { return [...document.querySelectorAll(sel)].reduce((a, x) => a + parseWeight(x.value), 0) }
function caTotalsByRA() { const out = {}; document.querySelectorAll('.pca-weight').forEach(i => { const ra = i.dataset.ra; out[ra] = (out[ra] || 0) + parseWeight(i.value) }); return out }
function caValidationErrors() { const totals = caTotalsByRA(); const errors = []; Object.entries(totals).forEach(([ra, total]) => { const topall = parseWeight(document.querySelector(`.pra-weight[data-id="${ra}"]`)?.value || 0); if (total > topall + 0.0001) errors.push({ ra, total, topall }); }); return errors }
function updateProjectTotals() {
  const tr = sumWeights('.pra-weight'); const errors = caValidationErrors(); const totals = caTotalsByRA();
  const raEl = document.getElementById('totalProjectRa'), caEl = document.getElementById('totalProjectCa');
  if (raEl) raEl.textContent = tr.toFixed(2) + '%'; if (caEl) caEl.textContent = errors.length ? 'Revisar' : 'OK';
  document.querySelectorAll('.ra-card').forEach(card => { const id = card.dataset.ra; const chk = document.querySelector(`.pra-check[data-id="${id}"]`); const w = document.querySelector(`.pra-weight[data-id="${id}"]`); const topall = parseWeight(w?.value); const caTotal = totals[id] || 0; const invalid = caTotal > topall + 0.0001; card.classList.toggle('selected', chk?.checked || topall > 0); card.classList.toggle('invalid', invalid); });
}

async function saveProjectWeights(projecteId) {
  const ras = [...document.querySelectorAll('.pra-weight')].map(i => ({ projecte_id: projecteId, ra_id: Number(i.dataset.id), pes: parseWeight(i.value) })).filter(x => x.pes > 0);
  const cas = [...document.querySelectorAll('.pca-weight')].map(i => ({ projecte_id: projecteId, ca_id: Number(i.dataset.id), ra_id: Number(i.dataset.ra), pes: parseWeight(i.value) })).filter(x => x.pes > 0);
  
  const sumRa = ras.reduce((a, x) => a + x.pes, 0); 
  const errors = caValidationErrors();
  
  if (sumRa > 100.0001) { toast('La ponderació dels RA supera el 100%.', 'error'); return }
  if (errors.length) { toast('Els CA superen el topall del RA.', 'error'); return }
  
  // Guardem a Supabase (primer netegem les antigues per a aquest projecte)
  await supabase.from('projecte_ra').delete().eq('projecte_id', projecteId);
  await supabase.from('projecte_ca').delete().eq('projecte_id', projecteId);
  
  if (ras.length) await supabase.from('projecte_ra').insert(ras);
  if (cas.length) await supabase.from('projecte_ca').insert(cas);
  
  toast('Ponderacions gravades.'); 
  await load();
}

// Vistes restants amb estils Premium
function grupsView() {
  const editing = S.editingGroupId ? S.grups.find(g => g.id == S.editingGroupId) : null;
  return `
    <div class="grid">
      ${wrap(editing ? 'Modificar grup' : 'Nou grup', `
        <label>Nom</label><input id="gn" value="${editing?.nom || ''}">
        <label>Curs</label><input id="gc" value="${editing?.curs || ''}">
        <button onclick="saveGrup()">${editing ? 'Desar' : 'Afegir'}</button>
      `, 'users')}
      <div class="wide">
        ${wrap('Llistat de grups', `
          <table>
            <thead><tr><th>Nom</th><th>Curs</th><th>Alumnes</th><th></th></tr></thead>
            <tbody>
              ${(S.grups || []).map(g => `<tr><td><strong>${g.nom}</strong></td><td>${g.curs || ''}</td><td><span class="pill">${g.alumnes}</span></td><td class="actions"><button class="secondary mini" onclick="S.editingGroupId=${g.id};render()">Editar</button><button class="danger mini" onclick="del('grups',${g.id})">Eliminar</button></td></tr>`).join('')}
            </tbody>
          </table>
        `, 'list')}
      </div>
    </div>
  `;
}

async function saveGrup() {
  const data = { nom: val('gn'), curs: val('gc'), descripcio: '' };
  if (S.editingGroupId) await upd('grups', S.editingGroupId, data);
  else await create('grups', data);
  S.editingGroupId = null; await load();
}

function usuarisView() {
  const editing = S.editingAlumneId ? S.alumnes.find(a => a.id == S.editingAlumneId) : null;
  const filterId = S.filterGroupId;
  const filteredAlumnes = filterId ? (S.alumnes || []).filter(a => a.grup_id == filterId) : (S.alumnes || []);
  return `
    <div class="grid">
      <div class="wide">${wrap(editing ? 'Modificar usuari' : 'Gestió d’usuaris', `<div class="grid"><div><label>Grup</label><select id="ag">${opts(S.grups)}</select><label>Nom</label><input id="anom" value="${editing?.nom || ''}"><label>Cognoms</label><input id="acog" value="${editing?.cognoms || ''}"><button onclick="saveAlumne()">${editing ? 'Desar' : 'Afegir'}</button></div><div style="border-left: 1px solid #eee; padding-left: 20px"><label>Importació CSV</label><input id="csv" type="file" accept=".csv"><button class="secondary" onclick="importar()">Importar</button></div></div>`, 'user-plus')}</div>
      <div class="wide">
        ${wrap('Llistat d’usuaris', `
          <div class="module-toolbar"><select onchange="S.filterGroupId=this.value==='all'?null:this.value;render()"><option value="all">Tots els grups</option>${(S.grups || []).map(g => `<option value="${g.id}" ${filterId == g.id ? 'selected' : ''}>${g.nom}</option>`).join('')}</select></div>
          <table><thead><tr><th>Grup</th><th>Cognoms, Nom</th><th></th></tr></thead><tbody>${filteredAlumnes.map(a => `<tr><td><span class="pill">${a.grup_nom || '—'}</span></td><td><strong>${a.cognoms}, ${a.nom}</strong></td><td class="actions"><button class="secondary mini" onclick="S.editingAlumneId=${a.id};render()">Editar</button><button class="danger mini" onclick="del('alumnes',${a.id})">Eliminar</button></td></tr>`).join('')}</tbody></table>
        `, 'users')}
      </div>
    </div>
  `;
}

async function saveAlumne() {
  const data = { numero: '', grup_id: num('ag'), nom: val('anom'), cognoms: val('acog'), data_naixement: '' };
  if (S.editingAlumneId) await upd('alumnes', S.editingAlumneId, data); else await create('alumnes', data);
  S.editingAlumneId = null; await load();
}

async function importar() {
  const f = $('#csv').files[0];
  if (!f) return toast('Selecciona un fitxer.', 'error');

  const text = await f.text();
  const rows = text.split('\n').map(r => r.split(',')).filter(r => r.length > 1);
  const headers = rows.shift();

  toast('Important alumnes...');
  for (const row of rows) {
    const r = {}; headers.forEach((h, i) => r[h.trim()] = row[i]?.trim());
    const grupNom = r.grup_classe || r.grup || r.grup_nom || 'Sense grup';

    let { data: g } = await supabase.from('grups').select('id').eq('nom', grupNom).single();
    if (!g) {
      const { data: newG } = await supabase.from('grups').insert([{ nom: grupNom }]).select().single();
      g = newG;
    }

    await supabase.from('alumnes').insert([{
      numero: r.numero || '',
      grup_id: g.id,
      nom: r.nom,
      cognoms: r.cognoms,
      data_naixement: r.data_naixement || null
    }]);
  }
  toast('Usuaris importats.');
  await load();
}

function tipusActivitatView() {
  return `
    <div class="grid">
      <div class="wide">
        ${wrap('Nou Tipus d’Activitat', `
          <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap">
            <div style="flex: 2; min-width: 200px">
              <label>Nom del tipus</label>
              <input id="new-tn" placeholder="Ex: Examen, Projecte, Pràctica...">
            </div>
            <div style="flex: 1; min-width: 100px">
              <label>Pes defecte (%)</label>
              <input id="new-tp" type="number" value="20">
            </div>
            <button onclick="createTipusActivitat()" style="margin-bottom: 16px">
              <i data-lucide="plus"></i> Afegir Tipus
            </button>
          </div>
        `, 'plus-circle')}
      </div>
      <div class="wide">
        ${(() => {
      const actius = (S.tipus_activitat || []).filter(t => Number(t.actiu) !== 0);
      const total = actius.reduce((acc, t) => acc + Number(t.pes_defecte || 0), 0);
      const isOk = Math.abs(total - 100) < 0.01;
      return `
            <div class="status ${isOk ? 'ok' : 'warn'}" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center">
              <span>Suma de ponderacions actives: <strong>${total.toFixed(2)}%</strong></span>
              ${isOk ? '<span><i data-lucide="check-circle" style="width:16px; vertical-align:middle"></i> Correcte</span>' : '<span><i data-lucide="alert-triangle" style="width:16px; vertical-align:middle"></i> Ha de sumar 100%</span>'}
            </div>
          `;
    })()}
        ${wrap('Configuració de Tipus', `
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Pes def.</th>
                  <th title="Si no s'arriba a la nota mínima, el RA no se supera">Mínim oblig.</th>
                  <th>Nota mínima</th>
                  <th>Actiu</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${(S.tipus_activitat || []).map(r => `
                  <tr>
                    <td><input value="${r.nom || ''}" onchange="upd('tipus_activitat',${r.id},{nom:this.value}).then(load)" style="margin:0"></td>
                    <td><input type="number" step="0.01" value="${r.pes_defecte || 0}" onchange="upd('tipus_activitat',${r.id},{pes_defecte:Number(this.value)}).then(load)" style="margin:0; width:70px"></td>
                    <td style="text-align: center"><input type="checkbox" ${Number(r.requereix_minim) ? 'checked' : ''} onchange="upd('tipus_activitat',${r.id},{requereix_minim:this.checked?1:0}).then(load)"></td>
                    <td><input type="number" step="0.1" value="${r.nota_minima || 5}" onchange="upd('tipus_activitat',${r.id},{nota_minima:Number(this.value)}).then(load)" style="margin:0; width:70px"></td>
                    <td style="text-align: center"><input type="checkbox" ${Number(r.actiu) !== 0 ? 'checked' : ''} onchange="upd('tipus_activitat',${r.id},{actiu:this.checked?1:0}).then(load)"></td>
                    <td><button class="btn-icon-danger" onclick="del('tipus_activitat',${r.id})"><i data-lucide="trash-2" style="width:16px"></i></button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `, 'settings')}
      </div>
    </div>
  `;
}

async function createTipusActivitat() {
  const nom = val('new-tn');
  const pes = num('new-tp');
  if (!nom) return toast('Has de posar un nom al tipus.', 'error');
  await create('tipus_activitat', {
    nom,
    pes_defecte: pes || 0,
    requereix_minim: 0,
    nota_minima: 5,
    actiu: 1
  });
}

function notesView() {
  if (!selectedProjectId && S.projectes?.length) selectedProjectId = S.projectes[0].id;
  const p = S.projectes.find(x => String(x.id) === String(selectedProjectId));
  const filterId = S.filterGroupId;
  const filteredAlumnes = filterId ? S.alumnes.filter(a => a.grup_id == filterId) : S.alumnes;
  const notes = new Map((S.notes_projecte || []).map(n => [`${n.alumne_id}-${n.projecte_id}`, n]));

  return `
    <div class="activities-layout">
      <div class="sidebar-content">
        ${wrap('Selecciona Activitat', `
          <div class="project-list-rich">
            ${(S.projectes || []).map(x => `
              <div class="project-card-item ${x.id == selectedProjectId ? 'active' : ''}" onclick="selectedProjectId=${x.id};render()">
                <div class="project-card-icon">
                  <i data-lucide="${x.tipus_nom?.toLowerCase().includes('sintesi') ? 'star' : 'file-text'}"></i>
                </div>
                <div class="project-card-info">
                  <strong>${x.nom}</strong>
                  <div class="project-card-meta">
                    <span class="pill mini">${x.modul_codi}</span>
                    <span class="type-tag">${x.tipus_nom || 'Genèrica'}</span>
                  </div>
                </div>
              </div>
            `).join('') || '<div class="notice">No hi ha activitats creades.</div>'}
          </div>
        `, 'edit-3')}
      </div>
      <div class="main-content-scroll">
        ${p ? `
          <div class="card">
            <div class="module-toolbar" style="grid-template-columns: 1fr auto">
              <div class="module-summary">
                <strong>Notes: ${p.nom}</strong><span>${p.modul_codi} · ${p.tipus_nom || ''}</span>
              </div>
              <div class="actions">
                <select onchange="S.filterGroupId=this.value==='all'?null:this.value;render()">
                  <option value="all">Tots els grups</option>
                  ${(S.grups || []).map(g => `<option value="${g.id}" ${filterId == g.id ? 'selected' : ''}>${g.nom}</option>`).join('')}
                </select>
                <button onclick="saveBulkGrades(${p.id})"><i data-lucide="save"></i> Gravar tot</button>
              </div>
            </div>
            
            <div class="table-scroll" style="margin-top: 20px">
              <table>
                <thead>
                  <tr>
                    <th>Alumne</th>
                    <th style="width: 120px; text-align: center">Nota (0-10)</th>
                    <th>Observacions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredAlumnes.map(a => {
    const n = notes.get(`${a.id}-${p.id}`);
    return `
                      <tr>
                        <td><strong>${a.cognoms}, ${a.nom}</strong></td>
                        <td style="text-align: center">
                          <input class="grade-input" data-alumne="${a.id}" type="text" inputmode="decimal" 
                            style="width: 70px; text-align: center; font-weight: 700; color: var(--primary); margin: 0" 
                            value="${n?.nota ?? ''}">
                        </td>
                        <td>
                          <input class="obs-input" data-alumne="${a.id}" type="text" 
                            style="width: 100%; margin: 0" 
                            value="${n?.observacions || ''}" placeholder="Opcional...">
                        </td>
                      </tr>
                    `;
  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="empty-state">
            <i data-lucide="edit-3" size="48"></i>
            <h3>Qualificacions</h3>
            <p>Selecciona una activitat de la llista per introduir les notes de l'alumnat.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

async function saveBulkGrades(projectId) {
  const inputs = document.querySelectorAll('.grade-input');
  const obsInputs = document.querySelectorAll('.obs-input');
  const grades = [];

  for (let i = 0; i < inputs.length; i++) {
    const alumneId = inputs[i].dataset.alumne;
    const notaRaw = inputs[i].value;
    const observacions = obsInputs[i].value;

    if (notaRaw === '') {
      await supabase.from('notes_projecte').delete().eq('alumne_id', alumneId).eq('projecte_id', projectId);
      continue;
    }

    const nota = Number(String(notaRaw).replace(',', '.'));
    if (!Number.isFinite(nota) || nota < 0 || nota > 10) {
      toast(`Nota invàlida per a l'alumne ${alumneId}`, 'error');
      continue;
    }

    grades.push({ alumne_id: alumneId, projecte_id: projectId, nota, observacions });
  }

  try {
    if (grades.length > 0) {
      // Supabase UPSERT (insert or update based on unique constraint)
      const { error } = await supabase.from('notes_projecte').upsert(grades, { onConflict: 'alumne_id,projecte_id' });
      if (error) throw error;
    }
    toast('Totes les notes s’han desat correctament.');
    await recalc();
  } catch (e) {
    toast('Error en desar les notes: ' + e.message, 'error');
  }
}

async function recalc() {
  toast('Recalculant notes...');
  const { data: alumnes } = await supabase.from('alumnes').select('*');
  const { data: ras } = await supabase.from('ras').select('*').eq('actiu', 1);
  const { data: allNotes } = await supabase.from('notes_projecte').select('*, projectes(*)');
  const { data: allProjRa } = await supabase.from('projecte_ra').select('*');
  const { data: allTipus } = await supabase.from('tipus_activitat').select('*');

  const results = [];
  for (const a of alumnes) {
    for (const ra of ras) {
      // Filtrem les notes que pertanyen a aquest RA i alumne
      const projRaList = allProjRa.filter(pr => pr.ra_id == ra.id);
      const projIds = projRaList.map(pr => pr.projecte_id);

      const relevantNotes = allNotes.filter(n => n.alumne_id == a.id && projIds.includes(n.projecte_id));

      let total = 0, pes = 0, bloq = 0, detall = [];
      for (const n of relevantNotes) {
        const p = n.projectes;
        const pr = projRaList.find(x => x.projecte_id == p.id);
        const t = allTipus.find(x => x.id == p.tipus_id);

        const reqMin = t?.requereix_minim || 0;
        const limRa = t?.limita_ra || 0;
        const notaMin = t?.nota_minima || 5;
        const pPes = pr?.pes || 0;

        total += Number(n.nota) * Number(pPes);
        pes += Number(pPes);
        detall.push(`${p.nom}: ${n.nota} x ${pPes}%`);

        if (reqMin && limRa && Number(n.nota) < Number(notaMin)) bloq = 1;
      }

      const calc = pes > 0 ? total / pes : null;
      let final = calc;
      let superat = (calc !== null && calc >= (ra.nota_minima || 5)) ? 1 : 0;

      if (calc !== null && bloq) {
        if (calc >= 5) final = 4;
        superat = 0;
      }

      results.push({
        alumne_id: a.id,
        ra_id: ra.id,
        nota_calculada: calc,
        nota_final: final,
        superat,
        bloquejat_sintesi: bloq,
        detall: detall.join('; ')
      });
    }
  }

  // Guardem els resultats a Supabase (esborrem tot el d'aquest mòdul o total si cal)
  await supabase.from('notes_ra_calculades').delete().neq('alumne_id', -1); 

  const { error } = await supabase.from('notes_ra_calculades').insert(results);

  if (error) toast('Error al desar càlculs: ' + error.message, 'error');
  else toast('Notes recalculades amb èxit.');

  await load();
}

function resultatsMatrixView() {
  const rows = S.notes_ra_calculades || [];
  const ras = [...S.ras].filter(r => Number(r.actiu) !== 0);
  const by = new Map(rows.map(r => [`${r.alumne_id}-${r.ra_id}`, r]));
  const filterId = S.filterGroupId;
  const filteredAlumnes = filterId ? S.alumnes.filter(a => a.grup_id == filterId) : S.alumnes;
  return wrap('Resultats per RA', `
    <div class="module-toolbar">
      <select onchange="S.filterGroupId=this.value==='all'?null:this.value;render()">
        <option value="all">Tots els grups</option>
        ${S.grups.map(g => `<option value="${g.id}" ${filterId == g.id ? 'selected' : ''}>${g.nom}</option>`).join('')}
      </select>
      <div class="actions">
        <button onclick="recalc()"><i data-lucide="refresh-cw"></i> Recalcular ara</button>
        <button class="secondary" onclick="tab='Informes';renderTabs();render()">Veure Informes</button>
      </div>
    </div>
    <div class="table-scroll"><table class="matrix"><thead><tr><th class="sticky-col">Alumne</th>${ras.map(r => `<th><strong>${r.codi}</strong></th>`).join('')}<th>Final</th></tr></thead><tbody>${filteredAlumnes.map(a => { let vals = []; const cells = ras.map(r => { const x = by.get(`${a.id}-${r.id}`); if (x && x.nota_final != null) vals.push(Number(x.nota_final)); const cls = x ? (x.superat ? 'okcell' : 'kocell') : ''; return `<td class="${cls}">${x ? fmt(x.nota_final) : '—'}</td>` }).join(''); const final = vals.length ? vals.reduce((p, c) => p + c, 0) / vals.length : null; return `<tr><th class="sticky-col">${a.cognoms}, ${a.nom}</th>${cells}<td><strong>${fmt(final)}</strong></td></tr>` }).join('')}</tbody></table></div>
  `, 'bar-chart-2');
}

function informesView() {
  const filterId = S.filterGroupId;
  const filteredAlumnes = filterId ? S.alumnes.filter(a => a.grup_id == filterId) : S.alumnes;
  return `
    <div class="activities-layout">
      <div class="sidebar-content">
        ${wrap('Selecciona usuari', `
          <div class="module-toolbar" style="grid-template-columns: 1fr">
            <select onchange="S.filterGroupId=this.value==='all'?null:this.value;render()">
              <option value="all">Tots els grups</option>
              ${(S.grups || []).map(g => `<option value="${g.id}" ${filterId == g.id ? 'selected' : ''}>${g.nom}</option>`).join('')}
            </select>
          </div>
          <div class="alumne-list-rich">
            ${filteredAlumnes.map(a => `
              <div class="alumne-card-item ${a.id == S.selectedAlumneIdForReport ? 'active' : ''}" onclick="S.selectedAlumneIdForReport=${a.id};render()">
                <div class="alumne-avatar">${a.nom[0]}${a.cognoms[0]}</div>
                <div class="alumne-info">
                  <strong>${a.cognoms}, ${a.nom}</strong>
                  <span class="grup-tag">${a.grup_nom}</span>
                </div>
                <i data-lucide="chevron-right" class="arrow"></i>
              </div>
            `).join('')}
          </div>
        `, 'user')}
      </div>
      <div class="main-content-scroll">
        ${S.selectedAlumneIdForReport ? renderInformeAlumne(S.selectedAlumneIdForReport) : `
          <div class="empty-state">
            <i data-lucide="file-text" size="48"></i>
            <h3>Informe de seguiment</h3>
            <p>Selecciona un alumne de la llista per generar la seva fitxa detallada de resultats.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderInformeAlumne(id) {
  const targetId = `report-${id}`;
  setTimeout(async () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      // Obtenim dades directament de Supabase
      const { data: alumne } = await supabase.from('alumnes').select('*, grups(nom)').eq('id', id).single();
      const { data: notesRa } = await supabase.from('notes_ra_calculades').select('*, ras(*, moduls(*))').eq('alumne_id', id);

      const resultats = notesRa.map(n => ({
        ra_codi: n.ras.codi,
        modul_codi: n.ras.moduls.codi,
        descripcio: n.ras.descripcio,
        nota_final: n.nota_final,
        superat: n.superat,
        cas: [] // Per simplificar el primer informe, o podríem fer més queries
      }));

      el.innerHTML = generateReportHTML({ alumne: { ...alumne, grup_nom: alumne.grups.nom }, resultats });
    } catch (e) {
      el.innerHTML = `<div class="status warn">Error: ${e.message}</div>`;
    }
  }, 50);
  return `<div id="${targetId}"><div class="notice">Carregant...</div></div>`;
}

function generateReportHTML(data) {
  const { alumne, resultats } = data;
  return `
    <div class="report-card">
      <header class="report-header"><div><h1>Informe de seguiment</h1><p><strong>Usuari:</strong> ${alumne.nom} ${alumne.cognoms}</p><p><strong>Grup:</strong> ${alumne.grup_nom}</p></div><button onclick="window.print()" class="secondary"><i data-lucide="printer"></i> Imprimir</button></header>
      <div class="report-body">${resultats.map(ra => `<div class="ra-report-block"><div class="ra-report-header ${ra.superat ? 'superat' : 'no-superat'}"><div class="ra-info"><span class="ra-badge">${ra.ra_codi}</span><strong>${ra.modul_codi} · ${ra.ra_codi}</strong></div><div class="ra-score"><small>Nota RA</small><strong>${ra.nota_final != null ? ra.nota_final.toFixed(2) : '—'}</strong></div></div><table class="report-table"><thead><tr><th>CA</th><th style="text-align:center">Nota</th><th style="text-align:center">Estat</th></tr></thead><tbody>${ra.cas.map(ca => `<tr><td>${ca.codi} · ${ca.descripcio || ''}</td><td style="text-align:center">${ca.nota != null ? ca.nota.toFixed(2) : '—'}</td><td style="text-align:center"><span class="pill ${ca.superat ? 'ok' : 'ko'}">${ca.superat ? 'Assolit' : 'No assolit'}</span></td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
    </div>
  `;
}

function seguimentView() {
  const projectes = [...S.projectes].sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  const notes = new Map((S.notes_projecte || []).map(n => [`${n.alumne_id}-${n.projecte_id}`, n]));
  const filterId = S.filterGroupId;
  const filteredAlumnes = filterId ? S.alumnes.filter(a => a.grup_id == filterId) : S.alumnes;

  return wrap('Llençol de Seguiment', `
    <div class="module-toolbar">
      <select onchange="S.filterGroupId=this.value==='all'?null:this.value;render()">
        <option value="all">Tots els grups</option>
        ${(S.grups || []).map(g => `<option value="${g.id}" ${filterId == g.id ? 'selected' : ''}>${g.nom}</option>`).join('')}
      </select>
      <div class="actions">
        <button class="secondary" onclick="window.print()"><i data-lucide="printer"></i> Imprimir</button>
      </div>
    </div>
    <div class="table-scroll">
      <table class="matrix">
        <thead>
          <tr>
            <th class="sticky-col">Alumne</th>
            ${projectes.map(p => `
              <th title="${p.nom} (${p.modul_codi})">
                <div style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px">
                  ${p.nom}
                </div>
                <small style="font-size: 9px; color: var(--text-muted); font-weight: 500">${p.tipus_nom || ''}</small>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${filteredAlumnes.map(a => `
            <tr>
              <th class="sticky-col">${a.cognoms}, ${a.nom}</th>
              ${projectes.map(p => {
    const n = notes.get(`${a.id}-${p.id}`);
    const notaVal = (n && n.nota != null) ? Number(n.nota) : null;
    const cls = notaVal !== null ? (notaVal >= 5 ? 'okcell' : 'kocell') : '';
    return `<td class="${cls}" style="text-align: center; font-weight: 600">${fmt(notaVal)}</td>`;
  }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `, 'layout');
}

document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  render();
  load().catch(e => {
    console.error("Error carregant l'aplicació:", e);
  });
});
