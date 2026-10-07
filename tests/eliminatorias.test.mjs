import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnockout, isFinished } from '../assets/js/eliminatorias-model.js';
const category = '2014';
function group(names, label = null) {
  return names.map((name, i) => ({ categoria: category, equipo_id: name, equipo: name, grupo: label, pts: 12 - i * 3, dg: 4 - i, gf: 9 - i }));
}
function schedule(rows) {
  return rows.flatMap((r, i) => rows.slice(i + 1).map(v => ({ categoria: category, equipo_local_id: r.equipo_id, equipo_visitante_id: v.equipo_id, estado: 'OFICIAL', goles_local: 1, goles_visitante: 0 })));
}
const rows = group(['one', 'two', 'three', 'four', 'five']);
const games = schedule(rows);
test('Single group: 1 vs 4 and 2 vs 3, final and third remain undecided', () => {
  const result = buildKnockout(category, rows, games);
  assert.equal(result.ready, true);
  assert.deepEqual(result.matches.slice(0, 2).map(m => m.teams.map(t => t.id)), [['one', 'four'], ['two', 'three']]);
  assert.ok(result.matches.slice(2).every(m => m.teams.every(t => t.pending)));
});
test('A/B ignores duplicate aggregate rows and crosses both groups', () => {
  const a = group(['A1', 'A2', 'A3'], 'A'), b = group(['B1', 'B2', 'B3'], 'B');
  const result = buildKnockout(category, [...a, ...b, ...a.map(r => ({ ...r, grupo: null }))], [...schedule(a), ...schedule(b)]);
  assert.equal(result.ready, true);
  assert.deepEqual(result.matches.slice(0, 2).map(m => m.teams.map(t => t.id)), [['A1', 'B2'], ['B1', 'A2']]);
});
test('Scheduled 0-0, live and under-review matches cannot qualify teams', () => {
  for (const estado of ['PROGRAMADO', 'EN_VIVO', 'EN_REVISION']) {
    const result = buildKnockout(category, rows, [{ ...games[0], estado }, ...games.slice(1)]);
    assert.equal(result.ready, false); assert.equal(result.pending, 1);
    assert.ok(result.matches[0].teams.every(t => t.pending));
  }
  assert.equal(isFinished({ estado: 'FINALIZADO', goles_local: 0, goles_visitante: 0 }), true);
  assert.equal(isFinished({ estado: 'OFICIAL', goles_local: null, goles_visitante: 0 }), false);
});
test('Missing pairing or missing standings prevents a false completed group', () => {
  assert.equal(buildKnockout(category, rows, games.slice(1)).ready, false);
  assert.equal(buildKnockout(category, [], games).ready, false);
});
test('An unresolved sporting tie cannot be settled alphabetically', () => {
  const tied = rows.map(r => ({ ...r }));
  Object.assign(tied[4], { pts: tied[3].pts, dg: tied[3].dg, gf: tied[3].gf });
  const result = buildKnockout(category, tied, games);
  assert.equal(result.ready, false); assert.equal(result.tied, true);
});
test('Categories progress independently', () => {
  const extra = games.map(r => ({ ...r, categoria: '2018', estado: 'PROGRAMADO' }));
  assert.equal(buildKnockout(category, rows, [...games, ...extra]).ready, true);
});
import { advanceKnockout } from '../assets/js/eliminatorias-model.js';
const tid='cup';
const base=()=>buildKnockout(category,rows,games);
const result=(fase,local,visitante,a,b,extra={})=>({torneo_id:tid,categoria:category,fase,equipo_local_id:local,equipo_visitante_id:visitante,goles_local:a,goles_visitante:b,estado:'OFICIAL',...extra});
test('Official semifinal winners advance, losers play third and final crowns champion',()=>{
  const records=[result('SF1','one','four',2,0),result('SF2','two','three',1,3),result('F','one','three',1,1,{penales_local:4,penales_visitante:5}),result('TP','four','two',0,2)];
  const k=advanceKnockout(base(),records,tid);
  assert.deepEqual(k.matches[2].teams.map(t=>t.id),['one','three']);
  assert.deepEqual(k.matches[3].teams.map(t=>t.id),['four','two']);
  assert.equal(k.champion.id,'three');assert.equal(k.third.id,'two');
});
test('Live, draws without penalties and another tournament never advance',()=>{
  for(const record of [result('SF1','one','four',2,0,{estado:'EN_VIVO'}),result('SF1','one','four',1,1),result('SF1','one','four',2,0,{torneo_id:'other'})]){
    assert.ok(advanceKnockout(base(),[record],tid).matches[2].teams[0].pending);
  }
});
test('Correction invalidates a previously saved final pairing and champion',()=>{
  const records=[result('SF1','one','four',0,2),result('SF2','two','three',1,3),result('F','one','three',4,1)];
  const k=advanceKnockout(base(),records,tid);
  assert.equal(k.matches[2].teams[0].id,'four');assert.equal(k.champion,null);assert.deepEqual(k.matches[2].goals,[null,null]);
});

import { bannerStage } from '../assets/js/eliminatorias-graphic.js';
test('Banner keeps semifinal emphasis until both official finalists exist',()=>{
  const sf1=result('SF1','one','four',2,0),sf2=result('SF2','two','three',1,3);
  assert.equal(bannerStage(advanceKnockout(base(),[],tid)),'semifinals');
  assert.equal(bannerStage(advanceKnockout(base(),[sf1],tid)),'semifinals');
  assert.equal(bannerStage(advanceKnockout(base(),[sf1,{...sf2,estado:'EN_VIVO'}],tid)),'semifinals');
  assert.equal(bannerStage(advanceKnockout(base(),[sf1,sf2],tid)),'final');
});
test('Banner celebrates only an official final winner and handles result corrections',()=>{
  const records=[result('SF1','one','four',2,0),result('SF2','two','three',1,3)];
  const f=result('F','one','three',1,1,{penales_local:4,penales_visitante:5});
  assert.equal(bannerStage(advanceKnockout(base(),[...records,{...f,estado:'EN_VIVO'}],tid)),'final');
  assert.equal(bannerStage(advanceKnockout(base(),[...records,f],tid)),'champion');
  assert.equal(bannerStage(advanceKnockout(base(),[{...records[0],goles_local:0,goles_visitante:2},records[1],f],tid)),'final');
});

import { tournamentEdition } from '../assets/js/eliminatorias-model.js';
test('Edition defaults to the explicitly configured Clausura 2026 before metadata installation',()=>{
  assert.deepEqual(tournamentEdition(games),{stage:'Clausura',year:2026});
});
test('Edition uses category-specific database metadata and refuses conflicting editions',()=>{
  const next=games.map(m=>({...m,etapa:'Apertura',temporada:2027}));
  const other=games.map(m=>({...m,categoria:'2018',etapa:'Clausura',temporada:2026}));
  assert.deepEqual(buildKnockout(category,rows,[...next,...other]).edition,{stage:'Apertura',year:2027});
  assert.equal(tournamentEdition([next[0],other[0]]),null);
});
