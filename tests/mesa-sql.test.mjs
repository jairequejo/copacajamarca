import { PGlite } from '../.local-work/tmp/knockout-sql-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const [admin, mesa, outsider, inactive] = [1,2,3,4].map(n => `00000000-0000-4000-8000-00000000000${n}`);
const tid = '10000000-0000-4000-8000-000000000001';
const [local, visitante] = [1,2].map(n => `20000000-0000-4000-8000-00000000000${n}`);
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values('${admin}'),('${mesa}'),('${outsider}'),('${inactive}');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
create table equipos(id uuid primary key);insert into equipos values('${local}'),('${visitante}');
create table partidos(torneo_id uuid,categoria text);insert into partidos values('${tid}','2014');
grant select on equipos,partidos to authenticated,anon;`);
const base = await readFile('supabase/migrations/20260930000100_eliminatorias.sql','utf8');
// Reproduce the published database: no claim column, review state or Mesa RPC.
await db.exec(base.slice(0, base.indexOf('-- Mesa may update'))
  .replace("'PROGRAMADO','EN_VIVO','EN_REVISION','OFICIAL'", "'PROGRAMADO','EN_VIVO','OFICIAL'")
  .replace('  reclamo text check (length(reclamo) <= 1000),\n','') + '\ncommit;');
await db.exec(`insert into eliminatorias_admins values('${admin}');`);
const match = (await db.query(`insert into eliminatorias_partidos(torneo_id,categoria,fase,equipo_local_id,equipo_visitante_id)
values('${tid}','2014','SF1','${local}','${visitante}') returning *`)).rows[0];
const migration = await readFile('supabase/migrations/20261018000100_reparar_mesa_eliminatorias.sql','utf8');
await db.exec(migration);
await db.exec(migration);
assert.equal((await db.query('select estado from eliminatorias_partidos')).rows[0].estado, 'PROGRAMADO');
assert.equal((await db.query('select count(*)::int as n from mesa_accesos')).rows[0].n, 0);
await db.exec(`insert into mesa_accesos values('${mesa}','Mesa principal',true),('${inactive}','Mesa inactiva',false);
set role authenticated;select set_config('request.jwt.claim.sub','${outsider}',false);`);
const save = async (version,state,a,b,pa=null,pb=null,claim=null) => (await db.query(
  'select to_jsonb(m) as result from guardar_eliminatoria_mesa($1,$2,$3,$4,$5,$6,$7,$8) m',
  [match.id, version, state, a, b, pa, pb, claim],
)).rows[0].result;
await assert.rejects(save(match.updated_at,'EN_VIVO',0,0), /no autorizada/);
await db.exec(`select set_config('request.jwt.claim.sub','${inactive}',false)`);
await assert.rejects(save(match.updated_at,'EN_VIVO',0,0), /no autorizada/);
await db.exec(`select set_config('request.jwt.claim.sub','${mesa}',false)`);
assert.equal((await db.query('select es_mesa_control() as ok')).rows[0].ok, true);
assert.equal((await db.query('select * from mesa_accesos')).rows.length, 1);
await assert.rejects(db.exec(`insert into mesa_accesos values('${outsider}','Intruso',true)`), /permission denied/);
let live = await save(match.updated_at,'EN_VIVO',0,0);
await assert.rejects(save(match.updated_at,'EN_VIVO',1,0), /marcador cambió/);
await assert.rejects(save(live.updated_at,'OFICIAL',1,0), /no puede oficializar/);
await assert.rejects(save(live.updated_at,'EN_REVISION',0,0), /ganador/);
await assert.rejects(save(live.updated_at,'EN_VIVO',0,0,3,null), /ambos penales/);
await assert.rejects(save(live.updated_at,'EN_VIVO',2,1,3,2), /ambos penales/);
live = await save(live.updated_at,'EN_VIVO',1,1,3,3,' Acta por revisar ');
assert.equal(live.reclamo, 'Acta por revisar');
await assert.rejects(save(live.updated_at,'EN_REVISION',1,1,3,3), /ganador/);
let review = await save(live.updated_at,'EN_REVISION',1,1,4,3,'Documento observado');
assert.equal(review.estado, 'EN_REVISION');
assert.equal(review.penales_local, 4);
const reopened = await save(review.updated_at,'EN_VIVO',1,1,4,3,'Documento observado');
assert.equal(reopened.reclamo, 'Documento observado');
const reset = await save(reopened.updated_at,'PROGRAMADO',1,1,4,3,'Documento observado');
assert.equal(reset.goles_local, null);
assert.equal(reset.penales_local, null);
assert.equal(reset.reclamo, null);
await db.exec(`reset role;update eliminatorias_partidos set estado='OFICIAL',goles_local=2,goles_visitante=1 where id='${match.id}';
set role authenticated;select set_config('request.jwt.claim.sub','${mesa}',false);`);
const official = (await db.query('select * from eliminatorias_partidos')).rows[0];
await assert.rejects(save(official.updated_at,'EN_VIVO',2,1), /solo puede corregirse/);
await db.exec('reset role;set role anon');
await assert.rejects(save(official.updated_at,'EN_VIVO',2,1), /permission denied/);
assert.equal((await db.query('select * from partidos')).rows.length, 1);
await db.close();
console.log('SQL Mesa OK: legacy upgrade twice, access isolation, concurrent edits, live penalties, review/reopen and official lock.');
