import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../.local-work/tmp/mesa-test/node_modules/jsdom/lib/api.js';
import { buildKnockout, advanceKnockout } from '../assets/js/eliminatorias-model.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check) {
  for (let i=0;i<30;i++) { if (check()) return; await tick(); }
  throw new Error('La interfaz no alcanzó el estado esperado.');
}

test('Confirming a Mesa knockout locks it, survives reload and requires confirmation to edit', async () => {
  const dom=new JSDOM(`<section id="tab-eliminatorias"><select></select><button class="ka-reload"></button><p role="status"></p><div class="ka-matches"></div><div class="ka-preview"></div></section><button data-target="tab-eliminatorias"></button>`,{url:'http://localhost/admin/',runScripts:'outside-only'});
  const {window}=dom;
  const tid='10000000-0000-4000-8000-000000000001';
  let records=[{id:'final',torneo_id:tid,categoria:'2014',fase:'F',estado:'EN_REVISION',clasificacion_manual:true,updated_at:'v1',equipo_local_id:'a',equipo_visitante_id:'b',goles_local:2,goles_visitante:1,penales_local:null,penales_visitante:null,equipo_local:{nombre:'Local'},equipo_visitante:{nombre:'Visita'}}];
  let edits=0;
  window.buildKnockout=buildKnockout;
  window.advanceKnockout=advanceKnockout;
  window.tournamentFor=()=>tid;
  window.renderKnockout=()=>{};
  window.loadMatchesWithMetadata=async()=>({data:[{torneo_id:tid,categoria:'2014'}],error:null});
  window.loadKnockoutResults=async()=>({records:structuredClone(records),available:true});
  window.supabase={
    from:()=>({select:async()=>({data:[],error:null})}),
    rpc:async(_name,{p})=>{
      edits++;
      records=[{...records[0],...p,updated_at:`v${edits+1}`}];
      return {data:structuredClone(records[0]),error:null};
    }
  };
  window.confirm=()=>true;
  const source=(await readFile('admin/eliminatorias-admin.js','utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  window.eval(source);
  window.initKnockoutAdmin();
  window.document.querySelector('[data-target="tab-eliminatorias"]').click();
  const confirmButton=()=>[...window.document.querySelectorAll('.ka-match [type="submit"]')].find(button=>button.textContent==='Confirmar resultado');
  await until(confirmButton);

  confirmButton().click();
  await until(()=>window.document.querySelector('[data-edit-official]'));
  const form=window.document.querySelector('[data-edit-official]').closest('form');
  assert.match(form.textContent,/Resultado oficial confirmado y bloqueado/);
  assert.equal(form.querySelector('fieldset').disabled,true);
  assert.doesNotMatch(form.textContent,/Confirmar resultado/);

  window.document.querySelector('.ka-reload').click();
  await until(()=>window.document.querySelector('[data-edit-official]')&&!/Cargando/.test(window.document.querySelector('[role="status"]').textContent));
  assert.equal(window.document.querySelector('[data-edit-official]').closest('form').querySelector('fieldset').disabled,true);

  window.document.querySelector('[data-edit-official]').click();
  const editing=[...window.document.querySelectorAll('.ka-match')].find(node=>/Guardar corrección/.test(node.textContent));
  assert.equal(editing.querySelector('fieldset').disabled,false);
  assert.equal(editing.querySelector('select[name="estado"]').disabled,true);
  assert.equal(editing.querySelector('[data-remove]'),null);
  assert.match(editing.textContent,/Guardar corrección/);
  dom.window.close();
});
