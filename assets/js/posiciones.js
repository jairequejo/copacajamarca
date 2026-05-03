const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';
const URL_EQ = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1862807827&single=true&output=csv`;
const URL_FIX = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1171502194&single=true&output=csv`;
let equipos = {}, standings = {}, activeCat = '';
const el = id => document.getElementById(id);
function parseCsv(t) { const rows = []; for (const ln of t.replace(/\r/g, '\n').split('\n')) { if (!ln.trim()) continue; const cols = []; let c = '', q = false; for (let i = 0; i < ln.length; i++) { const ch = ln[i]; if (ch === '"') { if (q && ln[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { cols.push(c.trim()); c = ''; } else c += ch; } cols.push(c.trim()); rows.push(cols); } return rows; }
function parseEquipos(rows) { if (!rows.length) return {}; const h = rows[0], cats = {}; for (let c = 1; c < h.length; c++) { const y = h[c].trim(); if (y && !isNaN(y)) cats[y] = []; } for (let r = 1; r < rows.length; r++) { const t = (rows[r][0] || '').trim().toUpperCase(); if (!t) continue; for (let c = 1; c < h.length; c++) { const y = h[c].trim(), v = (rows[r][c] || '').trim(); if (cats[y] && (v === '1' || v.toLowerCase() === 'x' || v === '✓')) cats[y].push(t); } } Object.keys(cats).forEach(k => { if (!cats[k].length) delete cats[k]; }); return cats; }
function parseFixture(rows) { if (!rows.length) return []; const h = rows[0].map(x => x.trim().toUpperCase()); const col = k => h.findIndex(x => x.includes(k)), exact = k => h.findIndex(x => x === k); const I = { cat: col('CATEG'), lo: exact('LOCAL'), vi: col('VISITANTE'), gl: h.findIndex(x => x.includes('GOLES') && x.includes('LOCAL')), gv: h.findIndex(x => x.includes('GOLES') && x.includes('VISITANTE')), res: col('RESULTADO') }; const out = []; for (let r = 1; r < rows.length; r++) { const row = rows[r]; if (!row[0]) continue; const lo = (row[I.lo] || '').trim().toUpperCase(), vi = (row[I.vi] || '').trim().toUpperCase(); if (!lo || !vi) continue; const rl = (row[I.res] || '').toLowerCase(); out.push({ cat: (row[I.cat] || '').trim(), lo, vi, gl: parseInt(row[I.gl] || '', 10), gv: parseInt(row[I.gv] || '', 10), ok: rl !== '' && rl !== 'pendiente' && rl !== '-' }); } return out; }
function buildStandings(loaded) { standings = {}; Object.keys(equipos).sort().forEach(cat => { const m = {}; equipos[cat].forEach(t => m[t] = { eq: t, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }); loaded.filter(x => String(x.cat) === String(cat) && x.ok).forEach(x => { const gl = x.gl, gv = x.gv; if (isNaN(gl) || isNaN(gv)) return; if (!m[x.lo]) m[x.lo] = { eq: x.lo, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }; if (!m[x.vi]) m[x.vi] = { eq: x.vi, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }; const L = m[x.lo], V = m[x.vi]; L.pj++; V.pj++; L.gf += gl; L.gc += gv; V.gf += gv; V.gc += gl; if (gl > gv) { L.pg++; L.pts += 3; V.pp++; } else if (gl < gv) { V.pg++; V.pts += 3; L.pp++; } else { L.pe++; L.pts++; V.pe++; V.pts++; } L.dg = L.gf - L.gc; V.dg = V.gf - V.gc; }); standings[cat] = Object.values(m).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.eq.localeCompare(b.eq)); }); }
function renderAll() { const cats = Object.keys(equipos).sort((a, b) => a - b); if (!cats.length) return; if (!activeCat) activeCat = cats[0]; el('catFilterBar').innerHTML = cats.map(c => `<button class="cat-btn${activeCat === c ? ' active' : ''}" data-cat="${c}" onclick="setCat('${c}',this)">Cat. ${c}</button>`).join(''); el('catFilterWrap').hidden = false; renderCat(activeCat); }
function renderCat(cat) { const rows = standings[cat] || [], mx = rows.reduce((s, r) => Math.max(s, r.pj), 0); let h = `<div class="cat-section"><div class="cat-card"><div class="cat-head"><div class="cat-head-left"><div class="cat-badge">CAT. ${cat}</div><div class="cat-count">⚽ ${rows.length} equipos</div></div><div class="cat-leader">${rows[0]?.eq || ''} · ${rows[0]?.pts || 0} pts</div></div><div style="overflow-x:auto;"><table class="pos-table"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>`; rows.forEach((r, i) => { const pc = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'pn', dg = r.dg > 0 ? `+${r.dg}` : `${r.dg}`, b = mx > 0 ? Math.round((r.pts / (mx * 3)) * 100) : 0; h += `<tr><td><span class="pos-badge ${pc}">${i + 1}</span></td><td><div class="team-name-pos">${r.eq}</div><div class="pts-bar-wrap"><div class="pts-bar" style="width:${b}%"></div></div></td><td>${r.pj}</td><td class="st-g">${r.pg}</td><td class="st-e">${r.pe}</td><td class="st-p">${r.pp}</td><td>${r.gf}</td><td>${r.gc}</td><td class="${r.dg > 0 ? 'dg-pos' : r.dg < 0 ? 'dg-neg' : ''}">${dg}</td><td><span class="pos-pts">${r.pts}</span></td></tr>`; }); h += `</tbody></table></div></div></div>`; el('standingsContainer').innerHTML = h; }
function setCat(cat, btn) { activeCat = cat; document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderCat(cat); }

const _logo = new Image(); _logo.src = '../assets/img/logo.png'; _logo.crossOrigin = 'anonymous';
const _bgPos = new Image(); _bgPos.src = '../assets/img/fondo-posiciones.png'; _bgPos.crossOrigin = 'anonymous';
function fit(ctx, txt, maxW, base, wt) { let s = base; while (s > 8) { ctx.font = `${wt} ${s}px "Barlow Condensed",sans-serif`; if (ctx.measureText(txt).width <= maxW) break; s--; } return s; }
function pill(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
function ball(ctx, x, y, r, a) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 5; i++) { const an = Math.PI * 2 * i / 5 - Math.PI / 2; ctx.moveTo(x + Math.cos(an) * r * .3, y + Math.sin(an) * r * .3); ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * .3, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
function jersey(ctx, x, y, w, h, a) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + h * .2); ctx.lineTo(x + w * .3, y + h * .2); ctx.lineTo(x + w / 2, y + h * .35); ctx.lineTo(x + w * .7, y + h * .2); ctx.lineTo(x + w, y + h * .2); ctx.lineTo(x + w, y + h * .5); ctx.lineTo(x + w * .85, y + h * .5); ctx.lineTo(x + w * .85, y + h); ctx.lineTo(x + w * .15, y + h); ctx.lineTo(x + w * .15, y + h * .5); ctx.lineTo(x, y + h * .5); ctx.closePath(); ctx.stroke(); ctx.restore(); }

async function generateCanvasForCat(cat) {
  const rows = standings[cat];
  if (!rows || !rows.length) return null;
  const W = 1080, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const NAVY = '#0d1117', RED = '#b91c1c', RED2 = '#dc2626', GOLD = '#f5c518', GOLD2 = '#c8a012', WHITE = '#fff', OFFWH = '#eef2ff', MUTED = 'rgba(255,255,255,0.38)';

  // FONDO
  if (_bgPos.complete && _bgPos.naturalWidth > 0) {
    ctx.drawImage(_bgPos, 0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a0f1e'); bg.addColorStop(.6, '#111827'); bg.addColorStop(1, '#060c18');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }

  // FRANJA DORADA
  const gG = ctx.createLinearGradient(0, 0, W, 0); gG.addColorStop(0, GOLD2); gG.addColorStop(.5, GOLD); gG.addColorStop(1, GOLD2);
  ctx.fillStyle = gG; ctx.fillRect(0, 0, W, 10);

  // TÍTULO MASIVO
  const TX = 205, TW = W - TX - 20, TY = 18;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
  ctx.fillStyle = WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const ts = fit(ctx, 'TABLA DE POSICIONES', TW, 92, '900');
  ctx.font = `900 ${ts}px "Barlow Condensed",sans-serif`; ctx.fillText('TABLA DE POSICIONES', TX, TY); ctx.restore();

  // FILA 2: CATEGORIA pill rojo + ETAPA APERTURA dorado derecha
  const R2 = TY + ts + 8;
  const catTxt = `CATEGORÍA ${cat}`;
  ctx.font = `italic 800 42px "Barlow Condensed",sans-serif`;
  const cW = ctx.measureText(catTxt).width + 34;
  pill(ctx, TX, R2, cW, 54, 8); ctx.fillStyle = RED; ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(catTxt, TX + 17, R2 + 27);
  ctx.fillStyle = GOLD; ctx.textAlign = 'right'; ctx.font = `italic 800 44px "Barlow Condensed",sans-serif`; ctx.fillText('ETAPA APERTURA', W - 26, R2 + 27);

  // SEPARADOR DEBAJO DEL TEXTO
  const SEP = R2 + 62; ctx.fillStyle = gG; ctx.fillRect(0, SEP, W, 3);

  // LOGO GRANDE IZQUIERDA
  const LR = 82, LX = 104, LY = 122;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 22;
  const lg = ctx.createRadialGradient(LX, LY, 0, LX, LY, LR); lg.addColorStop(0, '#1e3a8a'); lg.addColorStop(1, '#060d1f');
  ctx.beginPath(); ctx.arc(LX, LY, LR, 0, Math.PI * 2); ctx.fillStyle = lg; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = 'rgba(245,197,24,0.28)'; ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(LX, LY, LR * .89, 0, Math.PI * 2); ctx.clip();
  if (_logo.complete && _logo.naturalWidth > 0) { const ls = LR * 2.1; ctx.drawImage(_logo, LX - ls / 2, LY - ls / 2, ls, ls); }
  else { ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${LR * .38}px "Barlow Condensed"`; ctx.fillText('CC', LX, LY); }
  ctx.restore();

  // TABLA (Se baja a Y=295 para asegurar que no se sobreponga con el texto del logo)
  const TY2 = 295, TW2 = 1038, TX2 = (W - TW2) / 2, TH = 48;
  const MAX = Math.min(rows.length, 10);
  const FH_BOT = 72;
  let RH = Math.min(70, Math.floor((H - TY2 - FH_BOT - TH - 16) / MAX)); if (RH < 44) RH = 44;
  const PW = 52, EW = 302, NW = Math.floor((TW2 - PW - EW) / 8);
  let cx = TX2;
  const C = [{ x: cx, w: PW, l: '#' }, { x: cx += PW, w: EW, l: 'EQUIPO' }, { x: cx += EW, w: NW, l: 'PJ' }, { x: cx += NW, w: NW, l: 'PG' }, { x: cx += NW, w: NW, l: 'PE' }, { x: cx += NW, w: NW, l: 'PP' }, { x: cx += NW, w: NW, l: 'GF' }, { x: cx += NW, w: NW, l: 'GC' }, { x: cx += NW, w: NW, l: 'DF' }, { x: cx += NW, w: NW, l: 'Pts' }];

  // header tabla
  const hG = ctx.createLinearGradient(TX2, TY2, TX2 + TW2, TY2); hG.addColorStop(0, '#1a2744'); hG.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = hG; ctx.fillRect(TX2, TY2, TW2, TH);
  ctx.fillStyle = GOLD; ctx.font = `800 20px "Barlow Condensed",sans-serif`; ctx.textBaseline = 'middle';
  C.forEach(c => { ctx.textAlign = c.l === 'EQUIPO' ? 'left' : 'center'; ctx.fillText(c.l, c.l === 'EQUIPO' ? c.x + 14 : c.x + c.w / 2, TY2 + TH / 2); });

  // filas
  const mxPJ = rows.reduce((s, r) => Math.max(s, r.pj), 0);
  rows.slice(0, MAX).forEach((r, i) => {
    const ry = TY2 + TH + i * RH, lead = i === 0;
    ctx.fillStyle = lead ? 'rgba(185,28,28,0.14)' : i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(TX2, ry, TW2, RH);
    if (lead) { ctx.strokeStyle = RED2; ctx.lineWidth = 1.5; ctx.strokeRect(TX2, ry, TW2, RH); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.strokeRect(TX2, ry, TW2, RH); }
    const bc = [RED2, '#94a3b8', '#c97b3a', 'rgba(255,255,255,0.1)'][Math.min(i, 3)];
    ctx.fillStyle = bc; ctx.fillRect(TX2, ry, 4, RH);
    const my = ry + RH / 2, fs = Math.max(15, Math.min(24, RH * .35)); ctx.textBaseline = 'middle';
    ctx.fillStyle = lead ? GOLD : OFFWH; ctx.font = `800 ${fs}px "Barlow Condensed",sans-serif`; ctx.textAlign = 'center'; ctx.fillText(i + 1, C[0].x + C[0].w / 2, my);
    ctx.textAlign = 'left'; const es = fit(ctx, r.eq, EW - 22, fs, '700'); ctx.font = `${lead ? '800' : '700'} ${es}px "Barlow Condensed",sans-serif`; ctx.fillText(r.eq, C[1].x + 14, my);
    const dg = r.dg > 0 ? `+${r.dg}` : `${r.dg}`;
    const st = [r.pj, r.pg, r.pe, r.pp, r.gf, r.gc, dg, r.pts];
    const sc = [OFFWH, '#4ade80', '#fb923c', '#f87171', OFFWH, OFFWH, r.dg > 0 ? '#4ade80' : r.dg < 0 ? '#f87171' : MUTED, lead ? GOLD : '#fde68a'];
    const fw = [600, 700, 600, 600, 600, 600, 600, 800];
    st.forEach((n, ni) => { ctx.fillStyle = sc[ni]; ctx.font = `${fw[ni]} ${ni === 7 ? fs + 3 : fs}px "Barlow Condensed",sans-serif`; ctx.textAlign = 'center'; ctx.fillText(n, C[2 + ni].x + C[2 + ni].w / 2, my); });
  });
  ctx.strokeStyle = 'rgba(245,197,24,0.28)'; ctx.lineWidth = 2; ctx.strokeRect(TX2, TY2, TW2, TH + MAX * RH);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(C[2].x, TY2); ctx.lineTo(C[2].x, TY2 + TH + MAX * RH); ctx.stroke();

  // FOOTER
  const FY = H - FH_BOT;
  ctx.fillStyle = 'rgba(5,8,18,0.95)'; ctx.fillRect(0, FY, W, FH_BOT);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, FY, W, 1);


  // Fecha derecha
  const now = new Date();
  const fecha = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.textAlign = 'right'; ctx.font = `500 16px "Barlow Condensed",sans-serif`;
  ctx.fillText(`Emitido el ${fecha} a las ${hora}`, W - 32, FY + FH_BOT / 2);

  return cv;
}

async function downloadPNG() {
  if (!standings[activeCat] || !standings[activeCat].length) { showToast('No hay datos'); return; }
  const btn = el('btnDownload'); btn.classList.add('loading'); btn.innerHTML = '<span class="spin"></span> Generando…';
  await new Promise(r => setTimeout(r, 50));
  try {
    const w = [
      (!_logo.complete || !_logo.naturalWidth) ? new Promise(res => { _logo.onload = res; _logo.onerror = res; setTimeout(res, 3000); }) : null,
      (!_bgPos.complete || !_bgPos.naturalWidth) ? new Promise(res => { _bgPos.onload = res; _bgPos.onerror = res; setTimeout(res, 3000); }) : null
    ].filter(Boolean);
    if (w.length) await Promise.all(w);
    const cv = await generateCanvasForCat(activeCat);
    if (cv) {
      const lnk = document.createElement('a'); lnk.download = `Posiciones-Cat${activeCat}-${new Date().getTime()}.png`;
      lnk.href = cv.toDataURL('image/png'); lnk.click();
      showToast('¡Imagen descargada!');
    }
  } catch (err) { console.error(err); showToast('Error: ' + err.message); }
  finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar Tabla PNG`;
  }
}

async function downloadAllPNGs() {
  const cats = Object.keys(standings).filter(c => standings[c].length > 0);
  if (!cats.length) { showToast('No hay datos'); return; }
  const btn = el('btnDownloadAll'); btn.classList.add('loading'); btn.innerHTML = '<span class="spin"></span> Generando ZIP…';
  await new Promise(r => setTimeout(r, 50));
  try {
    const w = [
      (!_logo.complete || !_logo.naturalWidth) ? new Promise(res => { _logo.onload = res; _logo.onerror = res; setTimeout(res, 3000); }) : null,
      (!_bgPos.complete || !_bgPos.naturalWidth) ? new Promise(res => { _bgPos.onload = res; _bgPos.onerror = res; setTimeout(res, 3000); }) : null
    ].filter(Boolean);
    if (w.length) await Promise.all(w);
    const zip = new JSZip();
    let count = 0;
    for (const cat of cats) {
      const cv = await generateCanvasForCat(cat);
      if (cv) {
        const dataUrl = cv.toDataURL('image/png');
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        zip.file(`Posiciones-Cat${cat}.png`, base64Data, { base64: true });
        count++;
      }
    }
    if (count > 0) {
      const content = await zip.generateAsync({ type: "blob" });
      const lnk = document.createElement('a'); lnk.download = `Posiciones-Todas-${new Date().getTime()}.zip`;
      lnk.href = URL.createObjectURL(content); lnk.click();
      showToast(`¡ZIP con ${count} tablas descargado!`);
    } else {
      showToast('No se generó ninguna imagen.');
    }
  } catch (err) { console.error(err); showToast('Error: ' + err.message); }
  finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Descargar Todas (ZIP)`;
  }
}

function showToast(msg) { const t = el('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

async function loadAll() {
  el('posLoader').style.display = 'flex'; el('posError').classList.add('hidden'); el('posContent').classList.add('hidden'); el('catFilterWrap').hidden = true;
  try {
    el('loaderText').textContent = 'Cargando equipos…';
    const rE = await fetch(URL_EQ); if (!rE.ok) throw new Error(`HTTP ${rE.status}`);
    equipos = parseEquipos(parseCsv(await rE.text())); if (!Object.keys(equipos).length) throw new Error('Sin datos en EQUIPOS');
    el('loaderText').textContent = 'Cargando fixture…';
    const rF = await fetch(URL_FIX); if (!rF.ok) throw new Error(`HTTP ${rF.status}`);
    buildStandings(parseFixture(parseCsv(await rF.text()))); renderAll();
    const now = new Date(), upd = el('lastUpdated');
    upd.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`; upd.classList.remove('hidden');
    el('posContent').classList.remove('hidden');
  } catch (err) { el('errorTitle').textContent = 'Error al conectar con Google Sheets'; el('errorMsg').textContent = err.message; el('posError').classList.remove('hidden'); }
  finally { el('posLoader').style.display = 'none'; }
}

document.addEventListener('DOMContentLoaded', () => { loadAll(); el('btnDownload').addEventListener('click', downloadPNG); el('btnDownloadAll').addEventListener('click', downloadAllPNGs); });
