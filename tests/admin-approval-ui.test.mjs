import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from '../.local-work/tmp/mesa-test/node_modules/jsdom/lib/api.js';
import * as model from '../admin/panel-model.js';
import {loadPanelMatches} from '../admin/panel-data.js';
import {approveKnockout} from '../admin/panel-approval.js';
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(f){for(let i=0;i<100;i++){if(f())return;await tick();}assert.fail('UI timed out');}
test('Approve groups and knockout from pending list; claim validation and failed saves are visible',async()=>{
 const base={id:'same',categoria:'2014',estado:'EN_REVISION',goles_local:1,goles_visitante:0,reclamo:'Revisar DNI',equipo_local_id:'a',equipo_visitante_id:'b',equipo_local:{nombre:'A'},equipo_visitante:{nombre:'B'}};
 const groups=[{...base}], knockout=[{...base,torneo_id:'t',fase:'SF1',updated_at:'v1',goles_visitante:1,penales_local:4,penales_visitante:3}];
 let calls=[],failure=false;
 const client={from(table){const q={select:()=>q,order:()=>q,range:async()=>({data:structuredClone(table==='partidos'?groups:knockout),error:null})};return q;},rpc:async(name,args)=>{calls.push({name,args});if(failure)return {error:{message:'Permiso denegado'}};const row=name==='guardar_eliminatoria'?knockout[0]:groups[0];row.estado='OFICIAL';return {data:name==='guardar_eliminatoria'?{...row}:row.id,error:null};}};
 const dom=new JSDOM(await readFile('admin/index.html','utf8'),{url:'http://localhost/admin/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 Object.assign(w,{...model,e:model.escapeHTML,loadPanelMatches,approveKnockout,client});
 w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'));};
 try{
 let source=await readFile('admin/admin-panel.js','utf8');source=source.replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];/g,'').replace('export function initAdminPanel','function initAdminPanel');
 w.eval(source+';window.panel=initAdminPanel(client,()=>{});');await w.panel.start({user:{id:'admin',email:'admin@example.test'}});
 assert.equal(d.querySelector('[data-target="tab-reclamos"]'),null);
 const open=origin=>d.querySelector(`#review-list [data-origin="${origin}"]`).click();
 open('grupos');d.querySelector('dialog [type=submit]').click();assert.equal(calls.length,0);assert.match(d.querySelector('dialog [role=status]').textContent,/Marca/);
 d.querySelector('dialog [type=checkbox]').checked=true;failure=true;d.querySelector('dialog [type=submit]').click();await until(()=>d.querySelector('dialog [role=status]').textContent==='Permiso denegado');assert.equal(d.querySelector('dialog [type=submit]').disabled,false);
 failure=false;d.querySelector('dialog [type=submit]').click();await until(()=>!d.querySelector('dialog'));await tick();assert.equal(groups[0].estado,'OFICIAL');
 open('eliminatorias');d.querySelector('dialog [type=checkbox]').checked=true;d.querySelector('dialog [type=submit]').click();await until(()=>!d.querySelector('dialog'));await tick();assert.equal(knockout[0].estado,'OFICIAL');assert.equal(calls.at(-1).name,'guardar_eliminatoria');assert.equal(calls.at(-1).args.p_version,'v1');assert.equal(calls.at(-1).args.p.penales_local,4);assert.equal(d.querySelectorAll('#review-list [data-review-match]').length,0);assert.equal(d.querySelectorAll('#matches-list .panel-claim').length,0);
 }finally{w.close();}
});
test('Knockout approval rejects tied penalties and unconfirmed writes',async()=>{
 const m={id:'ko',estado:'EN_REVISION',updated_at:'v1'};
 await assert.rejects(approveKnockout({},m,1,1,3,3),/ganador/);
 await assert.rejects(approveKnockout({rpc:async()=>({data:null,error:null})},m,2,1,'',''),/No se confirmó/);
});
