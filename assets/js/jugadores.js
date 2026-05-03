// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN
// Actualiza GID_JUGADORES con el ID de la hoja "Jugadores"
// en el mismo spreadsheet (ver la URL del sheet: ...#gid=XXXXX)
//
// Columnas esperadas en el sheet:
//   NOMBRE | EQUIPO | CATEGORIA | POSICION | NUMERO | FOTO
// ═══════════════════════════════════════════════════════════
const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';
const GID_JUGADORES = '0'; // ← CAMBIAR al GID de tu hoja de jugadores

const URL_JUGADORES = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=${GID_JUGADORES}&single=true&output=csv`;

// ═══════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════
let allPlayers = [];
let currentCat = 'todos';
let currentSearch = '';

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

function parseJugadores(rows) {
  if (rows.length < 2) return [];
  const hdr = rows[0].map(h => h.trim().toUpperCase());

  const idx = key => hdr.findIndex(h => h.includes(key));
  const I = {
    nombre: Math.max(idx('NOMBRE'), idx('JUGADOR')),
    equipo: idx('EQUIPO'),
    cat: Math.max(idx('CATEG'), idx('CAT')),
    posicion: Math.max(idx('POSIC'), idx('POS')),
    numero: Math.max(idx('NUMER'), idx('#')),
    foto: Math.max(idx('FOTO'), idx('IMAGE'), idx('URL')),
  };

  return rows.slice(1).map(row => {
    const nombre = (row[I.nombre] || '').trim();
    if (!nombre) return null;
    return {
      nombre,
      equipo: (I.equipo >= 0 ? row[I.equipo] : '').trim().toUpperCase(),
      cat: (I.cat >= 0 ? row[I.cat] : '').trim(),
      posicion: (I.posicion >= 0 ? row[I.posicion] : '').trim(),
      numero: (I.numero >= 0 ? row[I.numero] : '').trim(),
      foto: (I.foto >= 0 ? row[I.foto] : '').trim(),
    };
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function getInitials(nombre) {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
}

const POS_STYLES = {
  'PORTERO': { bg: '#fee2e2', color: '#991b1b' },
  'DEFENSA': { bg: '#dbeafe', color: '#1e40af' },
  'LATERAL': { bg: '#dbeafe', color: '#1e40af' },
  'MEDIOCAMPISTA': { bg: '#fef9c3', color: '#713f12' },
  'CENTROCAMPISTA': { bg: '#fef9c3', color: '#713f12' },
  'MEDIO': { bg: '#fef9c3', color: '#713f12' },
  'DELANTERO': { bg: '#dcfce7', color: '#14532d' },
  'ATACANTE': { bg: '#dcfce7', color: '#14532d' },
};

function getPosStyle(pos) {
  const k = pos.toUpperCase();
  for (const [key, val] of Object.entries(POS_STYLES)) {
    if (k.includes(key)) return val;
  }
  return { bg: '#f1f5f9', color: '#334155' };
}

function renderCard(p) {
  const initials = getInitials(p.nombre);
  const ps = getPosStyle(p.posicion);

  const photoInner = p.foto
    ? `<img src="${p.foto}" alt="${p.nombre}" loading="lazy"
           onerror="this.parentElement.innerHTML='<span class=\\'initials\\'>${initials}</span>'" />`
    : `<span class="initials">${initials}</span>`;

  const numBadge = p.numero
    ? `<span class="num-badge">#${p.numero}</span>` : '';

  const catTag = p.cat
    ? `<span class="cat-tag">Cat. ${p.cat}</span>` : '';

  const posTag = p.posicion
    ? `<span class="pos-tag" style="background:${ps.bg};color:${ps.color}">${p.posicion}</span>` : '';

  return `
    <div class="player-card">
      <div class="player-photo-area">
        <div class="player-photo">${photoInner}</div>
        ${numBadge}
      </div>
      <div class="player-info">
        <div class="player-name">${p.nombre}</div>
        ${p.equipo ? `<div class="player-team">${p.equipo}</div>` : ''}
        <div class="player-tags">${catTag}${posTag}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// FILTRADO
// ═══════════════════════════════════════════════════════════
function applyFilter() {
  const q = currentSearch.toLowerCase().trim();
  const filtered = allPlayers.filter(p => {
    const matchCat = currentCat === 'todos' || String(p.cat) === String(currentCat);
    const matchQ = !q
      || p.nombre.toLowerCase().includes(q)
      || p.equipo.toLowerCase().includes(q)
      || p.posicion.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const grid = document.getElementById('playerGrid');
  const empty = document.getElementById('emptyState');
  const clearBtn = document.getElementById('btnClearFilter');

  if (filtered.length === 0) {
    grid.hidden = true;
    empty.hidden = false;
    clearBtn.hidden = !(currentSearch || currentCat !== 'todos');
  } else {
    grid.hidden = false;
    empty.hidden = true;
    grid.innerHTML = filtered.map(renderCard).join('');
  }

  const total = allPlayers.length;
  document.getElementById('countText').textContent =
    filtered.length === total
      ? `${total} jugador${total !== 1 ? 'es' : ''}`
      : `${filtered.length} de ${total} jugadores`;
}

function clearFilters() {
  currentSearch = '';
  currentCat = 'todos';
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  document.getElementById('searchClear').hidden = true;
  document.querySelectorAll('.cat-tab').forEach((b, i) => b.classList.toggle('active', i === 0));
  applyFilter();
}

// ═══════════════════════════════════════════════════════════
// TABS DE CATEGORÍA
// ═══════════════════════════════════════════════════════════
function buildCatTabs(players) {
  const cats = [...new Set(players.map(p => p.cat).filter(Boolean))].sort((a, b) => a - b);
  const wrap = document.getElementById('catTabs');
  wrap.innerHTML =
    `<button class="cat-tab active" data-cat="todos">Todos</button>` +
    cats.map(c => `<button class="cat-tab" data-cat="${c}">Cat. ${c}</button>`).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    wrap.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.cat;
    applyFilter();
  });
}

// ═══════════════════════════════════════════════════════════
// CARGA DE DATOS
// ═══════════════════════════════════════════════════════════
async function loadJugadores() {
  const loader = document.getElementById('loader');
  const grid = document.getElementById('playerGrid');
  const empty = document.getElementById('emptyState');

  try {
    const res = await fetch(URL_JUGADORES);
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const text = await res.text();

    allPlayers = parseJugadores(parseCsv(text));

    if (allPlayers.length === 0) {
      throw new Error('La hoja está vacía o el GID_JUGADORES no es correcto. Actualiza la constante en jugadores.js.');
    }

    buildCatTabs(allPlayers);
    loader.hidden = true;
    grid.hidden = false;
    applyFilter();

  } catch (err) {
    loader.hidden = true;
    empty.hidden = false;
    document.getElementById('emptyMsg').textContent = err.message;
    document.getElementById('countText').textContent = 'Error al cargar';
    console.error('[Jugadores]', err);
  }
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadJugadores();

  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');

  input.addEventListener('input', () => {
    currentSearch = input.value;
    clearBtn.hidden = !input.value;
    applyFilter();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    currentSearch = '';
    clearBtn.hidden = true;
    applyFilter();
  });

  document.getElementById('btnClearFilter').addEventListener('click', clearFilters);
});
