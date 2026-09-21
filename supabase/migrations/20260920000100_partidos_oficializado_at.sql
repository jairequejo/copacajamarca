-- Registra la transición real a OFICIAL sin modificar fechas o marcadores.
-- Los partidos que ya eran oficiales mantienen NULL: no se conoce su hora real.
begin;
alter table public.partidos
  add column if not exists oficializado_at timestamptz;

create or replace function public.registrar_oficializacion_partido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if upper(new.estado) = 'OFICIAL' then
    if TG_OP = 'INSERT' then
      new.oficializado_at := now();
    elsif upper(old.estado) is distinct from 'OFICIAL' then
      new.oficializado_at := now();
    else
      new.oficializado_at := old.oficializado_at;
    end if;
  else
    new.oficializado_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists registrar_oficializacion_partido on public.partidos;
create trigger registrar_oficializacion_partido
before insert or update on public.partidos
for each row execute function public.registrar_oficializacion_partido();
comment on column public.partidos.oficializado_at is
  'Hora del servidor al pasar a OFICIAL; NULL en resultados históricos sin fecha verificable.';
notify pgrst, 'reload schema';
commit;
