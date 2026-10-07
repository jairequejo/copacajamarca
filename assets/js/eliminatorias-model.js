export const isFinished = match => ['OFICIAL', 'FINALIZADO', 'TERMINADO', 'COMPLETADO'].includes(String(match.estado).trim().toUpperCase()) && match.goles_local != null && match.goles_visitante != null;
const rank = (a, b) => Number(b.pts) - Number(a.pts) || Number(b.dg) - Number(a.dg) || Number(b.gf) - Number(a.gf);
const team = (row, seed) => row ? { id: row.equipo_id, name: row.equipo, logo: row.logo_url, seed } : { name: seed, seed, pending: true };

// Current edition explicitly configured for the existing tournament until SQL metadata is installed.
export const CURRENT_EDITION = Object.freeze({stage:'Clausura',year:2026});
export function tournamentEdition(matches) {
  const editions=new Map();
  for(const match of matches) {
    const stage=String(match.etapa||'').trim(),year=Number(match.temporada);
    if(stage&&Number.isInteger(year)&&year>=1900&&year<=2200) editions.set(`${stage.toLowerCase()}|${year}`,{stage,year});
  }
  if(editions.size>1)return null;
  return editions.size===1?[...editions.values()][0]:{...CURRENT_EDITION};
}

// Uses the same points / goal difference / goals scored order as Posiciones.
// Aggregate rows (grupo=null) must not be mixed with the A/B standings.
export function buildKnockout(category, standings, matches) {
  const rows = standings.filter(r => String(r.categoria) === String(category));
  const groupNames = [...new Set(rows.map(r => r.grupo).filter(Boolean))].sort();
  const split = groupNames.length === 2;
  const groups = groupNames.length ? groupNames.map(g => rows.filter(r => r.grupo === g)) : [rows];
  groups.forEach(g => g.sort(rank));
  const games = matches.filter(m => String(m.categoria) === String(category) && m.equipo_local_id && m.equipo_visitante_id);
  const pending = games.filter(m => !isFinished(m)).length;
  const supported = groups.length <= 2 && groups.every(g => g.length >= (split ? 2 : 4));
  // Do not treat a partially loaded or incomplete fixture as a finished group.
  const complete = supported && groups.every(g => g.every(a => g.every(b => a === b || games.some(m =>
    ((String(m.equipo_local_id) === String(a.equipo_id) && String(m.equipo_visitante_id) === String(b.equipo_id)) ||
     (String(m.equipo_local_id) === String(b.equipo_id) && String(m.equipo_visitante_id) === String(a.equipo_id))) && isFinished(m)))));
  const tied = groups.some(g => g.some((r, i) => i > 0 && i <= (split ? 2 : 4) && rank(g[i - 1], r) === 0));
  const ready = complete && pending === 0 && !tied;
  const labels = split ? [`1.º grupo ${groupNames[0]}`, `2.º grupo ${groupNames[1]}`, `1.º grupo ${groupNames[1]}`, `2.º grupo ${groupNames[0]}`] : ['1.º de la tabla', '4.º de la tabla', '2.º de la tabla', '3.º de la tabla'];
  const seeds = ready ? (split ? [groups[0][0], groups[1][1], groups[1][0], groups[0][1]] : [groups[0][0], groups[0][3], groups[0][1], groups[0][2]]) : [];
  const slots = labels.map((label, i) => team(seeds[i], label));
  return {
    category, edition:tournamentEdition(games), ready, pending, tied: complete && !pending && tied,
    message: ready ? 'Cruces según la tabla de posiciones. Horarios por programar.' : pending ? `Fase de grupos en curso · ${pending} partido${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}.` : tied && complete ? 'Hay un empate en puntos, diferencia de gol y goles a favor. Clasificación pendiente de desempate.' : 'Clasificación pendiente de completar y validar la fase de grupos.',
    rule: split ? 'Clasifican los dos primeros de cada grupo: 1.º A vs. 2.º B y 1.º B vs. 2.º A.' : 'Clasifican los cuatro primeros: 1.º vs. 4.º y 2.º vs. 3.º.',
    matches: [
      { title: 'Semifinal 1', teams: slots.slice(0, 2) },
      { title: 'Semifinal 2', teams: slots.slice(2, 4) },
      { title: 'Final', teams: [team(null, 'Ganador semifinal 1'), team(null, 'Ganador semifinal 2')] },
      { title: 'Tercer puesto', teams: [team(null, 'Perdedor semifinal 1'), team(null, 'Perdedor semifinal 2')] }
    ]
  };
}

// Results live in a separate table so knockout scores never affect group standings.
export const ROUND_IDS = ['SF1', 'SF2', 'F', 'TP'];
export function matchDecision(match) {
  if (match.estado !== 'OFICIAL' || match.teams.some(t => !t.id)) return null;
  const scores = match.goals;
  if (!scores?.every(n => Number.isInteger(n) && n >= 0)) return null;
  let winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;
  if (winner === null) {
    if (!match.penalties?.every(n => Number.isInteger(n) && n >= 0) || match.penalties[0] === match.penalties[1]) return null;
    winner = match.penalties[0] > match.penalties[1] ? 0 : 1;
  }
  return { winner: match.teams[winner], loser: match.teams[1 - winner], winnerIndex: winner };
}
export function advanceKnockout(bracket, records = [], tournamentId = null) {
  const result = { ...bracket, matches: bracket.matches.map((m, i) => ({ ...m, round: ROUND_IDS[i], teams: m.teams.map(t => ({ ...t })), goals: [null, null], penalties: [null, null], estado: 'PROGRAMADO' })), tournamentId };
  const apply = index => {
    const match = result.matches[index];
    const record = records.find(r => String(r.categoria) === String(bracket.category) && r.fase === match.round && String(r.torneo_id) === String(tournamentId));
    if (!record || !bracket.ready || !match.teams.every(t => t.id)) return;
    // A correction upstream must never attach an old score to a different pairing.
    if (String(record.equipo_local_id) !== String(match.teams[0].id) || String(record.equipo_visitante_id) !== String(match.teams[1].id)) return;
    Object.assign(match, { recordId: record.id, updatedAt: record.updated_at, goals: [record.goles_local, record.goles_visitante], penalties: [record.penales_local, record.penales_visitante], estado: record.estado, date: record.fecha_hora, cancha: record.cancha });
    match.decision = matchDecision(match);
  };
  apply(0); apply(1);
  for (let i = 0; i < 2; i++) {
    const decision = result.matches[i].decision;
    if (decision) {
      result.matches[2].teams[i] = { ...decision.winner, seed: `Ganador semifinal ${i + 1}` };
      result.matches[3].teams[i] = { ...decision.loser, seed: `Perdedor semifinal ${i + 1}` };
    }
  }
  apply(2); apply(3);
  result.champion = result.matches[2].decision?.winner || null;
  result.third = result.matches[3].decision?.winner || null;
  if (result.champion) result.message = `Campeón: ${result.champion.name}.`;
  else if (result.matches.some(m => m.estado === 'EN_VIVO')) result.message = 'Eliminatorias en vivo. El ganador avanza al oficializar el resultado.';
  else if (result.matches.slice(0, 2).every(m => m.decision)) result.message = 'Finalistas definidos. La final y el tercer puesto ya tienen sus equipos.';
  else if (result.matches.some(m => m.decision)) result.message = 'El cuadro se actualiza con los resultados oficiales de las semifinales.';
  else if (result.matches.some(m => m.date)) result.message = 'Eliminatorias programadas. Horarios en hora de Perú.';
  return result;
}
