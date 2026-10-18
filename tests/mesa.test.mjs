import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMesaMatches, mesaPayload, normalizeMesaMatch, saveMesaMatch } from '../mesa/mesa-data.js';

const match = (extra = {}) => ({ id:'same-id',estado:'EN_VIVO',goles_local:1,goles_visitante:1,
  penales_local:null,penales_visitante:null,reclamo:'Documento observado',updated_at:'2026-10-18T10:00:00Z',
  equipo_local_id:'a',equipo_visitante_id:'b',tipo_partido:'ELIMINATORIA',cancha:'C1',lugar:'Estadio',...extra });

test('A legacy missing claim column does not hide group games or the knockout list', async () => {
  const filters = [], ranges = [];
  const client = { from(table) {
    let fields;
    const q = { select(f) { fields=f; return q; }, or(f) { filters.push(f); return q; }, order() { return q; },
      range(start,end) {
        ranges.push([start,end]);
        if (table==='eliminatorias_partidos' && fields.includes(',reclamo')) return { error:{ code:'42703', message:'column eliminatorias_partidos.reclamo does not exist' } };
        const records = table==='partidos' ? Array.from({length:501},(_,i)=>match({id:'group-'+i})) : [match()];
        return { data:records.slice(start,end+1), error:null };
      } };
    return q;
  } };
  const result = await loadMesaMatches(client);
  assert.equal(result.matches.length,502);
  assert.match(result.warning, /actualización SQL/);
  assert.ok(ranges.some(([start])=>start===500));
  assert.ok(filters.every(f=>f.includes('estado.neq.OFICIAL')));
});

test('An unrelated knockout query failure still leaves groups editable', async () => {
  const client = { from(table) { const q={ select:()=>q,or:()=>q,order:()=>q,
    range:()=>table==='partidos' ? {data:[match()],error:null} : {error:new Error('Temporary API failure')} }; return q; } };
  const result=await loadMesaMatches(client);
  assert.equal(result.matches.length,1);
  assert.match(result.warning,/grupos siguen disponibles/);
});

test('Separate table IDs do not collide and venue normalization survives saving', async () => {
  const source=match({cancha:'El Golazo - Cancha 2',fase:'SF1'});
  const group=normalizeMesaMatch(source);
  const knockout=normalizeMesaMatch(source,true);
  assert.notEqual(group.key,knockout.key);
  assert.equal(knockout.cancha,'Cancha 2');
  const client={rpc:async(name,payload)=>{
    assert.equal(name,'guardar_eliminatoria_mesa');
    assert.equal(payload.p_version,source.updated_at);
    return {data:{...source,goles_local:2,goles_visitante:1,updated_at:'next-version'},error:null};
  }};
  await saveMesaMatch(client,knockout,{goles_local:2,goles_visitante:1});
  assert.equal(knockout.cancha,'Cancha 2');
  assert.equal(knockout.updated_at,'next-version');
  assert.equal(knockout.reclamo,'Documento observado');
});

test('Live penalties can be tied, but review requires a winner; invalid partial penalties and scores never save', () => {
  assert.equal(mesaPayload(match(), {penales_local:3,penales_visitante:3}).penales_local,3);
  assert.throws(()=>mesaPayload(match(),{estado:'EN_REVISION',penales_local:3,penales_visitante:3}),/ganador/);
  assert.throws(()=>mesaPayload(match(),{penales_local:3}),/ambos/);
  assert.throws(()=>mesaPayload(match(),{goles_local:2,penales_local:4,penales_visitante:3}),/empatados/);
  for (const value of ['',null,-1,100,2.5,NaN,true]) assert.throws(()=>mesaPayload(match(),{goles_local:value}),/entero/);
  assert.equal(mesaPayload(match(),{estado:'EN_REVISION',penales_local:4,penales_visitante:3}).estado,'EN_REVISION');
  assert.throws(()=>mesaPayload(match({estado:'OFICIAL'}),{estado:'EN_VIVO'}),/administración/);
});

test('Group updates check the original score, claim, teams and state; invisible or rejected writes do not succeed', async () => {
  const conditions = [];
  let response={data:null,error:{code:'PGRST116',message:'No rows'}};
  const client={from(table){ assert.equal(table,'partidos'); const q={
    update(p){assert.equal(p.estado,'EN_VIVO'); assert.equal(p.goles_local,2);return q;},
    eq(k,v){conditions.push([k,v]);return q;},is(k,v){conditions.push([k,v]);return q;},select:()=>q,single:async()=>response,
  };return q;}};
  const group=match({tipo_partido:'REGULAR'});
  await assert.rejects(saveMesaMatch(client,group,{goles_local:2}),error=>error.code==='PGRST116');
  assert.equal(group.goles_local,1);
  assert.ok(conditions.some(([k,v])=>k==='estado'&&v==='EN_VIVO'));
  assert.ok(conditions.some(([k,v])=>k==='reclamo'&&v==='Documento observado'));
  assert.ok(conditions.some(([k,v])=>k==='equipo_local_id'&&v==='a'));
  response={data:null,error:null};
  await assert.rejects(saveMesaMatch(client,group,{goles_local:2}),/No se guardó/);
  response={data:{id:group.id,estado:'EN_VIVO',goles_local:2,goles_visitante:1,reclamo:'Documento observado'},error:null};
  await saveMesaMatch(client,group,{goles_local:2});
  assert.equal(group.goles_local,2);
});
