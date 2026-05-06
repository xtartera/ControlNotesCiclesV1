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
    toast("Error de connexió", 'error');
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
  const m = mods.find(x => x.id == selectedModulId);
  const ras = (S.ras || []).filter(r => r.modul_id == selectedModulId);
  
  return `
    <div class="module-toolbar">
      <select onchange="selectedModulId=this.value;render()">${opts(mods, 'codi')}</select>
      <button onclick="api('/api/moduls/'+selectedModulId+'/normalitzar', {method:'POST'}).then(load)">Repartir Pesos</button>
      <div style="margin-left: auto"><input id="csvcurr" type="file" style="display:none" onchange="importarCurriculum(this)"><button class="secondary" onclick="$('#csvcurr').click()">Importar CSV</button></div>
    </div>
    <div class="ra-grid">${ras.map(ra => `
      <article class="ra-card">
        <header style="display:flex; justify-content:space-between"><strong>${ra.codi}</strong> <input type="number" value="${ra.pes}" style="width:60px" onchange="upd('ras',${ra.id},{pes:this.value})">%</header>
        <p class="desc-tiny">${ra.descripcio || ''}</p>
        <div class="ca-list">${(S.cas || []).filter(c => c.ra_id == ra.id).map(c => `
          <div class="ca-row"><span>${c.codi}</span><input type="number" value="${c.pes}" style="width:50px" onchange="upd('cas',${c.id},{pes:this.value})">%</div>
        `).join('')}</div>
      </article>
    `).join('')}</div>
  `;
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
      ${wrap('Nova Activitat', `<label>Mòdul</label><select id="pm">${opts(S.moduls)}</select><label>Tipus</label><select id="pt">${opts(S.tipus_activitat)}</select><label>Nom</label><input id="pn"><button onclick="create('projectes',{modul_id:num('pm'),tipus_id:num('pt'),nom:val('pn')})">Afegir</button>`, 'plus')}
      <div class="wide">${wrap('Llistat', `<table><thead><tr><th>Mòdul</th><th>Nom</th><th>Tipus</th><th></th></tr></thead><tbody>${(S.projectes || []).map(p => `<tr><td>${p.modul_codi}</td><td><strong>${p.nom}</strong></td><td>${p.tipus_nom || ''}</td><td><button class="danger mini" onclick="del('projectes',${p.id})">X</button></td></tr>`).join('')}</tbody></table>`, 'list')}</div>
    </div>
  `;
}

function notesView() {
  if (!selectedProjectId && S.projectes?.length) selectedProjectId = S.projectes[0].id;
  const alumnes = S.alumnes || [];
  const notes = new Map((S.notes_projecte || []).map(n => [`${n.alumne_id}-${n.projecte_id}`, n]));
  
  return `
    <div class="module-toolbar"><select onchange="selectedProjectId=this.value;render()">${opts(S.projectes)}</select></div>
    ${wrap('Qualificacions', `<table><thead><tr><th>Alumne</th><th>Nota</th><th>Observacions</th></tr></thead><tbody>${alumnes.map(a => {
      const n = notes.get(`${a.id}-${selectedProjectId}`);
      return `<tr><td>${a.cognoms}, ${a.nom}</td><td><input type="number" step="0.1" value="${n?.nota||''}" onchange="saveNota(${a.id},${selectedProjectId},this.value)"></td><td><input value="${n?.observacions||''}" onchange="saveNota(${a.id},${selectedProjectId},null,this.value)"></td></tr>`;
    }).join('')}</tbody></table>`, 'edit-3')}
  `;
}

async function saveNota(aid, pid, nota, obs) {
  const current = (S.notes_projecte || []).find(n => n.alumne_id == aid && n.projecte_id == pid);
  const data = { alumne_id: aid, projecte_id: pid, nota: nota !== null ? nota : (current?.nota||''), observacions: obs !== null ? obs : (current?.observacions||'') };
  await api('/api/notes_projecte/upsert', { method:'POST', body:JSON.stringify(data) });
  await load();
}

function resultatsMatrixView() {
  return wrap('Resultats Finals', `<button onclick="api('/api/recalcular',{method:'POST'}).then(load)">Recalcular Notes</button><div class="table-scroll" style="margin-top:10px"><table><thead><tr><th>Alumne</th>${(S.ras||[]).slice(0,5).map(r => `<th>${r.codi}</th>`).join('')}</tr></thead><tbody>${(S.alumnes||[]).map(a => `<tr><td>${a.cognoms}</td>${(S.ras||[]).slice(0,5).map(r => `<td>—</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, 'bar-chart');
}

function informesView() {
  return wrap('Informes', `<p>Proximament...</p>`, 'file-text');
}

function grupsView() {
  return wrap('Grups', `<table><thead><tr><th>Nom</th><th>Curs</th><th></th></tr></thead><tbody>${(S.grups||[]).map(g => `<tr><td>${g.nom}</td><td>${g.curs||''}</td><td><button class="danger mini" onclick="del('grups',${g.id})">X</button></td></tr>`).join('')}</tbody></table>`, 'users');
}

function usuarisView() {
  return wrap('Usuaris', `<table><thead><tr><th>Cognoms, Nom</th><th>Grup</th><th></th></tr></thead><tbody>${(S.alumnes||[]).map(a => `<tr><td>${a.cognoms}, ${a.nom}</td><td>${a.grup_nom}</td><td><button class="danger mini" onclick="del('alumnes',${a.id})">X</button></td></tr>`).join('')}</tbody></table>`, 'user');
}

function tipusActivitatView() {
  return wrap('Tipus d\'activitat', `<table><thead><tr><th>Nom</th><th>Pes %</th></tr></thead><tbody>${(S.tipus_activitat||[]).map(t => `<tr><td>${t.nom}</td><td>${t.pes_defecte}%</td></tr>`).join('')}</tbody></table>`, 'settings');
}

function seguimentView() { return wrap('Seguiment', `<p>Proximament...</p>`, 'layout'); }

document.addEventListener('DOMContentLoaded', load);
