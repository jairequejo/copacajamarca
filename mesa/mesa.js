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
  }

  function aplicarFiltros() {
    const diaVal = document.getElementById('filter-dia')?.value || 'todos';
    const lugarVal = document.getElementById('filter-lugar')?.value || 'todos';
    const catVal = document.getElementById('filter-cat')?.value || 'todos';

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

      return matchDia && matchLugar && matchCat;
    });

    renderizarPartidos(filtrados);
  }

  function renderizarPartidos(partidos) {
    partidosList.innerHTML = '';
    
    partidos.forEach(p => {
      // Parse hora
      let horaTexto = "Sin Hora";
      if (p.fecha_hora) {
        const d = new Date(p.fecha_hora);
        horaTexto = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }

      const gl = p.goles_local !== null ? p.goles_local : 0;
      const gv = p.goles_visitante !== null ? p.goles_visitante : 0;

      const isLocked = p.estado === 'OFICIAL';

      const card = document.createElement('div');
      card.className = 'partido-card';
      card.dataset.id = p.id;
      card.dataset.golesLocal = gl;
      card.dataset.golesVisita = gv;
      if (isLocked) card.style.opacity = '0.6';
      
      card.innerHTML = `
        <div class="partido-header">
          <span>${safe(horaTexto)} - ${safe(p.cancha || 'Cancha')} <strong style="color:var(--gold)">[${p.estado}]</strong></span>
          <span>Cat: ${safe(p.categoria || 'N/A')}</span>
        </div>
        
        <div style="margin-bottom: 14px;">
          <button class="btn-envivo" data-action="envivo" data-estado="${p.estado}" style="${p.estado === 'EN_VIVO' ? 'background:#16a34a; opacity:1;' : ''}" ${isLocked ? 'disabled' : ''}>
            ${p.estado === 'EN_VIVO' ? '🔴 QUITAR EN VIVO' : (isLocked ? '🔒 BLOQUEADO (OFICIAL)' : '▶️ INICIAR PARTIDO (EN VIVO)')}
          </button>
        </div>

        <div style="margin-bottom: 14px;">
          <input type="text" id="reclamo-${p.id}" placeholder="Escribe un reclamo u observación..." style="width:100%; padding:12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; border-radius:8px;" value="${safe(p.reclamo || '')}" ${isLocked ? 'disabled' : ''}>
        </div>

        <div class="equipo-row">
          <div class="equipo-name">${safe(p.equipo_local?.nombre || 'Local')}</div>
          <div class="score-controls">
            <button class="btn-score minus" data-team="local" data-delta="-1" ${isLocked ? 'disabled' : ''}>-</button>
            <div class="score-display" id="local-${p.id}">${gl}</div>
            <button class="btn-score plus" data-team="local" data-delta="1" ${isLocked ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <div class="equipo-row">
          <div class="equipo-name">${safe(p.equipo_visitante?.nombre || 'Visita')}</div>
          <div class="score-controls">
            <button class="btn-score minus" data-team="visitante" data-delta="-1" ${isLocked ? 'disabled' : ''}>-</button>
            <div class="score-display" id="visita-${p.id}">${gv}</div>
            <button class="btn-score plus" data-team="visitante" data-delta="1" ${isLocked ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <button class="btn-finalizar" data-action="finalizar" ${isLocked ? 'disabled style="display:none;"' : ''}>Finalizar Partido</button>
      `;
      partidosList.appendChild(card);

      // Delegación de eventos — sin window.*
      card.querySelectorAll('.btn-score').forEach(btn => {
        btn.addEventListener('click', () => {
          actualizarGol(p.id, btn.dataset.team, parseInt(btn.dataset.delta));
        });
      });
      const btnEnVivo = card.querySelector('[data-action="envivo"]');
      if (btnEnVivo) {
        btnEnVivo.addEventListener('click', () => marcarEnVivo(p.id, btnEnVivo));
      }
      card.querySelector('[data-action="finalizar"]').addEventListener('click', () => {
        finalizarPartido(p.id);
      });
    });
  }

  // DENTRO del closure — no en window
  async function marcarEnVivo(id, btn) {
    const isEnVivo = btn.dataset.estado === 'EN_VIVO';
    btn.disabled = true;
    btn.innerText = 'Actualizando...';
    
    const newState = isEnVivo ? 'PROGRAMADO' : 'EN_VIVO';

    const { error } = await supabase
      .from('partidos')
      .update({ estado: newState })
      .eq('id', id);

    if (error) {
      console.error(error);
      showToast('Error. Verifica permisos.', true);
      btn.disabled = false;
      btn.innerText = isEnVivo ? '🔴 QUITAR EN VIVO' : '▶️ INICIAR PARTIDO (EN VIVO)';
    } else {
      btn.disabled = false;
      if (newState === 'EN_VIVO') {
        btn.innerText = '🔴 QUITAR EN VIVO';
        btn.style.background = '#16a34a';
        btn.dataset.estado = 'EN_VIVO';
        showToast('Partido marcado como EN VIVO');
      } else {
        btn.innerText = '▶️ INICIAR PARTIDO (EN VIVO)';
        btn.style.background = 'var(--navy)';
        btn.dataset.estado = 'PROGRAMADO';
        showToast('En Vivo desactivado');
      }
    }
  }

  async function actualizarGol(id, tipo, cantidad) {
    const displayElement = document.getElementById(tipo === 'local' ? `local-${id}` : `visita-${id}`);
    const valorPrevio = parseInt(displayElement.innerText); // valor ACTUAL en el DOM al momento del clic
    let nuevoValor = valorPrevio + cantidad;
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
    const reclamo = document.getElementById(`reclamo-${id}`).value.trim();

    const { error } = await supabase
      .from('partidos')
      .update({ estado: 'EN_REVISION', reclamo: reclamo })
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
