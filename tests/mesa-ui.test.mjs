import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../.local-work/tmp/mesa-test/node_modules/jsdom/lib/api.js';
import { loadMesaMatches, saveMesaMatch, mesaError } from '../mesa/mesa-data.js';

const tick = () => new Promise(resolve=>setTimeout(resolve,5));
async function until(check) {
  for(let i=0;i<200;i++) { if(check()) return; await tick(); }
  assert.fail('UI did not reach the expected state');
}
const record = extra => ({id:'shared',estado:'EN_VIVO',categoria:'2014',fecha_hora:new Date().toISOString(),
  equipo_local_id:'local',equipo_visitante_id:'visitor',equipo_local:{nombre:'Equipo local'},equipo_visitante:{nombre:'Equipo visitante'},
  goles_local:1,goles_visitante:1,reclamo:'Documento observado',cancha:'Estadio - C1',updated_at:'v1',
  penales_local:null,penales_visitante:null,...extra});

test('Mesa reopens groups, saves goals and penalties, submits and reopens knockouts, and reports failed writes', async () => {
  const groups=[record({estado:'EN_REVISION'}),record({id:'official',estado:'OFICIAL',goles_local:3,goles_visitante:1})];
  const knockout=[record({fase:'SF1'})];
  let version=1, writes=0, failNext=false;
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'mesa',email:'mesa@example.test'}}}}),signOut:async()=>({})},
    rpc:async(name,p)=>{
      if(name==='es_mesa_control') return {data:true,error:null};
      assert.equal(name,'guardar_eliminatoria_mesa');
      const row=knockout.find(r=>r.id===p.p_id);
      assert.equal(p.p_version,row.updated_at);
      writes++;
      const update=Object.fromEntries(Object.entries(p).filter(([key])=>!['p_id','p_version'].includes(key)).map(([key,value])=>[key.slice(2),value]));
      Object.assign(row,update,{updated_at:'v'+ ++version});
      return {data:{...row},error:null};
    },
    from(table){
      const rows=table==='partidos'?groups:knockout;
      let payload,conditions=[];
      const q={select:()=>q,or:()=>q,order:()=>q,range:(start,end)=>Promise.resolve({data:rows.slice(start,end+1).map(r=>({...r})),error:null}),
        update(p){payload=p;return q;},eq(k,v){conditions.push([k,v]);return q;},is(k,v){conditions.push([k,v]);return q;},
        single:async()=>{
          await tick();
          if(failNext){failNext=false;return {data:null,error:{code:'PGRST116'}};}
          const row=rows.find(r=>conditions.every(([key,value])=>(r[key]??null)===value));
          assert.ok(row,'Update must match the original snapshot');
          writes++;Object.assign(row,payload);
          return {data:{...row},error:null};
        },
      };return q;
    },
  };
  const html=await readFile('mesa/index.html','utf8');
  const source=(await readFile('mesa/mesa.js','utf8')).replace(/^import .*;\n/gm,'');
  const dom=new JSDOM(html,{url:'http://localhost/mesa/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom, document=window.document;
  Object.assign(window,{supabase:client,loadMesaMatches,saveMesaMatch,mesaError});
  window.confirm=()=>true;window.scrollTo=()=>{};
  const card=key=>document.querySelector(`.partido-card[data-id="${key}"]`);
  try {
    window.eval(source);
    await until(()=>card('grupo-shared')&&card('eliminatoria-shared'));
    assert.equal(card('grupo-official').querySelector('[data-action="editar"]'),null);
    card('grupo-shared').querySelector('[data-action="editar"]').click();
    await until(()=>card('grupo-shared').querySelector('.btn-score.plus'));
    assert.equal(groups[0].estado,'EN_VIVO');
    const initialWrites=writes;
    card('grupo-shared').querySelector('.btn-score.plus[data-team="local"]').click();
    card('grupo-shared').querySelector('.btn-score.plus[data-team="visitante"]').click();
    await until(()=>groups[0].goles_local===2);
    assert.equal(writes,initialWrites+1,'Concurrent taps on one card must not race');
    assert.equal(groups[0].goles_visitante,1);
    await until(()=>!card('grupo-shared').querySelector('.btn-score.plus').disabled);
    failNext=true;
    card('grupo-shared').querySelector('.btn-score.plus[data-team="visitante"]').click();
    await until(()=>document.getElementById('mesa-status').textContent.includes('El partido cambió'));
    assert.equal(groups[0].goles_visitante,1);
    assert.equal(document.getElementById('visita-grupo-shared').textContent,'1');
    assert.equal(card('grupo-shared').querySelector('.btn-score.plus').disabled,false);

    const penalty=(side,value)=>{ document.getElementById(`pen-${side}-eliminatoria-shared`).value=value; };
    penalty('local','4');penalty('visita','3');
    card('eliminatoria-shared').querySelector('[data-action="penales"]').click();
    await until(()=>knockout[0].penales_local===4);
    assert.equal(knockout[0].penales_visitante,3);
    await until(()=>!card('eliminatoria-shared').querySelector('[data-action="finalizar"]').disabled);
    card('eliminatoria-shared').querySelector('[data-action="finalizar"]').click();
    await until(()=>card('eliminatoria-shared').querySelector('[data-action="editar"]'));
    assert.equal(knockout[0].estado,'EN_REVISION');
    assert.equal(knockout[0].reclamo,'Documento observado');
    assert.match(card('eliminatoria-shared').textContent,/Penales: 4 - 3/);
    card('eliminatoria-shared').querySelector('[data-action="editar"]').click();
    await until(()=>card('eliminatoria-shared').querySelector('.btn-score.plus'));
    assert.equal(document.getElementById('pen-local-eliminatoria-shared').value,'4');
    card('eliminatoria-shared').querySelector('.btn-score.plus[data-team="local"]').click();
    await until(()=>knockout[0].goles_local===2);
    assert.equal(knockout[0].penales_local,null);
    assert.equal(knockout[0].penales_visitante,null);
    await until(()=>!card('eliminatoria-shared').querySelector('.btn-score.plus').disabled);
    assert.equal(document.getElementById('pen-local-eliminatoria-shared').disabled,true);
    assert.equal(document.getElementById('pen-local-eliminatoria-shared').value,'');
    assert.match(card('eliminatoria-shared').textContent,/Cancha|C1/);
  } finally { window.close(); }
});
