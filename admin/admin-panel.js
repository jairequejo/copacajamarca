import {escapeHTML as e,STATUS,filterMatches,matchCounts,validateScore,peruDate} from './panel-model.js?v=1';

const TITLES={inicio:['Mesa de control','El campeonato, en tus manos.'],partidos:['Partidos','Consulta resultados y revisa cada acta.'],reclamos:['Reclamos','Las observaciones de mesa, junto a su partido.'],historial:['Mis aprobaciones','Resultados que oficializaste con tu cuenta.'],mesa:['Accesos de mesa','Administra las cuentas que registran los partidos.'],mas:['Herramientas','Todo lo que necesitas para organizar el torneo.'],programar:['Programación','Fechas, horarios y canchas por jornada.'],eliminatorias:['Eliminatorias','Semifinales, final y tercer puesto.'],importar:['Importar fixture','Carga y comprueba la programación.'],salvavidas:['Crear partido','Añade un encuentro al campeonato.'],directorio:['Directorio','Jugadores, delegados y entrenadores.'],carnets:['Carnets','Prepara identificaciones para impresión.'],boleteria:['Boletería','Consulta ventas y administra el ingreso.'],fichas:['Fichas PDF','Documentos oficiales de los equipos.']};
const FIELDS='id,torneo_id,categoria,grupo,jornada,estado,goles_local,goles_visitante,fecha_hora,cancha,lugar,reclamo,equipo_local_id,equipo_visitante_id,equipo_local:equipos!partidos_equipo_local_id_fkey(nombre,logo_url),equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre,logo_url)';

export function initAdminPanel(client,say) {
  const $=id=>document.getElementById(id);
  let session,matches=[],active='inicio',loading=false,history=[],historyMore=false,historyLoading=false,historyRequest=0;
  const filters=()=>({category:$('panel-category').value,search:$('panel-search').value.trim(),status:$('panel-status').value});
  const scoped=()=>filterMatches(matches,{category:filters().category,search:filters().search});
  function navigate(id) {
    const target=id.replace('tab-','');
    if(!TITLES[target])return;
    active=target;
    document.querySelectorAll('.tab-content').forEach(p=>p.classList.toggle('active',p.id===id));
    document.querySelectorAll('[data-panel-target]').forEach(b=>{const selected=b.dataset.panelTarget===id;b.classList.toggle('active',selected);b.setAttribute('aria-current',selected?'page':'false');});
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===id));
    $('panel-title').textContent=TITLES[target][0];$('panel-subtitle').textContent=TITLES[target][1];
    $('panel-filters').hidden=!['inicio','partidos','reclamos','historial'].includes(target);
    $('panel-status-wrap').hidden=target!=='partidos';
    const url=new URL(location.href);url.searchParams.set('vista',target);historyURL(url);
    render();if(target==='historial')loadHistory();if(target==='mesa')loadMesa();
    $('panel-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  const historyURL=url=>window.history.replaceState(null,'',url);
  document.querySelectorAll('[data-panel-target]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.panelTarget,legacy=document.querySelector(`.tab-btn[data-target="${id}"]`);
    if(legacy)legacy.click();else navigate(id);
  }));
  document.querySelectorAll('.tab-btn').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.target)));
  document.querySelectorAll('[data-tool-target]').forEach(button=>button.addEventListener('click',()=>document.querySelector(`.tab-btn[data-target="${button.dataset.toolTarget}"]`).click()));
  $('panel-category').addEventListener('change',()=>{render();if(active==='historial')loadHistory();});
  $('panel-search').addEventListener('input',render);$('panel-status').addEventListener('change',render);
  $('panel-refresh').addEventListener('click',()=>active==='mesa'?loadMesa():active==='historial'?loadHistory():refresh());
  $('history-more').addEventListener('click',()=>loadHistory(true));
  document.querySelector('.content-wrapper').addEventListener('click',event=>{
    const button=event.target.closest('[data-review-match]');if(button)reviewMatch(button.dataset.reviewMatch);
    const access=event.target.closest('[data-mesa-user]');if(access)passwordDialog(access.dataset.mesaUser,access.dataset.mesaName);
  });
  const blank=(title,detail)=>`<div class="panel-empty"><span aria-hidden="true">✓</span><h3>${e(title)}</h3><p>${e(detail)}</p></div>`;
  function team(t){return `<div class="panel-team">${t?.logo_url?`<img src="${e(t.logo_url)}" alt="" loading="lazy">`:'<span class="team-initial" aria-hidden="true">'+e(t?.nombre?.slice(0,1)||'?')+'</span>'}<strong>${e(t?.nombre||'Descanso')}</strong></div>`;}
  function matchCard(m){
    const score=m.goles_local!==null&&m.goles_visitante!==null?`${m.goles_local} <span>:</span> ${m.goles_visitante}`:'<span>vs</span>';
    return `<article class="panel-match"><div class="panel-match-meta"><span>Cat. ${e(m.categoria)}${m.grupo?' / Grupo '+e(m.grupo):''}${m.jornada?' / Jornada '+e(m.jornada):''}</span><span class="match-status status-${e(m.estado)}">${e(STATUS[m.estado]||m.estado)}</span></div><div class="panel-match-pair">${team(m.equipo_local)}<div class="panel-result">${score}</div>${team(m.equipo_visitante)}</div><div class="panel-match-bottom"><p>${e(peruDate(m.fecha_hora))}${m.cancha?' / '+e(m.cancha):''}</p>${m.estado==='EN_REVISION'?`<button class="panel-primary" data-review-match="${e(m.id)}">Revisar resultado</button>`:''}</div>${m.reclamo?`<details class="panel-claim" ${active==='reclamos'?'open':''}><summary><span>Reclamo de mesa</span><span>Ver detalle</span></summary><p>${e(m.reclamo)}</p></details>`:''}</article>`;
  }
  function render(){
    const rows=scoped(),counts=matchCounts(rows);
    document.querySelectorAll('[data-count]').forEach(n=>n.textContent=counts[n.dataset.count]||0);
    $('review-list').innerHTML=rows.filter(m=>m.estado==='EN_REVISION').map(matchCard).join('')||blank('La revisión está al día','No hay resultados pendientes con estos filtros.');
    const all=filterMatches(matches,filters());
    $('matches-count').textContent=`${all.length} partido${all.length===1?'':'s'}`;
    $('matches-list').innerHTML=all.map(matchCard).join('')||blank('Sin partidos','Prueba otra categoría o borra la búsqueda.');
    $('claims-list').innerHTML=rows.filter(m=>String(m.reclamo||'').trim()).map(matchCard).join('')||blank('Sin reclamos registrados','Aquí aparecerán las observaciones enviadas desde mesa.');
    const grouped=[...new Set(matches.map(m=>String(m.categoria)))].sort();
    $('category-overview').innerHTML=grouped.map(cat=>{const c=matchCounts(matches.filter(m=>String(m.categoria)===cat));return `<button type="button" data-overview-cat="${e(cat)}"><strong>${e(cat)}</strong><span>${c.review?c.review+' por aprobar':'Revisión al día'}</span>${c.claims?`<small>${c.claims} reclamo${c.claims===1?'':'s'}</small>`:''}</button>`;}).join('');
    $('category-overview').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{$('panel-category').value=b.dataset.overviewCat;navigate('tab-partidos');$('panel-status').value='';render();}));
    renderHistory();
  }
  async function refresh(){
    if(!session||loading)return;loading=true;$('panel-refresh').disabled=true;$('panel-connection').textContent='Actualizando partidos…';
    try {
      const rows=[];
      for(let start=0;;start+=500){const {data,error}=await client.from('partidos').select(FIELDS).order('id').range(start,start+499);if(error)throw error;rows.push(...data);if(data.length<500)break;}
      matches=rows.sort((a,b)=>(Date.parse(b.fecha_hora)||0)-(Date.parse(a.fecha_hora)||0));
      const old=$('panel-category').value;$('panel-category').innerHTML='<option value="">Todas las categorías</option>'+[...new Set(matches.map(m=>String(m.categoria)))].sort().map(c=>`<option value="${e(c)}">Categoría ${e(c)}</option>`).join('');
      if([...$('panel-category').options].some(o=>o.value===old))$('panel-category').value=old;
      render();$('panel-connection').textContent='Actualizado '+new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}).format(new Date());
    }catch(error){$('panel-connection').textContent='No se pudieron actualizar los partidos. Usa Actualizar para reintentar.';say('No se pudieron cargar los partidos.',true);}
    finally{loading=false;$('panel-refresh').disabled=false;}
  }
  function renderHistory(){
    const search=filters().search.toLowerCase();
    const rows=history.filter(h=>!search||[h.local_nombre,h.visitante_nombre,h.reclamo].join(' ').toLowerCase().includes(search));
    $('history-list').innerHTML=rows.map(h=>`<article class="panel-history"><div class="history-mark" aria-hidden="true">✓</div><div><p class="history-date">${e(peruDate(h.aprobado_at))} / Cat. ${e(h.categoria)}${h.grupo?' / Grupo '+e(h.grupo):''}</p><h3>${e(h.local_nombre)} <b>${e(h.goles_local)} : ${e(h.goles_visitante)}</b> ${e(h.visitante_nombre)}</h3><p>Oficializado por ti${h.reclamo?' / Con reclamo registrado':''}</p>${h.reclamo?`<details><summary>Ver reclamo del acta</summary><p>${e(h.reclamo)}</p></details>`:''}</div></article>`).join('')||blank('Todavía no hay aprobaciones registradas','El historial identifica tu cuenta desde que se activa el registro. Los partidos anteriores no se atribuyen automáticamente.');
    $('history-more').hidden=!historyMore;
  }
  async function loadHistory(more=false){
    if(!session)return;
    if(more&&historyLoading)return;
    const request=++historyRequest;historyLoading=true;
    const category=filters().category,start=more?history.length:0;
    $('history-note').textContent='Cargando tus aprobaciones…';$('history-more').disabled=true;
    try {
      let query=client.from('partidos_aprobaciones').select('*').eq('actor_id',session.user.id).order('aprobado_at',{ascending:false}).order('id',{ascending:false}).range(start,start+99);
      if(category)query=query.eq('categoria',category);
      const {data,error}=await query;if(error)throw error;if(request!==historyRequest)return;
      history=more?[...history,...data]:data;historyMore=data.length===100;renderHistory();$('history-note').textContent='Registro de tu cuenta. Conserva el marcador y el reclamo de cada aprobación.';
    }catch(error){if(request!==historyRequest)return;history=[];historyMore=false;renderHistory();$('history-note').textContent=['PGRST205','42P01'].includes(error.code)?'El registro de aprobaciones aún necesita activarse. Los resultados actuales siguen disponibles en Partidos.':'No se pudo cargar tu historial. Pulsa Actualizar para reintentar.';}
    finally{if(request===historyRequest){historyLoading=false;$('history-more').disabled=false;}}
  }
  function modal(title,content){const d=document.createElement('dialog');d.className='panel-dialog';d.innerHTML=`<div class="panel-dialog-head"><h2>${e(title)}</h2><button type="button" data-close aria-label="Cerrar">×</button></div>${content}`;document.body.append(d);d.querySelector('[data-close]').addEventListener('click',()=>d.close());d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;}
  function reviewMatch(id){
    const m=matches.find(m=>m.id===id);if(!m||m.estado!=='EN_REVISION')return;
    const d=modal('Revisar resultado',`<p class="dialog-description">Categoría ${e(m.categoria)} / ${e(m.equipo_local?.nombre)} vs ${e(m.equipo_visitante?.nombre)}</p>${m.reclamo?`<div class="dialog-claim"><strong>Reclamo pendiente de revisión</strong><p>${e(m.reclamo)}</p></div>`:''}<form class="panel-review-form"><div class="score-fields"><label>${e(m.equipo_local?.nombre)}<input name="local" type="number" min="0" max="99" step="1" required value="${e(m.goles_local??'')}"></label><label>${e(m.equipo_visitante?.nombre)}<input name="visitante" type="number" min="0" max="99" step="1" required value="${e(m.goles_visitante??'')}"></label></div>${m.reclamo?'<label class="review-check"><input type="checkbox" required>He revisado el reclamo antes de oficializar.</label>':''}<p class="dialog-description">El marcador se publicará en la tabla de posiciones.</p><p class="panel-form-message" role="status"></p><button type="submit" class="panel-primary">Aprobar y hacer oficial</button></form>`);
    d.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();const data=new FormData(event.currentTarget),a=data.get('local'),b=data.get('visitante');if(!validateScore(a,b))return;
      const button=d.querySelector('[type=submit]'),message=d.querySelector('[role=status]');button.disabled=true;message.textContent='Guardando aprobación…';
      try {
        let {error}=await client.rpc('aprobar_partido_admin',{p_id:id,p_local:Number(a),p_visitante:Number(b),p_original_local:m.goles_local,p_original_visitante:m.goles_visitante,p_reclamo:m.reclamo??null,p_local_id:m.equipo_local_id,p_visitante_id:m.equipo_visitante_id});
        let legacy=false;
        if(error?.code==='PGRST202'){
          let query=client.from('partidos').update({estado:'OFICIAL',goles_local:Number(a),goles_visitante:Number(b)}).eq('id',id).eq('estado','EN_REVISION').eq('equipo_local_id',m.equipo_local_id).eq('equipo_visitante_id',m.equipo_visitante_id);
          for(const [key,value] of Object.entries({goles_local:m.goles_local,goles_visitante:m.goles_visitante,reclamo:m.reclamo??null}))query=value===null?query.is(key,null):query.eq(key,value);
          const result=await query.select('id');error=result.error;if(!error&&!result.data?.length)throw new Error('El partido cambió. Actualiza y revisa el acta nuevamente.');legacy=true;
        }
        if(error)throw error;d.close();say(legacy?'Resultado oficializado. Activa el registro para guardar quién lo aprobó.':'Partido aprobado y registrado en tu historial.');await refresh();if(active==='historial')loadHistory();
      }catch(error){message.textContent=error.message||'No se pudo aprobar. Reintenta después de actualizar.';button.disabled=false;}
    });
  }
  async function invokeMesa(body){const {data,error}=await client.functions.invoke('admin-mesa',{body});if(error){const details=await error.context?.json?.().catch(()=>null);throw new Error(details?.error||'No se pudo conectar con la gestión de mesa. Revisa su activación y tus permisos.');}if(data?.error)throw new Error(data.error);return data;}
  async function loadMesa(){
    if(!session)return;$('mesa-note').textContent='Cargando accesos…';$('mesa-users').innerHTML='';
    try {const data=await invokeMesa({action:'list'});$('mesa-note').textContent='Solo se muestran cuentas de mesa autorizadas. Las contraseñas actuales no se pueden consultar.';$('mesa-users').innerHTML=data.users.map(u=>`<article class="mesa-user"><span class="mesa-avatar" aria-hidden="true">${e(u.nombre.slice(0,1))}</span><div><h3>${e(u.nombre)}</h3><p>${e(u.email)}</p><small>${u.last_sign_in_at?'Último acceso: '+e(peruDate(u.last_sign_in_at)):'Todavía no registra un acceso'}</small></div><button type="button" class="panel-secondary" data-mesa-user="${e(u.id)}" data-mesa-name="${e(u.nombre)}">Cambiar contraseña</button></article>`).join('')||blank('Sin accesos vinculados','Vincula las cuentas existentes de mesa durante la configuración del panel.');}
    catch(error){$('mesa-note').textContent=error.message;$('mesa-users').innerHTML=blank('No se pudieron cargar los accesos','Pulsa Actualizar para reintentar.');}
  }
  function passwordDialog(id,name){
    const d=modal('Cambiar contraseña',`<p class="dialog-description">Nueva contraseña para ${e(name)}.</p><form><label>Nueva contraseña<input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Repetir contraseña<input type="password" name="confirmation" autocomplete="new-password" minlength="12" maxlength="128" required></label><p class="dialog-description">Usa al menos 12 caracteres. La cuenta de mesa necesitará esta contraseña en su próximo ingreso.</p><p class="panel-form-message" role="status"></p><button type="submit" class="panel-primary">Guardar nueva contraseña</button></form>`);
    d.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form),message=d.querySelector('[role=status]');if(data.get('password')!==data.get('confirmation')){message.textContent='Las contraseñas no coinciden.';return;}const button=form.querySelector('[type=submit]');button.disabled=true;try{await invokeMesa({action:'password',user_id:id,password:data.get('password')});form.reset();d.close();say('Contraseña de mesa actualizada.');}catch(error){message.textContent=error.message;button.disabled=false;}});
  }
  return {async start(value){session=value;document.body.classList.add('admin-authenticated');$('panel-account').textContent=value.user.email;await refresh();const requested=new URLSearchParams(location.search).get('vista');navigate('tab-'+(TITLES[requested]?requested:'inicio'));},refresh};
}
