import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../.local-work/tmp/mesa-test/node_modules/jsdom/lib/api.js';
import { buildKnockout, advanceKnockout } from '../assets/js/eliminatorias-model.js';

test('The fixture actually moves Mesa winner logos into the final and loser logos into third place',async()=>{
  const names=['one','two','three','four'];
  const standings=names.map((name,i)=>({categoria:'2014',equipo_id:name,equipo:name,logo_url:`/logos/${name}.svg`,pts:9-i*3,dg:4-i,gf:9-i}));
  const groups=names.flatMap((name,i)=>names.slice(i+1).map(other=>({categoria:'2014',equipo_local_id:name,equipo_visitante_id:other,estado:'OFICIAL',goles_local:1,goles_visitante:0})));
  const records=[
    {torneo_id:'cup',categoria:'2014',fase:'SF1',estado:'EN_REVISION',equipo_local_id:'one',equipo_visitante_id:'four',goles_local:1,goles_visitante:1,penales_local:0,penales_visitante:1},
    {torneo_id:'cup',categoria:'2014',fase:'SF2',estado:'EN_REVISION',equipo_local_id:'two',equipo_visitante_id:'three',goles_local:2,goles_visitante:0},
  ];
  const source=(await readFile('assets/js/eliminatorias.js','utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
  const dom=new JSDOM('<div id="knockoutContent"></div>',{url:'http://localhost/fixture/',runScripts:'outside-only'});
  const {window}=dom;
  window.ResizeObserver=class {observe(){} disconnect(){}};
  window.HTMLCanvasElement.prototype.getContext=()=>({measureText:value=>({width:value.length*5})});
  Object.defineProperty(window.document,'fonts',{value:{ready:Promise.resolve()}});
  try {
    window.eval(source);
    const container=window.document.getElementById('knockoutContent');
    await window.renderKnockout(container,advanceKnockout(buildKnockout('2014',standings,groups),records,'cup'));
    const logos=selector=>Array.from(container.querySelectorAll(selector)).map(image=>image.getAttribute('src'));
    assert.deepEqual(logos('.ko-final .ko-team img'),['/logos/four.svg','/logos/two.svg']);
    assert.deepEqual(logos('.ko-third .ko-team img'),['/logos/one.svg','/logos/three.svg']);
    assert.equal(container.querySelector('.ko-sf-one .is-winner .ko-team-name').title,'four');
    assert.match(container.querySelector('.ko-sf-one .ko-match-info').textContent,/Penales 0 – 1 · Finalizado por Mesa/);
    assert.match(container.querySelector('.ko-footnote').textContent,/avanza al finalizar en Mesa/);
    const reopened=[{...records[0],estado:'EN_VIVO'},records[1]];
    await window.renderKnockout(container,advanceKnockout(buildKnockout('2014',standings,groups),reopened,'cup'));
    assert.equal(container.querySelectorAll('.ko-final .ko-team-placeholder').length,1);
    assert.deepEqual(logos('.ko-final .ko-team img'),['/logos/two.svg']);
  } finally {window.close();}
});
