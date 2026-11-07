import { supabase } from '../assets/js/supabase.js';
import { buildKnockout, advanceKnockout } from '../assets/js/eliminatorias-model.js?v=6';
import { loadKnockoutResults, tournamentFor, loadMatchesWithMetadata } from '../assets/js/eliminatorias-data.js?v=3';
import { renderKnockout } from '../assets/js/eliminatorias.js?v=35';
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localDate(value) {
  if(!value)return '';
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)).replace(' ','T');
}
export function initKnockoutAdmin() {
  const root=document.getElementById('tab-eliminatorias');
  let standings=[],games=[],results=[],bracket,available=false,busy=false,activeForm=null;
  const editingOfficial=new Set();
  const select=root.querySelector('select'),status=root.querySelector('[role=status]'),forms=root.querySelector('.ka-matches');
  const say=message=>{status.textContent=message; const inline=activeForm?.querySelector(".ka-form-status"); if(inline)inline.textContent=message;};
  function render() {
    const cat=select.value;
    bracket=advanceKnockout(buildKnockout(cat,standings,games),results,tournamentFor(cat,games),{includeReview:false});
    const writable=available&&bracket.ready&&bracket.tournamentId;
    forms.innerHTML=bracket.matches.map((m,i)=>{
      const raw=results.find(r=>r.categoria===cat&&r.fase===m.round&&r.torneo_id===bracket.tournamentId);
      const official=raw?.estado==='OFICIAL';
      const editing=official&&editingOfficial.has(raw.id);
      const canEdit=writable&&m.teams.every(t=>t.id)&&(!official||editing);
      const stale=raw&&!m.recordId;
      const stateLabel=s=>s==='OFICIAL'?'Oficial':s==='EN_REVISION'?'Por confirmar':s==='EN_VIVO'?'En vivo':'Programado';
      const review=raw?.estado==='EN_REVISION';
      const locked=official&&!editing?'<p class="ka-confirmed">Resultado oficial confirmado y bloqueado.</p>':'';
      const action=official?(editing?'Guardar corrección':''):review?'Confirmar resultado':'Guardar '+safe(m.title.toLowerCase());
      return `<form class="ka-match" data-index="${i}"><h3>${safe(m.title)}</h3><p>${m.teams.map(t=>safe(t.name)).join(' vs. ')}</p>${review?'<p class="ka-warning">Mesa envió este resultado. Revísalo y confirma para guardar los siguientes cruces. El fixture ya muestra el avance de Mesa.</p>':''}${locked}${raw?.reclamo&&raw.estado!=='OFICIAL'?`<p class="ka-warning"><strong>Observación de mesa:</strong> ${safe(raw.reclamo)}</p>`:''}${stale?'<p class="ka-warning">El resultado guardado corresponde a otro cruce. Retíralo antes de continuar.</p>':''}<fieldset ${canEdit&&!stale?'':'disabled'}><div class="ka-inputs"><label>Goles local<input name="goles_local" type="number" min="0" max="99" step="1" value="${m.goals[0]??''}"></label><label>Goles visitante<input name="goles_visitante" type="number" min="0" max="99" step="1" value="${m.goals[1]??''}"></label><label>Penales local<input name="penales_local" type="number" min="0" max="99" step="1" value="${m.penalties[0]??''}"></label><label>Penales visitante<input name="penales_visitante" type="number" min="0" max="99" step="1" value="${m.penalties[1]??''}"></label></div><small>Penales solo si el marcador está empatado.</small><label>Estado<select name="estado" ${official?'disabled':''}>${['PROGRAMADO','EN_VIVO','EN_REVISION','OFICIAL'].map(s=>`<option ${s===m.estado?'selected':''} value="${s}">${stateLabel(s)}</option>`).join('')}</select></label>${official?'<input type="hidden" name="estado" value="OFICIAL">':''}<label>Fecha y hora (Perú)<input type="datetime-local" name="fecha_hora" value="${localDate(m.date)}"></label><label>Cancha<input name="cancha" maxlength="100" value="${safe(m.cancha)}"></label><p class="ka-form-status" role="status"></p>${action?`<button type="submit" class="btn-primary">${action}</button>`:''}</fieldset>${official&&!editing?`<button type="button" class="btn-primary ka-edit" data-edit-official="${safe(raw.id)}">Editar resultado</button>`:''}${raw&&!official?`<button type="button" class="ka-remove" data-remove="${safe(raw.id)}">Retirar programación y resultado</button>`:''}</form>`;
    }).join('');
    renderKnockout(root.querySelector('.ka-preview'),bracket);
    if(!available)say('Para guardar resultados falta aplicar la migración de eliminatorias en Supabase. El gráfico y su descarga ya están disponibles.');
    else if(!bracket.tournamentId)say('No se pudo identificar un único torneo para esta categoría.');
    else if(!bracket.ready)say(bracket.message);
  }
  async function load() {
    if(busy)return;busy=true;say('Cargando eliminatorias…');
    try {
      const [s,g,k]=await Promise.all([supabase.from('view_posiciones').select('*'),loadMatchesWithMetadata('id,torneo_id,categoria,equipo_local_id,equipo_visitante_id,estado,goles_local,goles_visitante'),loadKnockoutResults()]);
      if(s.error||g.error)throw s.error||g.error;
      standings=s.data;games=g.data;results=k.records;available=k.available;
      const old=root.dataset.requestedCategory||select.value;delete root.dataset.requestedCategory;select.innerHTML=[...new Set(games.map(m=>m.categoria))].sort().map(c=>`<option value="${safe(c)}">Categoría ${safe(c)}</option>`).join('');
      if([...select.options].some(o=>o.value===old))select.value=old;
      say('El fixture avanza al finalizar en Mesa. Confirma ambas semifinales para guardar la final y el tercer puesto.');render();
    } catch(error){say('No se pudo cargar: '+error.message);}finally{busy=false;}
  }
  select.addEventListener('change',()=>{say('');render();});
  root.querySelector('.ka-reload').addEventListener('click',load);
  document.querySelector('[data-target="tab-eliminatorias"]').addEventListener('click',load);
  forms.addEventListener('invalid',event=>{activeForm=event.target.closest('form');say('Revisa el marcador: usa números enteros entre 0 y 99.');},true);
  forms.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;activeForm=event.target;
    const form=event.target,m=bracket.matches[Number(form.dataset.index)],data=new FormData(form);
    const number=name=>data.get(name)===''?null:Number(data.get(name));
    const p={torneo_id:bracket.tournamentId,categoria:bracket.category,fase:m.round,equipo_local_id:m.teams[0].id,equipo_visitante_id:m.teams[1].id,estado:m.estado==='OFICIAL'?'OFICIAL':m.estado==='EN_REVISION'&&data.get('estado')==='EN_REVISION'?'OFICIAL':data.get('estado'),goles_local:number('goles_local'),goles_visitante:number('goles_visitante'),penales_local:number('penales_local'),penales_visitante:number('penales_visitante'),fecha_hora:data.get('fecha_hora')?new Date(data.get('fecha_hora')+'-05:00').toISOString():null,cancha:String(data.get('cancha')||'').trim()||null};
    const goals=[p.goles_local,p.goles_visitante],pens=[p.penales_local,p.penales_visitante];
    if(pens.some(n=>n!==null)&&(!pens.every(n=>n!==null)||goals.some(n=>n===null)||goals[0]!==goals[1]))return say('Completa ambos penales y úsalos solo cuando hay empate.');
    if(p.estado==='OFICIAL'&&(goals.some(n=>n===null)||(goals[0]===goals[1]&&(pens.some(n=>n===null)||pens[0]===pens[1]))))return say('Para oficializar debe haber un ganador por goles o por penales.');
    busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
    try {
      const {data:savedData,error}=await supabase.rpc('guardar_eliminatoria',{p,p_version:m.updatedAt||null});
      if(error)throw error;
      const saved=Array.isArray(savedData)?savedData[0]:savedData;
      if(!saved?.id||saved.estado!==p.estado)throw new Error('Supabase no confirmó el cambio. Actualiza y vuelve a intentarlo.');
      const position=results.findIndex(r=>r.id===saved.id);
      if(position>=0)results[position]={...results[position],...saved};else results.push(saved);
      editingOfficial.delete(saved.id);
      render();
      say(saved.estado==='OFICIAL'?'Resultado oficial confirmado y bloqueado.':'Resultado guardado. Las llaves y el banner se actualizaron.');
    }catch(error){say(error.code==='42501'?'Tu cuenta necesita autorización en eliminatorias_admins de Supabase.':error.message);}
    finally{busy=false;button.disabled=false;}
  });
  forms.addEventListener('click',async event=>{
    const edit=event.target.closest('[data-edit-official]');
    if(edit&&!busy){
      if(!confirm('Este resultado ya es oficial. ¿Seguro que deseas desbloquearlo para corregirlo?'))return;
      const index=edit.closest('form').dataset.index;
      editingOfficial.add(edit.dataset.editOfficial);render();
      forms.querySelector(`[data-index="${index}"] input[name="goles_local"]`)?.focus();
      return;
    }
    const button=event.target.closest('[data-remove]');if(!button||busy)return;
    const record=results.find(r=>r.id===button.dataset.remove);
    if(!confirm('¿Retirar la programación y el resultado de este partido? Sus equipos volverán a aparecer sin marcador.'))return;
    busy=true;button.disabled=true;
    try {
      const {data,error}=await supabase.from('eliminatorias_partidos').delete().eq('id',record.id).eq('updated_at',record.updated_at).select('id');
      if(error)throw error;if(!data.length)throw new Error('El partido cambió o tu cuenta no tiene permiso. Recarga antes de continuar.');
      busy=false;await load();say('Partido retirado. Las llaves se actualizaron.');
    }catch(error){say(error.message);}finally{busy=false;button.disabled=false;}
  });
}
