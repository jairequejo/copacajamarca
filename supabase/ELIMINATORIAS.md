# Eliminatorias: instalación y uso

El gráfico y la exportación PNG funcionan con los clasificados de `view_posiciones`.
El avance persistente requiere aplicar `migrations/20260930000100_eliminatorias.sql`
en el SQL Editor del proyecto Supabase. Esta migración todavía NO se ha aplicado
al proyecto remoto desde este entorno: no hay conexión administrativa disponible.

La tabla `eliminatorias_partidos` se mantiene separada de `partidos` para que los
marcadores de semifinales, final y tercer puesto no sumen puntos a los grupos.
La lectura es pública; solo las cuentas autorizadas pueden escribir.

Después de aplicar la migración, autoriza la cuenta administradora existente:

```sql
-- Sustituye el UUID por el de tu cuenta en Authentication > Users.
insert into public.eliminatorias_admins(user_id)
values ('UUID-DE-TU-CUENTA-ADMIN')
on conflict do nothing;
```

No introduzcas claves privadas en JavaScript. El admin usa la sesión Supabase
existente. Abrir Admin > Eliminatorias, elegir categoría, completar resultado y
seleccionar «Oficial · avanzar ganador». Un empate requiere ambos marcadores de
penales, diferentes. Los ganadores pasan a la final y los perdedores al tercer
puesto; el ganador de la final aparece junto a la copa. El fixture consulta cambios
cada 30 segundos y al volver a la pestaña. El banner usa los mismos resultados.

Las categorías sin todos los enfrentamientos de grupos terminados conservan
casillas por definir. Un empate en puntos/DG/GF pendiente de resolver bloquea los
clasificados. No se oficializan resultados de prueba en el proyecto real.

Correcciones: si ya existe una final o tercer puesto guardado, retirarlos desde el
admin antes de modificar el resultado de una semifinal. El servidor impide cruces
inconsistentes y rechaza escrituras de formularios que quedaron desactualizados.
Se conservan las fechas en hora de Perú (`America/Lima`).

## Verificación local

- `node --test tests/eliminatorias.test.mjs`: clasificación, penales, avance,
  campeón, tercer puesto y corrección de cruces.
- Prueba SQL aislada con PostgreSQL embebido (PGlite):
  `npm install --prefix .local-work/tmp/knockout-sql-test @electric-sql/pglite@0.5.8 --no-audit --no-fund`
  y `node tests/eliminatorias-sql.test.mjs`.
  Usa datos sintéticos en memoria, sin conexión ni escrituras al Supabase real.

El PNG exportado mide 1080 × 1350 px (4:5). Usa un fondo exclusivo del túnel
al estadio y escudos sin placas de fondo. La copa usa SVG con la geometría del diseño
original: versión plana en la web y acabado metálico en el banner.

Los datos personales, herramientas y contexto de trabajo se conservan en
`.local-work/`, excluida de Git. Las dependencias de las pruebas SQL se instalan
localmente con el comando anterior; no forman parte del sitio publicado.

## Asignar Clausura 2026 a todos los partidos

Ejecutar completo `migrations/20261001000100_clausura_2026.sql` en Supabase > SQL Editor.
El script agrega `etapa` y `temporada` a `public.partidos`, asigna Clausura/2026
a todos los registros actuales (también aquellos sin torneo_id) y establece esos
valores por defecto para nuevas altas del admin. No modifica marcadores, fechas,
equipos, categorías, grupos ni torneo_id. Al empezar otra edición deben cambiarse
los valores por defecto. Puede ejecutarse más de una vez sin duplicar columnas.

Este script NO se ejecutó sobre el proyecto remoto desde este entorno.
El banner toma la edición de los partidos de su categoría. Mientras no existan
las columnas, utiliza la edición actual configurada explícitamente como Clausura 2026.
Si hay ediciones contradictorias en una categoría muestra «Etapa por confirmar».
Los partidos de eliminatorias heredan la edición del cuadro, sin duplicar la metadata.
Validación aislada: `node tests/clausura-2026-sql.test.mjs`.
