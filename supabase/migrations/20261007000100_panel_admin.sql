-- Panel operativo: cuentas autorizadas, historial real y accesos de mesa.
-- No atribuye resultados antiguos ni cambia las contraseñas al instalarse.
begin;
create table if not exists public.panel_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true
);
alter table public.panel_admins enable row level security;
revoke all on public.panel_admins from anon,authenticated;
grant select on public.panel_admins to authenticated;
grant all on public.panel_admins to service_role;
drop policy if exists panel_admin_self on public.panel_admins;
create policy panel_admin_self on public.panel_admins for select to authenticated using(user_id=auth.uid());

create or replace function public.es_admin_panel() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.panel_admins where user_id=auth.uid() and activo);
$$;
revoke all on function public.es_admin_panel() from public,anon;
grant execute on function public.es_admin_panel() to authenticated,service_role;

create table if not exists public.mesa_accesos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check(length(nombre) between 1 and 100),
  activo boolean not null default true
);
alter table public.mesa_accesos enable row level security;
revoke all on public.mesa_accesos from anon,authenticated;
grant select on public.mesa_accesos to authenticated;
grant all on public.mesa_accesos to service_role;
drop policy if exists mesa_accesos_admin_read on public.mesa_accesos;
create policy mesa_accesos_admin_read on public.mesa_accesos for select to authenticated using(public.es_admin_panel());

create table if not exists public.partidos_aprobaciones (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid references public.partidos(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  aprobado_at timestamptz not null default clock_timestamp(),
  tipo text not null check(tipo in ('APROBACION','CORRECCION')),
  categoria text not null,grupo text,jornada integer,
  local_nombre text not null,visitante_nombre text not null,
  goles_local integer not null,goles_visitante integer not null,
  reclamo text,cancha text
);
create index if not exists partidos_aprobaciones_actor_fecha on public.partidos_aprobaciones(actor_id,aprobado_at desc,id desc);
alter table public.partidos_aprobaciones enable row level security;
revoke all on public.partidos_aprobaciones from anon,authenticated;
grant select on public.partidos_aprobaciones to authenticated;
grant all on public.partidos_aprobaciones to service_role;
drop policy if exists aprobaciones_propias on public.partidos_aprobaciones;
create policy aprobaciones_propias on public.partidos_aprobaciones for select to authenticated using(public.es_admin_panel() and actor_id=auth.uid());

create or replace function public.registrar_aprobacion_admin() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_official boolean:=false; actor uuid:=auth.uid(); kind text;
begin
  if new.estado <> 'OFICIAL' then return new; end if;
  if TG_OP='UPDATE' then
    previous_official:=old.estado='OFICIAL';
    if previous_official and (new.goles_local,new.goles_visitante,new.equipo_local_id,new.equipo_visitante_id)
      is not distinct from (old.goles_local,old.goles_visitante,old.equipo_local_id,old.equipo_visitante_id) then return new; end if;
  end if;
  if actor is not null and not public.es_admin_panel() then raise exception 'Tu cuenta no está autorizada para aprobar partidos.' using errcode='42501'; end if;
  if new.goles_local is null or new.goles_visitante is null or new.goles_local<0 or new.goles_visitante<0 then
    raise exception 'Un resultado oficial necesita un marcador válido.';
  end if;
  -- Descansos sin dos equipos no generan actas de partido en el historial.
  if new.equipo_local_id is null or new.equipo_visitante_id is null then return new; end if;
  kind:=case when previous_official then 'CORRECCION' else 'APROBACION' end;
  insert into public.partidos_aprobaciones(partido_id,actor_id,tipo,categoria,grupo,jornada,local_nombre,visitante_nombre,goles_local,goles_visitante,reclamo,cancha)
  values(new.id,actor,kind,new.categoria,new.grupo,new.jornada,
    coalesce((select nombre from public.equipos where id=new.equipo_local_id),'Equipo no disponible'),
    coalesce((select nombre from public.equipos where id=new.equipo_visitante_id),'Equipo no disponible'),
    new.goles_local,new.goles_visitante,new.reclamo,new.cancha);
  return new;
end $$;
drop trigger if exists registrar_aprobacion_admin on public.partidos;
create trigger registrar_aprobacion_admin after insert or update on public.partidos for each row execute function public.registrar_aprobacion_admin();

create or replace function public.aprobar_partido_admin(p_id uuid,p_local integer,p_visitante integer,p_original_local integer,p_original_visitante integer,p_reclamo text,p_local_id uuid,p_visitante_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m public.partidos;
begin
  if not public.es_admin_panel() then raise exception 'Cuenta no autorizada.' using errcode='42501'; end if;
  if p_local is null or p_visitante is null or p_local not between 0 and 99 or p_visitante not between 0 and 99 then raise exception 'Marcador inválido.'; end if;
  select * into m from public.partidos where id=p_id for update;
  if not found or m.estado<>'EN_REVISION' then raise exception 'El partido ya no está pendiente de revisión. Actualiza la lista.'; end if;
  if (m.goles_local,m.goles_visitante,m.reclamo,m.equipo_local_id,m.equipo_visitante_id)
    is distinct from (p_original_local,p_original_visitante,p_reclamo,p_local_id,p_visitante_id) then
    raise exception 'El acta cambió. Actualiza y revisa el resultado nuevamente.';
  end if;
  if m.equipo_local_id is null or m.equipo_visitante_id is null then raise exception 'Faltan equipos en el partido.'; end if;
  update public.partidos set estado='OFICIAL',goles_local=p_local,goles_visitante=p_visitante where id=p_id;
  return p_id;
end $$;
revoke all on function public.aprobar_partido_admin(uuid,integer,integer,integer,integer,text,uuid,uuid) from public,anon;
grant execute on function public.aprobar_partido_admin(uuid,integer,integer,integer,integer,text,uuid,uuid) to authenticated;

create table if not exists public.admin_accesos_historial (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  mesa_id uuid references auth.users(id) on delete set null,
  creado_at timestamptz not null default clock_timestamp(),
  estado text not null default 'PENDIENTE' check(estado in ('PENDIENTE','EXITO','ERROR'))
);
create index if not exists accesos_historial_mesa_fecha on public.admin_accesos_historial(mesa_id,creado_at desc);
alter table public.admin_accesos_historial enable row level security;
revoke all on public.admin_accesos_historial from anon,authenticated;
grant select on public.admin_accesos_historial to authenticated;
grant all on public.admin_accesos_historial to service_role;
drop policy if exists accesos_historial_admin on public.admin_accesos_historial;
create policy accesos_historial_admin on public.admin_accesos_historial for select to authenticated using(public.es_admin_panel() and actor_id=auth.uid());

create or replace function public.reservar_cambio_mesa(p_actor uuid,p_mesa uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not exists(select 1 from public.panel_admins where user_id=p_actor and activo) then raise exception 'Cuenta no autorizada.' using errcode='42501'; end if;
  if not exists(select 1 from public.mesa_accesos where user_id=p_mesa and activo)
    or exists(select 1 from public.panel_admins where user_id=p_mesa) then raise exception 'Acceso de mesa no autorizado.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_mesa::text,0));
  if exists(select 1 from public.admin_accesos_historial where mesa_id=p_mesa and creado_at>clock_timestamp()-interval '30 seconds') then
    raise exception 'Espera 30 segundos antes de volver a cambiar esta contraseña.';
  end if;
  insert into public.admin_accesos_historial(actor_id,mesa_id) values(p_actor,p_mesa) returning id into result;
  return result;
end $$;
revoke all on function public.reservar_cambio_mesa(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reservar_cambio_mesa(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
