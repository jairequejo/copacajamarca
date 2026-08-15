import { supabase } from '../assets/js/supabase.js';

// ════════════════════════════════════════════════
// BOLETERÍA QR — Validador de Carnets con PIN
// ════════════════════════════════════════════════

const BUCKET_URL = 'https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/dnis';

// Elementos del DOM
const pinView    = document.getElementById('pin-view');
const appHeader  = document.getElementById('app-header');
const appMain    = document.getElementById('app-main');
const formPin    = document.getElementById('form-pin');
const pinBoxes   = document.querySelectorAll('.pin-box');
const btnScanner = document.getElementById('btn-scanner');
const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const resultado  = document.getElementById('resultado');
const historialList = document.getElementById('historial-list');
const histCount  = document.getElementById('hist-count');
const toast      = document.getElementById('toast');

let codeReader  = null;
let isScanning  = false;
let isProcessingScan = false; // Bloqueador de escaneos múltiples
let historial   = JSON.parse(localStorage.getItem('historial_ui') || '[]');
let lastScanned = null;

// Sonidos Antifrágiles nativos (AudioContext)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(success) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  if (success) {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  }
}

// Sanitizador XSS mínimo
const safe = s => String(s ?? '').replace(/[<>"'&]/g, c =>
  ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));

// ── TOAST ─────────────────────────────────────────
function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.style.background = ok ? '#16a34a' : '#d60d0d';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ════════════════════════════════════════════════
// 1. LOGIN CON PIN
// ════════════════════════════════════════════════

// Lógica de navegación entre cajas del PIN
pinBoxes.forEach((box, index) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/[^0-9]/g, '');
    if (box.value) {
      box.classList.add('filled');
      if (index < pinBoxes.length - 1) {
        pinBoxes[index + 1].focus();
      } else {
        // Auto-submit al llenar los 4
        formPin.dispatchEvent(new Event('submit'));
      }
    } else {
      box.classList.remove('filled');
    }
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && index > 0) {
      pinBoxes[index - 1].focus();
      pinBoxes[index - 1].value = '';
      pinBoxes[index - 1].classList.remove('filled');
    }
  });
});

// Autofocus al primer box al cargar
setTimeout(() => pinBoxes[0]?.focus(), 300);

// Verificar PIN contra Supabase
formPin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pinIngresado = Array.from(pinBoxes).map(b => b.value).join('');
  if (pinIngresado.length < 4) return;

  const btnSubmit = document.getElementById('btn-pin-enter');
  btnSubmit.textContent = 'Verificando…';

  const { data, error } = await supabase
    .from('config')
    .select('valor')
    .eq('clave', 'boleteria_pin')
    .single();

  if (error || !data) {
    showToast('Error de conexión. Reintenta en un momento.', false);
    limpiarPin();
    btnSubmit.textContent = 'Ingresar';
    return;
  }

  if (pinIngresado === data.valor) {
    entrarApp();
  } else {
    showToast('PIN incorrecto', false);
    limpiarPin();
    btnSubmit.textContent = 'Ingresar';
    // Shake animado
    formPin.style.animation = 'none';
    setTimeout(() => {
      formPin.style.animation = 'shake 0.4s ease';
    }, 10);
  }
});

function limpiarPin() {
  pinBoxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
  pinBoxes[0].focus();
}

function entrarApp() {
  pinView.style.display = 'none';
  appHeader.style.display = 'flex';
  appMain.style.display = 'flex';
  document.getElementById('bottom-nav').style.display = 'flex';
  renderHistorial(); // Renderizar historial guardado
  showToast('Acceso autorizado — Bienvenido');
  
  // Cargar directorio de staff
  if (typeof loadStaff === 'function') {
    loadStaff();
  }
}

// Animación shake para PIN incorrecto
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}
    60%{transform:translateX(-6px)}
    80%{transform:translateX(4px)}
  }
`;
document.head.appendChild(style);

// ════════════════════════════════════════════════
// 2. SCANNER QR
// ════════════════════════════════════════════════

function setStatus(text, active = false, error = false) {
  statusText.textContent = text;
  statusDot.className = 'status-dot' + (active ? ' active' : error ? ' error' : '');
}

btnScanner.addEventListener('click', () => {
  if (isScanning) {
    detenerScanner();
  } else {
    iniciarScanner();
  }
});

async function iniciarScanner() {
  try {
    const ZXing = window.ZXing;
    if (!ZXing) {
      showToast('Librería QR no cargada aún', false);
      return;
    }
    codeReader = new ZXing.BrowserQRCodeReader();
    // Acelerador: Reducimos el tiempo entre intentos de escaneo de 500ms a 100ms
    codeReader.timeBetweenDecodingAttempts = 100;

    setStatus('Iniciando cámara…');

    // Verificar si el navegador bloquea la cámara por no ser HTTPS
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      showToast('Navegador bloqueó cámara (Requiere HTTPS)', false);
      setStatus('Error de seguridad (Usa HTTPS)', false, true);
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputDevices = devices.filter(d => d.kind === 'videoinput');

    if (!videoInputDevices.length) {
      showToast('No se encontró cámara en el dispositivo', false);
      setStatus('Sin cámara detectada', false, true);
      return;
    }

    // Preferir cámara trasera
    const selectedDeviceId = videoInputDevices.find(d =>
      /back|rear|environment/i.test(d.label)
    )?.deviceId || videoInputDevices[videoInputDevices.length - 1]?.deviceId;

    isScanning = true;
    btnScanner.textContent = 'Detener Cámara';
    btnScanner.classList.add('activo');
    setStatus('Apunta el QR del carnet al recuadro', true);

    // Estrategia de Aprovechamiento (Rendimiento):
    // Forzamos una resolución baja/media (640x480) para que el procesamiento de ZXing en JS no sature la CPU del móvil.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        facingMode: "environment",
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    codeReader.decodeFromStream(stream, 'video-preview', async (result, err) => {
      if (result) {
        if (isProcessingScan) return; // Bloquear si ya estamos procesando uno o si no le dio a siguiente

        const qrText = result.getText().trim();

        // Anti-duplicados (redundancia)
        if (qrText === lastScanned) return;
        lastScanned = qrText;
        setTimeout(() => { lastScanned = null; }, 3000);

        // Extraer DNI del QR (Antifrágil)
        let dni = qrText;
        try {
          if (qrText.includes('dni=')) {
            const match = qrText.match(/dni=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              dni = match[1];
            }
          } else {
            const parsed = JSON.parse(qrText);
            if (parsed.dni) dni = String(parsed.dni);
          }
        } catch (_) { /* si falla, se asume texto plano */ }

        // Validar formato
        dni = dni.trim();
        if (!/^[a-zA-Z0-9_-]{4,15}$/.test(dni)) {
          playBeep(false);
          setStatus(`QR Inválido: ${dni.slice(0, 15)}`, false, true);
          return;
        }

        isProcessingScan = true; // Bloquear motor
        setStatus(`DNI ${dni} — Consultando…`, true);
        await validarPersona(dni);
      }
    });

  } catch (err) {
    console.error(err);
    setStatus('Error al acceder a la cámara', false, true);
    showToast('No se pudo acceder a la cámara', false);
    isScanning = false;
    btnScanner.textContent = 'Iniciar Escáner';
    btnScanner.classList.remove('activo');
  }
}

function detenerScanner() {
  const videoEl = document.getElementById('video-preview');
  if (videoEl && videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
  if (codeReader) { codeReader.reset(); codeReader = null; }
  isScanning = false;
  btnScanner.textContent = 'Iniciar Escáner';
  btnScanner.classList.remove('activo');
  setStatus('Cámara detenida.');
}

// ── VALIDAR EN SUPABASE Y LÓGICA ANTI-FRAUDE ────────
async function validarPersona(dni) {
  const { data, error } = await supabase
    .from('personas')
    .select('nombre_completo, dni, rol, categorias, equipos(nombre, logo_url)')
    .eq('dni', dni)
    .in('rol', ['DELEGADO', 'ENTRENADOR', 'JUGADOR'])
    .single();

  if (error || !data) {
    playBeep(false);
    isProcessingScan = false; // Desbloquear si falla
    mostrarError(dni, 'DNI no registrado en el sistema');
    agregarHistorial(null, dni, false);
    return;
  }
  
  // Anti-Passback Local
  const dbLocal = JSON.parse(localStorage.getItem('escaneos_cc') || '{}');
  const record = dbLocal[dni] || { conteo: 0, ultimo: null, horas_lista: [] };
  if (!record.horas_lista) record.horas_lista = []; // migración segura
  
  let warningInfo = null;
  let isAlert = false;

  if (record.ultimo) {
    const diffMin = Math.floor((Date.now() - record.ultimo) / 60000);
    const listaTiempos = record.horas_lista.join(', ');
    
    if (diffMin < 60) {
      isAlert = true;
      warningInfo = `¡ALERTA! Carnet escaneado hace ${diffMin} min. (Ya ingresó a las: ${listaTiempos})`;
    } else {
      warningInfo = `INFO: Ingresos previos a las: ${listaTiempos}`;
    }
  }

  // Sonido
  playBeep(!isAlert);

  // Actualizar DB local
  const horaActualStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  record.conteo += 1;
  record.ultimo = Date.now();
  record.horas_lista.push(horaActualStr);
  if (record.horas_lista.length > 5) record.horas_lista.shift(); // Guardar ultimos 5 para no reventar
  
  dbLocal[dni] = record;
  localStorage.setItem('escaneos_cc', JSON.stringify(dbLocal));

  mostrarResultado(data, warningInfo, record.conteo, isAlert);
  agregarHistorial(data, dni, true);
}

// ── MOSTRAR RESULTADO ─────────────────────────────
function mostrarResultado(persona, warningInfo, conteo, isAlert) {
  const fotoUrl = `${BUCKET_URL}/${persona.dni}.jpg`;
  const rolLabel = {
    'DELEGADO':   'Delegado Oficial',
    'ENTRENADOR': 'Entrenador',
    'JUGADOR':    'Jugador Registrado',
  }[persona.rol] || persona.rol;

  resultado.style.display = 'block';
  
  let warningHtml = '';
  if (warningInfo) {
    warningHtml = `
      <div style="background:${isAlert ? '#d60d0d' : '#f1a200'}; color:${isAlert ? '#fff' : '#000'}; font-family:'Barlow Condensed', sans-serif; padding:12px; font-size:1rem; font-weight:800; text-align:center; animation: shake 0.5s;">
        ${warningInfo}
      </div>
    `;
  }

  resultado.innerHTML = `
    <div class="result-header ok">✓ ACCESO AUTORIZADO</div>
    ${warningHtml}
    <div class="result-body">
      <div class="result-persona">
        <img src="${safe(fotoUrl)}" class="result-foto" alt="Foto"
             onerror="this.style.opacity='.25';">
        <div>
          <div class="result-info-name">${safe(persona.nombre_completo)}</div>
          <div class="result-info-detail">DNI: ${safe(persona.dni)} • Total Ingresos: ${conteo}</div>
        </div>
      </div>
      <div class="result-badges">
        <span class="badge badge-ok">${safe(rolLabel)}</span>
        <span class="badge badge-gold">${safe(persona.equipos?.nombre || 'Sin equipo')}</span>
        ${persona.categorias ? `<span class="badge badge-navy">Cat. ${safe(persona.categorias)}</span>` : ''}
      </div>
      <button class="btn-nuevo-scan" id="btn-nuevo" style="background:#eab308; color:#000; font-weight:900;">✓ ESCANEAR SIGUIENTE</button>
    </div>
  `;
  document.getElementById('btn-nuevo').addEventListener('click', () => {
    resultado.style.display = 'none';
    resultado.innerHTML = '';
    isProcessingScan = false; // Desbloquear motor para escanear de nuevo
  });

  setStatus(`✓ ${persona.nombre_completo.split(' ')[0]} — Autorizado`, true);
  showToast(`${persona.nombre_completo.split(' ')[0]} — Acceso autorizado`);
}

function mostrarError(dni, mensaje) {
  resultado.style.display = 'block';
  resultado.innerHTML = `
    <div class="result-header err">✗ ACCESO DENEGADO</div>
    <div class="result-body">
      <p class="result-error-msg">${safe(mensaje)}</p>
      <p style="font-family:'Barlow Condensed',sans-serif;font-size:.8rem;color:rgba(255,255,255,.35);margin-top:8px;">DNI escaneado: ${safe(dni)}</p>
      <button class="btn-nuevo-scan" id="btn-nuevo" style="margin-top:16px;">Escanear siguiente</button>
    </div>
  `;
  document.getElementById('btn-nuevo').addEventListener('click', () => {
    resultado.style.display = 'none';
    resultado.innerHTML = '';
  });

  setStatus(`✗ DNI ${dni} — No autorizado`, false, true);
  showToast(`DNI ${dni} — No en el sistema`, false);
}

// ── HISTORIAL ─────────────────────────────────────
function agregarHistorial(persona, dni, ok) {
  const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  historial.unshift({ persona, dni, ok, hora });
  if (historial.length > 50) historial.pop(); // evitar memory leak en sesiones largas
  localStorage.setItem('historial_ui', JSON.stringify(historial));
  renderHistorial();
}

function renderHistorial() {
  histCount.textContent = historial.length;
  historialList.innerHTML = '';
  if (historial.length === 0) {
    historialList.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,.3);">Ningún escaneo aún</div>';
    return;
  }

  historial.forEach(h => {
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.innerHTML = `
      <span class="hist-name">${safe(h.persona?.nombre_completo || 'Desconocido')}</span>
      <span class="hist-rol">${safe(h.persona?.rol || 'N/A')} · ${safe(h.hora)}</span>
      <span class="${h.ok ? 'hist-ok' : 'hist-err'}">${h.ok ? '✓' : '✗'}</span>
    `;
    historialList.appendChild(item);
  });
}

// ════════════════════════════════════════════════
// 3. TABS Y NAVEGACIÓN
// ════════════════════════════════════════════════
const navBtns = document.querySelectorAll('.nav-btn');
const appTabs = document.querySelectorAll('.app-tab');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    appTabs.forEach(t => t.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    
    // Auto-pausar escáner si sale de la pestaña
    if (btn.dataset.tab !== 'tab-escaner' && isScanning) {
      detenerScanner();
    }
  });
});

// ════════════════════════════════════════════════
// 4. DIRECTORIO Y GALERÍA DE STAFF
// ════════════════════════════════════════════════
const staffGrid = document.getElementById('staff-grid');
const galeriaGrid = document.getElementById('galeria-grid');
const staffStatus = document.getElementById('staff-status');
const searchStaff = document.getElementById('search-staff');
let allStaff = [];

async function loadStaff() {
  const { data, error } = await supabase
    .from('personas')
    .select('*, equipos(nombre)')
    .in('rol', ['ENTRENADOR', 'DELEGADO'])
    .order('nombre_completo');
    
  if (error) {
    staffStatus.textContent = 'Error cargando staff.';
    return;
  }
  
  if (!data || data.length === 0) {
    staffStatus.textContent = 'No hay staff registrado.';
    return;
  }
  
  staffStatus.style.display = 'none';
  allStaff = data;
  renderStaff(allStaff);
}

function renderStaff(list) {
  staffGrid.innerHTML = '';
  list.forEach(p => {
    const isRed = p.rol === 'ENTRENADOR';
    const fotoUrl = `${BUCKET_URL}/${p.dni}.jpg`;
    const card = document.createElement('div');
    card.className = 'dir-card';
    card.style.borderTop = `3px solid ${isRed ? '#d60d0d' : '#3b82f6'}`;
    
    card.innerHTML = `
      <img class="dir-foto" src="${safe(fotoUrl)}" onerror="this.src='../assets/img/logo.png'">
      <div class="dir-name">${safe(p.nombre_completo)}</div>
      <div class="dir-rol" style="color:${isRed ? '#d60d0d' : '#3b82f6'};">${safe(p.rol)}</div>
      <div class="dir-team">${safe(p.equipos?.nombre || 'Independiente')}</div>
      <div style="font-size:0.7rem; color:rgba(255,255,255,0.4); margin-top:8px;">DNI: ${safe(p.dni)}</div>
    `;
    staffGrid.appendChild(card);
  });
}

searchStaff.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allStaff.filter(p => 
    p.nombre_completo.toLowerCase().includes(term) || 
    p.dni.includes(term)
  );
  renderStaff(filtered);
});


