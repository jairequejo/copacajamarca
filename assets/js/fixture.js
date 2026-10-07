import { supabase } from './supabase.js';
import { buildKnockout, isFinished, advanceKnockout } from './eliminatorias-model.js?v=3';
import { renderKnockout } from './eliminatorias.js?v=28';
import { loadKnockoutResults, tournamentFor, loadMatchesWithMetadata } from './eliminatorias-data.js?v=2';
import { fixtureCategoryTabs, fixtureGroupKey, resolveFixtureSelection } from './fixture-navigation.js?v=1';

// ═══════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════
const G = { equipos: {}, fixture: [] };
let standings = [], rawMatches = [], knockoutRecords = [], currentPhase = 'grupos';
let currentCat = null;
let currentJornada = 'todas';
let categoryTabs = [], currentGroup = null;
const selectedTab = () => categoryTabs.find(tab => tab.id === currentCat);
const selectedFixtureKey = () => selectedTab()?.merged ? fixtureGroupKey(selectedTab().category, currentGroup) : currentCat;

function buildPhaseTabs() {
  const tab = selectedTab(), row = document.getElementById('phaseRow');
  const groupButtons = tab?.merged ? tab.groups.map(group =>
    `<button type="button" data-phase="grupos" data-group="${escapeMatchText(group)}" aria-pressed="false">Fase de grupos · Grupo ${escapeMatchText(group)}</button>`
  ).join('') : '<button type="button" data-phase="grupos" aria-pressed="false">Fase de grupos</button>';
  row.innerHTML = groupButtons + '<button type="button" data-phase="eliminatorias" aria-pressed="false">Eliminatorias <span>↗</span></button>';
}

function syncViewURL() {
  const url = new URL(location.href);
  url.searchParams.set('cat', currentCat);
  url.searchParams.set('fase', currentPhase);
  if (selectedTab()?.merged && currentPhase === 'grupos') url.searchParams.set('grupo', currentGroup);
  else url.searchParams.delete('grupo');
  history.replaceState(history.state, '', url);
}

// ═══════════════════════════════════════════════════════════
// AGRUPADO POR CAT → JORNADA
// ═══════════════════════════════════════════════════════════
function getGrouped() {
  const g = {};
  G.fixture.forEach(m => {
    if (!g[m.cat]) g[m.cat] = {};
    if (!g[m.cat][m.jornada]) g[m.cat][m.jornada] = [];
    g[m.cat][m.jornada].push(m);
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
function escapeMatchText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const OFFICIAL_SCHEDULE_TTL = 24 * 60 * 60 * 1000;

function scheduleExpiresAt(m) {
  const timestamp = Date.parse(m.oficializadoAt || '');
  return Number.isFinite(timestamp) ? timestamp + OFFICIAL_SCHEDULE_TTL : null;
}

function shouldShowSchedule(m, now = Date.now()) {
  const state = String(m.estadoOriginal || '').toUpperCase();
  if (state === 'EN_VIVO') return true;
  if (state === 'OFICIAL') {
    const expiresAt = scheduleExpiresAt(m);
    // Los resultados históricos no tienen una hora de oficialización verificable.
    return expiresAt !== null && now < expiresAt;
  }
  return ['PROGRAMADO', 'EN_REVISION', 'FINALIZADO'].includes(state)
    && Number.isFinite(Date.parse(m.fechaHora || ''));
}

function renderDesktopSchedule(m) {
  if (!shouldShowSchedule(m)) return '';
  const date = m.fechaHora ? new Date(m.fechaHora) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const dateText = validDate
    ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : (m.estado === 'pendiente' ? 'Por programar' : 'Fecha no registrada');
  const timeText = validDate
    ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: true }).format(date)
    : '';
  return `<div class="desktop-match-schedule" data-expires-at="${m.estadoOriginal === 'OFICIAL' ? scheduleExpiresAt(m) : ''}" hidden style="display: none;">
    <span class="schedule-label">Fecha programada</span>
    <span class="schedule-date">${escapeMatchText(dateText)}${timeText ? ` · ${escapeMatchText(timeText)}` : ''}</span>
    <span class="schedule-location"><span>Lugar</span> ${escapeMatchText(m.lugar || 'Por confirmar')}</span>
    <span class="schedule-location"><span>Cancha</span> ${escapeMatchText(m.cancha || 'Por confirmar')}</span>
  </div>`;
}

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
      <div class="${visitCls}">${m.visitante || 'Descanso'}</div>${canchaRow}${renderDesktopSchedule(m)}
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
  const category = currentCat.split(' GRP ')[0];
  const knockout = advanceKnockout(buildKnockout(category, standings, rawMatches), knockoutRecords, tournamentFor(category, rawMatches));
  const isKnockout = currentPhase === 'eliminatorias';
  const phaseRow = document.getElementById('phaseRow');
  phaseRow.hidden = false;
  document.querySelectorAll('[data-phase]').forEach(button => {
    const active = button.dataset.phase === currentPhase && (!button.dataset.group || button.dataset.group === currentGroup);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    if (active && phaseRow.scrollWidth > phaseRow.clientWidth) {
      const rowRect = phaseRow.getBoundingClientRect(), buttonRect = button.getBoundingClientRect();
      if (buttonRect.right > rowRect.right) phaseRow.scrollLeft += buttonRect.right - rowRect.right;
      else if (buttonRect.left < rowRect.left) phaseRow.scrollLeft += buttonRect.left - rowRect.left;
    }
  });
  document.getElementById('knockoutContent').hidden = !isKnockout;
  document.getElementById('jornadaRow').hidden = isKnockout;
  document.getElementById('quickStats').hidden = isKnockout;
  if (isKnockout) {
    document.getElementById('fixtureContent').hidden = true;
    document.getElementById('emptyState').hidden = true;
    renderKnockout(document.getElementById('knockoutContent'), knockout);
    return;
  }
  const grouped = getGrouped();
  const fixtureKey = selectedFixtureKey();
  const catData = grouped[fixtureKey] || {};
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
    const byeTeams = getByeTeams(fixtureKey, j);
    return renderJornada(j, catData[j], byeTeams);
  }).join('');

  const totalPartidos = jornadas.reduce((s, j) => s + catData[j].length, 0);
  const totalEquipos = G.equipos[fixtureKey] ? G.equipos[fixtureKey].length : 0;
  document.getElementById('qsEquipos').textContent = totalEquipos;
  document.getElementById('qsJornadas').textContent = jornadas.length;
  document.getElementById('qsPartidos').textContent = totalPartidos;
  document.getElementById('quickStats').hidden = false;
}

// ═══════════════════════════════════════════════════════════
// TABS Y PILLS
// ═══════════════════════════════════════════════════════════
function buildCatTabs() {
  const wrap = document.getElementById('catTabs');
  wrap.innerHTML = categoryTabs.map(tab => {
    return `<button class="cat-tab ${tab.id === currentCat ? 'active' : ''}" data-cat="${escapeMatchText(tab.id)}" aria-pressed="${tab.id === currentCat}">Cat. ${escapeMatchText(tab.id)}</button>`;
  }).join('');

  wrap.onclick = e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    currentCat = btn.dataset.cat;
    const tab = selectedTab();
    currentGroup = tab.merged ? tab.groups[0] : tab.group;
    currentPhase = buildKnockout(currentCat.split(' GRP ')[0], standings, rawMatches).ready ? 'eliminatorias' : 'grupos';
    currentJornada = 'todas';
    wrap.querySelectorAll('.cat-tab').forEach(button => {
      const active = button.dataset.cat === currentCat;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    buildPhaseTabs();
    buildJornadaPills();
    renderFixture();
    syncViewURL();
  };
}

function buildJornadaPills() {
  const grouped = getGrouped();
  const catData = grouped[selectedFixtureKey()] || {};
  const jornadas = Object.keys(catData).sort((a, b) => Number(a) - Number(b));

  const row = document.getElementById('jornadaRow');
  const wrap = document.getElementById('jornadaPills');

  if (jornadas.length === 0) { row.hidden = true; return; }
  if (currentJornada !== 'todas' && !jornadas.includes(currentJornada)) currentJornada = 'todas';
  row.hidden = false;

  wrap.innerHTML = `<button class="jornada-pill ${currentJornada === 'todas' ? 'active' : ''}" data-j="todas">Todas</button>` +
    jornadas.map(j => {
      const hasLive = catData[j].some(m => m.estado === 'en vivo');
      const dotHtml = hasLive ? '<span class="pill-dot"></span>' : '';
      return `<button class="jornada-pill ${j === currentJornada ? 'active' : ''} ${hasLive ? 'has-live' : ''}" data-j="${j}">${dotHtml}Jor. ${j}</button>`;
    }).join('');

  wrap.onclick = e => {
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
  };
}

// ═══════════════════════════════════════════════════════════
// CARGA DE DATOS DESDE SUPABASE
// ═══════════════════════════════════════════════════════════
async function loadFixtureMatches() {
  const fields = 'id, torneo_id, categoria, grupo, jornada, estado, equipo_local_id, equipo_visitante_id, equipo_local:equipos!partidos_equipo_local_id_fkey(nombre), equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre), goles_local, goles_visitante, lugar, cancha, fecha_hora';
  const result = await loadMatchesWithMetadata(`${fields}, oficializado_at`);
  // Compatibilidad durante el despliegue de la migración; no inventar fechas antiguas.
  if (['42703', 'PGRST204'].includes(result.error?.code)
      && result.error.message.includes('oficializado_at')) {
    return loadMatchesWithMetadata(fields);
  }
  return result;
}

function expireDesktopSchedules() {
  for (const panel of document.querySelectorAll('.desktop-match-schedule[data-expires-at]')) {
    const expiry = Number(panel.dataset.expiresAt);
    if (expiry > 0 && Date.now() >= expiry) panel.remove();
  }
}
setInterval(expireDesktopSchedules, 1000);
document.addEventListener('visibilitychange', expireDesktopSchedules);

function mapFixture(matches) {
    // Mapear equipos por pestaña (tabId) a partir de partidos
    G.equipos = {};
    matches.forEach(m => {
      const loc = m.equipo_local?.nombre?.trim().toUpperCase();
      const vis = m.equipo_visitante?.nombre?.trim().toUpperCase();
      
      
      // Determinar a qué tabId pertenece
      let tabId = String(m.categoria || '').trim();
      if (m.grupo) {
        tabId += ' GRP ' + String(m.grupo).trim();
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
      let catStr = String(m.categoria || '').trim();
      let tabId = catStr;
      if (m.grupo) {
        tabId += ' GRP ' + String(m.grupo).trim();
      }
      const jorStr = String(m.jornada || '').trim();
      const localName = m.equipo_local?.nombre?.trim().toUpperCase() || '';
      const visitanteName = m.equipo_visitante?.nombre?.trim().toUpperCase() || '';
      const isFree = !m.equipo_local || !m.equipo_visitante;

      const rawEstado = (m.estado || '').toString().toLowerCase();
      let estado = 'pendiente';
      if (rawEstado.includes('vivo') || rawEstado.includes('live')) {
        estado = 'en vivo';
      } else if (isFinished(m)) estado = 'finalizado';

      const isProgramado = String(m.estado).trim().toUpperCase() === 'PROGRAMADO';
      const golesL = !isProgramado && m.goles_local != null && !isNaN(parseInt(m.goles_local, 10)) ? parseInt(m.goles_local, 10) : null;
      const golesV = !isProgramado && m.goles_visitante != null && !isNaN(parseInt(m.goles_visitante, 10)) ? parseInt(m.goles_visitante, 10) : null;

      let hora = '';
      if (m.fecha_hora) {
        try {
          const d = new Date(m.fecha_hora);
          hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {}
      }

      return {
        id: m.id,
        cat: tabId,
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
        estadoOriginal: String(m.estado || '').trim().toUpperCase(),
        oficializadoAt: m.oficializado_at || null,
        fechaHora: m.fecha_hora || null,
        lugar: m.lugar || '',
        cancha: m.cancha || ''
      };
    });

}

async function loadAll() {
  const loader = document.getElementById('loader');
  const empty = document.getElementById('emptyState');

  try {
    const [resPartidos, resStandings, results] = await Promise.all([
      loadFixtureMatches(),
      supabase.from('view_posiciones').select('*'),
      loadKnockoutResults()
    ]);


    if (resPartidos.error) throw resPartidos.error;
    if (resStandings.error) throw resStandings.error;

    const matches = resPartidos.data || [];
    if (matches.length === 0) throw new Error('SIN_DATOS');

    standings = resStandings.data || [];
    rawMatches = matches;
    knockoutRecords = results.records;

    mapFixture(matches);

    categoryTabs = fixtureCategoryTabs(matches, standings);
    if (!categoryTabs.length) throw new Error('SIN_DATOS');

    const params = new URLSearchParams(location.search);
    const selection = resolveFixtureSelection(categoryTabs, params.get('cat'), params.get('grupo'));
    currentCat = selection.tab.id;
    currentGroup = selection.group;
    currentPhase = params.get('fase') === 'grupos' ? 'grupos' : params.get('fase') === 'eliminatorias' || buildKnockout(currentCat.split(' GRP ')[0], standings, rawMatches).ready ? 'eliminatorias' : 'grupos';
    buildCatTabs();
    buildPhaseTabs();
    buildJornadaPills();

    loader.hidden = true;
    renderFixture();
    syncViewURL();

  } catch (err) {
    loader.hidden = true;
    empty.hidden = false;
    const noData = err.message === 'SIN_DATOS';
    document.querySelector('#emptyState .empty-title').textContent = noData ? 'NO DISPONIBLE' : 'ERROR DE CONEXIÓN';
    document.querySelector('#emptyState .empty-sub').textContent = noData ? 'La información no está disponible en este momento.' : 'Intente nuevamente más tarde.';
    console.error('[Fixture]', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('phaseRow').addEventListener('click', event => {
    const button = event.target.closest('[data-phase]');
    if (!button) return;
    currentPhase = button.dataset.phase;
    if (button.dataset.group) currentGroup = button.dataset.group;
    currentJornada = 'todas';
    buildJornadaPills();
    renderFixture();
    syncViewURL();
  });
  loadAll();
});

let refreshingFixture = false;
async function refreshFixture() {
  if (document.hidden || !currentCat || refreshingFixture) return;
  refreshingFixture = true;
  try {
    const [resPartidos, resStandings, results] = await Promise.all([
      loadFixtureMatches(), supabase.from('view_posiciones').select('*'), loadKnockoutResults()
    ]);
    if (resPartidos.error) throw resPartidos.error;
    if (resStandings.error) throw resStandings.error;
    const matches = resPartidos.data || [], rows = resStandings.data || [];
    if (JSON.stringify(matches) === JSON.stringify(rawMatches) && JSON.stringify(rows) === JSON.stringify(standings) && JSON.stringify(results.records) === JSON.stringify(knockoutRecords)) return;
    const category = selectedTab().category;
    rawMatches = matches;
    standings = rows;
    knockoutRecords = results.records;
    mapFixture(matches);
    categoryTabs = fixtureCategoryTabs(matches, standings);
    const selection = resolveFixtureSelection(categoryTabs, category, currentGroup);
    if (!selection.tab) return;
    currentCat = selection.tab.id;
    currentGroup = selection.group;
    buildCatTabs();
    buildPhaseTabs();
    buildJornadaPills();
    renderFixture();
    syncViewURL();
  } catch (error) { console.warn('No se pudo actualizar el fixture:', error.message); }
  finally { refreshingFixture = false; }
}
setInterval(refreshFixture, 30000);
document.addEventListener('visibilitychange', refreshFixture);
