import { supabase } from './supabase.js';

// ═══════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════
const G = { equipos: {}, fixture: [] };
let currentCat = null;
let currentJornada = 'todas';

// ═══════════════════════════════════════════════════════════
// AGRUPADO POR CAT → JORNADA
// ═══════════════════════════════════════════════════════════
function getGrouped() {
  const g = {};
  G.fixture.forEach(m => {
    // Si tiene grupos (y no es inter-grupo)
    if (m.grupoLocal && m.grupoLocal === m.grupoVisita) {
      const tabId = m.cat + '_' + m.grupoLocal;
      if (!g[tabId]) g[tabId] = {};
      if (!g[tabId][m.jornada]) g[tabId][m.jornada] = [];
      g[tabId][m.jornada].push(m);
    } 
    // Inter-grupo: El usuario pidió OMITIRLOS por completo de las pestañas
    else if (m.grupoLocal || m.grupoVisita) {
      // No hacemos nada, el partido simplemente no se mostrará en las pestañas de grupos
    } else {
      // Categoría normal
      if (!g[m.cat]) g[m.cat] = {};
      if (!g[m.cat][m.jornada]) g[m.cat][m.jornada] = [];
      g[m.cat][m.jornada].push(m);
    }
  });
  return g;
}

// Equipos que no juegan en esta jornada de esta categoría
function getByeTeams(cat, jornada) {
  const allTeams = G.equipos[cat] || [];
  if (allTeams.length === 0) return [];
  const playing = new Set();
  G.fixture
    .filter(m => String(m.tabId) === String(cat) && String(m.jornada) === String(jornada))
    .forEach(m => {
      if (m.local) playing.add(m.local);
      if (m.visitante) playing.add(m.visitante);
    });
  return allTeams.filter(t => !playing.has(t));
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderMatchRow(m) {
  const isLive = m.estado === 'en vivo';
  const isFin  = m.estado === 'finalizado';

  // Bloque de score con estructura rica
  let scoreInner, scoreCls;
  if (isLive) {
    const gl = m.golesL !== null ? m.golesL : '?';
    const gv = m.golesV !== null ? m.golesV : '?';
    scoreInner = `<span class="score-nums">${gl}&thinsp;&ndash;&thinsp;${gv}</span><span class="score-label">EN VIVO</span>`;
    scoreCls   = 'live';
  } else if (isFin) {
    scoreInner = `<span class="score-nums">${m.golesL}&thinsp;&ndash;&thinsp;${m.golesV}</span><span class="score-label">FT</span>`;
    scoreCls   = 'fin';
  } else {
    const horaHtml = m.hora ? `<span class="hora-text">${m.hora}</span>` : '';
    scoreInner = `<span class="score-vs">${horaHtml}VS</span>`;
    scoreCls   = 'pend';
  }

  // Ganador / perdedor
  let localCls = 'match-team local', visitCls = 'match-team visitante';
  if (isFin && m.golesL !== null && m.golesV !== null) {
    if      (m.golesL > m.golesV) { localCls += ' winner'; visitCls += ' loser'; }
    else if (m.golesL < m.golesV) { localCls += ' loser';  visitCls += ' winner'; }
  }

  // Fila de cancha — span completo debajo
  const canchaRow = m.cancha ? `
      <div class="match-cancha-row">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        ${m.cancha}
      </div>` : '';

  return `
    <div class="match-row" data-estado="${m.estado}">
      <div class="${localCls}">${m.local || 'Descanso'}</div>
      <div class="match-score ${scoreCls}">${scoreInner}</div>
      <div class="${visitCls}">${m.visitante || 'Descanso'}</div>${canchaRow}
    </div>`;
}

function renderJornada(jornadaNum, matches, byeTeams) {
  const hasLive  = matches.some(m => m.estado === 'en vivo');
  const finCount = matches.filter(m => m.estado === 'finalizado').length;

  // Badge de estado
  let metaHtml;
  if (hasLive) {
    metaHtml = `<span class="jornada-live-badge"><span style="width:5px;height:5px;background:rgba(255,255,255,.9);border-radius:50%;display:inline-block;flex-shrink:0;animation:copa-pulse 1.3s ease-in-out infinite"></span>En Vivo</span>`;
  } else if (finCount === matches.length) {
    metaHtml = `<span class="jornada-meta">Completada &#10003;</span>`;
  } else {
    metaHtml = `<span class="jornada-meta">${finCount}&thinsp;/&thinsp;${matches.length} jugados</span>`;
  }

  const byeSection = byeTeams.length > 0 ? `
    <div class="descanso-section">
      <div class="descanso-title">
        <span>&#9208;</span>
        Descansa${byeTeams.length > 1 ? 'n' : ''} &middot; ${byeTeams.length} equipo${byeTeams.length > 1 ? 's' : ''}
      </div>
      <div class="descanso-teams">
        ${byeTeams.map(t => `<span class="descanso-team">${t}</span>`).join('')}
      </div>
    </div>` : '';

  return `
    <div class="jornada-block" id="jornada-${jornadaNum}">
      <div class="jornada-header">
        <span class="jornada-title">JORNADA <strong>${jornadaNum}</strong></span>
        ${metaHtml}
      </div>
      <div class="matches-list">
        ${matches.map(renderMatchRow).join('')}
      </div>
      ${byeSection}
    </div>`;
}

function renderFixture() {
  const grouped = getGrouped();
  const catData = grouped[currentCat] || {};
  const jornadas = Object.keys(catData).sort((a, b) => Number(a) - Number(b));

  const content = document.getElementById('fixtureContent');
  const empty = document.getElementById('emptyState');

  if (jornadas.length === 0) {
    content.hidden = true;
    empty.hidden = false;
    return;
  }

  content.hidden = false;
  empty.hidden = true;

  const selected = currentJornada === 'todas'
    ? jornadas
    : jornadas.filter(j => j === currentJornada);

  content.innerHTML = selected.map(j => {
    const byeTeams = getByeTeams(currentCat, j);
    return renderJornada(j, catData[j], byeTeams);
  }).join('');

  const totalPartidos = jornadas.reduce((s, j) => s + catData[j].length, 0);
  const totalEquipos = G.equipos[currentCat] ? G.equipos[currentCat].length : 0;
  document.getElementById('qsEquipos').textContent = totalEquipos;
  document.getElementById('qsJornadas').textContent = jornadas.length;
  document.getElementById('qsPartidos').textContent = totalPartidos;
  document.getElementById('quickStats').hidden = false;
}

// ═══════════════════════════════════════════════════════════
// TABS Y PILLS
// ═══════════════════════════════════════════════════════════
function buildCatTabs(cats) {
  const wrap = document.getElementById('catTabs');
  wrap.innerHTML = cats.map((c, i) => {
    let label = 'Cat. ' + c;
    if (c.includes('_')) {
      const [cat, grp] = c.split('_');
      label = `Cat. ${cat} GRP ${grp}`;
    }
    return `<button class="cat-tab ${c === currentCat ? 'active' : ''}" data-cat="${c}">${label}</button>`;
  }).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    wrap.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.cat;
    currentJornada = 'todas';
    buildJornadaPills();
    renderFixture();
  });
}

function buildJornadaPills() {
  const grouped = getGrouped();
  const catData = grouped[currentCat] || {};
  const jornadas = Object.keys(catData).sort((a, b) => Number(a) - Number(b));

  const row = document.getElementById('jornadaRow');
  const wrap = document.getElementById('jornadaPills');

  if (jornadas.length === 0) { row.hidden = true; return; }
  row.hidden = false;

  wrap.innerHTML = `<button class="jornada-pill active" data-j="todas">Todas</button>` +
    jornadas.map(j => {
      const hasLive = catData[j].some(m => m.estado === 'en vivo');
      const dotHtml = hasLive ? '<span class="pill-dot"></span>' : '';
      return `<button class="jornada-pill ${hasLive ? 'has-live' : ''}" data-j="${j}">${dotHtml}Jor. ${j}</button>`;
    }).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.jornada-pill');
    if (!btn) return;
    wrap.querySelectorAll('.jornada-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentJornada = btn.dataset.j;
    renderFixture();

    if (currentJornada !== 'todas') {
      const el = document.getElementById(`jornada-${currentJornada}`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CARGA DE DATOS DESDE SUPABASE
// ═══════════════════════════════════════════════════════════
async function loadAll() {
  const loader = document.getElementById('loader');
  const empty = document.getElementById('emptyState');

  try {
    const [resEquipos, resPartidos, resInsc] = await Promise.all([
      supabase.from('equipos').select('id, nombre'),
      supabase.from('partidos').select('id, categoria, jornada, estado, equipo_local_id, equipo_visitante_id, equipo_local:equipos!partidos_equipo_local_id_fkey(nombre), equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre), goles_local, goles_visitante, cancha, fecha_hora'),
      supabase.from('inscripciones').select('equipo_id, categoria, grupo')
    ]);

    if (resPartidos.error) throw resPartidos.error;
    if (resEquipos.error) throw resEquipos.error;
    if (resInsc.error) throw resInsc.error;

    const matches = resPartidos.data || [];
    if (matches.length === 0) throw new Error('SIN_DATOS');

    const inscripciones = resInsc.data || [];
    const getGrupo = (eqId, cat) => {
      const ins = inscripciones.find(i => String(i.equipo_id) === String(eqId) && String(i.categoria) === String(cat));
      return ins ? ins.grupo : null;
    };

    // Mapear equipos por pestaña (tabId) a partir de partidos
    G.equipos = {};
    matches.forEach(m => {
      const loc = m.equipo_local?.nombre?.trim().toUpperCase();
      const vis = m.equipo_visitante?.nombre?.trim().toUpperCase();
      
      const grpLoc = getGrupo(m.equipo_local_id, m.categoria);
      const grpVis = getGrupo(m.equipo_visitante_id, m.categoria);
      
      // Determinar a qué tabId pertenece
      let tabId = String(m.categoria || '').trim();
      if (grpLoc && grpLoc === grpVis) {
        tabId = tabId + '_' + grpLoc;
      }
      
      if (!G.equipos[tabId]) G.equipos[tabId] = new Set();
      if (loc) G.equipos[tabId].add(loc);
      if (vis) G.equipos[tabId].add(vis);
    });
    Object.keys(G.equipos).forEach(tabId => {
      G.equipos[tabId] = Array.from(G.equipos[tabId]);
    });

    // Mapear partidos a G.fixture
    G.fixture = matches.map(m => {
      const catStr = String(m.categoria || '').trim();
      const jorStr = String(m.jornada || '').trim();
      const localName = m.equipo_local?.nombre?.trim().toUpperCase() || '';
      const visitanteName = m.equipo_visitante?.nombre?.trim().toUpperCase() || '';
      const isFree = !m.equipo_local || !m.equipo_visitante;

      const rawEstado = (m.estado || '').toString().toLowerCase();
      let estado = 'pendiente';
      if (rawEstado.includes('vivo') || rawEstado.includes('live')) {
        estado = 'en vivo';
      } else {
        const gl = m.goles_local != null ? parseInt(m.goles_local, 10) : NaN;
        const gv = m.goles_visitante != null ? parseInt(m.goles_visitante, 10) : NaN;
        const hasScore = !isNaN(gl) && !isNaN(gv);
        const explicitFin = rawEstado.includes('finaliz') || rawEstado.includes('terminad') ||
                            rawEstado.includes('fin') || rawEstado.includes('complet') ||
                            rawEstado === 'oficial' || rawEstado === 'en_revision';
        if (hasScore || explicitFin) estado = 'finalizado';
      }

      const golesL = m.goles_local != null && !isNaN(parseInt(m.goles_local, 10)) ? parseInt(m.goles_local, 10) : null;
      const golesV = m.goles_visitante != null && !isNaN(parseInt(m.goles_visitante, 10)) ? parseInt(m.goles_visitante, 10) : null;

      let hora = '';
      if (m.fecha_hora) {
        try {
          const d = new Date(m.fecha_hora);
          hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {}
      }

      let tabId = catStr;
      const grpLocal = getGrupo(m.equipo_local_id, m.categoria);
      const grpVisita = getGrupo(m.equipo_visitante_id, m.categoria);
      if (grpLocal && grpLocal === grpVisita) {
        tabId = tabId + '_' + grpLocal;
      }

      return {
        id: m.id,
        cat: catStr,
        tabId: tabId,
        categoria: catStr,
        jornada: jorStr,
        local: localName,
        visitante: visitanteName,
        golesL,
        golesV,
        golesLocal: golesL,
        golesVisitante: golesV,
        estado,
        isFree,
        score: (golesL !== null && golesV !== null) ? `${golesL} - ${golesV}` : '',
        hora,
        cancha: m.cancha || '',
        grupoLocal:   grpLocal,
        grupoVisita:  grpVisita,
      };
    });

    const groupedInit = getGrouped();
    const catsConPartidos = Object.keys(groupedInit).sort();
    if (catsConPartidos.length === 0) throw new Error('SIN_DATOS');

    currentCat = catsConPartidos[0];
    buildCatTabs(catsConPartidos);
    buildJornadaPills();

    loader.hidden = true;
    renderFixture();

  } catch (err) {
    loader.hidden = true;
    empty.hidden = false;
    const noData = err.message === 'SIN_DATOS';
    document.querySelector('#emptyState .empty-title').textContent = noData ? 'NO DISPONIBLE' : 'ERROR DE CONEXIÓN';
    document.querySelector('#emptyState .empty-sub').textContent = noData ? 'La información no está disponible en este momento.' : 'Intente nuevamente más tarde.';
    console.error('[Fixture]', err);
  }
}

document.addEventListener('DOMContentLoaded', loadAll);
