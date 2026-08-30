import { supabase } from '../assets/js/supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard');
  const btnLogin = document.getElementById('btn-login');
  const listaRevision = document.getElementById('lista-revision');
  const toast = document.getElementById('toast');
  
  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Sanitizador XSS mínimo
  const safe = s => String(s ?? '').replace(/[<>"'&]/g, c =>
    ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));

  function showToast(msg, error = false) {
    toast.textContent = msg;
    toast.style.background = error ? '#ef4444' : '#16a34a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- TABS LOGIC ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // --- AUTH LOGIC ---
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (session.user.email.includes('admin')) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'block';
        cargarRevisiones();
        cargarEquiposParaSelect(); // solo aquí — no duplicar en submit
      } else {
        showToast('Acceso denegado. No eres Administrador.', true);
        await supabase.auth.signOut();
      }
    }
  };
  checkSession();

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('pass-input').value;

    if (!email || !password) return showToast('Llena los campos', true);

    btnLogin.innerText = "Verificando...";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast('Credenciales Inválidas', true);
      btnLogin.innerText = "Desbloquear";
    } else {
      if (data.user.email.includes('admin')) {
        btnLogin.innerText = '¡Entrando!';
        setTimeout(() => {
          loginView.style.display = 'none';
          dashboardView.style.display = 'block';
          cargarRevisiones();
          cargarEquiposParaSelect();
        }, 800);
      } else {
        showToast('Acceso denegado. No eres Administrador.', true);
        await supabase.auth.signOut();
        btnLogin.innerText = "Desbloquear";
      }
    }
  });

  // --- LOGOUT ---
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  // --- TAB: REVISIÓN ---
  async function cargarRevisiones() {
    listaRevision.innerHTML = '<p>Buscando partidos por aprobar...</p>';
    
    const { data, error } = await supabase
      .from('partidos')
      .select(`
        id, goles_local, goles_visitante, categoria, cancha, fecha_hora, reclamo,
        equipo_local:equipos!partidos_equipo_local_id_fkey(nombre),
        equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre)
      `)
      .eq('estado', 'EN_REVISION')
      .order('fecha_hora', { ascending: false });

    if (error) {
      console.error(error);
      return showToast('Error al cargar', true);
    }

    if ((data || []).length === 0) {
      listaRevision.innerHTML = '<p style="color:#64748b; text-align:center;">Todo al día. No hay partidos pendientes.</p>';
      return;
    }

    listaRevision.innerHTML = '';
    data.forEach(p => {
      const card = document.createElement('div');
      card.className = 'partido-card';
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="partido-header">
          <span>CAT: ${safe(p.categoria)}</span>
          <span>${safe(p.cancha || 'Cancha Libre')}</span>
        </div>
        <div class="score-row" style="display:flex; align-items:center; justify-content:center; margin:15px 0;">
          <div class="team-name" style="text-align:right; flex:1;">${safe(p.equipo_local?.nombre)}</div>
          <div style="display:flex; gap:10px; margin: 0 20px; align-items:center;">
            <input type="number" id="admin-gl-${p.id}" value="${p.goles_local || 0}" readonly style="width:50px; padding:8px; font-size:1.2rem; text-align:center; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); color:#fff; border-radius:6px; font-family:'Bebas Neue',sans-serif; opacity:0.6; pointer-events:none;">
            <span style="font-size:1.2rem; font-weight:bold; color:var(--gold);">-</span>
            <input type="number" id="admin-gv-${p.id}" value="${p.goles_visitante || 0}" readonly style="width:50px; padding:8px; font-size:1.2rem; text-align:center; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); color:#fff; border-radius:6px; font-family:'Bebas Neue',sans-serif; opacity:0.6; pointer-events:none;">
          </div>
          <div class="team-name" style="text-align:left; flex:1;">${safe(p.equipo_visitante?.nombre)}</div>
        </div>
        ${p.reclamo ? `<div style="background:rgba(214,13,13,0.15); border:1px solid rgba(214,13,13,0.4); padding:12px; border-radius:8px; margin-bottom:15px; color:#ffba00; font-size:0.95rem; font-family:'Barlow',sans-serif;"><strong>⚠️ OBSERVACIÓN / RECLAMO:</strong><br>${safe(p.reclamo)}</div>` : ''}
        <div style="display:flex; gap:10px;">
          <button class="btn-editar-admin" data-action="habilitar-edicion" style="flex:1; background:transparent; border:1px solid var(--gold); color:var(--gold); padding:14px; border-radius:10px; font-family:'Barlow Condensed',sans-serif; font-size:1.1rem; font-weight:800; text-transform:uppercase; cursor:pointer; transition:0.2s;">✏️ Editar</button>
          <button class="btn-aprobar" data-action="aprobar" style="flex:2;">Hacer Oficial</button>
        </div>
      `;
      listaRevision.appendChild(card);
    });

    // Delegación de eventos — sin window.*
    listaRevision.querySelectorAll('[data-action="aprobar"]').forEach(btn => {
      btn.addEventListener('click', () => aprobarPartido(btn.closest('.partido-card').dataset.id));
    });

    listaRevision.querySelectorAll('[data-action="habilitar-edicion"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.partido-card');
        const inputs = card.querySelectorAll('input[type="number"]');
        
        if (e.target.dataset.editing === 'true') {
          // Cancelar edición
          inputs.forEach(inp => {
            inp.setAttribute('readonly', 'true');
            inp.style.pointerEvents = 'none';
            inp.style.opacity = '0.6';
            inp.style.border = '1px solid rgba(255,255,255,0.05)';
            inp.style.background = 'rgba(0,0,0,0.4)';
            inp.value = inp.dataset.original; // Restaurar valor
          });
          e.target.dataset.editing = 'false';
          e.target.innerHTML = '✏️ Editar';
          e.target.style.color = 'var(--gold)';
          e.target.style.borderColor = 'var(--gold)';
        } else {
          // Habilitar edición
          inputs.forEach(inp => {
            inp.dataset.original = inp.value; // Guardar valor original
            inp.removeAttribute('readonly');
            inp.style.pointerEvents = 'auto';
            inp.style.opacity = '1';
            inp.style.border = '1px solid var(--gold)';
            inp.style.background = 'rgba(255,186,0,0.1)';
          });
          e.target.dataset.editing = 'true';
          e.target.innerHTML = '❌ Cancelar';
          e.target.style.color = '#ef4444';
          e.target.style.borderColor = '#ef4444';
        }
      });
    });
  }

  // Fuera del window — dentro del closure
  async function aprobarPartido(id) {
    if (!confirm('¿Confirma que el resultado es correcto? Se publicará en la tabla general.')) return;
    
    const gl = parseInt(document.getElementById(`admin-gl-${id}`).value) || 0;
    const gv = parseInt(document.getElementById(`admin-gv-${id}`).value) || 0;

    const { error } = await supabase
      .from('partidos')
      .update({ estado: 'OFICIAL', goles_local: gl, goles_visitante: gv })
      .eq('id', id);

    if (error) {
      showToast('Error al aprobar', true);
    } else {
      showToast('Partido OFICIALIZADO');
      cargarRevisiones();
    }
  };

  // --- TAB: PROGRAMAR JORNADA ---
  const inputJornada = document.getElementById('input-jornada');
  const btnBuscarJornada = document.getElementById('btn-buscar-jornada');
  const listaProgramacion = document.getElementById('lista-programacion');
  const btnGuardarProgramacion = document.getElementById('btn-guardar-programacion');
  let partidosProgramacion = [];

  btnBuscarJornada.addEventListener('click', async () => {
    const jornada = parseInt(inputJornada.value);
    if (!jornada) return showToast('Ingresa un número de jornada', true);

    listaProgramacion.innerHTML = '<p>Buscando partidos...</p>';
    btnGuardarProgramacion.style.display = 'none';

    const { data, error } = await supabase
      .from('partidos')
      .select(`id, categoria, equipo_local:equipos!partidos_equipo_local_id_fkey(nombre), equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre), cancha, lugar, fecha_hora`)
      .eq('jornada', jornada)
      .eq('estado', 'PROGRAMADO');

    if (error) {
      console.error(error);
      showToast('Error RLS Partidos: ' + error.message, true);
      return showToast('Error al buscar partidos', true);
    }

    if (data.length === 0) {
      return listaProgramacion.innerHTML = '<p>No hay partidos pendientes de programar para esta jornada.</p>';
    }

    partidosProgramacion = data;
    renderProgramacion(data);
    btnGuardarProgramacion.style.display = 'block';
  });

  function renderProgramacion(partidos) {
    listaProgramacion.innerHTML = '';
    partidos.forEach((p, index) => {
      // Intentar sacar fecha y hora si ya existe
      let d = p.fecha_hora ? new Date(p.fecha_hora) : null;
      let fechaVal = d ? d.toISOString().split('T')[0] : '';
      let horaVal = d ? d.toTimeString().substring(0,5) : '';

      const card = document.createElement('div');
      card.className = 'partido-card';
      card.style.borderLeftColor = 'var(--navy)';
        card.innerHTML = `
        <div class="partido-header" style="color:var(--navy);">CAT: ${safe(p.categoria)} | ${safe(p.equipo_local.nombre)} vs ${safe(p.equipo_visitante.nombre)}</div>
        <div class="prog-row" style="margin-top:10px;">
          <div class="form-group" style="flex:1; margin-bottom:0;">
            <label>Fecha</label>
            <input type="date" id="prog-fecha-${index}" class="input-brutal" style="padding:8px;" value="${fechaVal}">
          </div>
          <div class="form-group" style="flex:1; margin-bottom:0;">
            <label>Hora</label>
            <input type="time" id="prog-hora-${index}" class="input-brutal" style="padding:8px;" value="${horaVal}">
          </div>
          <div class="form-group" style="flex:1; margin-bottom:0;">
            <label>Lugar</label>
            <select id="prog-lugar-${index}" class="input-brutal">
              <option value="">Seleccionar...</option>
              <option value="Grass Sintético El Golazo" ${p.lugar === 'Grass Sintético El Golazo' ? 'selected' : ''}>Grass Sintético El Golazo</option>
              <option value="Grass Sintético Yecilu" ${p.lugar === 'Grass Sintético Yecilu' ? 'selected' : ''}>Grass Sintético Yecilu</option>
              <option value="Estadio Héroes de San Ramón" ${p.lugar === 'Estadio Héroes de San Ramón' ? 'selected' : ''}>Estadio Héroes de San Ramón</option>
            </select>
          </div>
          <div class="form-group" style="flex:1; margin-bottom:0;">
            <label>Cancha</label>
            <select id="prog-cancha-${index}" class="input-brutal">
              <option value="">--</option>
              <option value="C1" ${p.cancha === 'C1' ? 'selected' : ''}>C1</option>
              <option value="C2" ${p.cancha === 'C2' ? 'selected' : ''}>C2</option>
              <option value="C3" ${p.cancha === 'C3' ? 'selected' : ''}>C3</option>
              <option value="PRINCIPAL" ${p.cancha === 'PRINCIPAL' ? 'selected' : ''}>PRINCIPAL</option>
            </select>
          </div>
        </div>
      `;
      listaProgramacion.appendChild(card);
    });
  }

  btnGuardarProgramacion.addEventListener('click', async () => {
    btnGuardarProgramacion.innerText = 'Guardando...';
    let errores = 0;

    for (let i = 0; i < partidosProgramacion.length; i++) {
      const p = partidosProgramacion[i];
      const f = document.getElementById(`prog-fecha-${i}`).value;
      const h = document.getElementById(`prog-hora-${i}`).value;
      const c = document.getElementById(`prog-cancha-${i}`).value;
      const l = document.getElementById(`prog-lugar-${i}`).value;

      let isoStr = null;
      if (f && h) {
        isoStr = new Date(`${f}T${h}:00`).toISOString();
      }

      const { error } = await supabase
        .from('partidos')
        .update({ fecha_hora: isoStr, cancha: c, lugar: l })
        .eq('id', p.id);

      if (error) errores++;
    }

    btnGuardarProgramacion.innerText = 'Guardar Programación';
    if (errores > 0) {
      showToast(`Hubo ${errores} errores al guardar`, true);
    } else {
      showToast('Programación guardada con éxito');
    }
  });

  // --- TAB: SALVAVIDAS ---
  let equiposCargados = [];

  async function cargarEquiposParaSelect() {
    const { data, error } = await supabase.from('equipos').select('id, nombre').order('nombre');
    if (error) {
      console.error('Error RLS Equipos:', error.message);
      showToast('Error al cargar equipos: ' + error.message, true);
      return;
    }
    if (!data) return;
    
    equiposCargados = data;
    const selectLocal = document.getElementById('sel-local');
    const selectVisita = document.getElementById('sel-visita');
    
    let options = '<option value="">-- Seleccionar --</option>';
    data.forEach(eq => { options += `<option value="${eq.id}">${eq.nombre}</option>`; });
    
    selectLocal.innerHTML = options;
    selectVisita.innerHTML = options;
    
    const regEquipo = document.getElementById('reg-equipo');
    const dirEquipo = document.getElementById('dir-equipo');
    if (regEquipo) regEquipo.innerHTML = options;
    if (dirEquipo) dirEquipo.innerHTML = '<option value="">Todos los Equipos</option>' + options.replace('<option value="">-- Seleccionar --</option>', '');
  }

  document.getElementById('btn-crear').addEventListener('click', async () => {
    const locId = document.getElementById('sel-local').value;
    const visId = document.getElementById('sel-visita').value;
    const cat = document.getElementById('sel-cat').value;
    const fecha = document.getElementById('sel-fecha').value;

    if (!locId || !visId) {
      showToast('Selecciona los dos equipos', true);
      return;
    }
    if (locId === visId) {
      showToast('Un equipo no puede jugar consigo mismo', true);
      return;
    }

    const payload = {
      equipo_local_id: locId,
      equipo_visitante_id: visId,
      categoria: cat,
      estado: 'PROGRAMADO',
      jornada: parseInt(document.getElementById('sel-jornada')?.value) || 99
    };

    if (fecha) {
      payload.fecha_hora = new Date(fecha).toISOString();
    }

    const { error } = await supabase.from('partidos').insert([payload]);

    if (error) {
      console.error(error);
      showToast('Error al inyectar partido', true);
    } else {
      showToast('Partido creado y enviado a la Mesa');
      document.getElementById('sel-local').value = '';
      document.getElementById('sel-visita').value = '';
    }
  });

  // --- TAB: IMPORTAR EXCEL ---
  const btnAnalizarExcel = document.getElementById('btn-analizar-excel');
  const btnGuardarExcel = document.getElementById('btn-guardar-excel');
  const importDataText = document.getElementById('import-data');
  const importPreview = document.getElementById('import-preview');
  let parsedExcelData = [];

  const meses = { 'enero':1, 'febrero':2, 'marzo':3, 'abril':4, 'mayo':5, 'junio':6, 'julio':7, 'agosto':8, 'septiembre':9, 'octubre':10, 'noviembre':11, 'diciembre':12 };

  function parseSpanishDate(dateStr, timeStr) {
    try {
      // dateStr = "Sábado, 18 de Julio del" o "18/07/"
      let d = new Date();
      let dFound = false;

      const dateStrLow = dateStr.toLowerCase();
      const match = dateStrLow.match(/(\d+)\s+de\s+([a-z]+)\s+(?:del?|de)\s+(\d+)/);
      if (match) {
        const day = parseInt(match[1]);
        const month = meses[match[2]];
        const year = parseInt(match[3]);
        if (month) {
          d = new Date(year, month - 1, day);
          dFound = true;
        }
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length >= 3) {
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          dFound = true;
        }
      }

      if (dFound && timeStr) {
        // timeStr = "8:50 a. m." o "8:50 AM" o "13:00"
        let tLow = timeStr.toLowerCase().replace(/\./g, '').trim();
        const tMatch = tLow.match(/(\d+):(\d+)(?:\s*(a\s*m|p\s*m|am|pm))?/);
        if (tMatch) {
          let h = parseInt(tMatch[1]);
          const m = parseInt(tMatch[2]);
          const ampm = tMatch[3] ? tMatch[3].replace(/\s/g, '') : null;
          
          if (ampm === 'pm' && h < 12) h += 12;
          if (ampm === 'am' && h === 12) h = 0;
          
          d.setHours(h, m, 0, 0);
        }
      }
      return dFound ? d.toISOString() : null;
    } catch(e) {
      return null;
    }
  }

  btnAnalizarExcel.addEventListener('click', async () => {
    const raw = importDataText.value.trim();
    if (!raw) return showToast('Pega los datos primero', true);

    if (equiposCargados.length === 0) {
      await cargarEquiposParaSelect();
    }

    const lines = raw.split('\n');
    parsedExcelData = [];
    let previewHTML = '<strong>Vista previa de la lectura:</strong><br><br>';
    
    // Identificaremos equipos faltantes
    const missingTeams = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split('\t');
      // Si no son suficientes columnas, intentamos con comas (csv fallback)
      const colsDef = cols.length < 5 ? line.split(',') : cols;
      
      if (colsDef.length < 7) {
        previewHTML += `<div style="color:red;">Línea ${i+1}: ignorada (columnas insuficientes)</div>`;
        continue;
      }

      // Estructura esperada (12 columnas): FECHA, HORA, LUGAR, CANCHA, LOCAL, VS (ignorado), VISITANTE, CAT, JORNADA, GL, GV, ESTADO
      let fechaStr = colsDef[0]?.trim();
      let horaStr = colsDef[1]?.trim();
      let lugarStr = colsDef[2]?.trim();
      let canchaStr = colsDef[3]?.trim();
      let localStr = colsDef[4]?.trim().toUpperCase();
      let visitaStr = colsDef[6]?.trim().toUpperCase();
      let catStr = colsDef[7]?.trim();
      let jorStr = colsDef[8]?.trim();
      
      let glStr = colsDef[9]?.trim();
      let gvStr = colsDef[10]?.trim();
      let estadoStr = colsDef[11]?.trim()?.toUpperCase() || 'PROGRAMADO';
      
      let jornada = parseInt(jorStr) || 1;
      
      let gl = glStr && glStr !== '' ? parseInt(glStr) : null;
      let gv = gvStr && gvStr !== '' ? parseInt(gvStr) : null;
      
      if (isNaN(gl)) gl = null;
      if (isNaN(gv)) gv = null;

      let estado = estadoStr;
      if (!['PROGRAMADO', 'EN_VIVO', 'EN_REVISION', 'OFICIAL', 'FINALIZADO', 'SUSPENDIDO'].includes(estado)) {
        estado = (gl !== null && gv !== null) ? 'FINALIZADO' : 'PROGRAMADO';
      }

      if (!localStr || !visitaStr) continue;

      let locEq = equiposCargados.find(e => e.nombre.toUpperCase() === localStr);
      let visEq = equiposCargados.find(e => e.nombre.toUpperCase() === visitaStr);

      if (!locEq) missingTeams.add(localStr);
      if (!visEq) missingTeams.add(visitaStr);

      const isoDate = parseSpanishDate(fechaStr, horaStr);

      parsedExcelData.push({
        raw_local: localStr,
        raw_visita: visitaStr,
        categoria: catStr || '',
        lugar: lugarStr || '',
        cancha: canchaStr || '',
        fecha_hora: isoDate,
        goles_local: gl,
        goles_visitante: gv,
        estado: estado,
        jornada: jornada
      });

      previewHTML += `<div>✔️ [J${jornada}] ${localStr} ${gl !== null ? gl : ''} vs ${gv !== null ? gv : ''} ${visitaStr} (Cat ${catStr})</div>`;
    }

    importPreview.innerHTML = previewHTML;
    importPreview.style.display = 'block';

    if (parsedExcelData.length > 0) {
      if (missingTeams.size > 0) {
        importPreview.innerHTML += `<br><strong style="color:#d60d0d;">⚠️ Equipos Nuevos detectados (se crearán automáticamente):</strong><br> - ${Array.from(missingTeams).join('<br> - ')}`;
      }
      btnGuardarExcel.style.display = 'block';
    } else {
      btnGuardarExcel.style.display = 'none';
      showToast('No se encontraron datos válidos', true);
    }
  });

  btnGuardarExcel.addEventListener('click', async () => {
    btnGuardarExcel.innerText = 'Importando...';
    btnGuardarExcel.disabled = true;

    try {
      // 1. Crear equipos faltantes
      const missing = new Set();
      parsedExcelData.forEach(p => {
        if (!equiposCargados.find(e => e.nombre.toUpperCase() === p.raw_local)) missing.add(p.raw_local);
        if (!equiposCargados.find(e => e.nombre.toUpperCase() === p.raw_visita)) missing.add(p.raw_visita);
      });

      if (missing.size > 0) {
        const toInsert = Array.from(missing).map(m => ({ nombre: m }));
        const { error: errInsert } = await supabase.from('equipos').insert(toInsert);
        if (errInsert) throw new Error('Error al crear nuevos equipos: ' + errInsert.message);
        await cargarEquiposParaSelect(); // recargar
      }

      // 2. Preparar payload de partidos
      const payload = parsedExcelData.map(p => {
        const locId = equiposCargados.find(e => e.nombre.toUpperCase() === p.raw_local).id;
        const visId = equiposCargados.find(e => e.nombre.toUpperCase() === p.raw_visita).id;
        return {
          equipo_local_id: locId,
          equipo_visitante_id: visId,
          categoria: p.categoria,
          lugar: p.lugar,
          cancha: p.cancha,
          fecha_hora: p.fecha_hora,
          goles_local: p.goles_local,
          goles_visitante: p.goles_visitante,
          estado: p.estado,
          jornada: p.jornada
        };
      });

      // 3. Insertar partidos
      const { error } = await supabase.from('partidos').insert(payload);
      if (error) throw new Error(error.message);

      showToast(`¡Se importaron ${payload.length} partidos correctamente!`);
      importDataText.value = '';
      importPreview.style.display = 'none';
      btnGuardarExcel.style.display = 'none';
    } catch (err) {
      console.error(err);
      showToast('Error: ' + err.message, true);
    } finally {
      btnGuardarExcel.innerText = 'Confirmar e Importar BD';
      btnGuardarExcel.disabled = false;
    }
  });

  // ═══════════════════════════════════════════════
  // --- TAB: DIRECTORIO Y REGISTRO ---
  // ═══════════════════════════════════════════════
  const btnGuardarRegistro = document.querySelector('#form-registro .btn-guardar');
  const dirResultados = document.getElementById('dir-resultados');
  const dirSearch = document.getElementById('dir-search');
  const dirRol = document.getElementById('dir-rol');
  const dirEquipo = document.getElementById('dir-equipo');
  const formRegistro = document.getElementById('form-registro');
  
  let modoEdicion = false;

  document.querySelector('[data-target="tab-directorio"]')?.addEventListener('click', () => {
    cargarDirectorio();
  });

  async function cargarDirectorio() {
    if (!dirResultados) return;
    const contadorEl = document.getElementById('dir-contador');
    if (contadorEl) contadorEl.textContent = 'Calculando...';
    dirResultados.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; grid-column: 1 / -1;">Cargando directorio...</p>';
    
    let query = supabase.from('personas').select('*, equipos(nombre)').order('nombre_completo');
    
    const term = dirSearch.value.trim();
    if (term) query = query.or(`dni.eq.${term},dni_qr_impreso.eq.${term},nombre_completo.ilike.%${term}%`);
    if (dirRol.value) query = query.eq('rol', dirRol.value);
    if (dirEquipo.value) query = query.eq('equipo_id', dirEquipo.value);

    const { data, error } = await query;

    if (error) {
      if (contadorEl) contadorEl.textContent = 'Error';
      dirResultados.innerHTML = `<p style="color:red; text-align:center; grid-column: 1 / -1;">Error: ${safe(error.message)}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      if (contadorEl) contadorEl.textContent = '0 resultados encontrados';
      dirResultados.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; grid-column: 1 / -1;">No hay registros que coincidan.</p>';
      return;
    }

    if (contadorEl) contadorEl.textContent = `${data.length} resultado(s) encontrado(s)`;

    dirResultados.innerHTML = '';
    data.forEach(p => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; display: flex; gap: 12px; align-items: center; position: relative;';
      
      const fotoUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/dnis/${p.dni}.jpg`;
      let rolColor = p.rol === 'JUGADOR' ? '#22c55e' : p.rol === 'DELEGADO' ? '#eab308' : '#3b82f6';

      card.innerHTML = `
        <img src="${safe(fotoUrl)}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);" onerror="this.src='../assets/img/logo.png'; this.style.opacity='0.3';">
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--white);">${safe(p.nombre_completo)}</h4>
          <p style="margin: 4px 0 0; font-size: 0.85rem; color: rgba(255,255,255,0.6);">
            <strong style="color:${rolColor};">${safe(p.rol)}</strong> | DNI: ${safe(p.dni)}
          </p>
          <p style="margin: 2px 0 0; font-size: 0.85rem; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            Eq: ${safe(p.equipos?.nombre || 'Ninguno')} ${p.categorias ? `| Cat: ${safe(p.categorias)}` : ''}
          </p>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <button class="btn-editar" style="background:#3b82f6; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Editar</button>
        </div>
      `;
      
      card.querySelector('.btn-editar').addEventListener('click', () => {
        modoEdicion = true;
        document.getElementById('reg-dni').value = p.dni;
        document.getElementById('reg-dni').readOnly = true;
        document.getElementById('reg-nombre').value = p.nombre_completo;
        document.getElementById('reg-rol').value = p.rol;
        document.getElementById('reg-equipo').value = p.equipo_id || '';
        document.getElementById('reg-cat').value = p.categorias || '';
        document.getElementById('reg-nac').value = p.fecha_nacimiento || '';
        btnGuardarRegistro.innerText = 'ACTUALIZAR PERSONA';
        btnGuardarRegistro.style.background = '#eab308';
        
        document.getElementById('btn-cancelar-edicion').style.display = 'block';
        document.getElementById('btn-eliminar-registro').style.display = 'block';

        window.scrollTo({ top: formRegistro.offsetTop - 50, behavior: 'smooth' });
      });

      dirResultados.appendChild(card);
    });
  }

  function resetFormulario() {
    formRegistro.reset();
    modoEdicion = false;
    document.getElementById('reg-dni').readOnly = false;
    btnGuardarRegistro.innerText = 'REGISTRAR PERSONA';
    btnGuardarRegistro.style.background = '';
    document.getElementById('btn-cancelar-edicion').style.display = 'none';
    document.getElementById('btn-eliminar-registro').style.display = 'none';
  }

  document.getElementById('btn-cancelar-edicion')?.addEventListener('click', resetFormulario);

  document.getElementById('btn-eliminar-registro')?.addEventListener('click', async () => {
    const dni = document.getElementById('reg-dni').value;
    const nombre = document.getElementById('reg-nombre').value;
    if(confirm(`⚠️ ATENCIÓN: Estás a punto de eliminar permanentemente a ${nombre} (DNI: ${dni}).\n\n¿Estás absolutamente seguro de continuar?`)) {
      const { error } = await supabase.from('personas').delete().eq('dni', dni);
      if (error) {
        showToast('Error al eliminar', true);
      } else {
        showToast('Registro eliminado para siempre');
        resetFormulario();
        cargarDirectorio();
      }
    }
  });

  [dirSearch, dirRol, dirEquipo].forEach(el => el?.addEventListener('input', () => {
    clearTimeout(window.dirTimeout);
    window.dirTimeout = setTimeout(cargarDirectorio, 300);
  }));

  formRegistro?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value.trim().toUpperCase();

    if (modoEdicion) {
      if(!confirm(`Estás a punto de actualizar los datos de ${nombre}.\n\n¿Confirmar cambios?`)) return;
    }

    btnGuardarRegistro.innerText = 'Guardando...';
    btnGuardarRegistro.disabled = true;

    const payload = {
      dni: document.getElementById('reg-dni').value.trim(),
      nombre_completo: nombre,
      rol: document.getElementById('reg-rol').value,
      equipo_id: document.getElementById('reg-equipo').value || null,
      categorias: document.getElementById('reg-cat').value.trim() || null,
      fecha_nacimiento: document.getElementById('reg-nac').value || null
    };

    let errorObj;
    if (modoEdicion) {
      const { error } = await supabase.from('personas').update(payload).eq('dni', payload.dni);
      errorObj = error;
    } else {
      const { error } = await supabase.from('personas').insert([payload]);
      errorObj = error;
    }

    if (errorObj) {
      showToast('Error: ' + errorObj.message, true);
    } else {
      showToast(modoEdicion ? '¡Registro Actualizado!' : '¡Registro Creado con Éxito!');
      resetFormulario();
      cargarDirectorio();
    }

    btnGuardarRegistro.disabled = false;
  });

  // ═══════════════════════════════════════════════
  // --- TAB: CARNETS ---
  // ═══════════════════════════════════════════════
  const btnGenerarCarnets = document.getElementById('btn-generar-carnets');
  const carnetsStatus = document.getElementById('carnets-status');
  const carnetsPreviewContainer = document.getElementById('carnets-preview-container');
  const carnetsRenderArea = document.getElementById('carnets-render-area');
  const btnDescargarZipCarnets = document.getElementById('btn-descargar-zip-carnets');
  const carnetsSearchInput = document.getElementById('carnets-search');
  const carnetsSelectionSummary = document.getElementById('carnets-selection-summary');
  const btnSeleccionarCarnetsVisibles = document.getElementById('btn-seleccionar-carnets-visibles');
  const btnLimpiarSeleccionCarnets = document.getElementById('btn-limpiar-seleccion-carnets');
  let generandoZipCarnets = false;

  const normalizarTextoCarnet = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  function obtenerItemsCarnet() {
    return Array.from(carnetsRenderArea.querySelectorAll('.carnet-select-item'));
  }

  function asegurarMensajeBusquedaCarnets() {
    let message = document.getElementById('carnets-empty-search');
    if (!message) {
      message = document.createElement('p');
      message.id = 'carnets-empty-search';
      message.textContent = 'No hay carnets que coincidan con la búsqueda.';
      carnetsRenderArea.appendChild(message);
    }
    return message;
  }

  function marcarCarnet(item, selected) {
    item.classList.toggle('is-selected', selected);
    const toggle = item.querySelector('.carnet-select-toggle');
    if (!toggle) return;

    toggle.setAttribute('aria-pressed', String(selected));
    toggle.setAttribute('aria-label', `${selected ? 'Quitar' : 'Seleccionar'} carnet de ${item.dataset.name || 'persona'}`);
    const label = toggle.querySelector('.carnet-select-toggle-text');
    if (label) label.textContent = selected ? 'Seleccionado' : 'Seleccionar';
  }

  function actualizarSeleccionCarnets() {
    const items = obtenerItemsCarnet();
    const visibles = items.filter(item => !item.hidden);
    const seleccionados = items.filter(item => item.classList.contains('is-selected'));
    const seleccionadosVisibles = visibles.filter(item => item.classList.contains('is-selected'));

    carnetsSelectionSummary.innerHTML = `<strong>${seleccionados.length}</strong> seleccionados de ${items.length} &middot; ${visibles.length} visibles`;

    if (!generandoZipCarnets) {
      btnDescargarZipCarnets.disabled = seleccionados.length === 0;
      btnDescargarZipCarnets.innerHTML = seleccionados.length > 0
        ? `⬇️ DESCARGAR ${seleccionados.length} CARNET${seleccionados.length === 1 ? '' : 'S'} (.ZIP PDF)`
        : 'SELECCIONA AL MENOS UN CARNET';
    }

    carnetsSearchInput.disabled = generandoZipCarnets;
    btnSeleccionarCarnetsVisibles.disabled = generandoZipCarnets || visibles.length === 0 || seleccionadosVisibles.length === visibles.length;
    btnLimpiarSeleccionCarnets.disabled = generandoZipCarnets || seleccionados.length === 0;
    asegurarMensajeBusquedaCarnets().style.display = visibles.length === 0 ? 'block' : 'none';
  }

  function filtrarCarnets() {
    const term = normalizarTextoCarnet(carnetsSearchInput.value);
    obtenerItemsCarnet().forEach(item => {
      item.hidden = Boolean(term) && !item.dataset.search.includes(term);
    });
    actualizarSeleccionCarnets();
  }

  carnetsSearchInput?.addEventListener('input', filtrarCarnets);

  btnSeleccionarCarnetsVisibles?.addEventListener('click', () => {
    obtenerItemsCarnet().filter(item => !item.hidden).forEach(item => marcarCarnet(item, true));
    actualizarSeleccionCarnets();
  });

  btnLimpiarSeleccionCarnets?.addEventListener('click', () => {
    obtenerItemsCarnet().forEach(item => marcarCarnet(item, false));
    actualizarSeleccionCarnets();
  });

  carnetsRenderArea?.addEventListener('click', event => {
    const toggle = event.target.closest('.carnet-select-toggle');
    if (!toggle) return;

    const item = toggle.closest('.carnet-select-item');
    marcarCarnet(item, !item.classList.contains('is-selected'));
    actualizarSeleccionCarnets();
  });

  btnDescargarZipCarnets?.addEventListener('click', async () => {
    generandoZipCarnets = true;
    btnDescargarZipCarnets.disabled = true;
    actualizarSeleccionCarnets();
    btnDescargarZipCarnets.innerText = 'PREPARANDO PDF...';
    
    try {
      const carnets = carnetsRenderArea.querySelectorAll('.carnet-select-item.is-selected .carnet-box');
      if (carnets.length === 0) {
        showToast('Selecciona al menos un carnet para descargar', true);
        return;
      }

      const zip = new JSZip();
      const { jsPDF } = window.jspdf;
      
      for (let i = 0; i < carnets.length; i++) {
        const carnet = carnets[i];
        const item = carnet.closest('.carnet-select-item');
        const estabaOculto = item.hidden;
        btnDescargarZipCarnets.innerText = `GENERANDO PDF ${i + 1} DE ${carnets.length}...`;

        // Los carnets seleccionados conservan su selección aunque otra búsqueda los oculte.
        // Para exportarlos sin mostrarlos en pantalla, se renderizan temporalmente fuera del viewport.
        if (estabaOculto) {
          item.hidden = false;
          item.classList.add('carnet-export-staging');
        }
        
        let canvas;
        try {
          // Renderizar usando html2canvas desde cero
          canvas = await window.html2canvas(carnet, {
            scale: 3, // Alta calidad
            useCORS: true,
            logging: false,
            allowTaint: false,
            backgroundColor: '#ffffff', // Forzar blanco en las esquinas para evitar bugs negros de jsPDF
            width: carnet.offsetWidth,
            height: carnet.offsetHeight
          });
        } finally {
          if (estabaOculto) {
            item.classList.remove('carnet-export-staging');
            item.hidden = true;
          }
        }
        
        // Exportar a JPEG (más ligero, y el blanco ya tapó las esquinas)
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        // Generar PDF con dimensiones CR80 exactas (54mm x 85.6mm)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [54, 85.6]
        });
        
        // Insertar imagen
        pdf.addImage(imgData, 'JPEG', 0, 0, 54, 85.6);
        const pdfBlob = pdf.output('blob');
        
        const nombreEl = carnet.querySelector('.carnet-nombre');
        const rolEl = carnet.querySelector('.carnet-rol');
        const equipoEl = carnet.querySelector('.carnet-equipo');
        
        let nombre = nombreEl ? nombreEl.textContent.trim().replace(/[^a-zA-Z0-9]/g, '_') : `carnet_${i+1}`;
        let rol = rolEl ? rolEl.textContent.trim().replace(/[^a-zA-Z0-9]/g, '') : '';
        let equipo = equipoEl ? equipoEl.textContent.trim().replace(/[^a-zA-Z0-9]/g, '_') : '';
        
        zip.file(`${equipo}/${rol}_${nombre}.pdf`, pdfBlob);
      }
      
      btnDescargarZipCarnets.innerText = 'COMPRIMIENDO ARCHIVO ZIP...';
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      const downloadUrl = URL.createObjectURL(content);
      a.href = downloadUrl;
      a.download = `Carnets_CopaCajamarca.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      
      showToast(`Descarga iniciada: ${carnets.length} carnet${carnets.length === 1 ? '' : 's'}`);
      
    } catch (err) {
      console.error(err);
      showToast('Error al generar ZIP: ' + err.message, true);
    } finally {
      generandoZipCarnets = false;
      actualizarSeleccionCarnets();
    }
  });

  btnGenerarCarnets?.addEventListener('click', async () => {
    carnetsStatus.style.display = 'block';
    carnetsStatus.textContent = 'Descargando base de datos y renderizando...';
    carnetsPreviewContainer.style.display = 'none';
    carnetsRenderArea.innerHTML = '';
    carnetsSearchInput.value = '';

    const { data, error } = await supabase
      .from('personas')
      .select('*, equipos(nombre, logo_url)')
      .in('rol', ['ENTRENADOR', 'DELEGADO', 'JUGADOR'])
      .order('equipo_id')
      .order('nombre_completo');

    if (error) {
      carnetsStatus.textContent = `Error: ${error.message}`;
      showToast('Error al cargar datos para carnets', true);
      return;
    }

    if (!data || data.length === 0) {
      carnetsStatus.textContent = 'No hay personas registradas (Entrenadores, Delegados o Jugadores).';
      return;
    }

    const docFrag = document.createDocumentFragment();
    
    data.forEach(p => {
      const isRed = p.rol === 'ENTRENADOR';
      const className = isRed ? 'carnet-rojo' : 'carnet-azul';
      
      const item = document.createElement('div');
      item.className = 'carnet-select-item is-selected';
      item.dataset.name = p.nombre_completo || 'persona';
      item.dataset.search = normalizarTextoCarnet([
        p.nombre_completo,
        p.dni,
        p.rol,
        p.equipos?.nombre
      ].join(' '));

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'carnet-select-toggle';
      toggle.setAttribute('aria-pressed', 'true');
      toggle.setAttribute('aria-label', `Quitar carnet de ${p.nombre_completo || 'persona'}`);
      toggle.innerHTML = '<span class="carnet-select-icon" aria-hidden="true">✓</span><span class="carnet-select-toggle-text">Seleccionado</span>';

      const carnet = document.createElement('div');
      carnet.className = `carnet-box ${className}`;

      const fotoUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/dnis/${p.dni}.jpg`;
      
      carnet.innerHTML = `
        <div class="carnet-header-band">
          <span class="carnet-header-band-text">CREDENCIAL OFICIAL · COPA CAJAMARCA</span>
        </div>
        <div class="carnet-top">
          <img class="carnet-foto" src="${safe(fotoUrl)}" crossorigin="anonymous" alt="Foto" onerror="this.outerHTML='<img class=\\\'carnet-logo\\\' src=\\\'../assets/img/logo-sin-anio.png\\\' crossorigin=\\\'anonymous\\\'>'">
        </div>
        <div class="carnet-bottom">
          <div class="carnet-rol">${safe(p.rol)}</div>
          <div class="carnet-nombre">${safe(p.nombre_completo)}</div>
          
          <div style="flex: 1; min-height: 2px;"></div> <!-- Spacer superior -->
          
          <div class="carnet-equipo">${safe(p.equipos?.nombre || 'Independiente')}</div>
          <div class="carnet-logos-footer">
            ${p.equipos?.logo_url ? `<img class="team-logo" src="${safe(p.equipos.logo_url)}" crossorigin="anonymous" onerror="this.style.display='none'">` : ''}
            <div class="carnet-qr"></div>
          </div>
          
          <div style="flex: 1; min-height: 2px;"></div> <!-- Spacer inferior -->
        </div>
        <div class="carnet-footer">DNI: ${safe(p.dni)} &middot; PERSONAL E INTRANSFERIBLE</div>
      `;
      item.append(toggle, carnet);
      docFrag.appendChild(item);
      
      // Store the DOM node and data for later generation
      carnet.dataset.qr = p.dni;
    });

    carnetsRenderArea.appendChild(docFrag);
    asegurarMensajeBusquedaCarnets();
    carnetsStatus.style.display = 'none';
    carnetsPreviewContainer.style.display = 'block';
    actualizarSeleccionCarnets();

    // Generar los QRs después de que el DOM sea visible (para evitar fallos de offsetWidth = 0)
    setTimeout(() => {
      const qrElements = carnetsRenderArea.querySelectorAll('.carnet-box');
      
      qrElements.forEach(box => {
        const dni = box.dataset.qr;
        if (!dni) return;
        const qrContainer = box.querySelector('.carnet-qr');
        qrContainer.innerHTML = ''; // Limpiar por si acaso
        // El usuario requiere que el QR apunte rígidamente a producción con el dominio .com
        const qrData = `https://copacajamarca.com/fichas/index.html?dni=${dni}`;
        new QRCode(qrContainer, {
          text: qrData,
          width: 128,
          height: 128,
          colorDark : "#000000",
          colorLight : "#ffffff",
          correctLevel : QRCode.CorrectLevel.L
        });
      });
      showToast(`Se prepararon ${data.length} carnets para impresión`);
    }, 50);
  });



  // ═══════════════════════════════════════════════
  // --- TAB: BOLETERÍA — Configurar PIN ---
  // ═══════════════════════════════════════════════
  const pinDisplay  = document.getElementById('pin-display');
  const btnVerPin   = document.getElementById('btn-ver-pin');
  const btnGuardarPin = document.getElementById('btn-guardar-pin');
  const newPinBoxes = document.querySelectorAll('.new-pin-box');

  let pinVisible = false;
  let pinActual  = null; // se carga desde Supabase al abrir la tab

  // Cargar PIN actual desde config
  async function cargarPinActual() {
    pinDisplay.textContent = '••••';
    pinVisible = false;
    if (btnVerPin) btnVerPin.textContent = 'Ver PIN';

    const { data, error } = await supabase
      .from('config')
      .select('valor')
      .eq('clave', 'boleteria_pin')
      .single();

    if (error || !data) {
      pinActual = null;
      pinDisplay.textContent = 'ERR';
      showToast('Error al leer el PIN desde la BD', true);
      return;
    }
    pinActual = data.valor;
  }

  // Ver/ocultar PIN actual
  if (btnVerPin) {
    btnVerPin.addEventListener('click', () => {
      if (!pinActual) {
        showToast('Cargando PIN...', true);
        cargarPinActual();
        return;
      }
      pinVisible = !pinVisible;
      pinDisplay.textContent = pinVisible ? pinActual : '••••';
      btnVerPin.textContent  = pinVisible ? 'Ocultar' : 'Ver PIN';
    });
  }

  // Navegación OTP entre cajas del nuevo PIN
  newPinBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '');
      if (box.value && i < newPinBoxes.length - 1) {
        newPinBoxes[i + 1].focus();
      }
      // Focus style
      box.style.borderColor = box.value ? 'var(--gold)' : 'rgba(255,255,255,0.15)';
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        newPinBoxes[i - 1].focus();
        newPinBoxes[i - 1].value = '';
        newPinBoxes[i - 1].style.borderColor = 'rgba(255,255,255,0.15)';
      }
    });
  });

  // Guardar nuevo PIN en Supabase
  if (btnGuardarPin) {
    btnGuardarPin.addEventListener('click', async () => {
      const nuevoPin = Array.from(newPinBoxes).map(b => b.value).join('');
      if (nuevoPin.length < 4 || !/^\d{4}$/.test(nuevoPin)) {
        showToast('El PIN debe ser de 4 dígitos numéricos', true);
        return;
      }

      btnGuardarPin.textContent = 'Guardando...';
      btnGuardarPin.disabled = true;

      const { error } = await supabase
        .from('config')
        .upsert({ clave: 'boleteria_pin', valor: nuevoPin }, { onConflict: 'clave' });

      if (error) {
        showToast('Error al guardar: ' + error.message, true);
      } else {
        pinActual = nuevoPin;
        pinDisplay.textContent = '••••';
        pinVisible = false;
        if (btnVerPin) btnVerPin.textContent = 'Ver PIN';
        newPinBoxes.forEach(b => {
          b.value = '';
          b.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        showToast(`PIN actualizado a: ${nuevoPin}`);
      }

      btnGuardarPin.textContent = 'GUARDAR NUEVO PIN';
      btnGuardarPin.disabled = false;
    });
  }

  // Cargar PIN automáticamente cuando el usuario abre la tab de Boletería
  document.querySelector('[data-target="tab-boleteria"]')?.addEventListener('click', () => {
    if (!pinActual) cargarPinActual();
  });

});
