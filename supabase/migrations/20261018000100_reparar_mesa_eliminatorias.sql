-- Reparación incremental para instalaciones que ya tienen eliminatorias.
-- No modifica marcadores, cruces, cuentas ni políticas de partidos de grupos.
begin;

alter table public.eliminatorias_partidos
  add column if not exists reclamo text check (length(reclamo) <= 1000);
alter table public.eliminatorias_partidos
  drop constraint if exists eliminatorias_partidos_estado_check;
alter table public.eliminatorias_partidos
  add constraint eliminatorias_partidos_estado_check
  check (estado in ('PROGRAMADO','EN_VIVO','EN_REVISION','OFICIAL'));

create table if not exists public.mesa_accesos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 100),
  activo boolean not null default true
);
alter table public.mesa_accesos enable row level security;
revoke all on public.mesa_accesos from anon;
grant select on public.mesa_accesos to authenticated;
drop policy if exists mesa_acceso_propio on public.mesa_accesos;
create policy mesa_acceso_propio on public.mesa_accesos for select
  to authenticated using (user_id = auth.uid());

-- Solo las cuentas que registres explícitamente en mesa_accesos pueden guardar.
-- La autorización por correo se encuentra en MESA.md, separada de esta reparación.
create or replace function public.es_mesa_control() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.mesa_accesos
    where user_id=auth.uid() and activo);
$$;
revoke all on function public.es_mesa_control() from public,anon;
grant execute on function public.es_mesa_control() to authenticated;

create or replace function public.guardar_eliminatoria_mesa(
  p_id uuid,p_version timestamptz,p_estado text,
  p_goles_local integer,p_goles_visitante integer,
  p_penales_local integer default null,p_penales_visitante integer default null,
  p_reclamo text default null
) returns public.eliminatorias_partidos
language plpgsql security definer set search_path='' as $$
declare previous public.eliminatorias_partidos; saved public.eliminatorias_partidos;
begin
  if not public.es_mesa_control() then
    raise exception 'Cuenta de mesa no autorizada.' using errcode='42501';
  end if;
  if p_estado is null or p_estado not in ('PROGRAMADO','EN_VIVO','EN_REVISION') then
    raise exception 'Mesa no puede oficializar eliminatorias.' using errcode='42501';
  end if;
  select * into previous from public.eliminatorias_partidos where id=p_id;
  if not found then raise exception 'El partido eliminatorio no existe.'; end if;
  -- Mismo orden de bloqueos que guardar_eliminatoria y validar_eliminatoria.
  perform pg_advisory_xact_lock(hashtextextended(previous.torneo_id::text || ':' || previous.categoria,0));
  select * into previous from public.eliminatorias_partidos where id=p_id for update;
  if not found then raise exception 'El partido eliminatorio no existe.'; end if;
  if p_version is null or previous.updated_at is distinct from p_version then
    raise exception 'El marcador cambió. Actualiza antes de continuar.';
  end if;
  if previous.estado='OFICIAL' then
    raise exception 'El resultado oficial solo puede corregirse desde administración.' using errcode='42501';
  end if;
  if (previous.estado,p_estado) not in (
    ('PROGRAMADO','PROGRAMADO'),('PROGRAMADO','EN_VIVO'),
    ('EN_VIVO','PROGRAMADO'),('EN_VIVO','EN_VIVO'),('EN_VIVO','EN_REVISION'),
    ('EN_REVISION','EN_VIVO')
  ) then raise exception 'Cambio de estado no permitido para mesa.'; end if;
  if p_estado='PROGRAMADO' then
    p_goles_local:=null; p_goles_visitante:=null;
    p_penales_local:=null; p_penales_visitante:=null; p_reclamo:=null;
  elsif p_goles_local is null or p_goles_visitante is null
    or p_goles_local not between 0 and 99 or p_goles_visitante not between 0 and 99 then
    raise exception 'Ingresa goles enteros entre 0 y 99.';
  end if;
  if (p_penales_local is null)<>(p_penales_visitante is null)
    or (p_penales_local is not null and (p_goles_local<>p_goles_visitante
      or p_penales_local not between 0 and 99 or p_penales_visitante not between 0 and 99)) then
    raise exception 'Completa ambos penales y úsalos solo cuando el marcador esté empatado.';
  end if;
  if p_estado='EN_REVISION' and p_goles_local=p_goles_visitante
    and (p_penales_local is null or p_penales_local=p_penales_visitante) then
    raise exception 'Para enviar a revisión debe existir un ganador por goles o penales.';
  end if;
  if length(p_reclamo)>1000 then raise exception 'El reclamo admite hasta 1000 caracteres.'; end if;
  update public.eliminatorias_partidos
    set estado=p_estado,goles_local=p_goles_local,goles_visitante=p_goles_visitante,
      penales_local=p_penales_local,penales_visitante=p_penales_visitante,
      reclamo=nullif(btrim(p_reclamo),''),updated_at=clock_timestamp()
    where id=p_id returning * into saved;
  return saved;
end $$;
revoke all on function public.guardar_eliminatoria_mesa(uuid,timestamptz,text,integer,integer,integer,integer,text) from public,anon;
grant execute on function public.guardar_eliminatoria_mesa(uuid,timestamptz,text,integer,integer,integer,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
