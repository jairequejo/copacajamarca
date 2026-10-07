-- Separate knockout results; group matches and view_posiciones remain unchanged.
begin;
create table if not exists public.eliminatorias_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.eliminatorias_admins enable row level security;
revoke all on public.eliminatorias_admins from anon, authenticated;
grant select on public.eliminatorias_admins to authenticated;
create policy eliminatorias_admin_self on public.eliminatorias_admins
  for select to authenticated using (user_id = auth.uid());

create table public.eliminatorias_partidos (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null,
  categoria text not null check (length(categoria) between 1 and 40),
  fase text not null check (fase in ('SF1','SF2','F','TP')),
  equipo_local_id uuid not null references public.equipos(id),
  equipo_visitante_id uuid not null references public.equipos(id),
  goles_local integer check (goles_local between 0 and 99),
  goles_visitante integer check (goles_visitante between 0 and 99),
  penales_local integer check (penales_local between 0 and 99),
  penales_visitante integer check (penales_visitante between 0 and 99),
  estado text not null default 'PROGRAMADO' check (estado in ('PROGRAMADO','EN_VIVO','OFICIAL')),
  fecha_hora timestamptz,
  cancha text check (length(cancha) <= 100),
  updated_at timestamptz not null default clock_timestamp(),
  unique(torneo_id,categoria,fase),
  check (equipo_local_id <> equipo_visitante_id),
  check ((penales_local is null and penales_visitante is null) or
    (penales_local is not null and penales_visitante is not null and goles_local is not null and goles_local = goles_visitante)),
  check (estado <> 'OFICIAL' or (goles_local is not null and goles_visitante is not null and
    (goles_local <> goles_visitante or (penales_local is not null and penales_visitante is not null and penales_local <> penales_visitante))))
);
alter table public.eliminatorias_partidos enable row level security;
revoke all on public.eliminatorias_partidos from anon, authenticated;
grant select on public.eliminatorias_partidos to anon, authenticated;
grant insert, update, delete on public.eliminatorias_partidos to authenticated;
create policy eliminatorias_public_read on public.eliminatorias_partidos for select using (true);
create policy eliminatorias_admin_write on public.eliminatorias_partidos for all to authenticated
  using (exists(select 1 from public.eliminatorias_admins where user_id=auth.uid()))
  with check (exists(select 1 from public.eliminatorias_admins where user_id=auth.uid()));

create function public.validar_eliminatoria() returns trigger language plpgsql set search_path=public as $$
declare
  r public.eliminatorias_partidos;
  target_torneo uuid; target_cat text; target_fase text;
  advancing uuid[] := '{}'; chosen uuid; sf text;
begin
  if TG_OP='DELETE' then r:=old; else r:=new; end if;
  target_torneo:=r.torneo_id; target_cat:=r.categoria; target_fase:=r.fase;
  perform pg_advisory_xact_lock(hashtextextended(target_torneo::text || ':' || target_cat,0));
  if TG_OP='UPDATE' and (new.torneo_id,new.categoria,new.fase) is distinct from (old.torneo_id,old.categoria,old.fase) then
    raise exception 'No se puede cambiar la identidad de una eliminatoria.';
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
    raise exception 'Torneo o categoría desconocidos.';
  end if;
  if target_fase in ('F','TP') then
    foreach sf in array array['SF1','SF2'] loop
      select * into r from public.eliminatorias_partidos where torneo_id=target_torneo and categoria=target_cat and fase=sf;
      if not found or r.estado <> 'OFICIAL' then raise exception 'Oficializa ambas semifinales primero.'; end if;
      if r.goles_local>r.goles_visitante or (r.goles_local=r.goles_visitante and r.penales_local>r.penales_visitante) then
        chosen:=case when target_fase='F' then r.equipo_local_id else r.equipo_visitante_id end;
      else chosen:=case when target_fase='F' then r.equipo_visitante_id else r.equipo_local_id end; end if;
      advancing:=array_append(advancing,chosen);
    end loop;
    if new.equipo_local_id<>advancing[1] or new.equipo_visitante_id<>advancing[2] then raise exception 'Los equipos no corresponden a los resultados de semifinales.'; end if;
  end if;
  new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger validar_eliminatoria before insert or update or delete on public.eliminatorias_partidos
  for each row execute function public.validar_eliminatoria();

-- Optimistic concurrency prevents overwriting a score saved by a second admin.
create function public.guardar_eliminatoria(p jsonb, p_version timestamptz default null)
returns public.eliminatorias_partidos language plpgsql security invoker set search_path=public as $$
declare previous public.eliminatorias_partidos; saved public.eliminatorias_partidos;
begin
  perform pg_advisory_xact_lock(hashtextextended((p->>'torneo_id') || ':' || (p->>'categoria'),0));
  select * into previous from public.eliminatorias_partidos
    where torneo_id=(p->>'torneo_id')::uuid and categoria=p->>'categoria' and fase=p->>'fase' for update;
  if found and (p_version is null or previous.updated_at<>p_version) then raise exception 'Otro administrador actualizó este partido. Recarga antes de guardar.'; end if;
  if not found and p_version is not null then raise exception 'El partido cambió. Recarga antes de guardar.'; end if;
  insert into public.eliminatorias_partidos(torneo_id,categoria,fase,equipo_local_id,equipo_visitante_id,goles_local,goles_visitante,penales_local,penales_visitante,estado,fecha_hora,cancha)
  values((p->>'torneo_id')::uuid,p->>'categoria',p->>'fase',(p->>'equipo_local_id')::uuid,(p->>'equipo_visitante_id')::uuid,
    (p->>'goles_local')::int,(p->>'goles_visitante')::int,(p->>'penales_local')::int,(p->>'penales_visitante')::int,p->>'estado',(p->>'fecha_hora')::timestamptz,p->>'cancha')
  on conflict(torneo_id,categoria,fase) do update set
    equipo_local_id=excluded.equipo_local_id,equipo_visitante_id=excluded.equipo_visitante_id,
    goles_local=excluded.goles_local,goles_visitante=excluded.goles_visitante,penales_local=excluded.penales_local,penales_visitante=excluded.penales_visitante,
    estado=excluded.estado,fecha_hora=excluded.fecha_hora,cancha=excluded.cancha
  returning * into saved;
  return saved;
end $$;
revoke all on function public.guardar_eliminatoria(jsonb,timestamptz) from public, anon;
grant execute on function public.guardar_eliminatoria(jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
