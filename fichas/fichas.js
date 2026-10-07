import { supabase } from '../assets/js/supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard');
  const btnLogin = document.getElementById('btn-login');
  const toast = document.getElementById('toast');
  const btnLogout = document.getElementById('btn-logout');
  
  const delNombre = document.getElementById('del-nombre');
  const delEquipo = document.getElementById('del-equipo');
  const delLogo = document.getElementById('del-logo');
  
  const searchInput = document.getElementById('search-input');
  
  const searchResults = document.getElementById('search-results');
  
  const btnBack = document.getElementById('btn-back');
  const sectionTitle = document.getElementById('section-title');
  const searchSection = document.getElementById('search-section');
  
  const viewEquipos = document.getElementById('view-equipos');
  const viewCategorias = document.getElementById('view-categorias');
  const pendingContent = document.getElementById('pending-content');
  const pendingCount = document.getElementById('pending-count');
  const viewJugadores = document.getElementById('view-jugadores');
  let currentView = 'equipos';
  let allTeams = [];
  let currentTeam = null;
  let loggedUser = null;
  let currentCat = null;

  const safe = s => String(s ?? '').replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  const dniSingle = document.getElementById('dni-input-single');
  const hiddenDni = document.getElementById('dni-input');

  if (dniSingle) {
    dniSingle.addEventListener('input', () => {
      dniSingle.value = dniSingle.value.replace(/[^0-9]/g, '');
      hiddenDni.value = dniSingle.value;
    });
  }

  async function performLogin(dni, isAuto = false) {
  try {
    if (!isAuto) {
      btnLogin.innerText = "VALIDANDO...";
      btnLogin.disabled = true;
    }
    
    const { data, error } = await supabase
      .from('personas')
      .select('nombre_completo, rol, equipo_id, equipos(nombre, logo_url)')
      .or(`dni.eq.${dni},dni_qr_impreso.eq.${dni}`)
      .in('rol', ['DELEGADO', 'ENTRENADOR'])
      .maybeSingle();

    if (error) {
      btnLogin.innerText = "AUTENTICAR";
      btnLogin.disabled = false;
      showToast('Error de conexión');
      return;
    }

    if (!data) {
      btnLogin.innerText = "AUTENTICAR";
      btnLogin.disabled = false;
      localStorage.removeItem('fichas_dni'); // Clear invalid saved DNI
      if (!isAuto) showToast('DNI no registrado como Delegado');
      return;
    }

    btnLogin.innerText = "¡VALIDADO!";
    localStorage.setItem('fichas_dni', dni);
    loggedUser = data;
    
    setTimeout(() => {
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      btnLogout.style.display = 'block';
      
      const bNav = document.querySelector('.bottom-nav');
      if (bNav) bNav.style.display = 'flex';
      
      const rolLabel = data.rol === 'ENTRENADOR' ? 'Entrenador' : 'Delegado';
      delNombre.innerText = `HOLA, ${data.nombre_completo.split(' ')[0].toUpperCase()}`;
      delEquipo.innerText = `${rolLabel}: ${data.equipos?.nombre || 'SIN EQUIPO'}`;
      
      if (data.equipos?.logo_url) {
        delLogo.src = data.equipos.logo_url;
        delLogo.style.display = 'block';
      }

      loadEquipos();
    }, isAuto ? 0 : 500);
  } catch (err) { alert("performLogin error: " + err.message); }
  }

  // AUTO LOGIN VIA URL OR LOCALSTORAGE
  const urlParams = new URLSearchParams(window.location.search);
  const urlDni = urlParams.get('dni');
  
  if (urlDni) {
    try {
        if (dniSingle) {
          dniSingle.value = urlDni;
          hiddenDni.value = urlDni;
        }
        
        localStorage.setItem('fichas_dni', urlDni);
        window.history.replaceState({}, document.title, window.location.pathname);
        performLogin(urlDni, true).catch(err => alert("Login err: " + err.message));
    } catch(e) {
        alert("Auto login error: " + e.message);
    }
  } else {
    const savedDni = localStorage.getItem('fichas_dni');
    if (savedDni) {
      performLogin(savedDni, true);
    }
  }

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.activeElement.blur();
    
    const dni = hiddenDni.value;
    if (dni.length !== 8) {
      showToast('Ingrese un DNI válido de 8 dígitos');
      return;
    }

    await performLogin(dni, false);
  });

  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('fichas_dni');
    location.reload();
  });

  // BUSCADOR RAPIDO
  
  let searchTimeout;
  
  // Close autocomplete on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchResults.innerHTML.trim() !== '') {
      searchResults.style.display = 'flex';
    }
  });

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim();
    if (!term || term.length < 3) {
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      return;
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      searchResults.style.display = 'flex';
      searchResults.innerHTML = '<div style="padding:16px; text-align:center; color:var(--navy); font-weight:600;">Buscando...</div>';

      const { data, error } = await supabase
        .from('personas')
        .select('dni, nombres, apellidos, categorias, fecha_nacimiento, equipos(nombre)')
        .eq('rol', 'JUGADOR')
        .or(`dni.eq.${term},dni_qr_impreso.eq.${term},nombres.ilike.%${term}%,apellidos.ilike.%${term}%`)
        .limit(10);

      if (error) {
        searchResults.innerHTML = '<div style="padding:16px; text-align:center; color:#ef4444;">Error en búsqueda</div>';
        return;
      }

      if (data.length === 0) {
        searchResults.innerHTML = '<div style="padding:16px; text-align:center; color:var(--navy);">No se encontraron jugadores</div>';
        return;
      }

      searchResults.innerHTML = '';
      data.forEach(jugador => {
        const fotoUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/dnis/${jugador.dni}.jpg`;
        
        let edad = 'N/A';
        if (jugador.fecha_nacimiento) {
          const diff = Date.now() - new Date(jugador.fecha_nacimiento).getTime();
          edad = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }

        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `
          <img src="${safe(fotoUrl)}" class="autocomplete-img" onerror="this.src='../assets/img/logo.png'; this.style.opacity='0.3';">
          <div class="autocomplete-info">
            <h4>${safe((jugador.apellidos ? jugador.apellidos + ", " : "") + (jugador.nombres || ""))}</h4>
            <p>${safe(jugador.dni)} | ${edad} años | Cat: ${safe(jugador.categorias || 'N/A')} | ${safe(jugador.equipos?.nombre || 'Libre')}</p>
          </div>
        `;
        div.addEventListener('click', () => {
          window.open(fotoUrl, '_blank');
        });
        searchResults.appendChild(div);
      });
    }, 400); // Debounce 400ms
  });


  // EXPLORADOR
  async function loadEquipos() {
    viewEquipos.innerHTML = '<p style="color:#fff;">Cargando equipos...</p>';
    const [
      { data: equipos, error: equiposError },
      { data: inscripciones, error: inscripcionesError },
      { data: posiciones, error: posicionesError }
    ] = await Promise.all([
      supabase.from('equipos').select('id, nombre, logo_url').order('nombre'),
      supabase.from('inscripciones_equipos').select('equipo_id, categoria'),
      supabase.from('view_posiciones').select('categoria, grupo, equipo_id, pj, pts, dg, gf')
    ]);

    if (equiposError || inscripcionesError || !equipos) {
      viewEquipos.innerHTML = '<p style="color:#fff;">No se pudieron cargar los equipos.</p>';
      pendingCount.textContent = '!';
      pendingContent.textContent = 'No se pudo verificar el estado de las fichas.';
      return;
    }

    const categoriasPorEquipo = new Map(equipos.map(eq => [eq.id, new Set()]));
    (inscripciones || []).forEach(inscripcion => {
      const categoria = String(inscripcion.categoria || '').trim();
      if (!categoria) return;
      categoriasPorEquipo.get(inscripcion.equipo_id)?.add(categoria);
    });

    const data = equipos.map(eq => ({
      ...eq,
      categorias: [...(categoriasPorEquipo.get(eq.id) || [])].sort().join(',')
    }));
    
    allTeams = data;
    viewEquipos.innerHTML = '';
    
    data.forEach(eq => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      const logo = eq.logo_url || '../assets/img/logo.png';
      card.innerHTML = `
        <img src="${safe(logo)}" alt="Logo" onerror="this.src='../assets/img/logo.png'">
        <h4>${safe(eq.nombre)}</h4>
      `;
      card.addEventListener('click', () => selectEquipo(eq));
      viewEquipos.appendChild(card);
    });

    loadPendingSheets(data, posicionesError ? [] : (posiciones || []));
  }

  async function loadPendingSheets(equipos, posiciones) {
    const checks = equipos.flatMap(eq => {
      const categorias = String(eq.categorias || '').split(',').map(c => c.trim()).filter(Boolean);
      return categorias.map(categoria => ({ equipo: eq, categoria }));
    });

    if (checks.length === 0) {
      pendingCount.textContent = '0';
      pendingContent.textContent = 'No hay categorías inscritas en el torneo.';
      return;
    }

    const results = await Promise.all(checks.map(async item => {
      const fichaUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/fichas/${item.equipo.id}_${item.categoria}.pdf`;
      try {
        const response = await fetch(fichaUrl, { method: 'HEAD', cache: 'no-store' });
        return { ...item, exists: response.ok, verified: true };
      } catch (error) {
        console.error('No se pudo verificar la ficha:', fichaUrl, error);
        return { ...item, exists: false, verified: false };
      }
    }));

    if (results.some(result => !result.verified)) {
      pendingCount.textContent = '!';
      pendingContent.textContent = 'No se pudieron verificar todas las fichas. Intente nuevamente.';
      return;
    }

    const sortStandings = (a, b) =>
      Number(b.pts || 0) - Number(a.pts || 0) ||
      Number(b.dg || 0) - Number(a.dg || 0) ||
      Number(b.gf || 0) - Number(a.gf || 0);

    function getQualificationStatus(item) {
      const categoria = String(item.categoria);
      const teamRows = posiciones.filter(row =>
        String(row.categoria) === categoria && row.equipo_id === item.equipo.id
      );
      const standing = categoria === '2014'
        ? teamRows.find(row => row.grupo)
        : teamRows.find(row => !row.grupo);

      if (!standing) {
        return {
          level: 'eliminated', rank: null, group: null, remainingMatches: null,
          maximumPoints: null, label: 'Sin posición disponible'
        };
      }

      const cutoff = categoria === '2014' ? 2 : 4;
      const pool = posiciones.filter(row => {
        if (String(row.categoria) !== categoria) return false;
        if (categoria === '2014') return row.grupo === standing.grupo;
        return !row.grupo;
      }).sort(sortStandings);
      const rank = pool.findIndex(row => row.equipo_id === item.equipo.id) + 1;
      const cutoffPoints = Number(pool[cutoff - 1]?.pts ?? Infinity);
      const remainingMatches = Math.max(0, pool.length - 1 - Number(standing.pj || 0));
      const maximumPoints = Number(standing.pts || 0) + remainingMatches * 3;

      if (rank > 0 && rank <= cutoff) {
        return {
          level: 'critical', rank, group: standing.grupo,
          remainingMatches, maximumPoints, label: '⚠ Clasificando: ficha urgente'
        };
      }

      if (rank > cutoff && maximumPoints >= cutoffPoints) {
        return {
          level: 'warning', rank, group: standing.grupo,
          remainingMatches, maximumPoints, label: '⚠ Todavía puede clasificar'
        };
      }

      return {
        level: 'eliminated', rank, group: standing.grupo,
        remainingMatches, maximumPoints, label: 'Ya no puede clasificar'
      };
    }

    const priority = { critical: 0, warning: 1, eliminated: 2 };
    const pendientes = results
      .filter(result => !result.exists)
      .map(result => ({ ...result, status: getQualificationStatus(result) }))
      .sort((a, b) =>
        priority[a.status.level] - priority[b.status.level] ||
        (a.status.rank ?? Infinity) - (b.status.rank ?? Infinity) ||
        a.equipo.nombre.localeCompare(b.equipo.nombre) ||
        a.categoria.localeCompare(b.categoria)
      );
    const totalPendientes = pendientes.length;
    pendingCount.textContent = totalPendientes;

    if (pendientes.length === 0) {
      pendingContent.className = 'pending-message';
      pendingContent.textContent = '✅ Todos los equipos tienen sus fichas PDF publicadas.';
      return;
    }

    pendingContent.className = 'pending-table-wrap';
    pendingContent.innerHTML = `
      <div class="pending-rule">Clasifican los 4 primeros por categoría; en 2014 clasifican los 2 primeros de cada grupo.</div>
      <table class="pending-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Categoría</th>
            <th>Posición</th>
            <th>Partidos restantes</th>
            <th>Máximo posible</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${pendientes.map(item => `
            <tr class="pending-row-${item.status.level}">
              <td>${safe(item.equipo.nombre)}</td>
              <td><span class="pending-category">${safe(item.categoria)}</span></td>
              <td>
                ${item.status.rank ? `${item.status.rank}.º` : '—'}
                ${item.status.group ? `<span class="position-detail">Grupo ${safe(item.status.group)}</span>` : ''}
              </td>
              <td>${item.status.remainingMatches ?? '—'}</td>
              <td>${item.status.maximumPoints !== null ? `${item.status.maximumPoints} pts` : '—'}</td>
              <td><span class="risk-badge risk-${item.status.level}">${safe(item.status.label)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function selectEquipo(eq) {
    currentTeam = eq;
    currentView = 'categorias';
    const logoUrl = eq.logo_url || '../assets/img/logo.png';
    sectionTitle.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><img src="${safe(logoUrl)}" style="height:40px; width:auto; object-fit:contain;" onerror="this.src='../assets/img/logo.png'"> <span>${safe(eq.nombre)}</span></div>`;
    btnBack.style.display = 'block';
    searchSection.style.display = 'none'; // Ocultar buscador al explorar a fondo
    
    viewEquipos.style.display = 'none';
    viewCategorias.style.display = 'grid';
    viewJugadores.style.display = 'none';
    
    viewCategorias.innerHTML = '';

    viewCategorias.innerHTML = '<p style="color:#fff;">Cargando categorías...</p>';

    const { data: inscripcionesEq } = await supabase
      .from('inscripciones_equipos')
      .select('categoria')
      .eq('equipo_id', eq.id);
    
    viewCategorias.innerHTML = '';
    const catsArray = inscripcionesEq ? inscripcionesEq.map(i => i.categoria) : [];

    if (catsArray.length === 0) {
      viewCategorias.innerHTML = '<p style="color:#fff;">Este equipo no tiene categorías inscritas.</p>';
      return;
    }

    catsArray.sort().forEach(c => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.innerHTML = `
        <div style="font-size:3rem; font-family:'Bebas Neue'; color:var(--gold); line-height:1; margin-bottom:10px;">${safe(c)}</div>
        <h4>VER JUGADORES</h4>
      `;
      card.addEventListener('click', () => selectCategoria(c));
      viewCategorias.appendChild(card);
    });
  }

  async function selectCategoria(cat) {
    currentView = 'jugadores';
    currentCat = cat;
    const logoUrl = currentTeam.logo_url || '../assets/img/logo.png';
    sectionTitle.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><img src="${safe(logoUrl)}" style="height:40px; width:auto; object-fit:contain;" onerror="this.src='../assets/img/logo.png'"> <span>${cat} - ${safe(currentTeam.nombre)}</span></div>`;
    
    viewCategorias.style.display = 'none';
    
    if (loggedUser && loggedUser.equipo_id === currentTeam.id) {
      
      } else {
      
    }
    
    viewJugadores.style.display = 'flex';
    
    viewJugadores.innerHTML = '<p style="color:#fff;">Cargando jugadores...</p>';

    const { data: players } = await supabase
      .from('personas')
      .select('*')
      .eq('equipo_id', currentTeam.id)
      .eq('rol', 'JUGADOR')
      .eq('categorias', cat);

    viewJugadores.innerHTML = '';

    const fichaUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/fichas/${currentTeam.id}_${cat}.pdf`;
    const fichaBtn = document.createElement('a');
    fichaBtn.className = 'btn-ficha-general';
    fichaBtn.target = '_blank';
    fichaBtn.href = `../fichas/visor.html?v=2&file=${encodeURIComponent(fichaUrl)}`;
    fichaBtn.innerText = '📄 VER FICHA FOTOGRÁFICA (PDF)';
    viewJugadores.appendChild(fichaBtn);

    if (!players || players.length === 0) {
      const msg = document.createElement('p');
      msg.style.color = '#fff';
      msg.innerText = 'Verificando ficha...';
      viewJugadores.appendChild(msg);

      try {
        const resp = await fetch(fichaUrl, { method: 'HEAD' });
        if (resp.ok) {
          msg.innerText = 'Ficha fotográfica disponible (Cargada en PDF).';
        } else {
          msg.innerText = 'Aún no se ha registrado la ficha en esta categoría.';
        }
      } catch (e) {
        msg.innerText = 'Aún no se ha registrado la ficha en esta categoría.';
      }
      return;
    }

    players.sort((a,b) => (a.apellidos || '').localeCompare(b.apellidos || ''));
    
    players.forEach(p => {
      const card = document.createElement('div');
      card.className = 'jugador-card';
      const fotoUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/dnis/${p.dni}.jpg`;
      
      let edad = 'N/A';
      if (p.fecha_nacimiento) {
        const diff = Date.now() - new Date(p.fecha_nacimiento).getTime();
        edad = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      }

      card.innerHTML = `
        <img src="${safe(fotoUrl)}" class="jugador-foto" alt="Foto" onerror="this.src='../assets/img/logo.png'; this.style.opacity='0.3';">
        <div class="jugador-info">
          <h4>${safe((p.apellidos ? p.apellidos + ", " : "") + (p.nombres || ""))}</h4>
          <p>DNI: <strong>${safe(p.dni)}</strong></p>
          <p>Edad: <strong>${edad} años</strong> (F. Nac: ${safe(p.fecha_nacimiento || 'N/A')})</p>
          <a href="${safe(fotoUrl)}" download="${safe(p.dni)}.jpg" target="_blank" class="btn-action">⬇️ Descargar DNI</a>
        </div>
      `;
      viewJugadores.appendChild(card);
    });
  }

  btnBack.addEventListener('click', () => {
    if (currentView === 'jugadores') {
      currentView = 'categorias';
      const logoUrl = currentTeam.logo_url || '../assets/img/logo.png';
      sectionTitle.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><img src="${safe(logoUrl)}" style="height:40px; width:auto; object-fit:contain;" onerror="this.src='../assets/img/logo.png'"> <span>${safe(currentTeam.nombre)}</span></div>`;
      viewJugadores.style.display = 'none';
      
      viewCategorias.style.display = 'grid';
    } else if (currentView === 'categorias') {
      currentView = 'equipos';
      sectionTitle.innerText = `EXPLORAR EQUIPOS PARTICIPANTES`;
      btnBack.style.display = 'none';
      searchSection.style.display = 'block'; // Mostrar buscador al volver a la raiz
      viewCategorias.style.display = 'none';
      viewEquipos.style.display = 'grid';
    }
  });

  // Ocultar bottom-nav en mobile cuando se abre el teclado (focus en inputs)
  const bottomNav = document.querySelector('.bottom-nav');
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (bottomNav) bottomNav.style.display = 'none';
      if (loginView && e.target.closest('#login-view')) {
        loginView.classList.add('keyboard-active');
        // Scroll slightly after layout changes to keep inputs visible
        setTimeout(() => { window.scrollBy(0, 150); }, 150);
      }
    }
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (bottomNav) bottomNav.style.display = 'flex';
      if (loginView) loginView.classList.remove('keyboard-active');
    }
  });

});
