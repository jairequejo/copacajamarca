import { supabase } from '../assets/js/supabase.js';
import { buildKnockout, advanceKnockout } from '../assets/js/eliminatorias-model.js?v=3';
import { loadKnockoutResults, tournamentFor, loadMatchesWithMetadata } from '../assets/js/eliminatorias-data.js?v=2';
import { renderKnockout } from '../assets/js/eliminatorias.js?v=28';
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localDate(value) {
  if(!value)return '';
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)).replace(' ','T');
}
export function initKnockoutAdmin() {
  const root=document.getElementById('tab-eliminatorias');
  let standings=[],games=[],results=[],bracket,available=false,busy=false;
  const select=root.querySelector('select'),status=root.querySelector('[role=status]'),forms=root.querySelector('.ka-matches');
  const say=message=>{status.textContent=message;};
  function render() {
    const cat=select.value;
    bracket=advanceKnockout(buildKnockout(cat,standings,games),results,tournamentFor(cat,games));
    const writable=available&&bracket.ready&&bracket.tournamentId;
    forms.innerHTML=bracket.matches.map((m,i)=>{
      const canEdit=writable&&m.teams.every(t=>t.id);
      const raw=results.find(r=>r.categoria===cat&&r.fase===m.round&&r.torneo_id===bracket.tournamentId);
      const stale=raw&&!m.recordId;
      return `<form class="ka-match" data-index="${i}"><h3>${safe(m.title)}</h3><p>${m.teams.map(t=>safe(t.name)).join(' vs. ')}</p>${stale?'<p class="ka-warning">El resultado guardado corresponde a otro cruce. Retíralo antes de continuar.</p>':''}<fieldset ${canEdit&&!stale?'':'disabled'}><div class="ka-inputs"><label>Goles local<input name="goles_local" type="number" min="0" max="99" step="1" value="${m.goals[0]??''}"></label><label>Goles visitante<input name="goles_visitante" type="number" min="0" max="99" step="1" value="${m.goals[1]??''}"></label><label>Penales local<input name="penales_local" type="number" min="0" max="99" step="1" value="${m.penalties[0]??''}"></label><label>Penales visitante<input name="penales_visitante" type="number" min="0" max="99" step="1" value="${m.penalties[1]??''}"></label></div><small>Penales solo si el marcador está empatado.</small><label>Estado<select name="estado">${['PROGRAMADO','EN_VIVO','OFICIAL'].map(s=>`<option ${s===m.estado?'selected':''} value="${s}">${s==='OFICIAL'?'Oficial · avanzar ganador':s==='EN_VIVO'?'En vivo':'Programado'}</option>`).join('')}</select></label><label>Fecha y hora (Perú)<input type="datetime-local" name="fecha_hora" value="${localDate(m.date)}"></label><label>Cancha<input name="cancha" maxlength="100" value="${safe(m.cancha)}"></label><button type="submit" class="btn-primary">Guardar ${safe(m.title.toLowerCase())}</button></fieldset>${raw?`<button type="button" class="ka-remove" data-remove="${safe(raw.id)}">Retirar programación y resultado</button>`:''}</form>`;
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
      const old=select.value;select.innerHTML=[...new Set(games.map(m=>m.categoria))].sort().map(c=>`<option value="${safe(c)}">Categoría ${safe(c)}</option>`).join('');
      if([...select.options].some(o=>o.value===old))select.value=old;
      say('Al oficializar, el ganador avanza a la final y el perdedor al tercer puesto.');render();
    } catch(error){say('No se pudo cargar: '+error.message);}finally{busy=false;}
  }
  select.addEventListener('change',()=>{say('');render();});
  root.querySelector('.ka-reload').addEventListener('click',load);
  document.querySelector('[data-target="tab-eliminatorias"]').addEventListener('click',load);
  forms.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const form=event.target,m=bracket.matches[Number(form.dataset.index)],data=new FormData(form);
    const number=name=>data.get(name)===''?null:Number(data.get(name));
    const p={torneo_id:bracket.tournamentId,categoria:bracket.category,fase:m.round,equipo_local_id:m.teams[0].id,equipo_visitante_id:m.teams[1].id,estado:data.get('estado'),goles_local:number('goles_local'),goles_visitante:number('goles_visitante'),penales_local:number('penales_local'),penales_visitante:number('penales_visitante'),fecha_hora:data.get('fecha_hora')?new Date(data.get('fecha_hora')+'-05:00').toISOString():null,cancha:String(data.get('cancha')||'').trim()||null};
    const goals=[p.goles_local,p.goles_visitante],pens=[p.penales_local,p.penales_visitante];
    if(pens.some(n=>n!==null)&&(!pens.every(n=>n!==null)||goals.some(n=>n===null)||goals[0]!==goals[1]))return say('Completa ambos penales y úsalos solo cuando hay empate.');
    if(p.estado==='OFICIAL'&&(goals.some(n=>n===null)||(goals[0]===goals[1]&&(pens.some(n=>n===null)||pens[0]===pens[1]))))return say('Para oficializar debe haber un ganador por goles o por penales.');
    busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
    try {
      const {error}=await supabase.rpc('guardar_eliminatoria',{p,p_version:m.updatedAt||null});
      if(error)throw error;
      busy=false;await load();say('Resultado guardado. Las llaves y el banner se actualizaron.');
    }catch(error){say(error.code==='42501'?'Tu cuenta necesita autorización en eliminatorias_admins de Supabase.':error.message);}
    finally{busy=false;button.disabled=false;}
  });
  forms.addEventListener('click',async event=>{
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
