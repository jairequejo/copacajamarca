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
  const { data, error } = await client.rpc('guardar_eliminatoria', { p, p_version:match.updated_at });
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (saved?.id !== match.id || saved.estado !== 'OFICIAL') throw new Error('No se confirmó la aprobación. Actualiza y vuelve a revisar.');
  return saved;
}
