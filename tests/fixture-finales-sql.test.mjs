import { PGlite } from '../.local-work/tmp/knockout-sql-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const admin='00000000-0000-4000-8000-000000000001';
const tid='10000000-0000-4000-8000-000000000001';
const names=['JR STARS','ATLETICO JUNIOR','FC ESTUDIANTES','JV CAJAMARCA','U CAJAMARCA','SPORT REYES','ALAN VILLATY','SPORT JUNIOR','AAC RETOÑITOS','EFB BARCELONA','SAINTHORE'];
const teams=names.map((nombre,i)=>({id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,nombre}));

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  insert into auth.users values('${admin}');
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
  grant usage on schema auth to authenticated,anon;
  create table public.equipos(id uuid primary key,nombre text not null);
  insert into public.equipos values ${teams.map(t=>`('${t.id}','${t.nombre.replaceAll("'","''")}')`).join(',')};
  create table public.partidos(torneo_id uuid,categoria text);
  insert into public.partidos values ${['2013','2014','2015','2016','2017','2018','2019','2020'].map(c=>`('${tid}','${c}')`).join(',')};
  create table public.mesa_accesos(user_id uuid primary key,activo boolean not null default true);
  create table public.partidos_fixture(id bigint);
  grant select on public.partidos,public.equipos to authenticated,anon;
`);

await db.exec(await readFile('supabase/migrations/20260930000100_eliminatorias.sql','utf8'));
await db.exec(`insert into eliminatorias_admins values('${admin}')`);
await db.exec(await readFile('supabase/migrations/20261106000100_reparar_fixture_finales.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261107000100_reparar_aprobacion_eliminatorias.sql','utf8'));

const rows=(await db.query(`select * from eliminatorias_partidos order by categoria,fase`)).rows;
assert.equal(rows.length,16);
assert.ok(rows.every(r=>r.estado==='PROGRAMADO' && r.clasificacion_manual===true));
assert.equal((await db.query(`select count(*)::int n from eliminatorias_partidos where fase='F'`)).rows[0].n,8);
assert.equal((await db.query(`select count(*)::int n from eliminatorias_partidos where fase='TP'`)).rows[0].n,8);
assert.equal((await db.query(`select to_regclass('public.partidos_fixture') fixture`)).rows[0].fixture,null);

await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false)`);
const final=rows.find(r=>r.categoria==='2014' && r.fase==='F');
const payload={torneo_id:final.torneo_id,categoria:final.categoria,fase:final.fase,equipo_local_id:final.equipo_local_id,equipo_visitante_id:final.equipo_visitante_id,goles_local:null,goles_visitante:null,penales_local:null,penales_visitante:null,estado:'EN_VIVO',fecha_hora:final.fecha_hora,cancha:final.cancha};
const saved=(await db.query(`select to_jsonb(x) value from guardar_eliminatoria($1::jsonb,$2::timestamptz) x`,[JSON.stringify(payload),final.updated_at])).rows[0].value;
assert.equal(saved.estado,'EN_VIVO');
assert.equal(saved.clasificacion_manual,true);

const semifinal=(await db.query(`insert into eliminatorias_partidos(torneo_id,categoria,fase,equipo_local_id,equipo_visitante_id,goles_local,goles_visitante,estado)
  values($1,'2014','SF1',$2,$3,3,1,'EN_REVISION') returning *`,[tid,teams[0].id,teams[1].id])).rows[0];
const approved=(await db.query(`select to_jsonb(x) value from aprobar_eliminatoria_admin($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) x`,[
  semifinal.id,3,1,null,null,3,1,null,null,semifinal.equipo_local_id,semifinal.equipo_visitante_id
])).rows[0].value;
assert.equal(approved.estado,'OFICIAL');

await db.close();
console.log('SQL OK: cruces manuales editables y semifinal de Mesa aprobada sin conflicto de versión.');
