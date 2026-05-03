const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';
const URL_EQUIPOS = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1862807827&single=true&output=csv`;

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

function countUp(el, target, suffix = '', duration = 1100) {
  const start = Date.now();
  const tick = () => {
    const p = Math.min((Date.now() - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function loadStats() {
  try {
    const res = await fetch(`${URL_EQUIPOS}&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const equipos = parseEquipos(parseCsv(await res.text()));
    const totalCats   = Object.keys(equipos).length;
    const totalEquipos = Object.values(equipos).flat().length;
    const elC = document.getElementById('statCats');
    const elE = document.getElementById('statEquipos');
    if (elC && totalCats > 0)    countUp(elC, totalCats);
    if (elE && totalEquipos > 0) countUp(elE, totalEquipos, '+');
  } catch (err) {
    console.error('[Landing]', err);
  }
}

/* Ripple on tap */
function initRipple() {
  document.querySelectorAll('.nav-card').forEach(card => {
    card.addEventListener('pointerdown', e => {
      const r = document.createElement('span');
      const rect = card.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6;
      r.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;
        border-radius:50%;background:rgba(255,255,255,.08);
        transform:translate(-50%,-50%) scale(0);
        left:${e.clientX - rect.left}px;top:${e.clientY - rect.top}px;
        pointer-events:none;z-index:0;
        animation:ripple .55s ease-out forwards;
      `;
      card.style.position = 'relative';
      card.appendChild(r);
      setTimeout(() => r.remove(), 600);
    });
  });

  if (!document.getElementById('ripple-style')) {
    const s = document.createElement('style');
    s.id = 'ripple-style';
    s.textContent = '@keyframes ripple{to{transform:translate(-50%,-50%) scale(1);opacity:0}}';
    document.head.appendChild(s);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  initRipple();
});
