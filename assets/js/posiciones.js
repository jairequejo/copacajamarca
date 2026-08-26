import { supabase } from './supabase.js';

let equipos = {}, standings = {}, standingsByGrupo = {}, grupoMap = {}, activeCat = '';
const el = id => document.getElementById(id);

function buildStandings(rows) {
  standings = {};
  standingsByGrupo = {};
  equipos = {}; 

  rows.forEach(r => {
    const cat = r.categoria;
    const grp = r.grupo;
    const mapped = {
      eq: r.equipo, logo: r.logo_url, pj: r.pj, pg: r.pg, pe: r.pe, pp: r.pp, gf: r.gf, gc: r.gc, dg: r.dg, pts: r.pts
    };
    if (r.logo_url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = r.logo_url;
      mapped.logoImgObj = img;
    }

    if (!equipos[cat]) equipos[cat] = new Set();
    equipos[cat].add(r.equipo);

    if (!standings[cat]) standings[cat] = [];
    standings[cat].push(mapped);

    if (grp) {
      if (!standingsByGrupo[cat]) standingsByGrupo[cat] = {};
      if (!standingsByGrupo[cat][grp]) standingsByGrupo[cat][grp] = [];
      standingsByGrupo[cat][grp].push(mapped);
    }
  });

  Object.keys(standings).forEach(cat => {
    if (standingsByGrupo[cat] && Object.keys(standingsByGrupo[cat]).length < 2) {
      delete standingsByGrupo[cat];
    }
    
    standings[cat].sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.eq.localeCompare(b.eq));
    if (standingsByGrupo[cat]) {
      Object.keys(standingsByGrupo[cat]).forEach(g => {
        standingsByGrupo[cat][g].sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.eq.localeCompare(b.eq));
      });
    }
  });
}
function getStandingTabs() {
  const tabs = [];
  Object.keys(equipos).sort((a, b) => a.localeCompare(b)).forEach(c => {
    if (standingsByGrupo[c]) {
      Object.keys(standingsByGrupo[c]).sort().forEach(g => {
        tabs.push({ id: c + '_' + g, label: 'Cat. ' + c + ' GRP ' + g, cat: c, grupo: g, rows: standingsByGrupo[c][g] });
      });
    } else {
      tabs.push({ id: c, label: 'Cat. ' + c, cat: c, grupo: null, rows: standings[c] });
    }
  });
  return tabs;
}
function renderAll() {
  const tabs = getStandingTabs();
  if (!tabs.length) return;
  if (!tabs.some(t => t.id === activeCat)) activeCat = tabs[0].id;
  
  el('catFilterBar').innerHTML = tabs.map(t => `<button class="cat-btn${activeCat === t.id ? ' active' : ''}" data-cat="${t.id}">${t.label}</button>`).join('');
  el('catFilterWrap').hidden = false;
  
  const activeTab = tabs.find(t => t.id === activeCat);
  renderCat(activeTab.cat, activeTab.grupo);
}
// Helper: genera el HTML de una tabla de standings
function buildTableHTML(rows, cat) {
  const maxPts = rows[0]?.pts || 1;
  let h = `<div class="table-scroll-wrap"><table class="pos-table">`;
  h += `<thead><tr>`;
  h += `<th class="col-pos">#</th>`;
  h += `<th class="col-team">Equipo</th>`;
  h += `<th class="col-pj">PJ</th>`;
  h += `<th class="col-g">G</th>`;
  h += `<th class="col-e">E</th>`;
  h += `<th class="col-p">P</th>`;
  h += `<th class="col-gf">GF</th>`;
  h += `<th class="col-gc">GC</th>`;
  h += `<th class="col-dg">DG</th>`;
  h += `<th class="col-pts">PTS</th>`;
  h += `</tr></thead><tbody>`;
  rows.forEach((r, i) => {
    const pc = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'pn';
    const zc = i === 0 ? 'zone-1' : i === 1 ? 'zone-2' : i === 2 ? 'zone-3' : '';
    const dg = r.dg > 0 ? `+${r.dg}` : `${r.dg}`;
    const dgClass = r.dg > 0 ? 'dg-pos' : r.dg < 0 ? 'dg-neg' : '';
    h += `<tr class="${zc}">`;
    h += `<td class="col-pos"><span class="pos-badge ${pc}">${i + 1}</span></td>`;
    h += `<td class="col-team"><div class="team-name-pos">${r.eq}</div></td>`;
    h += `<td class="col-pj">${r.pj}</td>`;
    h += `<td class="col-g st-g">${r.pg}</td>`;
    h += `<td class="col-e st-e">${r.pe}</td>`;
    h += `<td class="col-p st-p">${r.pp}</td>`;
    h += `<td class="col-gf">${r.gf}</td>`;
    h += `<td class="col-gc">${r.gc}</td>`;
    h += `<td class="col-dg ${dgClass}">${dg}</td>`;
    h += `<td class="col-pts"><span class="pos-pts">${r.pts}</span></td>`;
    h += `</tr>`;
  });
  h += `</tbody></table></div>`;
  return h;
}
function renderCat(cat, grupoId) {
  let h = `<div class="cat-section">`;
  
  if (grupoId && standingsByGrupo[cat] && standingsByGrupo[cat][grupoId]) {
    // ── TABLA DE UN GRUPO ESPECÍFICO ──
    const rows = standingsByGrupo[cat][grupoId];
    const leader = rows[0];
    h += `<div class="cat-card">`;
    h += `<div class="cat-head"><div class="cat-head-left"><div class="cat-badge">Cat. ${cat} - GRUPO ${grupoId}</div><div class="cat-count">${rows.length} equipos</div></div></div>`;
    
    if (leader) h += `<div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:12px;"><div style="font-family:'Barlow Condensed',sans-serif;font-size:.85rem;font-weight:700;color:rgba(255,255,255,.55);">★ LÍDER: ${leader.eq} · ${leader.pts} pts</div></div>`;
    h += buildTableHTML(rows, cat);
    h += `</div>`;
  } else {
    // ── CATEGORÍA NORMAL (Sin grupos) ──
    const rows = standings[cat] || [];
    h += `<div class="cat-card">`;
    h += `<div class="cat-head"><div class="cat-head-left"><div class="cat-badge">Cat. ${cat}</div><div class="cat-count">${rows.length} equipos</div></div></div>`;
    h += buildTableHTML(rows, cat);
    h += `</div>`;
  }
  
  h += `</div>`;
  el('standingsContainer').innerHTML = h;
}
function setCat(id, btn) { 
  activeCat = id; 
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); 
  btn.classList.add('active'); 
  renderAll(); // Re-render everything to easily map the new activeCat
}
// Expose setCat globally for delegation via catFilterBar click
document.addEventListener('DOMContentLoaded', () => {
  const bar = el('catFilterBar');
  if (bar) {
    bar.addEventListener('click', e => {
      const btn = e.target.closest('.cat-btn');
      if (btn) setCat(btn.dataset.cat, btn);
    });
  }
});

const _logo = new Image(); _logo.src = '../assets/img/logo.png'; _logo.crossOrigin = 'anonymous';
const _bgPos = new Image(); _bgPos.src = '../assets/img/fondo-posiciones-pro.png'; _bgPos.crossOrigin = 'anonymous';
function fit(ctx, txt, maxW, base, wt) { let s = base; while (s > 8) { ctx.font = `${wt} ${s}px "Barlow Condensed",sans-serif`; if (ctx.measureText(txt).width <= maxW) break; s--; } return s; }
function pill(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

function drawImageCover(ctx, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale, sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function drawImageContain(ctx, image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawTeamMark(ctx, row, x, y, size) {
  if (row.logoImgObj && row.logoImgObj.complete && row.logoImgObj.naturalWidth > 0) {
    drawImageContain(ctx, row.logoImgObj, x, y, size, size);
    return;
  }
  const initials = row.eq.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const mark = ctx.createLinearGradient(x, y, x + size, y + size);
  mark.addColorStop(0, '#123b8f');
  mark.addColorStop(1, '#0047ff');
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = mark;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,0,.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 ' + Math.max(14, size * .36) + 'px "Barlow Condensed",sans-serif';
  ctx.fillText(initials || 'CC', x + size / 2, y + size / 2 + 1);
}

function drawExportBackground(ctx, width, height) {
  if (_bgPos.complete && _bgPos.naturalWidth > 0) {
    drawImageCover(ctx, _bgPos, width, height);
  } else {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, '#020617');
    base.addColorStop(.52, '#050b24');
    base.addColorStop(1, '#001a4d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
  }

  // Conserva las luces y gradas del estadio, pero protege la lectura en el centro.
  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, 'rgba(2,6,23,.42)');
  veil.addColorStop(.26, 'rgba(5,11,36,.68)');
  veil.addColorStop(.76, 'rgba(2,12,38,.52)');
  veil.addColorStop(1, 'rgba(1,7,24,.28)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);

  const centerShade = ctx.createLinearGradient(0, 0, width, 0);
  centerShade.addColorStop(0, 'rgba(1,6,22,.08)');
  centerShade.addColorStop(.18, 'rgba(1,6,22,.28)');
  centerShade.addColorStop(.5, 'rgba(1,6,22,.48)');
  centerShade.addColorStop(.82, 'rgba(1,6,22,.28)');
  centerShade.addColorStop(1, 'rgba(1,6,22,.08)');
  ctx.fillStyle = centerShade;
  ctx.fillRect(0, 0, width, height);

  const broadcastGlow = ctx.createRadialGradient(width * .5, 210, 20, width * .5, 210, 620);
  broadcastGlow.addColorStop(0, 'rgba(0,71,255,.15)');
  broadcastGlow.addColorStop(.55, 'rgba(0,71,255,.04)');
  broadcastGlow.addColorStop(1, 'rgba(0,71,255,0)');
  ctx.fillStyle = broadcastGlow;
  ctx.fillRect(0, 0, width, 720);

  ctx.save();
  ctx.globalAlpha = .07;
  ctx.fillStyle = '#20a4ff';
  [[720, -40, 900, -40, 540, 560, 360, 560], [930, -40, 1080, -40, 710, 560, 560, 560]].forEach(points => {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  // Microtrama solo en la cabecera: detalle editorial sin ensuciar la tabla.
  ctx.fillStyle = 'rgba(255,255,255,.045)';
  for (let y = 36; y < 410; y += 34) {
    for (let x = 28; x < width; x += 34) ctx.fillRect(x, y, 2, 2);
  }
}

function getFileSlug(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getExportName(item) {
  const group = item.grupo ? '-Grupo-' + getFileSlug(item.grupo) : '';
  return 'Tabla-Posiciones-Cat-' + getFileSlug(item.cat) + group + '.png';
}

function waitForImage(image) {
  if (image.complete) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => resolve();
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
    setTimeout(done, 3000);
  });
}

async function waitForExportAssets() {
  const teamLogos = Object.values(standings).flat()
    .map(row => row.logoImgObj)
    .filter(Boolean)
    .map(waitForImage);
  const fontTimeout = new Promise(resolve => setTimeout(resolve, 3000));
  const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, fontTimeout]) : Promise.resolve();
  await Promise.all([waitForImage(_logo), waitForImage(_bgPos), fonts, ...teamLogos]);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.')), 'image/png');
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function generateCanvasForStanding(item) {
  const rows = item.rows || [];
  if (!rows.length) return null;

  const WIDTH = 1080, TABLE_Y = 430, TABLE_HEAD_H = 62, FOOTER_H = 104;
  const ROW_H = rows.length <= 8 ? 82 : rows.length <= 10 ? 70 : rows.length <= 13 ? 58 : 54;
  const HEIGHT = Math.max(1350, TABLE_Y + TABLE_HEAD_H + rows.length * ROW_H + FOOTER_H + 42);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const ELECTRIC = '#0047ff', NAVY = '#050b24', GOLD = '#ffc400', WHITE = '#ffffff';
  const OFF_WHITE = '#eef4ff', RED = '#e60000', GREEN = '#36e38a', ORANGE = '#ff9b52', CORAL = '#ff6b72';

  drawExportBackground(ctx, WIDTH, HEIGHT);

  const topLine = ctx.createLinearGradient(0, 0, WIDTH, 0);
  topLine.addColorStop(0, GOLD);
  topLine.addColorStop(.72, '#ffe16b');
  topLine.addColorStop(1, RED);
  ctx.fillStyle = topLine;
  ctx.fillRect(0, 0, WIDTH, 12);

  // El escudo es circular: halo, placa y recorte comparten la misma geometría.
  const logoCenterX = 130, logoCenterY = 188, logoRadius = 100;
  ctx.save();
  const logoGlow = ctx.createRadialGradient(logoCenterX, logoCenterY, 34, logoCenterX, logoCenterY, logoRadius + 28);
  logoGlow.addColorStop(0, 'rgba(0,71,255,.34)');
  logoGlow.addColorStop(.7, 'rgba(0,71,255,.1)');
  logoGlow.addColorStop(1, 'rgba(0,71,255,0)');
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, logoRadius + 28, 0, Math.PI * 2);
  ctx.fillStyle = logoGlow;
  ctx.fill();

  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2,8,28,.86)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, logoRadius + 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(47,138,255,.48)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (_logo.complete && _logo.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCenterX, logoCenterY, logoRadius - 7, 0, Math.PI * 2);
    ctx.clip();
    drawImageContain(ctx, _logo, logoCenterX - logoRadius + 7, logoCenterY - logoRadius + 7, (logoRadius - 7) * 2, (logoRadius - 7) * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 64px "Barlow Condensed",sans-serif';
    ctx.fillText('CC', logoCenterX, logoCenterY);
  }
  ctx.restore();

  const titleX = 252;
  pill(ctx, titleX, 67, 246, 38, 7);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 800 21px "Barlow Condensed",sans-serif';
  ctx.fillText('CLASIFICACIÓN OFICIAL', titleX + 16, 87);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '700 22px "Barlow Condensed",sans-serif';
  ctx.fillText('CAMPEONATO DE MENORES', titleX, 129);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = WHITE;
  ctx.textBaseline = 'top';
  ctx.font = 'italic 900 69px "Barlow Condensed",sans-serif';
  ctx.fillText('TABLA DE', titleX, 145);
  const titleSize = fit(ctx, 'POSICIONES', WIDTH - titleX - 34, 105, 'italic 900');
  ctx.fillStyle = GOLD;
  ctx.font = 'italic 900 ' + titleSize + 'px "Barlow Condensed",sans-serif';
  ctx.fillText('POSICIONES', titleX, 204);
  ctx.restore();

  // Cabecera compacta de la tabla, igual a la referencia compartida.
  const infoX = 40, infoY = 332, infoW = WIDTH - 80, infoH = 74, splitX = 586;
  const infoGradient = ctx.createLinearGradient(infoX, infoY, infoX + infoW, infoY);
  infoGradient.addColorStop(0, 'rgba(10,43,103,.96)');
  infoGradient.addColorStop(.55, 'rgba(4,22,56,.96)');
  infoGradient.addColorStop(1, 'rgba(2,12,34,.98)');
  pill(ctx, infoX, infoY, infoW, infoH, 12);
  ctx.fillStyle = infoGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(64,132,255,.72)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fillRect(infoX, infoY, 7, infoH);
  ctx.fillStyle = ELECTRIC;
  ctx.fillRect(infoX + 7, infoY, 150, 4);
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(splitX, infoY + 14);
  ctx.lineTo(splitX, infoY + infoH - 14);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(174,207,255,.68)';
  ctx.font = '800 16px "Barlow Condensed",sans-serif';
  ctx.fillText('DIVISIÓN DEL CAMPEONATO', infoX + 28, infoY + 21);
  const categoryText = 'CATEGORÍA ' + item.cat;
  ctx.fillStyle = WHITE;
  ctx.font = 'italic 900 34px "Barlow Condensed",sans-serif';
  const categoryWidth = ctx.measureText(categoryText).width;
  ctx.fillText(categoryText, infoX + 28, infoY + 51);
  if (item.grupo) {
    ctx.font = '800 18px "Barlow Condensed",sans-serif';
    const groupText = 'GRUPO ' + item.grupo;
    const groupX = infoX + 28 + categoryWidth + 20;
    pill(ctx, groupX, infoY + 35, 104, 30, 15);
    ctx.fillStyle = 'rgba(255,196,0,.13)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,0,.5)';
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(groupText, groupX + 52, infoY + 51);
  }

  const leader = rows[0];
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = '800 16px "Barlow Condensed",sans-serif';
  ctx.fillText('LÍDER ACTUAL', splitX + 28, infoY + 21);
  const pointsW = 76, pointsX = infoX + infoW - pointsW - 18;
  const leaderSize = fit(ctx, leader.eq, pointsX - splitX - 48, 29, '800');
  ctx.fillStyle = WHITE;
  ctx.font = '800 ' + leaderSize + 'px "Barlow Condensed",sans-serif';
  ctx.fillText(leader.eq, splitX + 28, infoY + 52);
  pill(ctx, pointsX, infoY + 17, pointsW, 42, 21);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'center';
  ctx.font = '900 23px "Barlow Condensed",sans-serif';
  ctx.fillText(leader.pts + ' PTS', pointsX + pointsW / 2, infoY + 39);

  const TABLE_X = 40, TABLE_W = 1000;
  const widths = [64, 392, 64, 64, 64, 64, 64, 64, 72, 88];
  const labels = ['#', 'EQUIPO', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'PTS'];
  const columns = [];
  let cursor = TABLE_X;
  widths.forEach((width, index) => {
    columns.push({ x: cursor, w: width, label: labels[index] });
    cursor += width;
  });

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  pill(ctx, TABLE_X, TABLE_Y, TABLE_W, TABLE_HEAD_H + rows.length * ROW_H, 12);
  ctx.fillStyle = 'rgba(1,8,29,.93)';
  ctx.fill();
  ctx.restore();

  const headerGradient = ctx.createLinearGradient(TABLE_X, TABLE_Y, TABLE_X + TABLE_W, TABLE_Y);
  headerGradient.addColorStop(0, ELECTRIC);
  headerGradient.addColorStop(.62, '#063891');
  headerGradient.addColorStop(1, '#07183e');
  ctx.save();
  pill(ctx, TABLE_X, TABLE_Y, TABLE_W, TABLE_HEAD_H, 12);
  ctx.clip();
  ctx.fillStyle = headerGradient;
  ctx.fillRect(TABLE_X, TABLE_Y, TABLE_W, TABLE_HEAD_H + 14);
  ctx.restore();
  ctx.fillStyle = ELECTRIC;
  ctx.fillRect(TABLE_X, TABLE_Y, TABLE_W, 5);
  ctx.fillStyle = GOLD;
  ctx.font = '800 21px "Barlow Condensed",sans-serif';
  ctx.textBaseline = 'middle';
  columns.forEach(column => {
    ctx.textAlign = column.label === 'EQUIPO' ? 'left' : 'center';
    ctx.fillText(column.label, column.label === 'EQUIPO' ? column.x + 20 : column.x + column.w / 2, TABLE_Y + TABLE_HEAD_H / 2 + 1);
  });

  rows.forEach((row, index) => {
    const rowY = TABLE_Y + TABLE_HEAD_H + index * ROW_H;
    const centerY = rowY + ROW_H / 2;
    const isLeader = index === 0;
    ctx.fillStyle = isLeader ? 'rgba(255,196,0,.16)' : index % 2 === 0 ? 'rgba(9,37,84,.9)' : 'rgba(3,17,43,.9)';
    ctx.fillRect(TABLE_X, rowY, TABLE_W, ROW_H);
    ctx.fillStyle = isLeader ? GOLD : index === 1 ? '#cbd5e1' : index === 2 ? '#d69358' : 'rgba(0,126,255,.42)';
    ctx.fillRect(TABLE_X, rowY, isLeader ? 7 : 3, ROW_H);
    ctx.strokeStyle = 'rgba(151,192,255,.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TABLE_X, rowY + ROW_H);
    ctx.lineTo(TABLE_X + TABLE_W, rowY + ROW_H);
    ctx.stroke();

    const rankX = columns[0].x + columns[0].w / 2;
    if (index < 3) {
      ctx.beginPath();
      ctx.arc(rankX, centerY, Math.min(22, ROW_H * .3), 0, Math.PI * 2);
      ctx.fillStyle = isLeader ? GOLD : index === 1 ? '#dce4ef' : '#d69358';
      ctx.fill();
      ctx.fillStyle = isLeader ? NAVY : '#24324a';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.62)';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 ' + Math.min(26, ROW_H * .4) + 'px "Barlow Condensed",sans-serif';
    ctx.fillText(index + 1, rankX, centerY + 1);

    const teamLogoSize = Math.min(48, ROW_H * .64);
    const markX = columns[1].x + 18, markY = centerY - teamLogoSize / 2;
    pill(ctx, markX - 5, markY - 5, teamLogoSize + 10, teamLogoSize + 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.stroke();
    drawTeamMark(ctx, row, markX, markY, teamLogoSize);
    const teamX = columns[1].x + 18 + teamLogoSize + 15;
    const teamSize = fit(ctx, row.eq, columns[1].x + columns[1].w - teamX - 14, Math.min(30, ROW_H * .42), isLeader ? '900' : '700');
    ctx.fillStyle = isLeader ? GOLD : OFF_WHITE;
    ctx.textAlign = 'left';
    ctx.font = (isLeader ? '900 ' : '700 ') + teamSize + 'px "Barlow Condensed",sans-serif';
    ctx.fillText(row.eq, teamX, centerY + 1);

    const goalDifference = row.dg > 0 ? '+' + row.dg : String(row.dg);
    const values = [row.pj, row.pg, row.pe, row.pp, row.gf, row.gc, goalDifference];
    values.forEach((value, valueIndex) => {
      const column = columns[valueIndex + 2];
      const colors = [OFF_WHITE, GREEN, ORANGE, CORAL, OFF_WHITE, OFF_WHITE, row.dg > 0 ? GREEN : row.dg < 0 ? CORAL : 'rgba(255,255,255,.62)'];
      ctx.fillStyle = colors[valueIndex];
      ctx.textAlign = 'center';
      ctx.font = (valueIndex === 1 || valueIndex === 6 ? '800 ' : '700 ') + Math.min(27, ROW_H * .4) + 'px "Barlow Condensed",sans-serif';
      ctx.fillText(value, column.x + column.w / 2, centerY + 1);
    });

    const pointsColumn = columns[9], pointsWidth = 58, pointsHeight = Math.min(42, ROW_H * .58);
    pill(ctx, pointsColumn.x + (pointsColumn.w - pointsWidth) / 2, centerY - pointsHeight / 2, pointsWidth, pointsHeight, pointsHeight / 2);
    ctx.fillStyle = isLeader ? GOLD : 'rgba(0,71,255,.84)';
    ctx.fill();
    ctx.strokeStyle = isLeader ? GOLD : 'rgba(79,152,255,.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = isLeader ? NAVY : WHITE;
    ctx.textAlign = 'center';
    ctx.font = '900 ' + Math.min(29, ROW_H * .42) + 'px "Barlow Condensed",sans-serif';
    ctx.fillText(row.pts, pointsColumn.x + pointsColumn.w / 2, centerY + 1);
  });

  columns.slice(2).forEach(column => {
    ctx.strokeStyle = 'rgba(118,173,255,.1)';
    ctx.beginPath();
    ctx.moveTo(column.x, TABLE_Y + 14);
    ctx.lineTo(column.x, TABLE_Y + TABLE_HEAD_H + rows.length * ROW_H - 14);
    ctx.stroke();
  });
  pill(ctx, TABLE_X, TABLE_Y, TABLE_W, TABLE_HEAD_H + rows.length * ROW_H, 12);
  ctx.strokeStyle = 'rgba(126,178,255,.48)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const footerY = HEIGHT - FOOTER_H;
  ctx.fillStyle = 'rgba(2,6,23,.94)';
  ctx.fillRect(0, footerY, WIDTH, FOOTER_H);
  ctx.fillStyle = ELECTRIC;
  ctx.fillRect(0, footerY, WIDTH, 4);
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 27px "Barlow Condensed",sans-serif';
  ctx.fillText('COPA CAJAMARCA', 40, footerY + 39);
  ctx.fillStyle = GOLD;
  ctx.font = '700 16px "Barlow Condensed",sans-serif';
  ctx.fillText('COMPETENCIA  ·  TALENTO  ·  FÚTBOL BASE', 40, footerY + 68);

  const now = new Date();
  const issued = now.toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('.', '').toUpperCase();
  ctx.textAlign = 'right';
  ctx.fillStyle = WHITE;
  ctx.font = '700 18px "Barlow Condensed",sans-serif';
  ctx.fillText('copacajamarca.com', WIDTH - 40, footerY + 38);
  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.font = '600 15px "Barlow Condensed",sans-serif';
  ctx.fillText('ACTUALIZADO · ' + issued, WIDTH - 40, footerY + 68);

  return canvas;
}

async function downloadPNG() {
  const item = getStandingTabs().find(tab => tab.id === activeCat);
  if (!item || !item.rows.length) { showToast('No hay datos'); return; }
  const btn = el('btnDownload');
  const originalContent = btn.innerHTML;
  btn.classList.add('loading'); btn.innerHTML = '<span class="spin"></span> Diseñando banner…';
  await new Promise(r => setTimeout(r, 50));
  try {
    await waitForExportAssets();
    const cv = await generateCanvasForStanding(item);
    if (cv) {
      downloadBlob(await canvasToBlob(cv), getExportName(item));
      showToast('¡Banner PNG descargado!');
    }
  } catch (err) { console.error(err); showToast('Error: ' + err.message); }
  finally {
    btn.classList.remove('loading');
    btn.innerHTML = originalContent;
  }
}

async function downloadAllPNGs() {
  const items = getStandingTabs().filter(item => item.rows.length > 0);
  if (!items.length) { showToast('No hay datos'); return; }
  const btn = el('btnDownloadAll');
  const originalContent = btn.innerHTML;
  btn.classList.add('loading'); btn.innerHTML = '<span class="spin"></span> Preparando banners…';
  await new Promise(r => setTimeout(r, 50));
  try {
    await waitForExportAssets();
    const zip = new JSZip();
    let count = 0;
    for (const [index, item] of items.entries()) {
      btn.innerHTML = '<span class="spin"></span> Banner ' + (index + 1) + ' de ' + items.length + '…';
      const cv = await generateCanvasForStanding(item);
      if (cv) {
        zip.file(getExportName(item), await canvasToBlob(cv));
        count++;
      }
    }
    if (count > 0) {
      btn.innerHTML = '<span class="spin"></span> Comprimiendo ZIP…';
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(content, 'Banners-Posiciones-' + date + '.zip');
      showToast('¡ZIP con ' + count + ' banners descargado!');
    } else {
      showToast('No se generó ninguna imagen.');
    }
  } catch (err) { console.error(err); showToast('Error: ' + err.message); }
  finally {
    btn.classList.remove('loading');
    btn.innerHTML = originalContent;
  }
}

function showToast(msg) { const t = el('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

async function loadAll() {
  el('posLoader').style.display = 'flex'; el('posError').classList.add('hidden'); el('posContent').classList.add('hidden'); el('catFilterWrap').hidden = true;
  try {
    el('loaderText').textContent = 'Cargando datos...';
    
    const { data: rows, error } = await supabase.from('view_posiciones').select('*');
    if (error) throw error;
    if (!rows || !rows.length) throw new Error('SIN_DATOS');
    
    buildStandings(rows); 
    renderAll();
    
    const now = new Date(), upd = el('lastUpdated');
    upd.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`; upd.classList.remove('hidden');
    el('posContent').classList.remove('hidden');
  } catch (err) {
    console.error(err);
    const noData = err.message === 'SIN_DATOS';
    el('errorTitle').textContent = noData ? 'NO DISPONIBLE' : 'ERROR DE CONEXIÓN';
    el('errorMsg').textContent = noData ? 'La información no está disponible en este momento.' : 'Intente nuevamente más tarde.';
    el('posError').classList.remove('hidden');
  }
  finally { el('posLoader').style.display = 'none'; }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  el('btnDownload').addEventListener('click', downloadPNG);
  el('btnDownloadAll').addEventListener('click', downloadAllPNGs);
  // Expose loadAll globally for the retry button onclick="loadAll()"
  window.loadAll = loadAll;
});
