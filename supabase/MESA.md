# Reparar Mesa en una base de datos existente

El código publicado consultaba `eliminatorias_partidos.reclamo` y llamaba a
`guardar_eliminatoria_mesa`, pero la instalación anterior no tenía esa columna ni
esa función. Una eliminatoria sin actualizar bloqueaba también el listado de grupos.

1. Ejecutar completo `migrations/20261018000100_reparar_mesa_eliminatorias.sql`
   en Supabase → SQL Editor. Es una actualización incremental y puede repetirse.
   No volver a ejecutar la migración inicial que crea la tabla de eliminatorias.
2. Autorizar explícitamente la cuenta existente de Mesa, sustituyendo el correo:

```sql
insert into public.mesa_accesos (user_id, nombre, activo)
select id, 'Mesa de control', true
from auth.users
where lower(email) = lower('TU_CORREO_DE_MESA')
on conflict (user_id) do update set activo = true;

-- Verificar que el correo coincidió con una cuenta existente:
select u.email, m.nombre, m.activo
from public.mesa_accesos m join auth.users u on u.id = m.user_id;
```

Repetir el INSERT para las demás cuentas autorizadas. La reparación no crea
usuarios, cambia contraseñas ni autoriza cuentas automáticamente por su correo.
Si la verificación no devuelve la cuenta, revisar el correo en Authentication → Users.

3. Recargar `/mesa/`. Iniciar un partido, registrar goles y, si hay empate,
   completar ambos penales y pulsar **Guardar penales**. Al finalizar, la tanda
   debe tener un ganador. **Finalizar partido** lo envía a revisión; mientras esté
   en revisión puede reabrirse para corregir resultado o reclamo. Solo Admin puede
   corregir resultados oficiales. El fixture muestra ganadores y perdedores en las
   siguientes rondas al finalizar en Mesa, aunque la aprobación administrativa
   todavía esté pendiente. Si Mesa reabre o corrige el resultado, el cuadro se recalcula.

La página mantiene los grupos disponibles aunque falte la actualización de
eliminatorias y muestra el motivo del error. Las actualizaciones comprueban la
versión del resultado y las escrituras que no devuelven una fila nunca se presentan
como guardadas. Los partidos pendientes o en revisión no desaparecen por tener
más de cuatro días o por estar sin fecha.

## Pruebas locales con datos sintéticos

```sh
npm install --prefix .local-work/tmp/mesa-test jsdom@26.1.0 --no-audit --no-fund
npm install --prefix .local-work/tmp/knockout-sql-test @electric-sql/pglite@0.5.8 --no-audit --no-fund
node --test tests/mesa.test.mjs
node --liftoff-only --no-wasm-tier-up tests/mesa-sql.test.mjs
```

El test SQL reproduce una instalación sin reclamos ni RPC de Mesa, aplica la
reparación dos veces y valida permisos, penales, reapertura y resultados oficiales.
