import { supabase } from '../assets/js/supabase.js';

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

  // Verificamos si ya hay sesión activa
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (session.user.email.includes('mesa')) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'block';
        cargarPartidos();
      } else {
        showToast('Acceso denegado. No eres personal de Mesa.', true);
        await supabase.auth.signOut();
      }
    }
  };
  checkSession();

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
      if (data.user.email.includes('mesa')) {
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

  async function cargarPartidos() {
    partidosList.innerHTML = '<p style="text-align:center; color:#94a3b8;">Cargando partidos programados...</p>';
    
    const cutoffISO = new Date(Date.now() - (4 * 24 * 60 * 60 * 1000)).toISOString();

    const { data, error } = await supabase
      .from('partidos')
      .select(`
        id,
        goles_local,
        goles_visitante,
        estado,
        fecha_hora,
        cancha,
        lugar,
        categoria,
        reclamo,
        equipo_local:equipos!partidos_equipo_local_id_fkey(nombre),
        equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre)
      `)
      .not('fecha_hora', 'is', null)
      .gte('fecha_hora', cutoffISO)
      .order('fecha_hora', { ascending: true });

    if (error) {
      console.error(error);
      showToast('Error al cargar partidos', true);
      return;
    }

    if (data.length === 0) {
      partidosList.innerHTML = '<p style="text-align:center; color:#94a3b8;">No hay partidos pendientes para hoy.</p>';
      return;
    }

    allPartidosData = data;
    construirFiltros(data);
    aplicarFiltros();
  }

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
        const dayStr = d.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' });
        dias.add(dayStr);
      }
      if(p.lugar) lugares.add(p.lugar);
      if(p.categoria) cats.add(p.categoria);
    });

    selDia.innerHTML = '<option value="todos">📅 Todos los días</option>';
    selLugar.innerHTML = '<option value="todos">📍 Todos los lugares</option>';
    selCat.innerHTML = '<option value="todos">🏆 Todas las categorías</option>';

    [...dias].forEach(d => selDia.insertAdjacentHTML('beforeend', `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`));
    [...lugares].forEach(l => selLugar.insertAdjacentHTML('beforeend', `<option value="${l}">${l}</option>`));
    [...cats].forEach(c => selCat.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));

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
        const pDia = d.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' });
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
    
    partidosList.innerHTML = '';
    
    const resumenTbody = document.getElementById('resumen-tbody');
    if (resumenTbody) resumenTbody.innerHTML = '';
    
    partidos.forEach(p => {
      // Parse hora
      let horaTexto = "Sin Hora";
      if (p.fecha_hora) {
        const d = new Date(p.fecha_hora);
        horaTexto = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }

      const isFinalizado = p.estado === 'EN_REVISION';
      const isOficial = p.estado === 'OFICIAL';
      const isLocked = isFinalizado || isOficial;
      const isProgramado = p.estado === 'PROGRAMADO';

      // Render '-' if programado, else use DB value or default to 0
      const gl = isProgramado ? '-' : (p.goles_local !== null ? p.goles_local : 0);
      const gv = isProgramado ? '-' : (p.goles_visitante !== null ? p.goles_visitante : 0);

      const card = document.createElement('div');
      card.className = 'partido-card';
      card.dataset.id = p.id;
      card.dataset.golesLocal = gl;
      card.dataset.golesVisita = gv;
      if (isOficial) card.style.opacity = '0.6';
      if (isFinalizado) card.style.border = '1px solid var(--gold)';
      if (isLocked) {
        card.innerHTML = `
          <div class="partido-header">
            <span>${safe(horaTexto)} - ${safe(p.cancha || 'Cancha')} <strong style="color:var(--gold)">[${p.estado}]</strong></span>
            <span>Cat: ${safe(p.categoria || 'N/A')}</span>
          </div>
          
          <div class="equipo-row" style="flex-direction:column; align-items:center; text-align:center; padding:20px 15px; gap:12px; margin-bottom:0;">
            <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; color:#fff; text-transform:uppercase;">${safe(p.equipo_local?.nombre)}</div>
            
            <div style="font-family:'Bebas Neue',sans-serif; font-size:3.5rem; color:var(--gold); background:rgba(0,0,0,0.5); padding:5px 25px; border-radius:12px; border:2px solid rgba(255,186,0,0.2); line-height:1; display:flex; align-items:center; justify-content:center; gap:15px; width:100%;">
              <span>${gl}</span>
              <span style="color:rgba(255,255,255,0.3); font-size:1.5rem; font-family:'Barlow Condensed',sans-serif;">VS</span>
              <span>${gv}</span>
            </div>
            
            <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.6rem; font-weight:800; color:#fff; text-transform:uppercase;">${safe(p.equipo_visitante?.nombre)}</div>
            
            ${p.reclamo ? `<div style="margin-top:10px; width:100%; padding:12px; background:rgba(214,13,13,0.15); border:1px solid rgba(214,13,13,0.3); border-radius:8px; color:#ffba00; font-size:1rem; font-family:'Barlow',sans-serif; line-height:1.4;"><strong>⚠️ RECLAMO:</strong><br>${safe(p.reclamo)}</div>` : ''}
          </div>

          ${isFinalizado ? `<button class="btn-envivo" data-action="editar" style="background:var(--navy); border:1px solid var(--gold); color:var(--gold); padding:16px; margin-top:16px; border-radius:10px; width:100%;">✏️ EDITAR RESULTADO / RECLAMO</button>` : ''}
        `;
      } else {
        const btnEnVivoHTML = `<button class="btn-envivo" data-action="envivo" data-estado="${p.estado}">
            ${p.estado === 'EN_VIVO' ? '🔙 VOLVER A PENDIENTE' : '▶️ INICIAR PARTIDO (EN VIVO)'}
          </button>`;

        const scoreControlsDisabled = isProgramado ? 'disabled' : '';

        card.innerHTML = `
          <div class="partido-header">
            <span>${safe(horaTexto)} - ${safe(p.cancha || 'Cancha')} <strong style="color:var(--gold)">[${p.estado}]</strong></span>
            <span>Cat: ${safe(p.categoria || 'N/A')}</span>
          </div>
          
          <div style="margin-bottom: 14px;">
            ${btnEnVivoHTML}
          </div>

          <div style="margin-bottom: 14px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.1); padding:15px; border-radius:10px;">
            <label style="color:var(--gold); font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:1.1rem; text-transform:uppercase; margin-bottom:10px; display:block;">⚠️ Observaciones o Reclamos:</label>
            <select id="tipo-reclamo-${p.id}" style="width:100%; padding:12px; margin-bottom:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:8px; font-family:'Barlow',sans-serif; font-size:1.05rem;">
              <option value="">-- Sin reclamos --</option>
              <option value="DNI Vencido">Por DNI Vencido</option>
              <option value="Niño sin DNI jugando">Niño sin DNI jugando</option>
              <option value="Niño de otra categoría">Niño de otra categoría</option>
              <option value="Otros">Otros (Especificar)</option>
            </select>
            <input type="text" id="reclamo-${p.id}" placeholder="Detalles de la observación (Opcional)..." style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); color:#fff; border-radius:8px; font-family:'Barlow',sans-serif;" value="${safe(p.reclamo || '')}">
          </div>

          <div class="equipo-row">
            <div class="equipo-name">${safe(p.equipo_local?.nombre || 'Local')}</div>
            <div class="score-controls">
              ${!isProgramado ? `<button class="btn-score minus" data-team="local" data-delta="-1" ${scoreControlsDisabled}>-</button>` : ''}
              <div class="score-display" id="local-${p.id}">${gl}</div>
              ${!isProgramado ? `<button class="btn-score plus" data-team="local" data-delta="1" ${scoreControlsDisabled}>+</button>` : ''}
            </div>
          </div>

          <div class="equipo-row">
            <div class="equipo-name">${safe(p.equipo_visitante?.nombre || 'Visita')}</div>
            <div class="score-controls">
              ${!isProgramado ? `<button class="btn-score minus" data-team="visitante" data-delta="-1" ${scoreControlsDisabled}>-</button>` : ''}
              <div class="score-display" id="visita-${p.id}">${gv}</div>
              ${!isProgramado ? `<button class="btn-score plus" data-team="visitante" data-delta="1" ${scoreControlsDisabled}>+</button>` : ''}
            </div>
          </div>

          <button class="btn-finalizar" data-action="finalizar">Finalizar Partido</button>
        `;
      }
      partidosList.appendChild(card);

      // Delegación de eventos — sin window.*
      card.querySelectorAll('.btn-score').forEach(btn => {
        btn.addEventListener('click', () => {
          actualizarGol(p.id, btn.dataset.team, parseInt(btn.dataset.delta), p.goles_local, p.goles_visitante);
      const btnEnVivo = card.querySelector('[data-action="envivo"]');
      if (btnEnVivo) {
        if (p.estado === 'EN_VIVO') btnEnVivo.style.background = '#16a34a';
        btnEnVivo.addEventListener('click', () => marcarEnVivo(p.id, btnEnVivo, p.goles_local, p.goles_visitante));
      }
      
      const btnEditar = card.querySelector('[data-action="editar"]');
      if (btnEditar) btnEditar.addEventListener('click', () => editarPartido(p.id, btnEditar));
      
      const btnFinalizar = card.querySelector('[data-action="finalizar"]');
      if (btnFinalizar) btnFinalizar.addEventListener('click', () => finalizarPartido(p.id));

      const btnAumentarLocal = card.querySelector('.btn-score.plus[data-team="local"]');
      const btnQuitarLocal = card.querySelector('.btn-score.minus[data-team="local"]');
      const btnAumentarVisita = card.querySelector('.btn-score.plus[data-team="visitante"]');
      const btnQuitarVisita = card.querySelector('.btn-score.minus[data-team="visitante"]');

      if (btnAumentarLocal) btnAumentarLocal.addEventListener('click', () => actualizarGol(p.id, 'local', 1, p.goles_local, p.goles_visitante));
      if (btnQuitarLocal) btnQuitarLocal.addEventListener('click', () => actualizarGol(p.id, 'local', -1, p.goles_local, p.goles_visitante));
      if (btnAumentarVisita) btnAumentarVisita.addEventListener('click', () => actualizarGol(p.id, 'visita', 1, p.goles_local, p.goles_visitante));
      if (btnQuitarVisita) btnQuitarVisita.addEventListener('click', () => actualizarGol(p.id, 'visita', -1, p.goles_local, p.goles_visitante));
      
      if (resumenTbody) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        let colorEstado = '#fff';
        if (p.estado === 'EN_VIVO') colorEstado = '#16a34a';
        if (isLocked) colorEstado = 'var(--gold)';
        
        tr.innerHTML = `
          <td style="padding:12px; font-weight:600;">${safe(horaTexto)}<br><span style="font-size:0.85rem; color:rgba(255,255,255,0.5);">${safe(p.cancha || 'Cancha')}</span></td>
          <td style="padding:12px;">${safe(p.categoria || 'N/A')}</td>
          <td style="padding:12px; text-align:right; font-family:'Barlow Condensed',sans-serif; font-weight:700;">${safe(p.equipo_local?.nombre)}</td>
          <td style="padding:12px; text-align:center; font-family:'Bebas Neue',sans-serif; font-size:1.5rem; color:var(--gold);">${gl} - ${gv}</td>
          <td style="padding:12px; text-align:left; font-family:'Barlow Condensed',sans-serif; font-weight:700;">${safe(p.equipo_visitante?.nombre)}</td>
          <td style="padding:12px; text-align:center; font-family:'Barlow Condensed',sans-serif; font-weight:800; color:${colorEstado};">[${p.estado}]</td>
        `;
        resumenTbody.appendChild(tr);
      }
    });

    window.scrollTo(0, currentScrollY);
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

  async function editarPartido(id, btn) {
    if (!confirm('¿Seguro que deseas volver a abrir este partido para edición?')) return;
    btn.disabled = true;
    btn.innerText = 'Actualizando...';
    
    const { error } = await supabase
      .from('partidos')
      .update({ estado: 'EN_VIVO' })
      .eq('id', id);

    if (error) {
      console.error(error);
      showToast('Error. Verifica permisos.', true);
      btn.disabled = false;
      btn.innerText = '✏️ EDITAR RESULTADO / RECLAMO';
    } else {
      showToast('Partido abierto para edición.');
      setTimeout(cargarPartidos, 300);
    }
  }

  // DENTRO del closure — no en window
  async function marcarEnVivo(id, btn, gl, gv) {
    const isEnVivo = btn.dataset.estado === 'EN_VIVO';
    btn.disabled = true;
    btn.innerText = 'Actualizando...';
    
    const newState = isEnVivo ? 'PROGRAMADO' : 'EN_VIVO';
    
    const payload = { estado: newState };
    // Si estamos iniciando el partido y los goles son nulos, inicializarlos en 0
    if (newState === 'EN_VIVO') {
      if (gl === null) payload.goles_local = 0;
      if (gv === null) payload.goles_visitante = 0;
    } else if (newState === 'PROGRAMADO') {
      payload.goles_local = null;
      payload.goles_visitante = null;
    }

    const { error } = await supabase
      .from('partidos')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error(error);
      showToast('Error. Verifica permisos.', true);
      btn.disabled = false;
      btn.innerText = isEnVivo ? '🔙 VOLVER A PENDIENTE' : '▶️ INICIAR PARTIDO (EN VIVO)';
    } else {
      btn.disabled = false;
      if (newState === 'EN_VIVO') {
        btn.innerText = '🔙 VOLVER A PENDIENTE';
        btn.style.background = '#16a34a';
        btn.dataset.estado = 'EN_VIVO';
        showToast('Partido marcado como EN VIVO');
      } else {
        btn.innerText = '▶️ INICIAR PARTIDO (EN VIVO)';
        btn.style.background = 'var(--navy)';
        btn.dataset.estado = 'PROGRAMADO';
        showToast('En Vivo desactivado');
      }
      setTimeout(cargarPartidos, 300);
    }
  }

  async function actualizarGol(id, tipo, cantidad, currentGl, currentGv) {
    const displayElement = document.getElementById(tipo === 'local' ? `local-${id}` : `visita-${id}`);
    
    // Si era nulo y están sumando, empezamos de 0.
    let currentDBValue = tipo === 'local' ? currentGl : currentGv;
    if (currentDBValue === null) currentDBValue = 0;

    let nuevoValor = currentDBValue + cantidad;
    if (nuevoValor < 0) nuevoValor = 0;
    
    // Actualización optimista (UI primero)
    displayElement.innerText = nuevoValor;

    const payload = {};
    if (tipo === 'local') payload.goles_local = nuevoValor;
    else payload.goles_visitante = nuevoValor;
    payload.estado = 'EN_VIVO';

    const { error } = await supabase
      .from('partidos')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error(error);
      showToast('Fallo al guardar gol. Verifica permisos RLS.', true);
      displayElement.innerText = valorPrevio; // revertir al valor previo correcto
    }
  }

  async function finalizarPartido(id) {
    if (!confirm('¿Seguro que deseas enviar este partido a revisión?')) return;
    
    const selectEl = document.getElementById(`tipo-reclamo-${id}`);
    const tipo = selectEl ? selectEl.value : '';
    const textoEl = document.getElementById(`reclamo-${id}`);
    const texto = textoEl ? textoEl.value.trim() : '';

    let reclamoFinal = '';
    if (tipo && tipo !== 'Otros') {
      reclamoFinal += `[${tipo}] `;
    }
    if (texto) {
      reclamoFinal += texto;
    }
    reclamoFinal = reclamoFinal.trim();

    const { error } = await supabase
      .from('partidos')
      .update({ estado: 'EN_REVISION', reclamo: reclamoFinal })
      .eq('id', id);

    if (error) {
      console.error(error);
      showToast('Error al finalizar. Verifica permisos.', true);
    } else {
      showToast('Partido enviado a revisión');
      cargarPartidos(); // Recargar lista
    }
  };
});
