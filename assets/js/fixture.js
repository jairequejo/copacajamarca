// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — mismo spreadsheet que el resto de la app
// ═══════════════════════════════════════════════════════════
const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';

const URL_EQUIPOS = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1862807827&single=true&output=csv`;
const URL_FIXTURE = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1171502194&single=true&output=csv`;

// ═══════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════
const G = { equipos: {}, fixture: [] };
let currentCat = null;
let currentJornada = 'todas';

// ═══════════════════════════════════════════════════════════
// PARSEO CSV
// ═══════════════════════════════════════════════════════════
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(line => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else cur += c;
    }
    cols.push(cur.trim());
    return cols;
  }).filter(r => r.some(c => c));
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
    golesL: hdr.findIndex(h => h.includes('GOLES') && h.includes('LOCAL')),
    golesV: hdr.findIndex(h => h.includes('GOLES') && h.includes('VISITANTE')),
    score: exact('SCORE'),
    resultado: col('RESULTADO'),
    hora: col('HORA'),
    cancha: col('CANCHA'),
  };

  return rows.slice(1).map(row => {
    if (!row[0]) return null;
    const local = (row[IDX.local] || '').trim().toUpperCase();
    const visitante = (row[IDX.visitante] || '').trim().toUpperCase();
    if (!local || !visitante) return null;

    const resLC = (row[IDX.resultado] || '').toLowerCase().trim();
    let estado = 'pendiente';
    if (resLC.includes('vivo') || resLC.includes('live')) {
      estado = 'en vivo';
    } else {
      const golesLTmp = parseInt(row[IDX.golesL] || '', 10);
      const golesVTmp = parseInt(row[IDX.golesV] || '', 10);
      const hasScore = !isNaN(golesLTmp) && !isNaN(golesVTmp);
      const explicitFin = resLC.includes('finaliz') || resLC.includes('terminad') ||
                          resLC.includes(' fin') || resLC.includes('complet');
      if (hasScore || explicitFin) estado = 'finalizado';
    }

    const golesL = parseInt(row[IDX.golesL] || '', 10);
    const golesV = parseInt(row[IDX.golesV] || '', 10);

    return {
      jornada: (row[IDX.jornada] || '').trim(),
      cat: (row[IDX.cat] || '').trim(),
      local, visitante, estado,
      golesL: isNaN(golesL) ? null : golesL,
      golesV: isNaN(golesV) ? null : golesV,
      score: (row[IDX.score] || '').trim(),
      hora: IDX.hora >= 0 ? (row[IDX.hora] || '').trim() : '',
      cancha: IDX.cancha >= 0 ? (row[IDX.cancha] || '').trim() : '',
    };
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════
// AGRUPADO POR CAT → JORNADA
// ═══════════════════════════════════════════════════════════
function getGrouped() {
  const grouped = {}; // { cat: { jornada: [matches] } }
  for (const m of G.fixture) {
    if (!grouped[m.cat]) grouped[m.cat] = {};
    if (!grouped[m.cat][m.jornada]) grouped[m.cat][m.jornada] = [];
    grouped[m.cat][m.jornada].push(m);
  }
  return grouped;
}

// Equipos que no juegan en esta jornada de esta categoría
function getByeTeams(cat, jornada) {
  const allTeams = G.equipos[cat] || [];
  if (allTeams.length === 0) return [];
  const playing = new Set();
  G.fixture
    .filter(m => String(m.cat) === String(cat) && String(m.jornada) === String(jornada))
    .forEach(m => { playing.add(m.local); playing.add(m.visitante); });
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
      <div class="${localCls}">${m.local}</div>
      <div class="match-score ${scoreCls}">${scoreInner}</div>
      <div class="${visitCls}">${m.visitante}</div>${canchaRow}
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
  document.getElementById('qsJornadas').textContent = jornadas.length;
  document.getElementById('qsPartidos').textContent = totalPartidos;
  document.getElementById('quickStats').hidden = false;
}

// ═══════════════════════════════════════════════════════════
// TABS Y PILLS
// ═══════════════════════════════════════════════════════════
function buildCatTabs(cats) {
  const wrap = document.getElementById('catTabs');
  wrap.innerHTML = cats.map((c, i) =>
    `<button class="cat-tab ${i === 0 ? 'active' : ''}" data-cat="${c}">Cat. ${c}</button>`
  ).join('');

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

    // Scroll al bloque si es una jornada específica
    if (currentJornada !== 'todas') {
      const el = document.getElementById(`jornada-${currentJornada}`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CARGA DE DATOS
// ═══════════════════════════════════════════════════════════
async function loadAll() {
  const loader = document.getElementById('loader');
  const empty = document.getElementById('emptyState');

  try {
    const [resEq, resFix] = await Promise.all([
      fetch(`${URL_EQUIPOS}&t=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${URL_FIXTURE}&t=${Date.now()}`, { cache: 'no-store' }),
    ]);
    if (!resEq.ok) throw new Error('No se pudo cargar equipos');
    if (!resFix.ok) throw new Error('No se pudo cargar fixture');

    G.equipos = parseEquipos(parseCsv(await resEq.text()));
    G.fixture = parseFixture(parseCsv(await resFix.text()));

    // Categorías con al menos un partido
    const catsConPartidos = [...new Set(G.fixture.map(m => m.cat).filter(Boolean))].sort((a, b) => a - b);
    if (catsConPartidos.length === 0) throw new Error('No hay partidos en el fixture');

    currentCat = catsConPartidos[0];
    buildCatTabs(catsConPartidos);
    buildJornadaPills();

    loader.hidden = true;
    renderFixture();

  } catch (err) {
    loader.hidden = true;
    empty.hidden = false;
    document.querySelector('#emptyState .empty-sub').textContent = err.message;
    console.error('[Fixture]', err);
  }
}

document.addEventListener('DOMContentLoaded', loadAll);
