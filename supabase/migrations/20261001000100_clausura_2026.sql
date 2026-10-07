-- Ejecutar completo en Supabase > SQL Editor.
-- Alcance solicitado: TODOS los registros actuales de public.partidos,
-- incluidos los que todavía no tienen torneo_id.
-- Solo asigna etapa/temporada; no modifica resultados, fechas, grupos ni equipos.
begin;

alter table public.partidos
  add column if not exists etapa text,
  add column if not exists temporada integer;

update public.partidos
set etapa = 'Clausura', temporada = 2026;

-- Los partidos nuevos creados desde el admin también pertenecerán a esta edición.
-- Cambiar estos defaults cuando empiece otra etapa o temporada.
alter table public.partidos
  alter column etapa set default 'Clausura',
  alter column temporada set default 2026;

commit;

-- Comprobación del resultado.
select etapa, temporada, count(*) as cantidad_partidos
from public.partidos
group by etapa, temporada;
