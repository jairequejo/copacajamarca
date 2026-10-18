const PHASES = { SF1:'Semifinal 1', SF2:'Semifinal 2', F:'Final', TP:'Tercer puesto' };
const GROUP_FIELDS = 'id,torneo_id,grupo,goles_local,goles_visitante,estado,fecha_hora,cancha,lugar,categoria,reclamo,equipo_local_id,equipo_visitante_id,equipo_local:equipos!partidos_equipo_local_id_fkey(nombre),equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre)';
const KO_FIELDS = 'id,torneo_id,goles_local,goles_visitante,penales_local,penales_visitante,estado,fecha_hora,cancha,categoria,fase,reclamo,updated_at,equipo_local_id,equipo_visitante_id,equipo_local:equipos!eliminatorias_partidos_equipo_local_id_fkey(nombre),equipo_visitante:equipos!eliminatorias_partidos_equipo_visitante_id_fkey(nombre)';

export function normalizeMesaMatch(match, knockout = false) {
  if (!knockout) return { ...match, key:'grupo-'+match.id, tipo_partido:'REGULAR' };
  const parts = String(match.cancha || '').trim().split(/\s+-\s+/);
  return { ...match, key:'eliminatoria-'+match.id, tipo_partido:'ELIMINATORIA',
    lugar:parts.length > 1 ? parts.shift() : '', cancha:parts.join(' - '),
    fase_label:PHASES[match.fase] || match.fase, reclamo:match.reclamo ?? null };
}

async function readMatches(client, table, fields, cutoff) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from(table).select(fields)
      .or(`fecha_hora.gte.${cutoff},estado.neq.OFICIAL`)
      .order('fecha_hora', { ascending:true, nullsFirst:false }).order('id')
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

export async function loadMesaMatches(client, now = Date.now()) {
  const cutoff = new Date(now - 4 * 86400000).toISOString();
  let needsMigration = false;
  const [regular, knockout] = await Promise.allSettled([
    readMatches(client, 'partidos', GROUP_FIELDS, cutoff),
    (async () => {
      try { return await readMatches(client, 'eliminatorias_partidos', KO_FIELDS, cutoff); }
      catch (error) {
        if (error.code !== '42703' || !String(error.message).includes('reclamo')) throw error;
        needsMigration = true;
        return readMatches(client, 'eliminatorias_partidos', KO_FIELDS.replace(',reclamo', ''), cutoff);
      }
    })(),
  ]);
  if (regular.status === 'rejected' && knockout.status === 'rejected') throw regular.reason;
  const warnings = [];
  if (regular.status === 'rejected') warnings.push('No se pudieron cargar los partidos de grupos. Pulsa Actualizar.');
  if (knockout.status === 'rejected') warnings.push('No se pudieron cargar las eliminatorias. Los partidos de grupos siguen disponibles.');
  if (needsMigration) warnings.push('Falta aplicar la actualización SQL de Mesa para guardar eliminatorias y penales.');
  const matches = [
    ...(regular.status === 'fulfilled' ? regular.value.map(m => normalizeMesaMatch(m)) : []),
    ...(knockout.status === 'fulfilled' ? knockout.value.map(m => normalizeMesaMatch(m, true)) : []),
  ].sort((a,b) => (a.fecha_hora ? Date.parse(a.fecha_hora) : Infinity) - (b.fecha_hora ? Date.parse(b.fecha_hora) : Infinity));
  return { matches, warning:warnings.join(' ') };
}

function score(value, optional = false) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (value === null || value === undefined || value === '' || typeof value === 'boolean'
    || !Number.isInteger(Number(value)) || Number(value)<0 || Number(value)>99) {
    throw new Error('Ingresa un marcador entero entre 0 y 99.');
  }
  return Number(value);
}

export function mesaPayload(match, changes) {
  if (match.estado === 'OFICIAL') throw new Error('El resultado oficial solo puede corregirse desde administración.');
  const merged = { ...match, ...changes };
  if (!['PROGRAMADO','EN_VIVO','EN_REVISION'].includes(merged.estado)) throw new Error('Estado no permitido para Mesa.');
  const result = { estado:merged.estado, goles_local:null, goles_visitante:null, reclamo:null };
  const knockout = match.tipo_partido === 'ELIMINATORIA';
  if (knockout) Object.assign(result, { penales_local:null, penales_visitante:null });
  if (merged.estado === 'PROGRAMADO') return result;
  result.goles_local = score(merged.goles_local);
  result.goles_visitante = score(merged.goles_visitante);
  result.reclamo = String(merged.reclamo || '').trim() || null;
  if (result.reclamo?.length > 1000) throw new Error('El reclamo admite hasta 1000 caracteres.');
  if (!knockout) return result;
  result.penales_local = score(merged.penales_local, true);
  result.penales_visitante = score(merged.penales_visitante, true);
  if ((result.penales_local === null) !== (result.penales_visitante === null)) throw new Error('Completa los penales de ambos equipos.');
  if (result.goles_local !== result.goles_visitante && result.penales_local !== null) throw new Error('Los penales solo se registran cuando los goles están empatados.');
  if (merged.estado === 'EN_REVISION' && result.goles_local === result.goles_visitante
    && (result.penales_local === null || result.penales_local === result.penales_visitante)) {
    throw new Error('Completa la tanda de penales con un ganador antes de enviar a revisión.');
  }
  return result;
}

export async function saveMesaMatch(client, match, changes) {
  const payload = mesaPayload(match, changes);
  let data, error;
  if (match.tipo_partido === 'ELIMINATORIA') {
    ({ data, error } = await client.rpc('guardar_eliminatoria_mesa', {
      p_id:match.id, p_version:match.updated_at, p_estado:payload.estado,
      p_goles_local:payload.goles_local, p_goles_visitante:payload.goles_visitante,
      p_penales_local:payload.penales_local, p_penales_visitante:payload.penales_visitante,
      p_reclamo:payload.reclamo,
    }));
  } else {
    let query = client.from('partidos').update(payload).eq('id', match.id).eq('estado', match.estado);
    for (const field of ['goles_local','goles_visitante','reclamo','equipo_local_id','equipo_visitante_id']) {
      query = match[field] == null ? query.is(field, null) : query.eq(field, match[field]);
    }
    ({ data, error } = await query.select('id,estado,goles_local,goles_visitante,reclamo').single());
  }
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved?.id) throw new Error('No se guardó el resultado. Actualiza la lista y revisa los permisos de tu cuenta.');
  if (match.tipo_partido === 'ELIMINATORIA') {
    const { cancha, lugar, ...updated } = saved;
    Object.assign(match, updated);
  } else Object.assign(match, saved);
  return saved;
}

export function mesaError(error) {
  if (['PGRST202','PGRST205','42703'].includes(error?.code)) return 'Falta aplicar la actualización SQL de Mesa. El archivo está en supabase/migrations/20261018000100_reparar_mesa_eliminatorias.sql.';
  if (error?.code === 'PGRST116') return 'El partido cambió o tu cuenta no pudo guardarlo. Actualiza la lista antes de reintentar.';
  return error?.message || 'No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.';
}
