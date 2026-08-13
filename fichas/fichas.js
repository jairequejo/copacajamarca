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
  const btnSearch = document.getElementById('btn-search');
  const searchResults = document.getElementById('search-results');
  
  const btnBack = document.getElementById('btn-back');
  const sectionTitle = document.getElementById('section-title');
  const searchSection = document.getElementById('search-section');
  
  const viewEquipos = document.getElementById('view-equipos');
  const viewCategorias = document.getElementById('view-categorias');
  const viewJugadores = document.getElementById('view-jugadores');
  const jugadoresHeader = document.getElementById('jugadores-header');
  const btnAddJugador = document.getElementById('btn-add-jugador');
  
  const modalJugador = document.getElementById('modal-jugador');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const formJugador = document.getElementById('form-jugador');
  const btnSubmitJugador = document.getElementById('btn-submit-jugador');
  const fjCategoria = document.getElementById('fj-categoria');

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

  const dniBoxes = document.querySelectorAll('.dni-box');
  const hiddenDni = document.getElementById('dni-input');

  function updateHiddenDni() {
    hiddenDni.value = Array.from(dniBoxes).map(b => b.value).join('');
  }

  dniBoxes.forEach((box, index) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '');
      if (box.value) {
        box.classList.add('filled');
        if (index < dniBoxes.length - 1) dniBoxes[index + 1].focus();
      } else {
        box.classList.remove('filled');
      }
      updateHiddenDni();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        dniBoxes[index - 1].focus();
        dniBoxes[index - 1].value = '';
        dniBoxes[index - 1].classList.remove('filled');
        updateHiddenDni();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 8);
      if (pasteData) {
        let i = 0;
        for (i; i < pasteData.length; i++) {
          dniBoxes[i].value = pasteData[i];
          dniBoxes[i].classList.add('filled');
        }
        updateHiddenDni();
        if (i < 8) dniBoxes[i].focus();
        else {
          dniBoxes[7].focus();
          btnLogin.click();
        }
      }
    });
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dni = hiddenDni.value.trim();
    if (dni.length < 8) return;

    btnLogin.innerText = "VERIFICANDO...";
    
    const { data, error } = await supabase
      .from('personas')
      .select('nombre_completo, rol, equipo_id, equipos(nombre, logo_url, categorias)')
      .eq('dni', dni)
      .in('rol', ['DELEGADO', 'ENTRENADOR'])
      .maybeSingle();

    if (error) {
      btnLogin.innerText = "AUTENTICAR";
      showToast('Error de conexión');
      return;
    }

    if (!data) {
      btnLogin.innerText = "AUTENTICAR";
      showToast('DNI no registrado como Delegado');
      return;
    }

    btnLogin.innerText = "¡VALIDADO!";
    loggedUser = data;
    
    setTimeout(() => {
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      btnLogout.style.display = 'block';
      
      const rolLabel = data.rol === 'ENTRENADOR' ? 'Entrenador' : 'Delegado';
      delNombre.innerText = `HOLA, ${data.nombre_completo.split(' ')[0].toUpperCase()}`;
      delEquipo.innerText = `${rolLabel}: ${data.equipos?.nombre || 'Sin Equipo'}`;
      
      if (data.equipos?.logo_url) {
        delLogo.src = data.equipos.logo_url;
        delLogo.style.display = 'block';
      }

      loadEquipos();
    }, 500);
  });

  btnLogout.addEventListener('click', () => location.reload());

  // BUSCADOR RAPIDO
  btnSearch.addEventListener('click', async () => {
    const term = searchInput.value.trim();
    if (term.length < 3) {
      showToast('Ingresa al menos 3 caracteres');
      return;
    }

    searchResults.innerHTML = '<p style="text-align:center; color:#fff; margin-top:15px;">Buscando en la base de datos...</p>';

    const { data, error } = await supabase
      .from('personas')
      .select('dni, nombre_completo, categorias, fecha_nacimiento, equipos(nombre)')
      .eq('rol', 'JUGADOR')
      .or(`dni.eq.${term},nombre_completo.ilike.%${term}%`)
      .limit(5);

    if (error) {
      searchResults.innerHTML = '<p style="color:#ef4444; text-align:center;">Error en la búsqueda.</p>';
      return;
    }

    if (data.length === 0) {
      searchResults.innerHTML = '<p style="text-align:center; color:#fff; margin-top:15px;">No se encontró ningún jugador.</p>';
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

      const card = document.createElement('div');
      card.className = 'jugador-card';
      card.innerHTML = `
        <img src="${safe(fotoUrl)}" class="jugador-foto" alt="Foto" onerror="this.src='../assets/img/logo.png'; this.style.opacity='0.3';">
        <div class="jugador-info">
          <h4>${safe(jugador.nombre_completo)}</h4>
          <p>DNI: <strong>${safe(jugador.dni)}</strong> | Edad: ${edad} años</p>
          <p>Categoría: <strong>${safe(jugador.categorias || 'N/A')}</strong></p>
          <span style="color:var(--navy); font-weight:800; display:block; margin-top:6px; font-size:1.1rem; text-transform:uppercase;">${safe(jugador.equipos?.nombre || 'Libre')}</span>
        </div>
        <a href="${safe(fotoUrl)}" target="_blank" class="btn-action" style="background:var(--red);">VER FICHA DNI</a>
      `;
      searchResults.appendChild(card);
    });
  });

  // EXPLORADOR
  async function loadEquipos() {
    viewEquipos.innerHTML = '<p style="color:#fff;">Cargando equipos...</p>';
    const { data } = await supabase.from('equipos').select('id, nombre, logo_url, categorias').order('nombre');
    if (!data) return;
    
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
  }

  function selectEquipo(eq) {
    currentTeam = eq;
    currentView = 'categorias';
    sectionTitle.innerText = `CATEGORÍAS DE ${eq.nombre}`;
    btnBack.style.display = 'block';
    searchSection.style.display = 'none'; // Ocultar buscador al explorar a fondo
    
    viewEquipos.style.display = 'none';
    viewCategorias.style.display = 'grid';
    viewJugadores.style.display = 'none';
    
    viewCategorias.innerHTML = '';

    const rawCats = eq.categorias || '';
    const catsArray = rawCats.split(',').map(c => c.trim().replace(/\r?\n|\r/g, '')).filter(c => c);

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
    sectionTitle.innerText = `JUGADORES ${cat} - ${currentTeam.nombre}`;
    
    viewCategorias.style.display = 'none';
    
    if (loggedUser && loggedUser.equipo_id === currentTeam.id) {
      jugadoresHeader.style.display = 'flex';
      fjCategoria.innerHTML = `<option value="${safe(cat)}">${safe(cat)}</option>`;
    } else {
      jugadoresHeader.style.display = 'none';
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
    fichaBtn.href = fichaUrl;
    fichaBtn.innerText = '📄 ABRIR FICHA FOTOGRÁFICA (PDF)';
    viewJugadores.appendChild(fichaBtn);

    if (!players || players.length === 0) {
      const msg = document.createElement('p');
      msg.style.color = '#fff';
      msg.innerText = 'Aún no se han registrado jugadores en esta categoría.';
      viewJugadores.appendChild(msg);
      return;
    }

    players.sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));
    
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
          <h4>${safe(p.nombre_completo)}</h4>
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
      sectionTitle.innerText = `CATEGORÍAS DE ${currentTeam.nombre}`;
      viewJugadores.style.display = 'none';
      jugadoresHeader.style.display = 'none';
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

  // LOGICA DEL MODAL
  btnAddJugador.addEventListener('click', () => {
    formJugador.reset();
    modalJugador.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    modalJugador.classList.remove('active');
  });

  formJugador.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSubmitJugador.disabled = true;
    btnSubmitJugador.innerText = 'GUARDANDO...';

    const fDni = document.getElementById('fj-dni').value.trim();
    const fNombres = document.getElementById('fj-nombres').value.trim().toUpperCase();
    const fFecha = document.getElementById('fj-fecha').value;
    const fCat = document.getElementById('fj-categoria').value;
    const fileInput = document.getElementById('fj-foto');

    try {
      // 1. Guardar o actualizar jugador en la base de datos (UPSERT)
      const { error: dbError } = await supabase.from('personas').upsert({
        dni: fDni,
        nombre_completo: fNombres,
        fecha_nacimiento: fFecha,
        categorias: fCat,
        equipo_id: loggedUser.equipo_id,
        rol: 'JUGADOR'
      }, { onConflict: 'dni' });

      if (dbError) throw dbError;

      // 2. Subir imagen si existe
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const { error: uploadError } = await supabase.storage.from('dnis').upload(`${fDni}.jpg`, file, {
          cacheControl: '3600',
          upsert: true
        });
        if (uploadError) throw uploadError;
      }

      showToast('JUGADOR INSCRITO CORRECTAMENTE');
      modalJugador.classList.remove('active');
      selectCategoria(currentCat); // Recargar la lista

    } catch (err) {
      console.error(err);
      showToast('ERROR AL GUARDAR. REVISE LOS DATOS.');
    } finally {
      btnSubmitJugador.disabled = false;
      btnSubmitJugador.innerText = 'GUARDAR JUGADOR';
    }
  });

});
