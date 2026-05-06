const $ = s => document.querySelector(s);
let S = { editingGroupId: null, editingAlumneId: null, filterGroupId: null, selectedAlumneIdForReport: null };

// --- COMUNICACIÓ AMB EL SERVIDOR ---
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error desconegut');
  return data;
}

async function load() {
  try {
    const data = await api('/api/bootstrap');
    S = { ...S, ...data };
    renderTabs();
    render();
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    console.error("Error carregant dades:", e);
    toast("Error: " + e.message, 'error');
  }
}

async function create(table, data) { await api(`/api/${table}`, { method: 'POST', body: JSON.stringify(data) }); await load(); }
async function upd(table, id, data) { await api(`/api/${table}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); await load(); }
async function del(table, id) { if (confirm('Segur?')) { await api(`/api/${table}/${id}`, { method: 'DELETE' }); await load(); } }

// Helpers
const val = id => document.getElementById(id)?.value || '';
const num = id => Number(val(id));
const opts = (arr, label = 'nom') => (arr||[]).map(x => `<option value="${x.id}">${x[label]}</option>`).join('');
const toast = (msg, type = 'success') => {
  const c = $('#toast-container'); if(!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};
const fmt = n => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// --- VISTES ---
let tab = 'Resum';
const tabConfig = {
  'Resum': { icon: 'home', desc: 'Visió general.' },
  'Currículum': { icon: 'book-open', desc: 'Mòduls i RA/CA.' },
  'Activitats': { icon: 'target', desc: 'Projectes i pesos.' },
  'Tipus activitat': { icon: 'settings', desc: 'Pesos per defecte.' },
  'Qualificacions': { icon: 'edit-3', desc: 'Notes per projecte.' },
  'Seguiment': { icon: 'layout', desc: 'Llençol de notes.' },
  'Resultats': { icon: 'bar-chart-2', desc: 'Notes de RA.' },
  'Informes': { icon: 'file-text', desc: 'Informes individuals.' },
  'Grups': { icon: 'users', desc: 'Grups de classe.' },
  'Usuaris': { icon: 'user-plus', desc: 'Alumnat.' }
};

const tabs = Object.keys(tabConfig);
let selectedModulId = null;
let selectedProjectId = null;

function renderTabs() {
  const T = $('#tabs'); if (!T) return;
  T.innerHTML = tabs.map(t => `
    <button class="nav-item ${tab === t ? 'active' : ''}" onclick="tab='${t}';renderTabs();render()">
      <i data-lucide="${tabConfig[t].icon}"></i>
      <span>${t}</span>
    </button>
  `).join('');
}

function render() {
  const A = $('#app');
  if ($('#current-tab-title')) $('#current-tab-title').textContent = tab;
  if ($('#current-tab-desc')) $('#current-tab-desc').textContent = tabConfig[tab].desc;

  if (tab === 'Resum') A.innerHTML = dashboardView();
  else if (tab === 'Currículum') A.innerHTML = curriculumView();
  else if (tab === 'Activitats') A.innerHTML = activitatsView();
  else if (tab === 'Tipus activitat') A.innerHTML = tipusActivitatView();
  else if (tab === 'Qualificacions') A.innerHTML = notesView();
  else if (tab === 'Seguiment') A.innerHTML = seguimentView();
  else if (tab === 'Resultats') A.innerHTML = resultatsMatrixView();
  else if (tab === 'Informes') A.innerHTML = informesView();
  else if (tab === 'Grups') A.innerHTML = grupsView();
  else if (tab === 'Usuaris') A.innerHTML = usuarisView();

  if (window.lucide) window.lucide.createIcons();
}

function wrap(title, html, icon) { return `<section class="card"><h2><i data-lucide="${icon || 'circle'}"></i> ${title}</h2>${html}</section>`; }

function dashboardView() {
  const lastNotes = (S.notes_projecte || []).slice(0, 5);
  
  return `
    <div class="dashboard-grid">
      <div class="stat-card">
        <div class="stat-icon"><i data-lucide="users"></i></div>
        <div class="stat-info">
          <div class="stat-value">${S.alumnes?.length || 0}</div>
          <div class="stat-label">Alumnes</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #fef3c7; color: #d97706;"><i data-lucide="layers"></i></div>
        <div class="stat-info">
          <div class="stat-value">${S.grups?.length || 0}</div>
          <div class="stat-label">Grups</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #ecfdf5; color: #059669;"><i data-lucide="book"></i></div>
        <div class="stat-info">
          <div class="stat-value">${S.moduls?.length || 0}</div>
          <div class="stat-label">Mòduls</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #f5f3ff; color: #7c3aed;"><i data-lucide="target"></i></div>
        <div class="stat-info">
          <div class="stat-value">${S.projectes?.length || 0}</div>
          <div class="stat-label">Activitats</div>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="wide">
        ${wrap('Darreres notes introduïdes', `
          <div class="recent-activity-table">
            <table>
              <thead>
                <tr>
                  <th>Alumne</th>
                  <th>Projecte / Activitat</th>
                  <th style="text-align: center">Nota</th>
                </tr>
              </thead>
              <tbody>
                ${lastNotes.map(n => {
                  const nota = Number(n.nota);
                  let cls = '';
                  if (nota >= 9) cls = 'excellent';
                  else if (nota >= 5) cls = 'good';
                  else cls = 'fail';
                  
                  return `
                    <tr>
                      <td>
                        <div class="alumne-pill">
                          <div class="avatar-small">${n.alumne_nom[0]}${n.alumne_cognoms[0]}</div>
                          <strong>${n.alumne_nom} ${n.alumne_cognoms}</strong>
                        </div>
                      </td>
                      <td>${n.projecte_nom}</td>
                      <td style="text-align: center">
                        <span class="nota-badge ${cls}">${fmt(n.nota)}</span>
                      </td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="3" style="text-align:center; padding: 40px; color: #94a3b8;">Encara no s\'ha introduït cap nota.</td></tr>'}
              </tbody>
            </table>
          </div>
        `, 'clock')}
      </div>
    </div>
  `;
}

function curriculumView() {
  const mods = S.moduls || [];
  if (!selectedModulId && mods.length) selectedModulId = mods[0].id;
  const ras = (S.ras || []).filter(r => r.modul_id == selectedModulId);
  
  return `
    <div class="card" style="margin-bottom: 24px">
      <div style="display:flex; gap: 16px; align-items:center;">
        <div style="flex:1">
          <label>Mòdul actiu</label>
          <div style="display:flex; gap:8px">
            <select onchange="selectedModulId=this.value;render()" style="margin:0">${opts(mods, 'codi')}</select>
            <button class="danger mini" onclick="delModule(selectedModulId)" title="Esborrar mòdul sencer">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>

        <div style="display:flex; gap: 10px; margin-top: 20px">
          <button class="secondary" onclick="api('/api/moduls/'+selectedModulId+'/normalitzar', {method:'POST'}).then(load)">
            <i data-lucide="scale"></i> Repartir Pesos
          </button>
          <input id="csvcurr" type="file" style="display:none" onchange="importarCurriculum(this)">
          <button class="secondary" onclick="$('#csvcurr').click()">
            <i data-lucide="upload"></i> Importar CSV
          </button>
        </div>
      </div>
    </div>

    <div class="ra-grid">
      ${ras.map(ra => `
        <article class="ra-card-premium ${ra.pes != 100 ? '' : ''}">
          <div class="ra-card-header">
            <div class="ra-title-group">
              <span class="ra-badge-premium">${ra.codi}</span>
              <div class="ra-weight-input-group">
                <input type="number" value="${ra.pes}" class="premium-input" onchange="upd('ras',${ra.id},{pes:this.value})">
                <span class="unit">%</span>
              </div>
            </div>
            <button class="btn-icon-danger" onclick="del('ras',${ra.id})"><i data-lucide="trash-2"></i></button>
          </div>
          <div class="ra-desc-box">
             <p class="desc-tiny" style="margin:0; font-weight:500;">${ra.descripcio || 'Sense descripció.'}</p>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${ra.pes}%"></div>
          </div>
          <div class="ca-list-premium">
            ${(S.cas || []).filter(c => c.ra_id == ra.id).map(c => `
              <div class="ca-item-premium">
                <div class="ca-check-group-premium">
                  <span class="ca-codi">${c.codi}</span>
                  <span class="desc-tiny">${c.descripcio || ''}</span>
                </div>
                <div class="ca-input-group-premium">
                  <input type="number" value="${c.pes}" class="premium-input-sm" onchange="upd('cas',${c.id},{pes:this.value})">
                  <span class="unit">%</span>
                </div>
              </div>
            `).join('')}
            <button class="btn mini secondary" style="margin-top:10px; width:100%" onclick="createCA(${ra.id})">
              <i data-lucide="plus"></i> Afegir CA
            </button>
          </div>
        </article>
      `).join('') || `
        <div class="wide empty-state">
          <i data-lucide="book-open"></i>
          <h3>No hi ha RAs</h3>
          <p>Importa un fitxer CSV o afegeix-los manualment.</p>
          <button onclick="createRA(selectedModulId)" class="primary"><i data-lucide="plus"></i> Crear RA manualment</button>
        </div>
      `}
    </div>
    ${ras.length > 0 ? `<div style="margin-top:20px; display:flex; justify-content:center"><button class="secondary" onclick="createRA(selectedModulId)"><i data-lucide="plus"></i> Afegir nou RA</button></div>` : ''}
  `;
}

async function delModule(id) {
  if (!id) return;
  if (confirm('Estàs segur que vols esborrar aquest mòdul i TOTS els seus RA, CA i notes vinculades? Aquesta acció no es pot desfer.')) {
    await api(`/api/moduls/${id}`, { method: 'DELETE' });
    selectedModulId = null;
    await load();
  }
}

async function createRA(mid) {
  const codi = prompt('Codi del RA (Ex: RA1):');
  if (!codi) return;
  await create('ras', { modul_id: mid, codi, descripcio: '', pes: 0 });
}

async function createCA(raid) {
  const codi = prompt('Codi del CA (Ex: a):');
  if (!codi) return;
  await create('cas', { ra_id: raid, codi, descripcio: '', pes: 0 });
}

async function importarCurriculum(input) {
  const f = input.files[0]; if(!f) return;
  const formData = new FormData(); formData.append('file', f);
  toast('Important...');
  await fetch('/api/import/curriculum', { method:'POST', body:formData });
  await load();
}

function activitatsView() {
  return `
    <div class="grid">
      <div class="card">
        <h2><i data-lucide="plus-circle"></i> Nova Activitat</h2>
        <div style="display:grid; gap:12px">
          <div><label>Mòdul</label><select id="pm" style="margin:0">${opts(S.moduls)}</select></div>
          <div><label>Tipus</label><select id="pt" style="margin:0">${opts(S.tipus_activitat)}</select></div>
          <div><label>Nom de l'activitat</label><input id="pn" placeholder="Ex: UF1 - Projecte final" style="margin:0"></div>
          <button style="margin-top:10px" onclick="create('projectes',{modul_id:num('pm'),tipus_id:num('pt'),nom:val('pn')})">
            <i data-lucide="save"></i> Crear activitat
          </button>
        </div>
      </div>
      <div class="wide">
        ${wrap('Llistat d\'activitats del curs', `
          <div class="recent-activity-table">
            <table>
              <thead>
                <tr>
                  <th>Mòdul</th>
                  <th>Activitat</th>
                  <th>Tipus</th>
                  <th style="text-align:right">Accions</th>
                </tr>
              </thead>
              <tbody>
                ${(S.projectes || []).map(p => `
                  <tr>
                    <td><span class="pill">${p.modul_codi}</span></td>
                    <td><strong>${p.nom}</strong></td>
                    <td><span class="type-tag">${p.tipus_nom || 'General'}</span></td>
                    <td style="text-align:right">
                      <button class="btn-icon-danger" onclick="del('projectes',${p.id})"><i data-lucide="trash-2"></i></button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center; padding:40px; color:#94a3b8">No hi ha activitats creades.</td></tr>'}
              </tbody>
            </table>
          </div>
        `, 'list')}
      </div>
    </div>
  `;
}

function notesView() {
  if (!selectedProjectId && S.projectes?.length) selectedProjectId = S.projectes[0].id;
  const projecte = S.projectes?.find(p => p.id == selectedProjectId);
  const alumnes = S.alumnes || [];
  const notes = new Map((S.notes_projecte || []).map(n => [`${n.alumne_id}-${n.projecte_id}`, n]));
  
  return `
    <div class="card" style="margin-bottom: 24px">
      <div style="display:flex; gap: 16px; align-items:center;">
        <div style="flex:1">
          <label>Activitat a avaluar</label>
          <select onchange="selectedProjectId=this.value;render()" style="margin:0">${opts(S.projectes)}</select>
        </div>
        <div style="margin-top:20px">
           <span class="pill" style="background:var(--primary-light); color:var(--primary)">${projecte?.tipus_nom || 'General'}</span>
        </div>
      </div>
    </div>

    ${wrap('Matriu de qualificacions', `
      <div class="recent-activity-table">
        <table>
          <thead>
            <tr>
              <th>Alumne</th>
              <th style="width:120px; text-align:center">Nota (0-10)</th>
              <th>Observacions / Feedback</th>
            </tr>
          </thead>
          <tbody>
            ${alumnes.map(a => {
              const n = notes.get(`${a.id}-${selectedProjectId}`);
              const notaVal = n?.nota !== undefined ? n.nota : '';
              return `
                <tr>
                  <td>
                    <div class="alumne-pill">
                      <div class="avatar-small">${a.nom[0]}${a.cognoms[0]}</div>
                      <strong>${a.cognoms}, ${a.nom}</strong>
                    </div>
                  </td>
                  <td style="text-align:center">
                    <input type="number" step="0.1" min="0" max="10" value="${notaVal}" 
                      class="premium-input" style="text-align:center; width:80px; border:1px solid #e2e8f0; border-radius:8px"
                      onchange="saveNota(${a.id},${selectedProjectId},this.value)">
                  </td>
                  <td>
                    <input value="${n?.observacions||''}" placeholder="Escriu un comentari..." 
                      style="margin:0; border:none; background:#f8fafc; font-size:13px"
                      onchange="saveNota(${a.id},${selectedProjectId},null,this.value)">
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="3" style="text-align:center; padding:40px">Crea alumnes primer.</td></tr>'}
          </tbody>
        </table>
      </div>
    `, 'edit-3')}
  `;
}

async function saveNota(aid, pid, nota, obs) {
  const current = (S.notes_projecte || []).find(n => n.alumne_id == aid && n.projecte_id == pid);
  const data = { alumne_id: aid, projecte_id: pid, nota: nota !== null ? nota : (current?.nota||''), observacions: obs !== null ? obs : (current?.observacions||'') };
  await api('/api/notes_projecte/upsert', { method:'POST', body:JSON.stringify(data) });
  await load();
}

function resultatsMatrixView() {
  const ras = S.ras || [];
  return `
    <div class="card" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center">
      <div>
        <h2 style="margin:0"><i data-lucide="award"></i> Càlcul de resultats</h2>
        <p class="desc-tiny">Es calcula la mitjana ponderada de cada RA segons les activitats avaluades.</p>
      </div>
      <button onclick="api('/api/recalcular',{method:'POST'}).then(() => { load(); toast('Notes recalculades'); })">
        <i data-lucide="refresh-cw"></i> Recalcular ara
      </button>
    </div>

    ${wrap('Resultats per RA', `
      <div class="table-scroll">
        <table class="recent-activity-table">
          <thead>
            <tr>
              <th class="sticky-col">Alumne</th>
              ${ras.map(r => `<th style="text-align:center">${r.codi}</th>`).join('')}
              <th style="text-align:center; background:#f1f5f9">Final</th>
            </tr>
          </thead>
          <tbody>
            ${(S.alumnes||[]).map(a => `
              <tr>
                <td class="sticky-col"><strong>${a.cognoms}, ${a.nom}</strong></td>
                ${ras.map(r => `<td style="text-align:center; color:#94a3b8">—</td>`).join('')}
                <td style="text-align:center; background:#f8fafc"><strong>—</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `, 'bar-chart')}
  `;
}

function informesView() {
  return wrap('Informes', `<p>Proximament...</p>`, 'file-text');
}

function grupsView() {
  return `
    <div class="grid">
      <div class="card">
        <h2><i data-lucide="plus-circle"></i> Nou Grup</h2>
        <label>Nom del grup</label><input id="gn" placeholder="Ex: 1r DAW A">
        <label>Curs</label><input id="gc" placeholder="Ex: 2023-24">
        <button onclick="create('grups',{nom:val('gn'),curs:val('gc')})"><i data-lucide="save"></i> Crear grup</button>
      </div>
      <div class="wide">
        ${wrap('Grups existents', `
          <div class="recent-activity-table">
            <table>
              <thead><tr><th>Grup</th><th>Curs</th><th style="text-align:right">Accions</th></tr></thead>
              <tbody>
                ${(S.grups||[]).map(g => `
                  <tr>
                    <td><strong>${g.nom}</strong></td>
                    <td>${g.curs||'—'}</td>
                    <td style="text-align:right">
                      <button class="btn-icon-danger" onclick="del('grups',${g.id})"><i data-lucide="trash-2"></i></button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px">No hi ha grups.</td></tr>'}
              </tbody>
            </table>
          </div>
        `, 'layers')}
      </div>
    </div>
  `;
}

function usuarisView() {
  return `
    <div class="grid">
      <div class="card">
        <h2><i data-lucide="user-plus"></i> Nou Alumne</h2>
        <label>Nom</label><input id="an">
        <label>Cognoms</label><input id="ac">
        <label>Grup</label><select id="ag">${opts(S.grups)}</select>
        <button onclick="create('alumnes',{nom:val('an'),cognoms:val('ac'),grup_id:num('ag')})"><i data-lucide="user-plus"></i> Afegir alumne</button>
      </div>
      <div class="wide">
        ${wrap('Llistat d\'alumnat', `
          <div class="recent-activity-table">
            <table>
              <thead><tr><th>Alumne</th><th>Grup</th><th style="text-align:right">Accions</th></tr></thead>
              <tbody>
                ${(S.alumnes||[]).map(a => `
                  <tr>
                    <td>
                      <div class="alumne-pill">
                        <div class="avatar-small">${a.nom[0]}${a.cognoms[0]}</div>
                        <strong>${a.cognoms}, ${a.nom}</strong>
                      </div>
                    </td>
                    <td><span class="pill">${a.grup_nom || 'Sense grup'}</span></td>
                    <td style="text-align:right">
                      <button class="btn-icon-danger" onclick="del('alumnes',${a.id})"><i data-lucide="trash-2"></i></button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px">No hi ha alumnes.</td></tr>'}
              </tbody>
            </table>
          </div>
        `, 'users')}
      </div>
    </div>
  `;
}

function tipusActivitatView() {
  return wrap('Tipus d\'activitat', `<table><thead><tr><th>Nom</th><th>Pes %</th></tr></thead><tbody>${(S.tipus_activitat||[]).map(t => `<tr><td>${t.nom}</td><td>${t.pes_defecte}%</td></tr>`).join('')}</tbody></table>`, 'settings');
}

function seguimentView() { return wrap('Seguiment', `<p>Proximament...</p>`, 'layout'); }

document.addEventListener('DOMContentLoaded', load);
