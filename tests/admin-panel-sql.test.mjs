import { PGlite } from "../.local-work/tmp/knockout-sql-test/node_modules/@electric-sql/pglite/dist/index.js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const ids = Array.from(
    { length: 7 },
    (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`,
  ),
  [admin, second, mesa, outsider, local, visitor, match] = ids;
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ${ids
    .slice(0, 4)
    .map((id) => `('${id}')`)
    .join(
      ",",
    )};create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;create table public.equipos(id uuid primary key,nombre text);insert into public.equipos values('${local}','Equipo local'),('${visitor}','Equipo visitante');create table public.partidos(id uuid primary key,categoria text,grupo text,jornada integer,estado text,goles_local integer,goles_visitante integer,reclamo text,cancha text,equipo_local_id uuid,equipo_visitante_id uuid);insert into public.partidos values('${match}','2014','A',2,'EN_REVISION',1,0,'Documento por revisar','C1','${local}','${visitor}');grant select,update on partidos to authenticated;grant select on equipos to authenticated;alter table partidos enable row level security;create policy fake_existing_access on partidos to authenticated using(true) with check(true);`,
);
const sql = await readFile(
  "supabase/migrations/20261007000100_panel_admin.sql",
  "utf8",
);
await db.exec(sql);
await db.exec(sql);
assert.equal(
  (await db.query("select count(*)::int as n from partidos_aprobaciones"))
    .rows[0].n,
  0,
);
await db.exec(
  `insert into panel_admins values('${admin}',true),('${second}',true);insert into mesa_accesos values('${mesa}','Mesa principal',true);set role authenticated;select set_config('request.jwt.claim.sub','${mesa}',false);`,
);
assert.equal(
  (await db.query("select es_admin_panel() as ok")).rows[0].ok,
  false,
);
const approve = (a = 1, b = 0, claim = "Documento por revisar") =>
  db.query("select aprobar_partido_admin($1,$2,$3,$4,$5,$6,$7,$8)", [
    match,
    a,
    b,
    1,
    0,
    claim,
    local,
    visitor,
  ]);
await assert.rejects(approve(), /Cuenta no autorizada/);
await assert.rejects(
  db.exec(`update partidos set estado='OFICIAL' where id='${match}'`),
  /no está autorizada/,
);
await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false)`);
await assert.rejects(approve(2, 0, "Reclamo desactualizado"), /acta cambió/);
await assert.rejects(approve(-1, 0), /Marcador inválido/);
await approve(2, 1);
const log = (await db.query("select * from partidos_aprobaciones")).rows;
assert.equal(log.length, 1);
assert.equal(log[0].actor_id, admin);
assert.equal(log[0].reclamo, "Documento por revisar");
assert.equal(log[0].goles_local, 2);
await assert.rejects(approve(), /ya no está pendiente/);
await assert.rejects(
  db.exec("delete from partidos_aprobaciones"),
  /permission denied/,
);
await db.exec(`update partidos set cancha='C2'`);
assert.equal(
  (await db.query("select count(*)::int as n from partidos_aprobaciones"))
    .rows[0].n,
  1,
);
await db.exec(`update partidos set goles_local=3`);
assert.equal(
  (
    await db.query(
      "select tipo from partidos_aprobaciones where tipo='CORRECCION'",
    )
  ).rows.length,
  1,
);
await db.exec(`select set_config('request.jwt.claim.sub','${second}',false)`);
assert.equal(
  (await db.query("select * from partidos_aprobaciones")).rows.length,
  0,
);
await assert.rejects(
  db.query("select reservar_cambio_mesa($1,$2)", [second, mesa]),
  /permission denied/,
);
await db.exec("reset role;set role service_role;");
await assert.rejects(
  db.query("select reservar_cambio_mesa($1,$2)", [outsider, mesa]),
  /Cuenta no autorizada/,
);
await assert.rejects(
  db.query("select reservar_cambio_mesa($1,$2)", [admin, second]),
  /Acceso de mesa no autorizado/,
);
await db.query("select reservar_cambio_mesa($1,$2)", [admin, mesa]);
await assert.rejects(
  db.query("select reservar_cambio_mesa($1,$2)", [admin, mesa]),
  /Espera 30 segundos/,
);
await db.exec(
  "reset role;select set_config('request.jwt.claim.sub','',false);",
);
const tid = "10000000-0000-4000-8000-000000000001",
  t3 = "20000000-0000-4000-8000-000000000003",
  t4 = "20000000-0000-4000-8000-000000000004";
await db.exec(
  `alter table partidos add column torneo_id uuid default '${tid}';insert into equipos values('${t3}','Tercer equipo'),('${t4}','Cuarto equipo');`,
);
await db.exec(
  await readFile(
    "supabase/migrations/20260930000100_eliminatorias.sql",
    "utf8",
  ),
);
await db.exec(sql);
await db.exec(sql);
await db.exec(
  `insert into eliminatorias_admins values('${admin}') on conflict do nothing;set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);`,
);
const saveKO = (fase, a, b, goals, pens = [null, null]) =>
  db.query("select guardar_eliminatoria($1::jsonb,null)", [
    JSON.stringify({
      torneo_id: tid,
      categoria: "2014",
      fase,
      equipo_local_id: a,
      equipo_visitante_id: b,
      goles_local: goals[0],
      goles_visitante: goals[1],
      penales_local: pens[0],
      penales_visitante: pens[1],
      estado: "OFICIAL",
    }),
  ]);
await saveKO("SF1", local, visitor, [2, 0]);
await saveKO("SF2", t3, t4, [1, 1], [4, 3]);
await saveKO("F", local, t3, [0, 0], [5, 3]);
const koLogs = (
  await db.query(
    "select * from partidos_aprobaciones where fase is not null order by fase",
  )
).rows;
assert.equal(koLogs.length, 3);
assert.ok(
  koLogs.every(
    (r) => r.actor_id === admin && r.partido_id === null && r.eliminatoria_id,
  ),
);
assert.equal(koLogs[0].fase, "F");
assert.equal(koLogs[0].penales_local, 5);
await db.exec(
  "update eliminatorias_partidos set penales_local=6 where fase='F'",
);
assert.equal(
  (
    await db.query(
      "select * from partidos_aprobaciones where fase='F' and tipo='CORRECCION'",
    )
  ).rows.length,
  1,
);
await db.exec(
  "reset role;grant select,update on partidos to anon;create policy fake_anon_access on partidos to anon using(true) with check(true);set role anon;select set_config('request.jwt.claim.sub','',false);",
);
await assert.rejects(
  db.exec("select * from partidos_aprobaciones"),
  /permission denied/,
);
await assert.rejects(
  db.exec("update partidos set goles_local=4"),
  /Inicia sesión/,
);
await db.close();
console.log(
  "SQL OK: autorización, actas concurrentes, historial propio inmutable, correcciones y reserva de accesos sin contraseñas.",
);
