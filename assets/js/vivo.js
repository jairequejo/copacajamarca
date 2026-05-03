const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSw7Sko2trfPzgA6xrE_0Jfs4eK3sTtM7M1SHJmXGb6xqjIEhwWkhHagOWk8otc2dXz6kfcO1Ygz-sF/pub?gid=1021095354&single=true&output=csv';
const CACHE_KEY = 'copa_vivo_v1';

const matchesList = document.getElementById('matchesList');
const refreshBar = document.getElementById('refreshBar');
const emptyState = document.getElementById('emptyState');
const btnDownload = document.getElementById('btnDownload');
const toast = document.getElementById('toast');

let allMatches = [];
let currentFilters = {
    cat: 'todos',
    lugar: 'todos',
    cancha: 'todos',
    estado: 'todos'
};
let refreshInterval = null;

// Texto CSV más reciente obtenido del servidor (en memoria, no en localStorage)
let lastFetchedText = null;

// Hash simple para comparar si el CSV cambió sin comparar strings largos
function hashText(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
}

async function init() {
    setupListeners();
    await fetchAndRender();
    startAutoRefresh();
}

function setupListeners() {
    const filtersContainer = document.getElementById('filtersContainer');
    if (filtersContainer) {
        filtersContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                const nav = e.target.closest('.filter-bar');
                const filterType = nav.id.replace('filter', '').toLowerCase(); // cat, lugar, cancha, estado

                nav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                currentFilters[filterType] = e.target.dataset.filter;
                renderMatches();
            }
        });
    }

    matchesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-details');
        if (btn) {
            const panel = btn.nextElementSibling;
            const isOpen = panel.classList.contains('open');
            if (isOpen) {
                panel.classList.remove('open');
                btn.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            } else {
                panel.classList.add('open');
                btn.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
        }
    });

    btnDownload.addEventListener('click', () => {
        const filtered = allMatches.filter(m => {
            const matchCat = currentFilters.cat === 'todos' || m.categoria === currentFilters.cat;
            const matchLugar = currentFilters.lugar === 'todos' || m.lugar === currentFilters.lugar;
            const matchCancha = currentFilters.cancha === 'todos' || m.cancha === currentFilters.cancha;
            const matchEstado = currentFilters.estado === 'todos' || m.estadoStandard === currentFilters.estado;
            return matchCat && matchLugar && matchCancha && matchEstado;
        });

        if (filtered.length === 0) {
            showToast('No hay partidos para descargar');
            return;
        }
        document.getElementById('formatModal').hidden = false;
    });

    const btnCancelFormat = document.getElementById('btnCancelFormat');
    if (btnCancelFormat) {
        btnCancelFormat.addEventListener('click', () => {
            document.getElementById('formatModal').hidden = true;
        });
    }

    document.querySelectorAll('.btn-format').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('formatModal').hidden = true;
            downloadScreenshot(e.target.dataset.format);
        });
    });
}

let countdownInterval = null;
const REFRESH_SECS = 30;

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    let remaining = REFRESH_SECS;
    updateCountdown(remaining);

    countdownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            remaining = REFRESH_SECS;
            // Limpiar caché de localStorage antes de cada refresco silencioso
            // para que nunca se compare contra un dato viejo de Google
            localStorage.removeItem(CACHE_KEY);
            fetchAndRender(true);
        }
        updateCountdown(remaining);
    }, 1000);
}

function updateCountdown(secs) {
    const el = document.getElementById('countdownSecs');
    if (el) el.textContent = secs;
}

async function fetchAndRender(isSilent = false) {
    if (!isSilent) {
        if (lastFetchedText) {
            parseCSV(lastFetchedText);
            updateFilters();
            renderMatches();
        } else {
            // Primera carga sin datos en memoria: mostrar skeleton
            matchesList.innerHTML = Array(3).fill().map(() => `
                <div class="skeleton-card">
                    <div class="skel" style="height: 14px; width: 40%; margin-bottom: 12px;"></div>
                    <div class="skel" style="height: 36px; width: 100%; margin-bottom: 12px;"></div>
                    <div class="skel" style="height: 24px; width: 60%; margin: 0 auto;"></div>
                </div>
            `).join('');
            emptyState.hidden = true;
        }
    } else {
        refreshBar.hidden = false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        // Múltiples parámetros para forzar URL única y evitar caché de Google Sheets
        const bust = `&nocache=${Date.now()}&r=${Math.random().toString(36).slice(2)}&v=${performance.now().toFixed(0)}`;
        const url = `${SHEET_CSV_URL}${bust}`;
        const response = await fetch(url, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();

        // Comparar hash del texto nuevo vs el último obtenido del servidor
        const newHash = hashText(text);
        const oldHash = lastFetchedText ? hashText(lastFetchedText) : null;

        const dataChanged = newHash !== oldHash;

        // Guardar el texto fresco en memoria y en localStorage
        lastFetchedText = text;
        localStorage.setItem(CACHE_KEY, text);

        // Re-renderizar solo si los datos cambiaron (o es la carga inicial)
        if (!isSilent || dataChanged) {
            parseCSV(text);
            updateFilters();
            renderMatches();
        }
    } catch (error) {
        if (error.name !== 'AbortError') console.error('[vivo] Error fetch:', error);

        if (!isSilent) {
            // En carga inicial, intentar recuperar desde localStorage como último recurso
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                lastFetchedText = cached;
                parseCSV(cached);
                updateFilters();
                renderMatches();
                showToast('Usando datos en caché. Sin conexión.');
            } else {
                matchesList.innerHTML = '';
                emptyState.innerHTML = '<img src="../assets/img/logo.svg" style="width: 64px; opacity: 0.3; margin: 0 auto 12px; display: block;"> <p>No se pudo cargar la información</p>';
                emptyState.hidden = false;
            }
        } else {
            showToast('Error de conexión. Reintentando en breve...');
        }
    } finally {
        clearTimeout(timeoutId);
        if (isSilent) refreshBar.hidden = true;
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row.trim()) continue;

        const values = [];
        let inQuotes = false;
        let currentValue = '';
        for (let char of row) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue);

        if (values.length >= 12) {
            const rawEstado = values[11].trim();
            const estadoLC = rawEstado.toLowerCase();
            let standardEstado = 'Pendiente';
            if (estadoLC.includes('vivo')) standardEstado = 'En Vivo';
            else if (estadoLC.includes('finalizado')) standardEstado = 'Finalizado';

            parsed.push({
                fecha: values[0].trim(),
                hora: values[1].trim(),
                lugar: values[2].trim(),
                cancha: values[3].trim(),
                local: values[4].trim(),
                visitante: values[6].trim(),
                categoria: values[7].trim(),
                jornada: values[8].trim(),
                golesLocal: values[9].trim(),
                golesVisitante: values[10].trim(),
                estadoRaw: rawEstado,
                estadoStandard: standardEstado
            });
        }
    }
    allMatches = parsed;
}

function updateFilters() {
    const buildHtml = (arr, currentValue, prefix = '') => {
        let activeExists = currentValue === 'todos' || arr.includes(currentValue);
        let finalValue = activeExists ? currentValue : 'todos';

        let html = `<button class="filter-btn ${finalValue === 'todos' ? 'active' : ''}" data-filter="todos">Todos</button>`;
        arr.forEach(item => {
            html += `<button class="filter-btn ${finalValue === item ? 'active' : ''}" data-filter="${item}">${prefix}${item}</button>`;
        });
        return { html, activeVal: finalValue };
    };

    const categories = Array.from(new Set(allMatches.map(m => m.categoria))).sort((a, b) => parseInt(a) - parseInt(b));
    const catData = buildHtml(categories, currentFilters.cat, 'Cat. ');
    currentFilters.cat = catData.activeVal;
    document.getElementById('filterCat').innerHTML = catData.html;

    const lugares = Array.from(new Set(allMatches.map(m => m.lugar))).filter(Boolean).sort();
    const lugarData = buildHtml(lugares, currentFilters.lugar);
    currentFilters.lugar = lugarData.activeVal;
    document.getElementById('filterLugar').innerHTML = lugarData.html;

    const canchas = Array.from(new Set(allMatches.map(m => m.cancha))).filter(Boolean).sort();
    const canchaData = buildHtml(canchas, currentFilters.cancha);
    currentFilters.cancha = canchaData.activeVal;
    document.getElementById('filterCancha').innerHTML = canchaData.html;

    const estados = Array.from(new Set(allMatches.map(m => m.estadoStandard))).sort();
    const estadoData = buildHtml(estados, currentFilters.estado);
    currentFilters.estado = estadoData.activeVal;
    document.getElementById('filterEstado').innerHTML = estadoData.html;
}

function updateLivePill() {
    const hasLive = allMatches.some(m => m.estadoStandard === 'En Vivo');
    const pill = document.querySelector('.live-pill');
    if (pill) pill.hidden = !hasLive;
}

function renderMatches() {
    updateLivePill();

    const filtered = allMatches.filter(m => {
        const matchCat = currentFilters.cat === 'todos' || m.categoria === currentFilters.cat;
        const matchLugar = currentFilters.lugar === 'todos' || m.lugar === currentFilters.lugar;
        const matchCancha = currentFilters.cancha === 'todos' || m.cancha === currentFilters.cancha;
        const matchEstado = currentFilters.estado === 'todos' || m.estadoStandard === currentFilters.estado;
        return matchCat && matchLugar && matchCancha && matchEstado;
    });

    if (filtered.length === 0) {
        matchesList.innerHTML = '';
        emptyState.innerHTML = '<img src="../assets/img/logo.svg" style="width: 72px; opacity: 0.25; margin: 0 auto 16px; display: block;"> <p>Sin partidos con estos filtros</p>';
        emptyState.hidden = false;
        return;
    }

    emptyState.hidden = true;

    let html = '';
    filtered.forEach(match => {
        const estadoLC = match.estadoStandard.toLowerCase();
        let stateClass = 'pendiente';
        if (estadoLC === 'en vivo') stateClass = 'en-curso';
        else if (estadoLC === 'finalizado') stateClass = 'finalizado';

        let localClass = 'local';
        let visitClass = 'visitante';
        const gl = parseInt(match.golesLocal);
        const gv = parseInt(match.golesVisitante);

        if (estadoLC === 'finalizado' && !isNaN(gl) && !isNaN(gv)) {
            if (gl > gv) {
                localClass += ' winner';
                visitClass += ' loser';
            } else if (gv > gl) {
                visitClass += ' winner';
                localClass += ' loser';
            }
        }

        html += `
            <div class="match-card" data-estado="${estadoLC}">
                <div class="card-top">
                    <span class="card-cat">Cat. ${match.categoria} — Jor. ${match.jornada}</span>
                    <span class="status-chip ${stateClass}">
                        ${stateClass === 'en-curso' ? '<span class="pulse-dot"></span>' : ''}
                        ${match.estadoStandard}
                    </span>
                </div>
                <div class="card-score">
                    <div class="team ${localClass}">${match.local}</div>
                    <div class="score-center">
                        <span class="score-num">${match.golesLocal !== '' ? match.golesLocal : '-'}</span>
                        <span class="score-sep">-</span>
                        <span class="score-num">${match.golesVisitante !== '' ? match.golesVisitante : '-'}</span>
                    </div>
                    <div class="team ${visitClass}">${match.visitante}</div>
                </div>
                <button class="btn-details" aria-expanded="false">
                    Ver detalles
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="details-panel">
                    <div class="details-inner">
                        <div class="detail-cell">
                            <span class="detail-label">Fecha</span>
                            <span class="detail-value">${match.fecha}</span>
                        </div>
                        <div class="detail-cell">
                            <span class="detail-label">Hora</span>
                            <span class="detail-value">${match.hora}</span>
                        </div>
                        <div class="detail-cell">
                            <span class="detail-label">Lugar</span>
                            <span class="detail-value">${match.lugar}</span>
                        </div>
                        <div class="detail-cell">
                            <span class="detail-label">Cancha</span>
                            <span class="detail-value">${match.cancha}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    matchesList.innerHTML = html;
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/* ── HELPER FUNCIONES BANNER ── */
function fit(ctx, text, maxW, base, w) {
    let s = base;
    while (s > 9) { ctx.font = `${w} ${s}px "Barlow Condensed",sans-serif`; if (ctx.measureText(text).width <= maxW) break; s--; }
    return s;
}

function drawBall(ctx, cx, cy, r, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#c8d8e8'; ctx.fill();
    const pr = r * 0.28;
    [[0, -0.62], [0.59, -0.19], [0.36, 0.5], [-0.36, 0.5], [-0.59, -0.19], [0, 0]].forEach(([px, py]) => {
        const bx = cx + px * r, by = cy + py * r, d = Math.sqrt(px * px + py * py), p = pr * (1 - d * 0.18);
        ctx.beginPath();
        for (let a = 0; a < 5; a++) { const ag = -Math.PI / 2 + a * Math.PI * 2 / 5; a === 0 ? ctx.moveTo(bx + p * Math.cos(ag), by + p * Math.sin(ag)) : ctx.lineTo(bx + p * Math.cos(ag), by + p * Math.sin(ag)); }
        ctx.closePath(); ctx.fillStyle = '#7090b0'; ctx.fill();
    });
    ctx.restore();
}

const _logo = new Image(); _logo.src = '../assets/img/logo.svg'; _logo.crossOrigin = 'anonymous';
function drawLogo(ctx, cx, cy, r) {
    const g = ctx.createRadialGradient(cx - r * .3, cy - r * .3, r * .05, cx, cy, r);
    g.addColorStop(0, '#1c3da6'); g.addColorStop(1, '#040e30');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * .03; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * .90, 0, Math.PI * 2); ctx.clip();
    if (_logo.complete) {
        const s = r * 2.05; ctx.drawImage(_logo, cx - s / 2, cy - s / 2, s, s);
    } else {
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${r * .4}px "Barlow Condensed"`; ctx.fillText('CC', cx, cy);
    }
    ctx.restore();
}

function drawHorizontalFutbol(ctx, num, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    const FONT = '"Barlow Condensed", Impact, "Arial Narrow", sans-serif';
    const NAVY = '#081C4A';
    const fSize = 82;
    const nSize = 90;
    const LS = 2;
    const gap = 14;

    ctx.font = `italic 900 ${fSize}px ${FONT}`;
    const lettersArr = 'FÚTBOL'.split('');
    let fW = 0;
    lettersArr.forEach((l, i) => {
        fW += ctx.measureText(l).width + (i < lettersArr.length - 1 ? LS : 0);
    });

    ctx.font = `italic 900 ${nSize}px ${FONT}`;
    const nW = ctx.measureText(num).width;

    const total = fW + gap + nW;
    const startX = -total / 2;
    const bY = 0;

    function drawThick(chars, x, y, size, spacing) {
        ctx.font = `italic 900 ${size}px ${FONT}`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#ffffff';

        let px = x;
        chars.forEach(c => {
            ctx.fillText(c, px, y);
            px += ctx.measureText(c).width + spacing;
        });
        ctx.restore();
    }

    drawThick('FÚTBOL'.split(''), startX, bY, fSize, LS);
    const nx = startX + fW + gap;
    const numY = bY + (nSize - fSize) * 0.52;
    drawThick(num.split(''), nx, numY, nSize, 0);

    ctx.restore();
}

async function downloadScreenshot(futbolFormat) {
    btnDownload.classList.add('loading');
    btnDownload.innerHTML = '<span class="spin"></span> Procesando...';

    await new Promise(r => setTimeout(r, 50));

    try {
        const filtered = allMatches.filter(m => {
            const matchCat = currentFilters.cat === 'todos' || m.categoria === currentFilters.cat;
            const matchLugar = currentFilters.lugar === 'todos' || m.lugar === currentFilters.lugar;
            const matchCancha = currentFilters.cancha === 'todos' || m.cancha === currentFilters.cancha;
            const matchEstado = currentFilters.estado === 'todos' || m.estadoStandard === currentFilters.estado;

            const isF9 = m.categoria === '2013' || m.categoria === '2014';
            const matchFormat = (futbolFormat === '9') ? isF9 : !isF9;

            return matchCat && matchLugar && matchCancha && matchEstado && matchFormat;
        });

        if (filtered.length === 0) {
            showToast(`No hay partidos de Fútbol ${futbolFormat} con los filtros actuales`);
            btnDownload.classList.remove('loading');
            return;
        }

        const rows = filtered.map(m => {
            const scoreStr = (m.golesLocal !== '' && m.golesVisitante !== '') ? `${m.golesLocal} - ${m.golesVisitante}` : 'VS';
            return {
                jornada: m.categoria || '',
                teamA: m.local || '',
                score: scoreStr,
                teamB: m.visitante || ''
            };
        });

        const futbolNum = futbolFormat;

        let fechaText = filtered[0].fecha || '';
        if (fechaText.length > 0) fechaText = fechaText.charAt(0).toUpperCase() + fechaText.slice(1);
        const tempText = 'TEMPORADA 2026';

        if (!_logo.complete) {
            await new Promise((resolve) => {
                const finish = () => resolve();
                _logo.onload = finish;
                _logo.onerror = finish;
                setTimeout(finish, 3000);
            });
        }

        // Cargar imagen de fondo
        const _bg = new Image();
        _bg.src = '../assets/img/fondo-resultados.png';
        if (!_bg.complete) {
            await new Promise((resolve) => {
                _bg.onload = resolve;
                _bg.onerror = resolve;
                setTimeout(resolve, 4000);
            });
        }

        const W = 1080, H = 1080;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');



        // ── 1. FONDO FOTOGRÁFICO ──
        if (_bg.complete && _bg.naturalWidth > 0) {
            // Escalar la imagen para cubrir todo el canvas (object-fit: cover)
            const scale = Math.max(W / _bg.naturalWidth, H / _bg.naturalHeight);
            const bw = _bg.naturalWidth * scale;
            const bh = _bg.naturalHeight * scale;
            ctx.drawImage(_bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
        } else {
            ctx.fillStyle = '#0b2060';
            ctx.fillRect(0, 0, W, H);
        }

        // ── 2. HEADER AZUL ──
        const HEADER = 155;
        ctx.fillStyle = 'rgba(10,25,75,0.95)';
        ctx.fillRect(0, 0, W, HEADER);
        // línea dorada superior
        ctx.fillStyle = '#f5c800';
        ctx.fillRect(0, 0, W, 7);
        // línea dorada inferior
        ctx.fillStyle = '#f5c800';
        ctx.fillRect(0, HEADER - 4, W, 4);

        // Logo circular
        drawLogo(ctx, 80, HEADER / 2 + 4, 52);

        // Título Copa Cajamarca (misma fuente del h1: Barlow Condensed 800)
        const TX = 158;
        const TITLE_MAX_W = 480;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        const tSize1 = fit(ctx, 'COPA CAJAMARCA', TITLE_MAX_W, 68, '800');
        ctx.font = `800 ${tSize1}px "Barlow Condensed",sans-serif`;
        ctx.fillText('COPA CAJAMARCA', TX, HEADER / 2 - 20);

        ctx.fillStyle = '#c8d8f0';
        const tSize2 = fit(ctx, 'CAMPEONATO DE MENORES', TITLE_MAX_W, 36, '700');
        ctx.font = `700 ${tSize2}px "Barlow Condensed",sans-serif`;
        ctx.fillText('CAMPEONATO DE MENORES', TX, HEADER / 2 + 28);

        // RESULTADOS en rojo oscuro (Anton, sin neón)
        ctx.save();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#cc0000';
        let resSize = 78;
        while (resSize > 9) { ctx.font = `italic 400 ${resSize}px "Anton","Barlow Condensed",sans-serif`; if (ctx.measureText('RESULTADOS').width <= 380) break; resSize--; }
        ctx.font = `italic 400 ${resSize}px "Anton","Barlow Condensed",sans-serif`;
        ctx.fillText('RESULTADOS', W - 50, HEADER / 2 + 10);
        ctx.restore();

        // ── 3. BARRA DORADA FECHA ──
        const DATEBAR = 54;
        const dy = HEADER;
        const DATEBAR_W = 580;
        const dg = ctx.createLinearGradient(0, dy, DATEBAR_W, dy + DATEBAR);
        dg.addColorStop(0, '#e0a200'); dg.addColorStop(0.5, '#f5c800'); dg.addColorStop(1, '#e0a200');
        // Trapecio (rectángulo con borde derecho diagonal)
        ctx.beginPath();
        ctx.moveTo(0, dy);
        ctx.lineTo(DATEBAR_W, dy);
        ctx.lineTo(DATEBAR_W - 30, dy + DATEBAR);
        ctx.lineTo(0, dy + DATEBAR);
        ctx.closePath();
        ctx.fillStyle = dg;
        ctx.fill();
        ctx.fillStyle = '#0a1830';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px "Barlow Condensed",sans-serif';
        ctx.fillText(fechaText, DATEBAR_W / 2 - 20, dy + DATEBAR / 2);

        // ── 4. LAYOUT TABLA ──
        const FOOTER = 60;
        const GAP = 20;
        const TBL_W = 960;
        const TBL_X = (W - TBL_W) / 2;
        const THEAD = 54;

        // Fijar la tabla en la parte superior, cerca de la fecha
        const TABLE_Y = dy + DATEBAR + 110;
        const TABLE_AREA_H = H - TABLE_Y - FOOTER - GAP;

        let ROW_H = Math.min(60, (TABLE_AREA_H - THEAD) / rows.length);
        if (ROW_H < 40) ROW_H = 40;
        const TABLE_H = THEAD + rows.length * ROW_H;

        const CC_W = 110, CS_W = 140;
        const TEAMS_W = TBL_W - CC_W - CS_W;
        const TEAM_W = Math.floor(TEAMS_W / 2);
        const CC = { x: TBL_X, w: CC_W };
        const CA = { x: TBL_X + CC_W, w: TEAM_W };
        const CS = { x: TBL_X + CC_W + TEAM_W, w: CS_W };
        const CB = { x: TBL_X + CC_W + TEAM_W + CS_W, w: TEAM_W };

        // ── 5. TEXTO FÚTBOL X (pegado encima del cuadro) ──
        const futbolY = TABLE_Y - 25;
        drawHorizontalFutbol(ctx, futbolNum, W / 2, futbolY);

        // ── 6. TABLA ──
        // Encabezado tabla
        ctx.fillStyle = '#2349a0';
        ctx.fillRect(TBL_X, TABLE_Y, TBL_W, THEAD);
        ctx.fillStyle = '#f5c800';
        ctx.font = 'bold 24px "Barlow Condensed",sans-serif';
        ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        ctx.fillText('CAT.', CC.x + CC.w / 2, TABLE_Y + THEAD / 2);
        ctx.fillText('PARTIDO', CC.x + CC.w + (TBL_W - CC.w) / 2, TABLE_Y + THEAD / 2);

        // Filas
        const RS = TABLE_Y + THEAD;
        rows.forEach((r, i) => {
            const ry = RS + i * ROW_H;
            ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f0f4f8';
            ctx.fillRect(TBL_X, ry, TBL_W, ROW_H);

            const my = ry + ROW_H / 2;
            const fs = Math.max(16, Math.min(38, ROW_H * 0.42));
            ctx.textBaseline = 'middle';

            ctx.fillStyle = '#081c4a';
            ctx.font = `${fs}px "Barlow",sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(r.jornada, CC.x + CC.w / 2, my);

            const as = fit(ctx, r.teamA.toUpperCase(), CA.w - 14, fs, '500');
            ctx.font = `500 ${as}px "Barlow",sans-serif`;
            ctx.fillStyle = '#0a1830'; ctx.textAlign = 'center';
            ctx.fillText(r.teamA.toUpperCase(), CA.x + CA.w / 2, my);

            const scoreFs = Math.max(20, Math.min(28, ROW_H * 0.5));
            ctx.font = `600 ${scoreFs}px "Barlow",sans-serif`;
            ctx.fillStyle = '#0a1830'; ctx.textAlign = 'center';
            ctx.fillText(r.score, CS.x + CS.w / 2, my);

            const bs = fit(ctx, r.teamB.toUpperCase(), CB.w - 14, fs, '500');
            ctx.font = `500 ${bs}px "Barlow",sans-serif`;
            ctx.fillStyle = '#0a1830'; ctx.textAlign = 'center';
            ctx.fillText(r.teamB.toUpperCase(), CB.x + CB.w / 2, my);

            // Borde inferior de la fila
            ctx.strokeStyle = '#081c4a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(TBL_X, ry, TBL_W, ROW_H);
        });

        // Divisores verticales oscuros
        ctx.strokeStyle = '#081c4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(TBL_X, TABLE_Y, TBL_W, TABLE_H);
        ctx.beginPath();
        ctx.moveTo(CA.x, TABLE_Y); ctx.lineTo(CA.x, TABLE_Y + TABLE_H);
        ctx.moveTo(CS.x, TABLE_Y + THEAD); ctx.lineTo(CS.x, TABLE_Y + TABLE_H);
        ctx.moveTo(CB.x, TABLE_Y + THEAD); ctx.lineTo(CB.x, TABLE_Y + TABLE_H);
        ctx.stroke();



        const link = document.createElement('a');
        let filename = 'Copa-Cajamarca';
        if (currentFilters.cat !== 'todos') filename += `-Cat-${currentFilters.cat}`;
        filename += `-${new Date().getTime()}.png`;
        link.download = filename;
        link.href = cv.toDataURL('image/png');
        link.click();

        showToast('Banner generado exitosamente');
    } catch (err) {
        console.error(err);
        showToast('Error al generar el banner');
    } finally {
        btnDownload.classList.remove('loading');
        btnDownload.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar Resumen
        `;
    }
}

document.addEventListener('DOMContentLoaded', init);
