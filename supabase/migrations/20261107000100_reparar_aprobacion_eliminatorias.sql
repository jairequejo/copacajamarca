begin;

-- Las finales cargadas directamente por la organización no deben impedir que
-- una semifinal enviada por Mesa sea confirmada posteriormente.
create or replace function public.validar_eliminatoria() returns trigger
language plpgsql set search_path=public as $$
declare
  r public.eliminatorias_partidos;
  target_torneo uuid; target_cat text; target_fase text;
  advancing uuid[] := '{}'; chosen uuid; sf text; manual_classification boolean;
begin
  if TG_OP='DELETE' then r:=old; else r:=new; end if;
  target_torneo:=r.torneo_id; target_cat:=r.categoria; target_fase:=r.fase;
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
  if TG_OP='INSERT' and new.clasificacion_manual and auth.uid() is not null
    and not exists(select 1 from public.eliminatorias_admins where user_id=auth.uid()) then
    raise exception 'Solo administracion puede crear un cruce manual.' using errcode='42501';
  end if;
  if target_fase in ('SF1','SF2') and TG_OP in ('UPDATE','DELETE') then
    if TG_OP='DELETE' or (new.equipo_local_id,new.equipo_visitante_id,new.goles_local,new.goles_visitante,new.penales_local,new.penales_visitante,new.estado)
      is distinct from (old.equipo_local_id,old.equipo_visitante_id,old.goles_local,old.goles_visitante,old.penales_local,old.penales_visitante,old.estado) then
      if exists(
        select 1 from public.eliminatorias_partidos
        where torneo_id=target_torneo and categoria=target_cat
          and fase in ('F','TP') and not clasificacion_manual
      ) then
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
      if not found or r.estado <> 'OFICIAL' then raise exception 'Oficializa ambas semifinales primero.'; end if;
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

-- La aprobación se hace contra la identidad y el acta que vio el administrador,
-- no contra la representación textual de un timestamptz enviada por el navegador.
create or replace function public.aprobar_eliminatoria_admin(
  p_id uuid,
  p_goles_local integer,
  p_goles_visitante integer,
  p_penales_local integer default null,
  p_penales_visitante integer default null,
  p_original_goles_local integer default null,
  p_original_goles_visitante integer default null,
  p_original_penales_local integer default null,
  p_original_penales_visitante integer default null,
  p_equipo_local_id uuid default null,
  p_equipo_visitante_id uuid default null
) returns public.eliminatorias_partidos
language plpgsql security definer set search_path='' as $$
declare
  previous public.eliminatorias_partidos;
  saved public.eliminatorias_partidos;
begin
  if not exists(select 1 from public.eliminatorias_admins where user_id=auth.uid()) then
    raise exception 'Cuenta administradora no autorizada.' using errcode='42501';
  end if;
  select * into previous from public.eliminatorias_partidos where id=p_id for update;
  if not found or previous.estado<>'EN_REVISION' then
    raise exception 'El resultado ya no esta pendiente de aprobacion. Actualiza la lista.';
  end if;
  if (previous.equipo_local_id,previous.equipo_visitante_id) is distinct from
     (p_equipo_local_id,p_equipo_visitante_id)
     or previous.goles_local is distinct from p_original_goles_local
     or previous.goles_visitante is distinct from p_original_goles_visitante
     or previous.penales_local is distinct from p_original_penales_local
     or previous.penales_visitante is distinct from p_original_penales_visitante then
    raise exception 'El acta cambio. Actualiza la lista y revisa el resultado nuevamente.';
  end if;
  if p_goles_local not between 0 and 99 or p_goles_visitante not between 0 and 99 then
    raise exception 'Ingresa un marcador valido.';
  end if;
  if (p_penales_local is null)<>(p_penales_visitante is null)
    or (p_penales_local is not null and
      (p_goles_local<>p_goles_visitante or p_penales_local not between 0 and 99
       or p_penales_visitante not between 0 and 99 or p_penales_local=p_penales_visitante))
    or (p_goles_local=p_goles_visitante and p_penales_local is null) then
    raise exception 'Para oficializar debe existir un ganador por goles o penales.';
  end if;
  update public.eliminatorias_partidos set
    goles_local=p_goles_local,goles_visitante=p_goles_visitante,
    penales_local=p_penales_local,penales_visitante=p_penales_visitante,
    estado='OFICIAL',reclamo=null
  where id=p_id returning * into saved;
  return saved;
end $$;

revoke all on function public.aprobar_eliminatoria_admin(uuid,integer,integer,integer,integer,integer,integer,integer,integer,uuid,uuid) from public,anon;
grant execute on function public.aprobar_eliminatoria_admin(uuid,integer,integer,integer,integer,integer,integer,integer,integer,uuid,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
