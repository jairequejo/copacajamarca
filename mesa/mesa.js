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
  async function cargarPartidos() {
    partidosList.innerHTML = '<p style="text-align:center; color:#94a3b8;">Cargando partidos programados...</p>';
    
    // Obtenemos los partidos que están PROGRAMADOS o EN_VIVO
    const { data, error } = await supabase
      .from('partidos')
      .select(`
        id,
        goles_local,
        goles_visitante,
        estado,
        fecha_hora,
        cancha,
        categoria,
        equipo_local:equipos!partidos_equipo_local_id_fkey(nombre),
        equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre)
      `)
      .in('estado', ['PROGRAMADO', 'EN_VIVO'])
      .not('fecha_hora', 'is', null)
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

    renderizarPartidos(data);
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

      const card = document.createElement('div');
      card.className = 'partido-card';
      card.dataset.id = p.id;
      card.dataset.golesLocal = p.goles_local;
      card.dataset.golesVisita = p.goles_visitante;
      card.innerHTML = `
        <div class="partido-header">
          <span>${safe(horaTexto)} - ${safe(p.cancha || 'Cancha')}</span>
          <span>Cat: ${safe(p.categoria || 'N/A')}</span>
        </div>
        
        <div style="margin-bottom: 14px;">
          <button class="btn-envivo" data-action="envivo" ${p.estado === 'EN_VIVO' ? 'disabled style="background:#16a34a; opacity:1;"' : ''}>
            ${p.estado === 'EN_VIVO' ? '🟢 EN VIVO' : '▶️ INICIAR PARTIDO (EN VIVO)'}
          </button>
        </div>

        <div class="equipo-row">
          <div class="equipo-name">${safe(p.equipo_local?.nombre || 'Local')}</div>
          <div class="score-controls">
            <button class="btn-score minus" data-team="local" data-delta="-1">-</button>
            <div class="score-display" id="local-${p.id}">${p.goles_local}</div>
            <button class="btn-score plus" data-team="local" data-delta="1">+</button>
          </div>
        </div>

        <div class="equipo-row">
          <div class="equipo-name">${safe(p.equipo_visitante?.nombre || 'Visita')}</div>
          <div class="score-controls">
            <button class="btn-score minus" data-team="visitante" data-delta="-1">-</button>
            <div class="score-display" id="visita-${p.id}">${p.goles_visitante}</div>
            <button class="btn-score plus" data-team="visitante" data-delta="1">+</button>
          </div>
        </div>

        <button class="btn-finalizar" data-action="finalizar">Finalizar Partido</button>
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
      btn.innerText = '▶️ INICIAR PARTIDO (EN VIVO)';
    } else {
      btn.innerText = '🟢 EN VIVO';
      btn.style.background = '#16a34a';
      showToast('Partido marcado como EN VIVO');
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
    if (!confirm('¿Seguro que deseas enviar este partido a revisión? Desaparecerá de esta lista.')) return;

    const { error } = await supabase
      .from('partidos')
      .update({ estado: 'EN_REVISION' })
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
