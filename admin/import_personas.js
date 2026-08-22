import { supabase } from '../assets/js/supabase.js';

const datosBrutos = [
  { "nombre_completo": "ALAN CARLOS VILLATY PINEDO", "dni": "42614176", "equipo_nombre": "ALAN VILLATY", "rol": "ENTRENADOR", "categorias": "2015" },
  { "nombre_completo": "ALEX ALEJANDRO ILMAN VILLANUEVA", "dni": "61325527", "equipo_nombre": "TALLERES LIMA", "rol": "DELEGADO", "categorias": "2014" },
  { "nombre_completo": "ALEX FERNANDO SEVILLANO CASTILLO", "dni": "41843560", "equipo_nombre": "JR STARS", "rol": "DELEGADO", "categorias": "2014" },
  { "nombre_completo": "ANA CLAUDIA CULQUITANTA AGUILAR", "dni": "71095535", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2017" },
  { "nombre_completo": "ANDRÉ CASIANO", "dni": "73024787", "equipo_nombre": "TALLERES LIMA", "rol": "ENTRENADOR", "categorias": "2014" },
  { "nombre_completo": "CEIFER ANTONIO CACHAY SÁNCHEZ", "dni": "40729443", "equipo_nombre": "EFB BARCELONA", "rol": "ENTRENADOR", "categorias": "2018" },
  { "nombre_completo": "CESAR IVAN ALCÁNTARA JAUREGUI", "dni": "48135727", "equipo_nombre": "ATLETICO JUNIOR", "rol": "DELEGADO", "categorias": "2020, 2019, 2018, 2017, 2016, 2015, 2014" },
  { "nombre_completo": "CINTHIA LISSETH MARIN MUÑOZ", "dni": "46100838", "equipo_nombre": "SPORT REYES", "rol": "DELEGADO", "categorias": "2016" },
  { "nombre_completo": "DANIEL ALEXANDER REYES BUENAÑO", "dni": "44721614", "equipo_nombre": "SPORT REYES", "rol": "ENTRENADOR", "categorias": "2018, 2017, 2016" },
  { "nombre_completo": "DILMER REGALADO BENAVIDES", "dni": "71384014", "equipo_nombre": "U CAJAMARCA", "rol": "ENTRENADOR", "categorias": "2020, 2018, 2017, 2016" },
  { "nombre_completo": "EDWIN IVÁN REQUEJO PAREDES", "dni": "26730195", "equipo_nombre": "JR STARS", "rol": "ENTRENADOR", "categorias": "2019, 2018, 2017, 2016, 2015, 2014, 2013" },
  { "nombre_completo": "HUAMÁN JÁUREGUI LUIS ENRIQUE", "dni": "49068577", "equipo_nombre": "ATLETICO JUNIOR", "rol": "ENTRENADOR", "categorias": "2020, 2019, 2018, 2017, 2016, 2015, 2014" },
  { "nombre_completo": "HUGO MAURO", "dni": "40521158", "equipo_nombre": "U CAJAMARCA", "rol": "ENTRENADOR", "categorias": "2014" },
  { "nombre_completo": "JEYNER ALBERTO RIVAS ZULOETA", "dni": "42040656", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2020" },
  { "nombre_completo": "JHORDY SANTANA", "dni": "76247009", "equipo_nombre": "TALLERES LIMA", "rol": "ENTRENADOR", "categorias": "2018" },
  { "nombre_completo": "JORGE LUIS INFANTE SILVA", "dni": "40846007", "equipo_nombre": "U CAJAMARCA", "rol": "ENTRENADOR", "categorias": "2013" },
  { "nombre_completo": "JUNIOR TACILLA VILLANUEVA", "dni": "71033177", "equipo_nombre": "JOTITAS", "rol": "ENTRENADOR", "categorias": "2017, 2016" },
  { "nombre_completo": "KARINA NOELIA LÓPEZ PÉREZ", "dni": "70171864", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2018" },
  { "nombre_completo": "KARLA ETELVINA PUITIZA CALDERON", "dni": "76842600", "equipo_nombre": "JOTITAS", "rol": "DELEGADO", "categorias": "2017, 2016" },
  { "nombre_completo": "KELLY ESCALANTE SÁNCHEZ", "dni": "45838745", "equipo_nombre": "SPORT REYES", "rol": "DELEGADO", "categorias": "2018, 2017, 2016" },
  { "nombre_completo": "LILIANA ELIZABETH CULQUI RAICO", "dni": "48872908", "equipo_nombre": "U CAJAMARCA", "rol": "DELEGADO", "categorias": "2020, 2018, 2016" },
  { "nombre_completo": "LUIS ALBERTO ARÉVALO TERRONES", "dni": "42067306", "equipo_nombre": "FC ESTUDIANTES", "rol": "ENTRENADOR", "categorias": "2015, 2014" },
  { "nombre_completo": "LUIS ALBERTO URIARTE GARAY", "dni": "71967974", "equipo_nombre": "FC ESTUDIANTES", "rol": "ENTRENADOR", "categorias": "2020, 2018" },
  { "nombre_completo": "MARCO LLOVERÁ", "dni": "72540418", "equipo_nombre": "TALLERES LIMA", "rol": "DELEGADO", "categorias": "2018" },
  { "nombre_completo": "MIGUEL ANGEL RAICO ALVAREZ", "dni": "40421220", "equipo_nombre": "FC ESTUDIANTES", "rol": "DELEGADO", "categorias": "2015" },
  { "nombre_completo": "OSCAR ALFREDO ESTELA MANRIQUE", "dni": "26719861", "equipo_nombre": "ATLETICO JUNIOR", "rol": "ENTRENADOR", "categorias": "2016, 2015, 2014" },
  { "nombre_completo": "PERLIRSH MACSH EMNER TORRES SALAS", "dni": "74281048", "equipo_nombre": "PERFECT SOCCER", "rol": "ENTRENADOR", "categorias": "2014" },
  { "nombre_completo": "ROBELINO GUEVARA DÁVILA", "dni": "43780874", "equipo_nombre": "EFB BARCELONA", "rol": "DELEGADO", "categorias": "2018" },
  { "nombre_completo": "ROSA ASUNCIÓN ALFARO GARCIA", "dni": "44820445", "equipo_nombre": "SPORT REYES", "rol": "DELEGADO", "categorias": "2017" },
  { "nombre_completo": "ROSEAU TORRES PANAIFO", "dni": "70777215", "equipo_nombre": "U CAJAMARCA", "rol": "ENTRENADOR", "categorias": "2019, 2017" },
  { "nombre_completo": "ROSELI TORRES TORRES", "dni": "45923271", "equipo_nombre": "JR STARS", "rol": "DELEGADO", "categorias": "2017, 2016" },
  { "nombre_completo": "SHELMER CHUQUILÍN GARCÍA", "dni": "74623118", "equipo_nombre": "PERFECT SOCCER", "rol": "ENTRENADOR", "categorias": "2017" },
  { "nombre_completo": "TANIA MARILI ROMERO PEREYRA", "dni": "48628697", "equipo_nombre": "SPORT REYES", "rol": "DELEGADO", "categorias": "2018" },
  { "nombre_completo": "WILLIAM RAFAEL ARRIBASPLATA TERRONES", "dni": "26682264", "equipo_nombre": "FC ESTUDIANTES", "rol": "DELEGADO", "categorias": "2015" },
  { "nombre_completo": "YULY AZUCENA DELGADO ESPINOZA", "dni": "31682747", "equipo_nombre": "FC ESTUDIANTES", "rol": "DELEGADO", "categorias": "2020" },
  { "nombre_completo": "JUAN CARLOS NEIRA VILLATE", "dni": "44882650", "equipo_nombre": "ALAN VILLATY", "rol": "DELEGADO", "categorias": "2015" },
  { "nombre_completo": "LOURDES RUBI MORENO MERINO", "dni": "47777294", "equipo_nombre": "ALAN VILLATY", "rol": "DELEGADO", "categorias": "2015" },
  { "nombre_completo": "JAIME HERAS CALDERÓN", "dni": "44619597", "equipo_nombre": "REAL JH", "rol": "DELEGADO", "categorias": "2014" },
  { "nombre_completo": "LUIS JULON RAMOS", "dni": "70491794", "equipo_nombre": "REAL JH", "rol": "ENTRENADOR", "categorias": "2014" },
  { "nombre_completo": "LESLY LINARES MONCADA", "dni": "72636248", "equipo_nombre": "REAL JH", "rol": "DELEGADO", "categorias": "2014" },
  { "nombre_completo": "LUIS ALBERTO AREVALO TERRONES", "dni": "42067306", "equipo_nombre": "FC ESTUDIANTES", "rol": "ENTRENADOR", "categorias": "2013" },
  { "nombre_completo": "RONALD ALEXANDRO BRIONES VILLANUEVA", "dni": "74039575", "equipo_nombre": "SAINTHORE", "rol": "ENTRENADOR", "categorias": "2020, 2019, 2018, 2017" },
  { "nombre_completo": "JAMPIER HERRERA TRUJILLO", "dni": "74744103", "equipo_nombre": "JOTITAS", "rol": "ENTRENADOR", "categorias": "2017, 2016" },
  { "nombre_completo": "ESTEFANY BIBIANE ALDAVE CHÁVEZ", "dni": "47371443", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2019" },
  { "nombre_completo": "ALAN RODRIGO BRIONES GONZALES", "dni": "60965141", "equipo_nombre": "SAINTHORE", "rol": "ENTRENADOR", "categorias": "2014" },
  { "nombre_completo": "JORGE EDSON CHÁVEZ BRAVO", "dni": "46213675", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2014" },
  { "nombre_completo": "ANA CLAUDIA CULQUITANTA AGUILAR", "dni": "71095535", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2017" },
  { "nombre_completo": "KARINA NOELIA LÓPEZ PÉREZ", "dni": "70171864", "equipo_nombre": "SAINTHORE", "rol": "DELEGADO", "categorias": "2018" },
  { "nombre_completo": "ALEJANDRO ILMAN", "dni": "26729646", "equipo_nombre": "TALLERES LIMA", "rol": "ENTRENADOR", "categorias": "2016" },
  { "nombre_completo": "LUZ HERLINDA VILLANUEVA CUEVA", "dni": "43816460", "equipo_nombre": "TALLERES LIMA", "rol": "DELEGADO", "categorias": "2016" },
  { "nombre_completo": "ANNETE ESTEFANY BANDA LIMAY", "dni": "74357730", "equipo_nombre": "SAINTHORE", "rol": "ENTRENADOR", "categorias": "2020, 2019, 2018, 2017, 2014" },
  { "nombre_completo": "MIGUEL ÁNGEL RAICO ALVAREZ", "dni": "40421220", "equipo_nombre": "FC ESTUDIANTES", "rol": "DELEGADO", "categorias": "2014" },
  { "nombre_completo": "WILLIAM RAFAEL ARRIBASPLATA TERRONES", "dni": "26682364", "equipo_nombre": "FC ESTUDIANTES", "rol": "ENTRENADOR", "categorias": "2015" },
  { "nombre_completo": "LUIS ALBERTO URIARTE GARAY", "dni": "71967974", "equipo_nombre": "FC ESTUDIANTES", "rol": "ENTRENADOR", "categorias": "2018" },
  { "nombre_completo": "YULY AZUCENA DELGADO ESPINOZA", "dni": "31682747", "equipo_nombre": "FC ESTUDIANTES", "rol": "DELEGADO", "categorias": "2020" },
  { "nombre_completo": "WILLIAM COLORADO QUILICHE", "dni": "45880532", "equipo_nombre": "FC ESTUDIANTES", "rol": "DELEGADO", "categorias": "2018" }
];

window.iniciarMigracionPersonas = async () => {
  console.log('Iniciando migración masiva de personas...');
  
  // 1. Agrupar duplicados por DNI para juntar categorías
  const mapDnis = new Map();
  for (const row of datosBrutos) {
    const dni = row.dni.trim();
    if (!mapDnis.has(dni)) {
      mapDnis.set(dni, { ...row });
    } else {
      // Unir categorías si ya existe
      const existente = mapDnis.get(dni);
      const catsNuevas = row.categorias.split(',').map(s => s.trim());
      const catsActuales = existente.categorias.split(',').map(s => s.trim());
      const setCats = new Set([...catsActuales, ...catsNuevas]);
      existente.categorias = Array.from(setCats).join(', ');
      
      console.log(`DNI Duplicado detectado y combinado: ${dni} - Categorias resultantes: ${existente.categorias}`);
    }
  }

  const procesados = Array.from(mapDnis.values());

  // 2. Traer todos los equipos para mapear IDs
  const { data: equipos, error: errEquipos } = await supabase.from('equipos').select('id, nombre');
  if (errEquipos) {
    console.error('Error obteniendo equipos:', errEquipos);
    return;
  }

  // Crear equipos que faltan por si acaso
  const equiposMap = new Map();
  equipos.forEach(e => equiposMap.set(e.nombre.toUpperCase(), e.id));

  const equiposNuevos = new Set();
  procesados.forEach(p => {
    if (!equiposMap.has(p.equipo_nombre.toUpperCase())) {
      equiposNuevos.add(p.equipo_nombre.toUpperCase());
    }
  });

  if (equiposNuevos.size > 0) {
    console.log('Creando equipos faltantes:', equiposNuevos);
    const toInsert = Array.from(equiposNuevos).map(n => ({ nombre: n }));
    const { error: errInsEq } = await supabase.from('equipos').insert(toInsert);
    if (errInsEq) {
      console.error('Error insertando equipos nuevos:', errInsEq);
      return;
    }
    
    // Recargar mapa
    const { data: nuevosEq } = await supabase.from('equipos').select('id, nombre');
    nuevosEq.forEach(e => equiposMap.set(e.nombre.toUpperCase(), e.id));
  }

  // 3. Preparar array para upsert
  const upsertPayload = procesados.map(p => ({
    dni: p.dni,
    nombre_completo: p.nombre_completo.toUpperCase(),
    rol: p.rol.toUpperCase(),
    equipo_id: equiposMap.get(p.equipo_nombre.toUpperCase()),
    categorias: p.categorias
  }));

  // 4. Inyectar (upsert usando DNI como clave primaria)
  console.log(`Subiendo ${upsertPayload.length} registros (después de limpiar duplicados)...`);
  
  const { error: errUpsert } = await supabase.from('personas').upsert(upsertPayload, { onConflict: 'dni' });
  
  if (errUpsert) {
    console.error('Error al insertar registros:', errUpsert);
    alert('Hubo un error en la migración. Revisa la consola.');
  } else {
    console.log('¡MIGRACIÓN COMPLETADA CON ÉXITO!');
    alert('Migración completada. Recarga la página y revisa la pestaña Directorio.');
  }
};

// Crear botón flotante temporal para ejecutarlo
const floatBtn = document.createElement('button');
floatBtn.innerText = '⚠️ EJECUTAR MIGRACIÓN MASIVA DE DELEGADOS/ENTRENADORES';
floatBtn.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:99999; background:red; color:white; padding:15px; font-weight:bold; border-radius:10px; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,0.5);';
floatBtn.onclick = () => {
  floatBtn.innerText = 'Ejecutando... (mira la consola)';
  floatBtn.disabled = true;
  window.iniciarMigracionPersonas();
};
document.body.appendChild(floatBtn);
