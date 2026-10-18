import { supabase } from '../assets/js/supabase.js';
import { loadMesaMatches, saveMesaMatch, mesaError } from './mesa-data.js?v=1';

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard');
  const btnLogin = document.getElementById('btn-login');
  const partidosList = document.getElementById('partidos-list');
  const toast = document.getElementById('toast');

  // Sanitizador XSS mínimo
  const safe = s => String(s ?? '').replace(/[<>"'&]/g, c =>
    ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));

  function showToast(msg, error = false) {
    toast.textContent = msg;
    toast.style.background = error ? '#ef4444' : '#16a34a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function isMesaUser(user) {
    const { data, error } = await supabase.rpc('es_mesa_control');
    if (!error) return data === true;
    if (error.code === 'PGRST202') return /mesa/i.test(user.email || '');
    throw error;
  }

  // Verificamos si ya hay sesión activa
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (await isMesaUser(session.user)) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'block';
        cargarPartidos();
      } else {
        showToast('Acceso denegado. No eres personal de Mesa.', true);
        await supabase.auth.signOut();
      }
    }
  };
  checkSession().catch(error => showToast(mesaError(error), true));

  // --- LOGIN CON SUPABASE AUTH REAL ---
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('pass-input').value;

    if (!email || !password) {
      showToast('Ingresa correo y contraseña', true);
      return;
    }

    btnLogin.innerText = "Autenticando...";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast('Credenciales incorrectas', true);
      btnLogin.innerText = "Ingresar al sistema";
    } else {
      if (await isMesaUser(data.user)) {
        btnLogin.innerText = '¡Entrando!';
        setTimeout(() => {
          loginView.style.display = 'none';
          dashboardView.style.display = 'block';
          cargarPartidos();
        }, 800);
      } else {
        showToast('Acceso denegado. No eres personal de Mesa.', true);
        await supabase.auth.signOut();
        btnLogin.innerText = "Ingresar al sistema";
      }
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  // --- CARGAR PARTIDOS ---
  let allPartidosData = [];
  let loadingMatches = false;
  const pendingMatches = new Set();
  const findMatch = key => allPartidosData.find(match => match.key === key);
  const notice = document.getElementById('mesa-status');

  async function cargarPartidos() {
    if (loadingMatches || pendingMatches.size) return;
    loadingMatches = true;
    document.getElementById('btn-refresh-mesa').disabled = true;
    if (!allPartidosData.length) partidosList.textContent = 'Cargando partidos…';
    try {
      const { matches, warning } = await loadMesaMatches(supabase);
      allPartidosData = matches;
      notice.textContent = warning;
      notice.hidden = !warning;
      construirFiltros(matches);
      aplicarFiltros();
    } catch (error) {
      notice.textContent = mesaError(error);
      notice.hidden = false;
      if (!allPartidosData.length) partidosList.textContent = 'No se pudieron cargar los partidos. Pulsa Actualizar para reintentar.';
    } finally {
      loadingMatches = false;
      document.getElementById('btn-refresh-mesa').disabled = false;
    }
  }
  document.getElementById('btn-refresh-mesa').addEventListener('click', cargarPartidos);

  function construirFiltros(data) {
    const filterContainer = document.getElementById('filters-container');
    const selDia = document.getElementById('filter-dia');
    const selLugar = document.getElementById('filter-lugar');
    const selCat = document.getElementById('filter-cat');
    if(!filterContainer) return;

    filterContainer.style.display = 'flex';

    const dias = new Set();
    const lugares = new Set();
    const cats = new Set();

    data.forEach(p => {
      if(p.fecha_hora) {
        const d = new Date(p.fecha_hora);
        const dayStr = d.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long', timeZone:'America/Lima' });
        dias.add(dayStr);
      }
      if(p.lugar) lugares.add(p.lugar);
      if(p.categoria) cats.add(p.categoria);
    });

    const prevDia = selDia.value;
    const prevLugar = selLugar.value;
    const prevCat = selCat.value;

    selDia.innerHTML = '<option value="todos">📅 Todos los días</option>';
    selLugar.innerHTML = '<option value="todos">📍 Todos los lugares</option>';
    selCat.innerHTML = '<option value="todos">🏆 Todas las categorías</option>';

    [...dias].forEach(d => selDia.insertAdjacentHTML('beforeend', `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`));
    [...lugares].forEach(l => selLugar.insertAdjacentHTML('beforeend', `<option value="${safe(l)}">${safe(l)}</option>`));
    [...cats].forEach(c => selCat.insertAdjacentHTML('beforeend', `<option value="${safe(c)}">${safe(c)}</option>`));

    if (prevDia && [...dias].includes(prevDia)) selDia.value = prevDia;
    if (prevLugar && [...lugares].includes(prevLugar)) selLugar.value = prevLugar;
    if (prevCat && [...cats].includes(prevCat)) selCat.value = prevCat;

    selDia.onchange = aplicarFiltros;
    selLugar.onchange = aplicarFiltros;
    selCat.onchange = aplicarFiltros;
    const selEstado = document.getElementById('filter-estado');
    if (selEstado) selEstado.onchange = aplicarFiltros;
  }

  function aplicarFiltros() {
    const diaVal = document.getElementById('filter-dia')?.value || 'todos';
    const lugarVal = document.getElementById('filter-lugar')?.value || 'todos';
    const catVal = document.getElementById('filter-cat')?.value || 'todos';
    const estadoVal = document.getElementById('filter-estado')?.value || 'todos';

    const filtrados = allPartidosData.filter(p => {
      let matchDia = true;
      if(diaVal !== 'todos' && p.fecha_hora) {
        const d = new Date(p.fecha_hora);
        const pDia = d.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long', timeZone:'America/Lima' });
        if(pDia !== diaVal) matchDia = false;
      } else if (diaVal !== 'todos' && !p.fecha_hora) {
        matchDia = false;
      }

      let matchLugar = true;
      if(lugarVal !== 'todos' && p.lugar !== lugarVal) matchLugar = false;

      let matchCat = true;
      if(catVal !== 'todos' && String(p.categoria) !== catVal) matchCat = false;

      let matchEstado = true;
      if (estadoVal !== 'todos') {
        if (estadoVal === 'FINALIZADOS' && (p.estado !== 'EN_REVISION' && p.estado !== 'OFICIAL')) matchEstado = false;
        if (estadoVal !== 'FINALIZADOS' && p.estado !== estadoVal) matchEstado = false;
      }

      return matchDia && matchLugar && matchCat && matchEstado;
    });

    renderizarPartidos(filtrados);
  }

  function renderizarPartidos(partidos) {
    const currentScrollY = window.scrollY;
    
    // Antifragile: fijar la altura actual para evitar el salto brusco (scroll jump)
    const currentHeight = partidosList.offsetHeight;
    partidosList.style.minHeight = currentHeight + 'px';
    
    partidosList.innerHTML = '';
    
    const resumenTbody = document.getElementById('resumen-tbody');
    if (resumenTbody) resumenTbody.innerHTML = '';
    
    const mainFragment = document.createDocumentFragment();
    const resumenFragment = document.createDocumentFragment();
    partidos.forEach(p => {
      // Parse hora
      let horaTexto = "Sin Hora";
      if (p.fecha_hora) {
        const d = new Date(p.fecha_hora);
        horaTexto = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', timeZone:'America/Lima'});
      }

      const estadoUpper = (p.estado || '').toUpperCase();
      const isFinalizado = estadoUpper === 'EN_REVISION';
      const isOficial = estadoUpper === 'OFICIAL';
      const isLocked = isFinalizado || isOficial;
      const isProgramado = estadoUpper === 'PROGRAMADO';

      // Render '-' if programado, else use DB value or default to 0
      const gl = isProgramado ? '-' : (p.goles_local !== null ? p.goles_local : 0);
      const gv = isProgramado ? '-' : (p.goles_visitante !== null ? p.goles_visitante : 0);

      const card = document.createElement('div');
      card.className = 'partido-card';
      card.dataset.id = p.key;
      card.dataset.golesLocal = gl;
      card.dataset.golesVisita = gv;
      if (isOficial) card.style.opacity = '0.6';
      if (isFinalizado) card.style.border = '1px solid var(--gold)';
      if (isLocked) {
        card.innerHTML = `
          <div class="partido-header" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom:16px;">
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              <span style="background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:6px; color:#fff; font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:4px;">🕒 ${safe(horaTexto)}</span>
              <span style="background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:6px; color:#fff; font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:4px;">📍 ${safe(p.cancha || 'Cancha')}</span>
              <span style="background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:6px; color:#fff; font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:4px;">🏆 ${safe(p.categoria || 'N/A')}${p.fase_label?' · '+safe(p.fase_label):''}</span>
            </div>
            ${p.estado !== 'PROGRAMADO' ? `<strong style="font-size:0.85rem; padding:4px 10px; border-radius:999px; background:rgba(255,186,0,0.15); border:1px solid rgba(255,186,0,0.3); color:var(--gold);">[${p.estado}]</strong>` : ''}
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:rgba(0,0,0,0.2); border-radius:12px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
            <div style="flex:1; text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:1.3rem; font-weight:800; color:#fff; text-transform:uppercase; padding-right:15px; line-height:1.1;">
              ${safe(p.equipo_local?.nombre)}
            </div>
            
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-family:'Bebas Neue',sans-serif; font-size:2.8rem; color:var(--gold); background:rgba(0,0,0,0.6); padding:5px 15px; border-radius:10px; border:2px solid rgba(255,186,0,0.3); min-width:90px; line-height:1;">
              <span>${gl}</span>
              <span style="color:rgba(255,255,255,0.3); font-size:1.5rem; font-family:'Barlow Condensed',sans-serif; position:relative; top:-2px;">-</span>
              <span>${gv}</span>
            </div>
            
            <div style="flex:1; text-align:left; font-family:'Barlow Condensed',sans-serif; font-size:1.3rem; font-weight:800; color:#fff; text-transform:uppercase; padding-left:15px; line-height:1.1;">
              ${safe(p.equipo_visitante?.nombre)}
            </div>
          </div>
          ${p.tipo_partido==='ELIMINATORIA'&&p.penales_local!==null?`<p style="text-align:center;color:var(--gold);font-weight:800;margin:-2px 0 14px;">Penales: ${safe(p.penales_local)} - ${safe(p.penales_visitante)}</p>`:''}
          ${p.reclamo ? `<div style="margin-bottom:15px; width:100%; padding:12px; background:rgba(214,13,13,0.15); border:1px solid rgba(214,13,13,0.3); border-radius:8px; color:#ffba00; font-size:1rem; font-family:'Barlow',sans-serif; line-height:1.4;"><strong>⚠️ RECLAMO:</strong><br>${safe(p.reclamo)}</div>` : ''}

          ${isOficial ? '<p class="mesa-official-note">Resultado oficial. Las correcciones se solicitan al administrador.</p>' : ''}
          ${isFinalizado ? `<button class="btn-envivo" data-action="editar" style="background:var(--navy); border:1px solid var(--gold); color:var(--gold); padding:16px; margin-top:16px; border-radius:10px; width:100%;">✏️ EDITAR RESULTADO / RECLAMO</button>` : ''}
        `;
      } else {
        const btnEnVivoHTML = `<button class="btn-envivo" data-action="envivo" data-estado="${estadoUpper}">
            ${estadoUpper === 'EN_VIVO' ? '🔙 VOLVER A PENDIENTE' : '▶️ INICIAR PARTIDO (EN VIVO)'}
          </button>`;

        const scoreControlsDisabled = isProgramado ? 'disabled' : '';

        card.innerHTML = `
          <div class="partido-header" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom:16px;">
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              <span style="background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:6px; color:#fff; font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:4px;">🕒 ${safe(horaTexto)}</span>
              <span style="background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:6px; color:#fff; font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:4px;">📍 ${safe(p.cancha || 'Cancha')}</span>
              <span style="background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:6px; color:#fff; font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:4px;">🏆 ${safe(p.categoria || 'N/A')}${p.fase_label?' · '+safe(p.fase_label):''}</span>
            </div>
            ${p.estado !== 'PROGRAMADO' ? `<strong style="font-size:0.85rem; padding:4px 10px; border-radius:999px; background:rgba(255,186,0,0.15); border:1px solid rgba(255,186,0,0.3); color:var(--gold);">[${p.estado}]</strong>` : ''}
          </div>
          
          ${isProgramado ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:rgba(0,0,0,0.2); border-radius:12px; border:1px solid rgba(255,255,255,0.05); margin-bottom:14px;">
              <div style="flex:1; text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:1.3rem; font-weight:800; color:#fff; text-transform:uppercase; padding-right:15px; line-height:1.1;">
                ${safe(p.equipo_local?.nombre)}
              </div>
              
              <div style="display:flex; align-items:center; justify-content:center; font-family:'Bebas Neue',sans-serif; font-size:2.2rem; color:var(--gold); background:rgba(0,0,0,0.6); padding:5px 15px; border-radius:10px; border:2px solid rgba(255,186,0,0.3); min-width:80px; line-height:1;">
                VS
              </div>
              
              <div style="flex:1; text-align:left; font-family:'Barlow Condensed',sans-serif; font-size:1.3rem; font-weight:800; color:#fff; text-transform:uppercase; padding-left:15px; line-height:1.1;">
                ${safe(p.equipo_visitante?.nombre)}
              </div>
            </div>
            <div style="display:none;" id="local-${p.key}">${gl}</div>
            <div style="display:none;" id="visita-${p.key}">${gv}</div>
            
            <div style="margin-bottom: 0px; margin-top: 14px;">
              ${btnEnVivoHTML}
            </div>
          ` : `
            <div style="margin-bottom: 14px; display:flex; justify-content:flex-end;">
              ${btnEnVivoHTML}
            </div>
            
            <div style="margin-bottom: 14px;">
              <button class="btn-toggle-reclamo" data-id="${p.key}" style="display: ${p.reclamo ? 'none' : 'block'}; width:100%; padding:14px; border-radius:10px; border:1px solid rgba(220,38,38,0.5); background:rgba(220,38,38,0.1); color:#fca5a5; font-family:'Barlow Condensed',sans-serif; font-size:1.15rem; font-weight:800; text-transform:uppercase; cursor:pointer; transition:background 0.2s;">⚠️ AÑADIR RECLAMO</button>
            </div>

            <div id="caja-reclamo-${p.key}" style="display: ${p.reclamo ? 'block' : 'none'}; margin-bottom: 14px; background:rgba(220,38,38,0.15); border:1px solid rgba(220,38,38,0.4); padding:15px; border-radius:10px;">
              <label style="color:#fca5a5; font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:1.1rem; text-transform:uppercase; margin-bottom:10px; display:block;">⚠️ Observaciones o Reclamos:</label>
              <select id="tipo-reclamo-${p.key}" style="width:100%; padding:12px; margin-bottom:10px; background:rgba(0,0,0,0.6); border:1px solid rgba(220,38,38,0.4); color:#fff; border-radius:8px; font-family:'Barlow',sans-serif; font-size:1.05rem;">
                <option value="">-- Selecciona el Motivo --</option>
                <option value="DNI Vencido" ${p.reclamo?.includes('DNI Vencido') ? 'selected' : ''}>DNI Vencido</option>
                <option value="Niño sin DNI jugando" ${p.reclamo?.includes('Niño sin DNI jugando') ? 'selected' : ''}>Niño sin DNI jugando</option>
                <option value="Niño de otra categoría" ${p.reclamo?.includes('Niño de otra categoría') ? 'selected' : ''}>Niño de otra categoría</option>
                <option value="Otros" ${p.reclamo?.includes('Otros') ? 'selected' : ''}>Otros (Especificar)</option>
              </select>
              <input type="text" id="reclamo-${p.key}" placeholder="Explica el reclamo al Admin..." style="width:100%; padding:12px; background:rgba(0,0,0,0.6); border:1px solid rgba(220,38,38,0.4); color:#fff; border-radius:8px; font-family:'Barlow',sans-serif;" maxlength="1000" value="${safe(p.reclamo ? p.reclamo.replace(/\[.*?\]\s*/, '') : '')}">
            </div>

            <div class="equipo-row">
              <div class="equipo-name">${safe(p.equipo_local?.nombre || 'Local')}</div>
              <div class="score-controls">
                <button class="btn-score minus" data-team="local" data-delta="-1">-</button>
                <div class="score-display" id="local-${p.key}">${gl}</div>
                <button class="btn-score plus" data-team="local" data-delta="1">+</button>
              </div>
            </div>

            <div class="equipo-row">
              <div class="equipo-name">${safe(p.equipo_visitante?.nombre || 'Visita')}</div>
              <div class="score-controls">
                <button class="btn-score minus" data-team="visitante" data-delta="-1">-</button>
                <div class="score-display" id="visita-${p.key}">${gv}</div>
                <button class="btn-score plus" data-team="visitante" data-delta="1">+</button>
              </div>
            </div>

              ${p.tipo_partido==='ELIMINATORIA' ? `
                <fieldset class="mesa-penalties">
                  <legend>Tanda de penales</legend>
                  <p>Solo si el marcador está empatado. Guarda la tanda antes de salir.</p>
                  <label>${safe(p.equipo_local?.nombre)}<input id="pen-local-${p.key}" type="number" min="0" max="99" step="1" inputmode="numeric" value="${safe(p.penales_local??'')}" data-penalty-control aria-label="Penales local"></label>
                  <label>${safe(p.equipo_visitante?.nombre)}<input id="pen-visita-${p.key}" type="number" min="0" max="99" step="1" inputmode="numeric" value="${safe(p.penales_visitante??'')}" data-penalty-control aria-label="Penales visitante"></label>
                  <button type="button" class="btn-envivo" data-action="penales" data-penalty-control>Guardar penales</button>
                </fieldset>
              ` : ''}
          `}

          ${!isProgramado ? `<button class="btn-finalizar" data-action="finalizar">Finalizar Partido</button>` : ''}
        `;
      }
      syncPenaltyControls(card, p);
      const savePenalties = card.querySelector('[data-action="penales"]');
      savePenalties?.addEventListener('click', () => guardarPenales(p.key));
      mainFragment.appendChild(card);

      // Delegación de eventos — sin window.*
      const btnEnVivo = card.querySelector('[data-action="envivo"]');
      if (btnEnVivo) {
        if (estadoUpper === 'EN_VIVO') btnEnVivo.style.background = '#f97316';
        btnEnVivo.addEventListener('click', () => marcarEnVivo(p.key, btnEnVivo, p.goles_local, p.goles_visitante));
      }
      
      const btnEditar = card.querySelector('[data-action="editar"]');
      if (btnEditar) btnEditar.addEventListener('click', () => editarPartido(p.key, btnEditar));
      
      const btnFinalizar = card.querySelector('[data-action="finalizar"]');
      if (btnFinalizar) btnFinalizar.addEventListener('click', () => finalizarPartido(p.key));

      const btnToggleReclamo = card.querySelector('.btn-toggle-reclamo');
      if (btnToggleReclamo) {
        btnToggleReclamo.addEventListener('click', () => {
          document.getElementById(`caja-reclamo-${p.key}`).style.display = 'block';
          btnToggleReclamo.style.display = 'none';
        });
      }

      const btnAumentarLocal = card.querySelector('.btn-score.plus[data-team="local"]');
      const btnQuitarLocal = card.querySelector('.btn-score.minus[data-team="local"]');
      const btnAumentarVisita = card.querySelector('.btn-score.plus[data-team="visitante"]');
      const btnQuitarVisita = card.querySelector('.btn-score.minus[data-team="visitante"]');

      if (btnAumentarLocal) btnAumentarLocal.addEventListener('click', () => actualizarGol(p.key, 'local', 1));
      if (btnQuitarLocal) btnQuitarLocal.addEventListener('click', () => actualizarGol(p.key, 'local', -1));
      if (btnAumentarVisita) btnAumentarVisita.addEventListener('click', () => actualizarGol(p.key, 'visita', 1));
      if (btnQuitarVisita) btnQuitarVisita.addEventListener('click', () => actualizarGol(p.key, 'visita', -1));
      
      if (resumenTbody) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        let colorEstado = '#fff';
        if (estadoUpper === 'EN_VIVO') colorEstado = '#16a34a';
        if (isLocked) colorEstado = 'var(--gold)';
        
        tr.innerHTML = `
          <td style="padding:12px; font-weight:600;">${safe(horaTexto)}<br><span style="font-size:0.85rem; color:rgba(255,255,255,0.5);">${safe(p.cancha || 'Cancha')}</span></td>
          <td style="padding:12px;">${safe(p.categoria || 'N/A')}${p.fase_label?'<br><small>'+safe(p.fase_label)+'</small>':''}</td>
          <td style="padding:12px; text-align:right; font-family:'Barlow Condensed',sans-serif; font-weight:700;">${safe(p.equipo_local?.nombre)}</td>
          <td style="padding:12px; text-align:center; font-family:'Bebas Neue',sans-serif; font-size:1.5rem; color:var(--gold);">${gl} - ${gv}${p.tipo_partido==='ELIMINATORIA' && p.penales_local!=null ? `<small class="mesa-penalty-summary">Penales ${safe(p.penales_local)} - ${safe(p.penales_visitante)}</small>` : ''}</td>
          <td style="padding:12px; text-align:left; font-family:'Barlow Condensed',sans-serif; font-weight:700;">${safe(p.equipo_visitante?.nombre)}</td>
          <td style="padding:12px; text-align:center; font-family:'Barlow Condensed',sans-serif; font-weight:800; color:${colorEstado};">[${p.estado}]</td>
        `;
        resumenFragment.appendChild(tr);
      }
    });

    if (!partidos.length) partidosList.textContent = 'No hay partidos para estos filtros.';
    partidosList.appendChild(mainFragment);
    if (resumenTbody) resumenTbody.appendChild(resumenFragment);

    // Permitir que el DOM termine de dibujar antes de devolver el scroll (Safari iOS requiere mayor retraso)
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.scrollTo(0, currentScrollY);
        partidosList.style.minHeight = 'auto';
      }, 150); // 150ms fuerza a WebKit (Safari) a procesar el reflow del DOM primero
    });
  }

  const btnToggleView = document.getElementById('btn-toggle-view');
  if (btnToggleView) {
    const resumenContainer = document.getElementById('resumen-container');
    btnToggleView.addEventListener('click', () => {
      const isResumenVisible = resumenContainer.style.display === 'block';
      if (isResumenVisible) {
        resumenContainer.style.display = 'none';
        partidosList.style.display = 'block';
        btnToggleView.innerHTML = '👁️ VER RESUMEN (TABLA)';
        btnToggleView.style.background = 'rgba(255,255,255,0.1)';
      } else {
        resumenContainer.style.display = 'block';
        partidosList.style.display = 'none';
        btnToggleView.innerHTML = '🎯 VER TARJETAS DE MESA';
        btnToggleView.style.background = 'var(--navy)';
        btnToggleView.style.borderColor = 'var(--gold)';
      }
    });
  }

  function syncPenaltyControls(card, match) {
    const enabled = match.estado === 'EN_VIVO' && match.goles_local === match.goles_visitante;
    card.querySelectorAll('[data-penalty-control]').forEach(control => { control.disabled = !enabled; });
  }

  function penaltyValues(key) {
    const value = side => {
      const input = document.getElementById(`pen-${side}-${key}`)?.value.trim() ?? '';
      return input === '' ? null : Number(input);
    };
    return { penales_local:value('local'), penales_visitante:value('visita') };
  }

  async function changeMatch(key, action, refresh = true) {
    if (pendingMatches.has(key)) return;
    const match = findMatch(key);
    if (!match) return;
    pendingMatches.add(key);
    const card = document.querySelector(`.partido-card[data-id="${key}"]`);
    const controls = Array.from(card.querySelectorAll('button,input,select'));
    const previous = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    let saved = false;
    try {
      await action(match, card);
      saved = true;
    } catch (error) {
      const message = mesaError(error);
      showToast(message, true);
      notice.textContent = message;
      notice.hidden = false;
    } finally {
      controls.forEach((control,index) => { control.disabled = previous[index]; });
      syncPenaltyControls(card, match);
      pendingMatches.delete(key);
    }
    if (saved && refresh) await cargarPartidos();
  }

  async function editarPartido(key) {
    if (!confirm('¿Volver a abrir este partido para editar el resultado o reclamo?')) return;
    await changeMatch(key, async match => {
      await saveMesaMatch(supabase, match, { estado:'EN_VIVO' });
      showToast('Partido abierto para edición.');
    });
  }

  async function marcarEnVivo(key) {
    const match = findMatch(key);
    if (match?.estado === 'EN_VIVO' && !confirm('¿Volver a pendiente y borrar el marcador de este partido?')) return;
    await changeMatch(key, async match => {
      const estado = match.estado === 'EN_VIVO' ? 'PROGRAMADO' : 'EN_VIVO';
      await saveMesaMatch(supabase, match, {
        estado, goles_local:match.goles_local ?? 0, goles_visitante:match.goles_visitante ?? 0,
      });
      showToast(estado === 'EN_VIVO' ? 'Partido marcado como EN VIVO' : 'Partido pendiente');
    });
  }

  async function actualizarGol(key, tipo, cantidad) {
    await changeMatch(key, async (match, card) => {
      const field = tipo === 'local' ? 'goles_local' : 'goles_visitante';
      const changes = { estado:'EN_VIVO', [field]:Math.max(0, (match[field] ?? 0) + cantidad) };
      const next = { ...match, ...changes };
      if (match.tipo_partido === 'ELIMINATORIA' && next.goles_local !== next.goles_visitante) {
        Object.assign(changes, { penales_local:null, penales_visitante:null });
      }
      await saveMesaMatch(supabase, match, changes);
      document.getElementById(`local-${key}`).textContent = match.goles_local;
      document.getElementById(`visita-${key}`).textContent = match.goles_visitante;
      if (match.tipo_partido === 'ELIMINATORIA' && match.goles_local !== match.goles_visitante) {
        card.querySelectorAll('input[data-penalty-control]').forEach(input => { input.value = ''; });
      }
    }, false);
  }

  async function guardarPenales(key) {
    const penalties = penaltyValues(key);
    await changeMatch(key, async match => {
      await saveMesaMatch(supabase, match, { estado:'EN_VIVO', ...penalties });
      showToast('Penales guardados.');
    }, false);
  }

  async function finalizarPartido(key) {
    if (!confirm('¿Enviar el resultado y el reclamo a revisión del administrador?')) return;
    const tipo = document.getElementById(`tipo-reclamo-${key}`)?.value || '';
    const texto = document.getElementById(`reclamo-${key}`)?.value.trim() || '';
    const reclamo = `${tipo && tipo !== 'Otros' ? `[${tipo}] ` : ''}${texto}`.trim();
    const penalties = penaltyValues(key);
    await changeMatch(key, async match => {
      await saveMesaMatch(supabase, match, {
        estado:'EN_REVISION', reclamo,
        ...(match.tipo_partido === 'ELIMINATORIA' ? penalties : {}),
      });
      showToast('Partido enviado a revisión.');
    });
  }
});
