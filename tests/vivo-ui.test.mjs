import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../.local-work/tmp/mesa-test/node_modules/jsdom/lib/api.js';
import { normalizeLiveMatch, liveResultText, liveScoreSummary, isRecentLiveMatch } from '../assets/js/vivo-model.js';

test('Live cards actually render penalties, winner emphasis and the corrected winner after a refresh',async()=>{
  const knockout={id:'semi',estado:'EN_REVISION',categoria:'2014',fase:'SF1',goles_local:1,goles_visitante:1,
    penales_local:4,penales_visitante:3,fecha_hora:'2020-01-01T10:00:00Z',updated_at:new Date().toISOString(),equipo_local:{nombre:'Local <Club>'},equipo_visitante:{nombre:'Visitante'}};
  let selectedFields;
  const client={from(table){return {select(fields){if(table==='eliminatorias_partidos')selectedFields=fields;return this;},
    order:async()=>({data:table==='eliminatorias_partidos'?[{...knockout}]:[],error:null})};}};
  const html=await readFile('vivo/index.html','utf8');
  const source=(await readFile('assets/js/vivo.js','utf8')).replace(/^import .*;\n/gm,'');
  const dom=new JSDOM(html,{url:'http://localhost/vivo/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom,doc=window.document;
  Object.assign(window,{supabase:client,normalizeLiveMatch,liveResultText,liveScoreSummary,isRecentLiveMatch});
  let interval;
  window.setInterval=callback=>{interval=callback;return 1;};window.clearInterval=()=>{};
  try {
    window.eval(source);
    const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Expected live card update');};
    await wait(()=>doc.querySelector('.match-card'));
    assert.match(selectedFields,/penales_local, penales_visitante/);
    assert.equal(doc.querySelector('.score-penalties').textContent,'Penales 4 – 3');
    assert.equal(doc.querySelector('.team.local').classList.contains('winner'),true);
    assert.equal(doc.querySelector('.team.visitante').classList.contains('loser'),true);
    assert.equal(doc.querySelector('.match-result-line').textContent,'Ganó Local <Club> por penales');
    assert.equal(doc.querySelector('club'),null);
    knockout.penales_local=3;knockout.penales_visitante=4;
    // The existing refresh timer re-fetches the result and must notice penalty-only edits.
    for(let i=0;i<30;i++) interval();
    await wait(()=>doc.querySelector('.team.visitante.winner'));
    assert.equal(doc.querySelector('.score-penalties').textContent,'Penales 3 – 4');
    assert.equal(doc.querySelector('.match-result-line').textContent,'Ganó Visitante por penales');
  } finally {window.close();}
});
