const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class Failure extends Error {constructor(message,status=503){super(message);this.status=status;}}
export function createMesaHandler({url,key,fetcher=fetch,origins=['https://copacajamarca.com','https://www.copacajamarca.com','http://localhost:8090','http://127.0.0.1:8090']}) {
  async function api(path,{method='GET',body,token=key}={}) {
    const response=await fetcher(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json().catch(()=>null);
    if(!response.ok){
      if(response.status===401||response.status===403)throw new Failure('Sesión o permisos no válidos.',403);
      if(value?.code==='PGRST205'||value?.code==='42P01'||value?.code==='PGRST202')throw new Failure('Falta activar la gestión de accesos del panel.',503);
      if(path.includes('/rpc/reservar_cambio_mesa'))throw new Failure('No se autorizó el cambio. Comprueba el acceso o espera 30 segundos antes de reintentar.',429);
      throw new Failure('No se pudo completar la operación. Intenta nuevamente.',502);
    }
    return value;
  }
  return async request=>{
    const origin=request.headers.get('origin'),allowed=!origin||origins.includes(origin);
    const cors={'Access-Control-Allow-Origin':allowed?(origin||origins[0]):origins[0],'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
    if(!allowed)return reply({error:'Origen no autorizado.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='POST')return reply({error:'Método no permitido.'},405);
    if(!url||!key)return reply({error:'La gestión de accesos no está configurada.'},503);
    const authorization=request.headers.get('authorization');
    if(!authorization?.startsWith('Bearer '))return reply({error:'Inicia sesión como administrador.'},401);
    let attempt;
    try {
      if(Number(request.headers.get('content-length'))>4096)throw new Failure('Solicitud demasiado grande.',413);
      const raw=await request.text();if(raw.length>4096)throw new Failure('Solicitud demasiado grande.',413);
      let input;try{input=JSON.parse(raw);}catch{throw new Failure('Solicitud inválida.',400);}
      if(!input||!['list','password'].includes(input.action))throw new Failure('Operación no válida.',400);
      const userData=await api('/auth/v1/user',{token:authorization.slice(7)}),user=userData?.user||userData;
      if(!UUID.test(user?.id||''))throw new Failure('Sesión no válida.',401);
      const membership=await api('/rest/v1/panel_admins?select=user_id&activo=eq.true&user_id=eq.'+user.id);
      if(!membership?.length)throw new Failure('Tu cuenta no está autorizada para administrar accesos.',403);
      const mesas=await api('/rest/v1/mesa_accesos?select=user_id,nombre&activo=eq.true&order=nombre');
      const admins=await api('/rest/v1/panel_admins?select=user_id');
      const eligible=mesas.filter(m=>UUID.test(m.user_id)&&!admins.some(a=>a.user_id===m.user_id));
      if(input.action==='list') {
        const users=[];
        for(const m of eligible){const record=await api('/auth/v1/admin/users/'+m.user_id),u=record?.user||record;users.push({id:m.user_id,nombre:m.nombre,email:u.email,last_sign_in_at:u.last_sign_in_at||null});}
        return reply({users});
      }
      if(!UUID.test(input.user_id||'')||!eligible.some(m=>m.user_id===input.user_id))throw new Failure('Cuenta de mesa no autorizada.',403);
      if(typeof input.password!=='string'||input.password.length<12||input.password.length>128||!input.password.trim())throw new Failure('La contraseña debe tener entre 12 y 128 caracteres.',400);
      attempt=await api('/rest/v1/rpc/reservar_cambio_mesa',{method:'POST',body:{p_actor:user.id,p_mesa:input.user_id}});
      if(!UUID.test(attempt||''))throw new Failure('No se pudo registrar el cambio de acceso.',503);
      await api('/auth/v1/admin/users/'+input.user_id,{method:'PUT',body:{password:input.password}});
      await api('/rest/v1/admin_accesos_historial?id=eq.'+attempt,{method:'PATCH',body:{estado:'EXITO'}}).catch(()=>null);
      return reply({ok:true});
    }catch(error){
      if(attempt&&UUID.test(attempt))await api('/rest/v1/admin_accesos_historial?id=eq.'+attempt,{method:'PATCH',body:{estado:'ERROR'}}).catch(()=>null);
      return reply({error:error instanceof Failure?error.message:'No se pudo completar la operación. Intenta nuevamente.'},error instanceof Failure?error.status:503);
    }
  };
}
