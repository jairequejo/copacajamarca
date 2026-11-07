import { validateScore } from './panel-model.js?v=2';

export async function approveKnockout(client, match, local, visitor, penaltyLocal, penaltyVisitor) {
  if (match.estado !== 'EN_REVISION' || !match.updated_at) {
    throw new Error('Actualiza la lista y vuelve a revisar el partido.');
  }
  if (!validateScore(local, visitor)) throw new Error('Completa ambos goles entre 0 y 99.');
  const optional = value => value == null || value === '' ? null : Number(value);
  const pl = optional(penaltyLocal), pv = optional(penaltyVisitor);
  const tied = Number(local) === Number(visitor);
  if (tied && (!validateScore(pl, pv) || pl === pv)) {
    throw new Error('Completa los penales con un ganador para aprobar el empate.');
  }
  if (!tied && (pl !== null || pv !== null)) throw new Error('Los penales solo corresponden a un empate.');
  const p = Object.fromEntries(['torneo_id','categoria','fase','equipo_local_id','equipo_visitante_id','fecha_hora','cancha'].map(key => [key, match[key] ?? null]));
  Object.assign(p, { estado:'OFICIAL', goles_local:Number(local), goles_visitante:Number(visitor), penales_local:pl, penales_visitante:pv });
  let { data, error } = await client.rpc('aprobar_eliminatoria_admin', {
    p_id:match.id,p_goles_local:Number(local),p_goles_visitante:Number(visitor),p_penales_local:pl,p_penales_visitante:pv,
    p_original_goles_local:match.goles_local,p_original_goles_visitante:match.goles_visitante,
    p_original_penales_local:match.penales_local,p_original_penales_visitante:match.penales_visitante,
    p_equipo_local_id:match.equipo_local_id,p_equipo_visitante_id:match.equipo_visitante_id
  });
  // Compatibilidad mientras la nueva migración llega a todos los entornos.
  if (error?.code === 'PGRST202') ({ data, error } = await client.rpc('guardar_eliminatoria', { p, p_version:match.updated_at }));
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (saved?.id !== match.id || saved.estado !== 'OFICIAL') throw new Error('No se confirmó la aprobación. Actualiza y vuelve a revisar.');
  return saved;
}
