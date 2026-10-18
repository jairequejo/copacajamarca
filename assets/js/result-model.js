const FINISHED = new Set(['OFICIAL', 'EN_REVISION', 'FINALIZADO', 'TERMINADO', 'COMPLETADO']);
export const validScorePair = values => Array.isArray(values) && values.length === 2
  && values.every(value => Number.isInteger(value) && value >= 0 && value <= 99);

export function resultDecision(match, { includeReview = true } = {}) {
  const state = String(match.estado || '').trim().toUpperCase();
  if (!FINISHED.has(state) || (!includeReview && state === 'EN_REVISION') || !validScorePair(match.goals)) return null;
  const [local, visitor] = match.goals;
  if (local !== visitor) return { winnerIndex:local > visitor ? 0 : 1, byPenalties:false };
  if (!validScorePair(match.penalties) || match.penalties[0] === match.penalties[1]) return null;
  return { winnerIndex:match.penalties[0] > match.penalties[1] ? 0 : 1, byPenalties:true };
}
