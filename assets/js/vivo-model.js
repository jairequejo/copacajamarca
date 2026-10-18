import { resultDecision, validScorePair } from './result-model.js?v=1';

const PHASES = { SF1:'Semifinal 1', SF2:'Semifinal 2', F:'Final', TP:'Tercer puesto' };
export function isRecentLiveMatch(match, isKnockout = false, now = Date.now()) {
  const state = String(match.estado || '').trim().toUpperCase();
  if (state === 'EN_VIVO') return true;
  const finished = ['OFICIAL','EN_REVISION','FINALIZADO','TERMINADO','COMPLETADO'].includes(state);
  const date = isKnockout && finished ? match.updated_at || match.fecha_hora : match.fecha_hora;
  return Boolean(date) && Date.parse(date) >= now - 2 * 86400000;
}
export function normalizeLiveMatch(match, isKnockout = false) {
  const state = String(match.estado || '').trim().toUpperCase();
  const finished = ['OFICIAL','EN_REVISION','FINALIZADO','TERMINADO','COMPLETADO'].includes(state);
  const estadoStandard = state === 'EN_VIVO' ? 'En Vivo' : finished ? 'Finalizado' : 'Pendiente';
  let fecha = '', hora = '';
  const date = match.fecha_hora ? new Date(match.fecha_hora) : null;
  if (date && !Number.isNaN(date.getTime())) {
    const raw = date.toLocaleDateString('es-PE', { weekday:'long',day:'numeric',month:'long',timeZone:'America/Lima' });
    fecha = raw.charAt(0).toUpperCase() + raw.slice(1);
    hora = date.toLocaleTimeString('es-PE', { hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'America/Lima' });
  }
  const parts = String(match.cancha || '').trim().split(/\s+-\s+/);
  const lugar = isKnockout ? (parts.length > 1 ? parts.shift() : '') : match.lugar || '';
  const goals = [match.goles_local, match.goles_visitante];
  const penalties = [match.penales_local, match.penales_visitante];
  const penaltyScore = isKnockout && estadoStandard !== 'Pendiente' && validScorePair(goals)
    && goals[0] === goals[1] && validScorePair(penalties) ? penalties : null;
  return {
    fecha, hora, lugar, cancha:isKnockout ? parts.join(' - ') : match.cancha || '',
    local:match.equipo_local?.nombre || 'Por definir', visitante:match.equipo_visitante?.nombre || 'Por definir',
    categoria:String(match.categoria || ''), jornada:match.jornada || '',
    phase:isKnockout ? PHASES[match.fase] || match.fase : `Jor. ${match.jornada || ''}`,
    isKnockout, estadoOriginal:state, estadoStandard,
    golesLocal:estadoStandard === 'Pendiente' ? '' : String(match.goles_local ?? ''),
    golesVisitante:estadoStandard === 'Pendiente' ? '' : String(match.goles_visitante ?? ''),
    penaltyScore,
    decision:resultDecision({estado:state,goals,penalties:isKnockout ? penalties : null}),
  };
}

export function liveResultText(match) {
  if (!match.isKnockout) return '';
  if (match.decision) return `Ganó ${match.decision.winnerIndex === 0 ? match.local : match.visitante}${match.decision.byPenalties ? ' por penales' : ''}`;
  if (match.estadoStandard === 'En Vivo' && match.penaltyScore) return 'Tanda de penales en curso';
  if (match.estadoStandard === 'Finalizado') return match.golesLocal !== '' && match.golesLocal === match.golesVisitante ? 'Desempate pendiente' : 'Resultado pendiente';
  return '';
}

export function liveScoreSummary(match) {
  return {
    score:match.golesLocal !== '' && match.golesVisitante !== '' ? `${match.golesLocal} - ${match.golesVisitante}` : 'VS',
    penalties:match.penaltyScore ? `Pen. ${match.penaltyScore.join(' - ')}` : '',
    winnerIndex:match.decision?.winnerIndex ?? null,
  };
}
