// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════
const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';

const URL_EQUIPOS = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1862807827&single=true&output=csv`;
const URL_FIXTURE = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1171502194&single=true&output=csv`;

// ═══════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════
const G = {
  equipos: {},
  loaded: [],
  standings: {}
};

let currentFixtureCat = '';
let currentTablaCat = '';

// ═══════════════════════════════════════════════════════════
// UTILIDADES DE PARSEO
// ═══════════════════════════════════════════════════════════
function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

function parseEquipos(rows) {
  if (!rows.length) return {};
  const header = rows[0];
  const cats = {};
  for (let c = 1; c < header.length; c++) {
    const yr = header[c].trim();
    if (yr && !isNaN(yr)) cats[yr] = [];
  }
  for (let r = 1; r < rows.length; r++) {
    const team = (rows[r][0] || '').trim().toUpperCase();
    if (!team) continue;
    for (let c = 1; c < header.length; c++) {
      const yr = header[c].trim();
      const val = (rows[r][c] || '').trim();
      if (cats[yr] && (val === '1' || val.toLowerCase() === 'x' || val === '✓')) {
        cats[yr].push(team);
      }
    }
  }
  Object.keys(cats).forEach(k => { if (!cats[k].length) delete cats[k]; });
  return cats;
}

function parseFixture(rows) {
  if (!rows.length) return [];
  const hdr = rows[0].map(h => h.trim().toUpperCase());

  const col = key => hdr.findIndex(h => h.includes(key));
  const exact = key => hdr.findIndex(h => h === key);
  const IDX = {
    jornada: col('JORNADA'),
    cat: col('CATEG'),
    local: exact('LOCAL'),
    visitante: col('VISITANTE'),
    score: exact('SCORE'),
    golesL: hdr.findIndex(h => h.includes('GOLES') && h.includes('LOCAL')),
    golesV: hdr.findIndex(h => h.includes('GOLES') && h.includes('VISITANTE')),
    resultado: col('RESULTADO'),
  };

  const result = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    const local = (row[IDX.local] || '').trim().toUpperCase();
    const visitante = (row[IDX.visitante] || '').trim().toUpperCase();
    if (!local || !visitante) continue;
    
    let estado = 'pendiente';
    const resLC = (row[IDX.resultado] || '').toLowerCase();
    if (resLC.includes('vivo')) estado = 'en vivo';
    else if (resLC !== '' && resLC !== 'pendiente' && resLC !== '-') estado = 'finalizado';

    result.push({
      jornada: (row[IDX.jornada] || '').trim(),
      cat: (row[IDX.cat] || '').trim(),
      local, visitante,
      score: (row[IDX.score] || '').trim(),
      golesL: parseInt(row[IDX.golesL] || '', 10),
      golesV: parseInt(row[IDX.golesV] || '', 10),
      resultado: (row[IDX.resultado] || '').trim(),
      estado
    });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// CÁLCULO DE TABLAS
// ═══════════════════════════════════════════════════════════
function buildStandings() {
  G.standings = {};

  Object.keys(G.equipos).sort().forEach(cat => {
    const teamMap = {};

    // Inicializar todos los equipos de la categoría
    G.equipos[cat].forEach(t => {
      teamMap[t] = { equipo: t, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    });

    // Procesar partidos jugados de esta categoría
    G.loaded
      .filter(m => String(m.cat) === String(cat))
      .forEach(m => {
        if (m.estado !== 'finalizado') return;

        const gl = isNaN(m.golesL) ? null : m.golesL;
        const gv = isNaN(m.golesV) ? null : m.golesV;
        if (gl === null || gv === null) return;

        const loc = m.local;
        const vis = m.visitante;

        // Asegurar que el equipo esté en el mapa aunque no esté en la lista inicial
        if (!teamMap[loc]) teamMap[loc] = { equipo: loc, pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0 };
        if (!teamMap[vis]) teamMap[vis] = { equipo: vis, pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0 };

        const tL = teamMap[loc];
        const tV = teamMap[vis];

        tL.pj++; tV.pj++;
        tL.gf += gl; tL.gc += gv;
        tV.gf += gv; tV.gc += gl;

        if (gl > gv) {
          tL.pg++; tL.pts += 3; tV.pp++;
        } else if (gl < gv) {
          tV.pg++; tV.pts += 3; tL.pp++;
        } else {
          tL.pe++; tL.pts++; tV.pe++; tV.pts++;
        }

        tL.dg = tL.gf - tL.gc;
        tV.dg = tV.gf - tV.gc;
      });

    // Ordenar: Pts → DG → GF → nombre
    G.standings[cat] = Object.values(teamMap).sort((a, b) =>
      b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.equipo.localeCompare(b.equipo)
    );
  });
}

// ═══════════════════════════════════════════════════════════
// RENDERIZADO EN UI
// ═══════════════════════════════════════════════════════════
function renderFixture(cat) {
  const tbody = document.getElementById('fixtureTbody');
  const matches = G.loaded.filter(m => String(m.cat) === String(cat));
  
  if (matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No hay partidos programados en esta categoría</td></tr>';
    return;
  }
  
  tbody.innerHTML = matches.map(r => {
    let scoreHtml, cls;
    if (r.estado === 'en vivo')         { scoreHtml = `${r.golesL} - ${r.golesV}`; cls = 'live'; }
    else if (r.estado === 'finalizado') { scoreHtml = `${r.golesL} - ${r.golesV}`; cls = 'fin'; }
    else                                { scoreHtml = 'vs'; cls = 'pend'; }
    
    return `<tr>
      <td><span class="fixture-jor">J${r.jornada}</span></td>
      <td>${r.local}</td>
      <td><span class="fixture-score ${cls}">${scoreHtml}</span></td>
      <td>${r.visitante}</td>
      <td style="color:var(--muted);font-size:.8rem;">-</td>
      <td style="color:var(--muted);font-size:.8rem;">-</td>
    </tr>`;
  }).join('');
}

function setFixtureCat(cat, btn) {
  currentFixtureCat = cat;
  document.querySelectorAll('#fixtureCatTabs .cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFixture(cat);
}

function renderTabla(cat) {
  const rows = G.standings[cat] || [];
  const tbody = document.getElementById('posTbody');
  
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted);">No hay equipos registrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = rows.map((r, i) => {
    const posClass = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'pn';
    return `<tr>
      <td><span class="pos-badge ${posClass}">${i + 1}</span></td>
      <td><span class="pos-team">${r.equipo}</span></td>
      <td>${r.pj}</td>
      <td>${r.pg}</td>
      <td>${r.pe}</td>
      <td>${r.pp}</td>
      <td>${r.gf}</td>
      <td>${r.gc}</td>
      <td><span class="pos-pts">${r.pts}</span></td>
    </tr>`;
  }).join('');
}

function setTablaCat(cat, btn) {
  currentTablaCat = cat;
  document.querySelectorAll('#tablaCatTabs .cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabla(cat);
}

function renderMatchesPreview() {
  const container = document.getElementById('matchesPreview');
  let matches = G.loaded.filter(m => m.estado === 'finalizado' || m.estado === 'en vivo');
  
  if (matches.length === 0) {
    matches = G.loaded;
  }
  
  const previewMatches = matches.slice(-3).reverse();
  
  if (previewMatches.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:.9rem;">No hay partidos recientes</div>';
    return;
  }

  container.innerHTML = previewMatches.map(m => {
    const isLive = m.estado === 'en vivo';
    const isFin = m.estado === 'finalizado';
    
    let chipHtml = '';
    if (isLive) chipHtml = '<span class="chip live"><span class="pulse-dot"></span>En Vivo</span>';
    else if (isFin) chipHtml = '<span class="chip fin">Finalizado</span>';
    else chipHtml = '<span class="chip pend">Pendiente</span>';
    
    let scoreHtml = '';
    let scoreCls = '';
    if (isLive) { scoreHtml = `${m.golesL} - ${m.golesV}`; scoreCls = 'live'; }
    else if (isFin) { scoreHtml = `${m.golesL} - ${m.golesV}`; scoreCls = 'fin'; }
    else { scoreHtml = 'vs'; scoreCls = 'pend'; }
    
    return `
      <div class="match-mini" data-estado="${m.estado}">
        <div class="match-mini-top">
          <span class="match-cat">Cat. ${m.cat} · Jor. ${m.jornada}</span>
          ${chipHtml}
        </div>
        <div class="score-row">
          <div class="team-l">${m.local}</div>
          <div class="score-center"><div class="score-nums ${scoreCls}">${scoreHtml}</div></div>
          <div class="team-r">${m.visitante}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterPlayers(q) {
  // Los datos de ejemplo de jugadores fueron eliminados según requerimiento
  document.getElementById('playerGrid').innerHTML = '';
  document.getElementById('noPlayers').hidden = false;
}

function setPlayerCat(cat, btn) {
  document.querySelectorAll('#playerCatTabs .cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('playerGrid').innerHTML = '';
  document.getElementById('noPlayers').hidden = false;
}

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════
function setupTabs() {
  const cats = Object.keys(G.equipos).sort();
  
  if (cats.length > 0) {
    currentFixtureCat = cats[0];
    currentTablaCat = cats[0];
    
    const buildTabs = (id, onClickName) => {
      const container = document.getElementById(id);
      if (!container) return;
      container.innerHTML = Object.keys(G.equipos).sort((a,b)=>a-b).map((cat, i) => 
        `<button class="cat-tab ${i === 0 ? 'active' : ''}" data-cat="${cat}" onclick="${onClickName}('${cat}',this)">Cat. ${cat}</button>`
      ).join('');
    };
    
    buildTabs('fixtureCatTabs', 'setFixtureCat');
    buildTabs('tablaCatTabs', 'setTablaCat');
  }
}

async function loadAll() {
  try {
    const resEq = await fetch(URL_EQUIPOS);
    if (!resEq.ok) throw new Error('No se pudo cargar equipos');
    G.equipos = parseEquipos(parseCsv(await resEq.text()));
    
    const resFix = await fetch(URL_FIXTURE);
    if (!resFix.ok) throw new Error('No se pudo cargar fixture');
    G.loaded = parseFixture(parseCsv(await resFix.text()));
    
    buildStandings();
    setupTabs();
    
    const sortedCats = Object.keys(G.equipos).sort((a,b)=>a-b);
    const firstCat = sortedCats.length > 0 ? sortedCats[0] : '';
    
    if (firstCat) {
      renderFixture(firstCat);
      renderTabla(firstCat);
    }
    renderMatchesPreview();
    
    // Limpiar grid de jugadores ya que se removieron datos demo
    const playerGrid = document.getElementById('playerGrid');
    const noPlayers = document.getElementById('noPlayers');
    if (playerGrid) playerGrid.innerHTML = '';
    if (noPlayers) noPlayers.hidden = false;
    
  } catch (err) {
    console.error('Error al cargar datos:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
});
