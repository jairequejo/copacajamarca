import { supabase } from '../assets/js/supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard');
  const btnLogin = document.getElementById('btn-login');
  const toast = document.getElementById('toast');
  
  const delNombre = document.getElementById('del-nombre');
  const delEquipo = document.getElementById('del-equipo');
  const delLogo = document.getElementById('del-logo');
  
  const searchInput = document.getElementById('search-input');
  const btnSearch = document.getElementById('btn-search');
  const searchResults = document.getElementById('search-results');

  // Sanitizador XSS mínimo
  const safe = s => String(s ?? '').replace(/[<>"'&]/g, c =>
    ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));

  function showToast(msg, error = false) {
    toast.textContent = msg;
    toast.style.background = error ? '#ef4444' : '#16a34a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- LOGICA DE CAJAS DNI (OTP) ---
  const dniBoxes = document.querySelectorAll('.dni-box');
  const hiddenDni = document.getElementById('dni-input');

  function updateHiddenDni() {
    hiddenDni.value = Array.from(dniBoxes).map(box => box.value).join('');
  }

  dniBoxes.forEach((box, index) => {
    // Manejar ingreso de numeros
    box.addEventListener('input', (e) => {
      // Forzar solo números
      box.value = box.value.replace(/[^0-9]/g, '');
      if (box.value) {
        box.classList.add('filled');
        if (index < dniBoxes.length - 1) {
          dniBoxes[index + 1].focus();
        }
      } else {
        box.classList.remove('filled');
      }
      updateHiddenDni();
    });

    // Manejar backspace
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        dniBoxes[index - 1].focus();
        dniBoxes[index - 1].value = '';
        dniBoxes[index - 1].classList.remove('filled');
        updateHiddenDni();
      }
    });

    // Manejar pegado (paste) de 8 digitos
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
        if (i < 8) {
          dniBoxes[i].focus();
        } else {
          dniBoxes[7].focus();
          // Auto submit si pego 8
          document.getElementById('btn-login').click();
        }
      }
    });
  });

  // --- LOGIN DE DELEGADO / ENTRENADOR
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dni = document.getElementById('dni-input').value.trim();
    if (!dni) return;

    btnLogin.innerText = "Verificando...";
    
    // Consulta a Supabase aceptando DELEGADO o ENTRENADOR
    const { data, error } = await supabase
      .from('personas')
      .select('nombre_completo, rol, equipo_id, equipos(nombre, logo_url)')
      .eq('dni', dni)
      .in('rol', ['DELEGADO', 'ENTRENADOR'])
      .single();

    btnLogin.innerText = "Autenticar";

    if (error || !data) {
      showToast('DNI no registrado como Delegado o Entrenador', true);
      return;
    }

    // Éxito
    document.getElementById('dni-input').blur();
    btnLogin.innerText = "¡Validado!";
    
    setTimeout(() => {
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      
      // Etiqueta según rol
      const rolLabel = data.rol === 'ENTRENADOR' ? 'Entrenador' : 'Delegado';
      delNombre.innerText = `Hola, ${data.nombre_completo.split(' ')[0]}`;
      delEquipo.innerText = `${rolLabel}: ${data.equipos?.nombre || 'Sin Equipo'}`;
      
      if (data.equipos?.logo_url) {
        delLogo.src = data.equipos.logo_url;
        delLogo.style.display = 'block';
      }
    }, 800);
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    location.reload();
  });

  // --- BUSCADOR DE JUGADORES RIVALES ---
  btnSearch.addEventListener('click', async () => {
    const term = searchInput.value.trim();
    if (term.length < 3) {
      showToast('Ingresa al menos 3 caracteres', true);
      return;
    }

    searchResults.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:15px;">Buscando en la base de datos...</p>';

    // Buscar por DNI exacto o ILIKE en nombre
    const { data, error } = await supabase
      .from('personas')
      .select('dni, nombre_completo, categorias, equipos(nombre)')
      .eq('rol', 'JUGADOR')
      .or(`dni.eq.${term},nombre_completo.ilike.%${term}%`)
      .limit(5);

    if (error) {
      console.error(error);
      searchResults.innerHTML = '<p style="color:#ef4444; text-align:center;">Error en la búsqueda.</p>';
      return;
    }

    if (data.length === 0) {
      searchResults.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:15px;">No se encontró ningún jugador.</p>';
      return;
    }

    searchResults.innerHTML = '';
    data.forEach(jugador => {
      // Como nombramos la foto exactamente como el DNI, predecimos la URL
      // Asegúrate de cambiar "dnis" por el nombre real de tu bucket público en Supabase Storage
      const fotoUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/dnis/${jugador.dni}.jpg`;
      
      const card = document.createElement('div');
      card.className = 'jugador-card';
      card.innerHTML = `
        <div class="jugador-info">
          <strong>${safe(jugador.nombre_completo)}</strong>
          <span>DNI: ${safe(jugador.dni)} | Cat: ${safe(jugador.categorias || 'N/A')}</span>
          <span style="color:#0f172a; font-weight:600;">${safe(jugador.equipos?.nombre || 'Libre')}</span>
        </div>
        <a href="${safe(fotoUrl)}" target="_blank" class="btn-ver-pdf">Ver Ficha</a>
      `;
      searchResults.appendChild(card);
    });
  });
});
