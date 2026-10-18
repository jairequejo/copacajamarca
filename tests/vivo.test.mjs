import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLiveMatch, liveResultText, liveScoreSummary, isRecentLiveMatch } from '../assets/js/vivo-model.js';
import { resultDecision } from '../assets/js/result-model.js';

const row=(extra={})=>({estado:'EN_REVISION',goles_local:1,goles_visitante:1,penales_local:3,penales_visitante:4,
  equipo_local:{nombre:'Equipo local'},equipo_visitante:{nombre:'Equipo visitante'},fase:'SF1',categoria:'2014',...extra});

test('A knockout finalized now stays in Live even if the original schedule is old or missing',()=>{
  const now=Date.parse('2026-10-18T20:00:00Z');
  assert.equal(isRecentLiveMatch(row({fecha_hora:'2020-01-01',updated_at:new Date(now).toISOString()}),true,now),true);
  assert.equal(isRecentLiveMatch(row({fecha_hora:null,updated_at:new Date(now).toISOString()}),true,now),true);
  assert.equal(isRecentLiveMatch(row({fecha_hora:'2020-01-01',updated_at:'2020-01-02'}),true,now),false);
  assert.equal(isRecentLiveMatch(row({fecha_hora:'2020-01-01',updated_at:new Date(now).toISOString()}),false,now),false);
});

test('Completed knockout shows penalty scores and winning team instead of an apparent draw',()=>{
  for(const estado of ['EN_REVISION','OFICIAL','FINALIZADO']) {
    const match=normalizeLiveMatch(row({estado}),true);
    assert.equal(match.estadoStandard,'Finalizado');
    assert.equal(match.decision.winnerIndex,1);
    assert.equal(match.decision.byPenalties,true);
    assert.deepEqual(match.penaltyScore,[3,4]);
    assert.equal(liveResultText(match),'Ganó Equipo visitante por penales');
    assert.deepEqual(liveScoreSummary(match),{score:'1 - 1',penalties:'Pen. 3 - 4',winnerIndex:1});
  }
});

test('An ongoing shootout displays the tally without declaring a winner before Mesa finishes',()=>{
  const match=normalizeLiveMatch(row({estado:'EN_VIVO'}),true);
  assert.equal(match.decision,null);
  assert.deepEqual(match.penaltyScore,[3,4]);
  assert.equal(liveResultText(match),'Tanda de penales en curso');
  const unfinished=normalizeLiveMatch(row({penales_local:3,penales_visitante:3}),true);
  assert.equal(unfinished.decision,null);
  assert.equal(liveResultText(unfinished),'Desempate pendiente');
});

test('Zero shootout scores count; incomplete penalties, negative goals and pending games cannot choose a winner',()=>{
  const zero=normalizeLiveMatch(row({goles_local:0,goles_visitante:0,penales_local:0,penales_visitante:1}),true);
  assert.equal(zero.decision.winnerIndex,1);
  for (const raw of [row({penales_visitante:null}),row({goles_local:-1}),row({estado:'PROGRAMADO'})]) {
    assert.equal(normalizeLiveMatch(raw,true).decision,null);
  }
  assert.equal(resultDecision({estado:'EN_REVISION',goals:[null,null],penalties:[2,3]}),null);
  assert.equal(resultDecision({estado:'EN_REVISION',goals:[1],penalties:[2,3]}),null);
});

test('Group draws remain draws and goal winners do not acquire unrelated shootout scores',()=>{
  const group=normalizeLiveMatch(row());
  assert.equal(group.decision,null);
  assert.equal(group.penaltyScore,null);
  const match=normalizeLiveMatch(row({goles_local:2,goles_visitante:1}),true);
  assert.equal(match.decision.winnerIndex,0);
  assert.equal(match.decision.byPenalties,false);
  assert.equal(match.penaltyScore,null);
  assert.equal(liveResultText(match),'Ganó Equipo local');
});
