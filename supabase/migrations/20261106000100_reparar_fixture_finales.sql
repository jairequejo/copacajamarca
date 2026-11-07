-- Repara el fixture del 7 de noviembre que se cargo por error en
-- public.partidos_fixture. La aplicacion solo consume eliminatorias_partidos.
-- Los encuentros se importan como PROGRAMADO: nunca se inventan resultados ni
-- se marcan como oficiales sin pasar por Mesa y el panel administrador.
begin;

alter table public.eliminatorias_partidos
  add column if not exists clasificacion_manual boolean not null default false;

comment on column public.eliminatorias_partidos.clasificacion_manual is
  'Permite programar una final o tercer puesto ya definido fuera del cuadro de semifinales; solo administracion puede crear estos registros.';

-- Conserva la validacion normal del cuadro, pero permite los cruces que el
-- organizador ya entrego directamente como final y tercer puesto.
create or replace function public.validar_eliminatoria() returns trigger
language plpgsql set search_path=public as $$
declare
  r public.eliminatorias_partidos;
  target_torneo uuid; target_cat text; target_fase text;
  advancing uuid[] := '{}'; chosen uuid; sf text; manual_classification boolean;
begin
  if TG_OP='DELETE' then r:=old; else r:=new; end if;
  target_torneo:=r.torneo_id; target_cat:=r.categoria; target_fase:=r.fase;
  -- Los BEFORE INSERT tambien se ejecutan antes de resolver ON CONFLICT. Si el
  -- registro existente es manual, conservar ese origen durante su actualizacion.
  manual_classification:=coalesce(r.clasificacion_manual,false) or exists(
    select 1 from public.eliminatorias_partidos x
    where x.torneo_id=target_torneo and x.categoria=target_cat
      and x.fase=target_fase and x.clasificacion_manual
  );
  perform pg_advisory_xact_lock(hashtextextended(target_torneo::text || ':' || target_cat,0));
  if TG_OP='UPDATE' and (new.torneo_id,new.categoria,new.fase)
    is distinct from (old.torneo_id,old.categoria,old.fase) then
    raise exception 'No se puede cambiar la identidad de una eliminatoria.';
  end if;
  if TG_OP='UPDATE' and new.clasificacion_manual is distinct from old.clasificacion_manual
    and not exists(select 1 from public.eliminatorias_admins where user_id=auth.uid()) then
    raise exception 'Solo administracion puede cambiar el origen del cruce.' using errcode='42501';
  end if;
  if TG_OP='INSERT' and new.clasificacion_manual
    and auth.uid() is not null
    and not exists(select 1 from public.eliminatorias_admins where user_id=auth.uid()) then
    raise exception 'Solo administracion puede crear un cruce manual.' using errcode='42501';
  end if;
  if target_fase in ('SF1','SF2') and TG_OP in ('UPDATE','DELETE') then
    if TG_OP='DELETE' or (new.equipo_local_id,new.equipo_visitante_id,new.goles_local,new.goles_visitante,new.penales_local,new.penales_visitante,new.estado)
      is distinct from (old.equipo_local_id,old.equipo_visitante_id,old.goles_local,old.goles_visitante,old.penales_local,old.penales_visitante,old.estado) then
      if exists(select 1 from public.eliminatorias_partidos where torneo_id=target_torneo and categoria=target_cat and fase in ('F','TP')) then
        raise exception 'Primero retira la final y el tercer puesto antes de corregir una semifinal.';
      end if;
    end if;
  end if;
  if TG_OP='DELETE' then return old; end if;
  if not exists(select 1 from public.partidos where torneo_id=target_torneo and categoria=target_cat) then
    raise exception 'Torneo o categoria desconocidos.';
  end if;
  if target_fase in ('F','TP') and not manual_classification then
    foreach sf in array array['SF1','SF2'] loop
      select * into r from public.eliminatorias_partidos
      where torneo_id=target_torneo and categoria=target_cat and fase=sf;
      if not found or r.estado <> 'OFICIAL' then
        raise exception 'Oficializa ambas semifinales primero.';
      end if;
      if r.goles_local>r.goles_visitante or
        (r.goles_local=r.goles_visitante and r.penales_local>r.penales_visitante) then
        chosen:=case when target_fase='F' then r.equipo_local_id else r.equipo_visitante_id end;
      else
        chosen:=case when target_fase='F' then r.equipo_visitante_id else r.equipo_local_id end;
      end if;
      advancing:=array_append(advancing,chosen);
    end loop;
    if new.equipo_local_id<>advancing[1] or new.equipo_visitante_id<>advancing[2] then
      raise exception 'Los equipos no corresponden a los resultados de semifinales.';
    end if;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;

create temporary table fixture_finales_reparacion (
  hora time not null,
  cancha text,
  equipo_local text not null,
  equipo_visitante text not null,
  categoria text not null,
  fase text not null
) on commit drop;

insert into fixture_finales_reparacion
  (hora,cancha,equipo_local,equipo_visitante,categoria,fase)
values
  ('08:00',null,'JR STARS','ATLETICO JUNIOR','2014','TP'),
  ('08:45',null,'JR STARS','FC ESTUDIANTES','2013','TP'),
  ('09:30',null,'JV CAJAMARCA','U CAJAMARCA','2013','F'),
  ('10:15',null,'FC ESTUDIANTES','U CAJAMARCA','2014','F'),
  ('11:20','Cancha 1','JV CAJAMARCA','U CAJAMARCA','2016','TP'),
  ('12:00','Cancha 1','SPORT REYES','JR STARS','2016','F'),
  ('12:40','Cancha 1','ALAN VILLATY','SPORT JUNIOR','2015','TP'),
  ('13:20','Cancha 1','FC ESTUDIANTES','ATLETICO JUNIOR','2015','F'),
  ('11:20','Cancha 2','AAC RETOÑITOS','EFB BARCELONA','2018','TP'),
  ('12:00','Cancha 2','SAINTHORE','JV CAJAMARCA','2018','F'),
  ('12:40','Cancha 2','FC ESTUDIANTES','JR STARS','2017','TP'),
  ('13:20','Cancha 2','SPORT REYES','ATLETICO JUNIOR','2017','F'),
  ('11:20','Cancha 3','AAC RETOÑITOS','U CAJAMARCA','2020','TP'),
  ('12:00','Cancha 3','SAINTHORE','ATLETICO JUNIOR','2020','F'),
  ('12:40','Cancha 3','ATLETICO JUNIOR','AAC RETOÑITOS','2019','TP'),
  ('13:20','Cancha 3','JV CAJAMARCA','SAINTHORE','2019','F');

do $$
declare missing text;
begin
  select string_agg(x.nombre,', ' order by x.nombre) into missing
  from (
    select equipo_local nombre from fixture_finales_reparacion
    union
    select equipo_visitante from fixture_finales_reparacion
  ) x
  where not exists(select 1 from public.equipos e where upper(btrim(e.nombre))=x.nombre);
  if missing is not null then
    raise exception 'No se importo el fixture. Faltan equipos: %',missing;
  end if;
  if exists(
    select 1 from fixture_finales_reparacion f
    where not exists(
      select 1 from public.partidos p
      where p.categoria=f.categoria and p.torneo_id is not null
    )
  ) then
    raise exception 'No se importo el fixture: una categoria no tiene torneo activo.';
  end if;
end $$;

insert into public.eliminatorias_partidos(
  torneo_id,categoria,fase,equipo_local_id,equipo_visitante_id,
  estado,fecha_hora,cancha,clasificacion_manual
)
select
  (select p.torneo_id from public.partidos p
    where p.categoria=f.categoria and p.torneo_id is not null
    group by p.torneo_id order by count(*) desc limit 1),
  f.categoria,f.fase,el.id,ev.id,'PROGRAMADO',
  ('2026-11-07 ' || f.hora::text || '-05')::timestamptz,
  f.cancha,true
from fixture_finales_reparacion f
join public.equipos el on upper(btrim(el.nombre))=f.equipo_local
join public.equipos ev on upper(btrim(ev.nombre))=f.equipo_visitante
on conflict(torneo_id,categoria,fase) do nothing;

do $$
begin
  if (select count(*) from public.eliminatorias_partidos
      where fecha_hora >= '2026-11-07 00:00-05'::timestamptz
        and fecha_hora < '2026-11-08 00:00-05'::timestamptz
        and clasificacion_manual) <> 16 then
    raise exception 'La reparacion no produjo los 16 partidos esperados; se revirtio todo.';
  end if;
end $$;

-- La tabla accidental nunca fue consumida por la aplicacion. Se elimina solo
-- despues de validar que los 16 partidos quedaron en la tabla correcta.
drop table if exists public.partidos_fixture;

notify pgrst,'reload schema';
commit;
