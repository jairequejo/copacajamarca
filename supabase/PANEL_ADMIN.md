# Panel de administración

El panel conserva programación, eliminatorias, directorio, fichas, carnets, importación
y boletería. Añade partidos y reclamos por categoría, búsqueda, revisión de marcadores,
historial de aprobaciones de la cuenta y gestión de contraseñas de cuentas de mesa.

## Activación en el proyecto Supabase

1. Ejecutar `migrations/20261007000100_panel_admin.sql` completa en SQL Editor.
   Puede repetirse. Para registrar también semifinales, final y tercer puesto, aplicar
   primero la migración de eliminatorias; si se instala después, repetir esta migración.
   No modifica marcadores históricos ni contraseñas existentes.
2. Vincular la cuenta administradora real de Authentication > Users:

```sql
insert into public.panel_admins(user_id)
values ('UUID-DE-LA-CUENTA-ADMIN')
on conflict(user_id) do update set activo=true;

insert into public.mesa_accesos(user_id,nombre)
values ('UUID-DE-LA-CUENTA-MESA','Mesa principal')
on conflict(user_id) do update set nombre=excluded.nombre,activo=true;
```

Registrar solo cuentas existentes de mesa. Una cuenta incluida en `panel_admins`
queda excluida de los cambios de contraseña de mesa, aunque esté vinculada por error.
No añadir administradores por nombre de correo: la autorización se basa en UUID.
Al activar la tabla, el admin necesita estar autorizado antes de oficializar partidos.

3. Desplegar la función protegida:

```sh
supabase functions deploy admin-mesa --project-ref uzyqpruqiqubwnqttnwf
```

Mantener la verificación JWT de la función. Usa `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` del entorno del servidor; admite `SUPABASE_SECRET_KEY`
si se configura una clave secreta equivalente. Ninguna clave privada va en HTML/JS
del navegador. El handler verifica la sesión con Auth y comprueba `panel_admins`
antes de acceder a la API administrativa de usuarios.

Por defecto acepta el dominio Copa Cajamarca y localhost en los puertos 8090 y 8091. Si cambia el dominio
o puerto de desarrollo, configurar `ADMIN_ALLOWED_ORIGINS` con orígenes separados
por comas. CORS complementa la autorización; no la sustituye.

## Historial y compatibilidad

- El trigger captura la cuenta que oficializa, fecha del servidor, categoría, grupo,
  nombres de rivales, marcador y reclamo. No inventa autores de resultados previos.
- Partidos reúne fase de grupos y eliminatorias. Un problema al consultar eliminatorias
  muestra una advertencia y conserva los partidos de grupos disponibles.
- Registra fase de grupos y eliminatorias, incluidos los penales, cuando su tabla existe.
  Las cuentas que guardan eliminatorias también deben estar vinculadas en `panel_admins`.
- Las correcciones de marcadores ya oficiales producen otro registro. Cambiar solo
  la programación no duplica aprobaciones. El historial del panel consulta únicamente
  registros del administrador conectado y permite cargar páginas anteriores.
- La RPC compara marcador, equipos y reclamo original bajo bloqueo del partido. Si
  otra persona cambió el acta, exige volver a revisarla.
- Antes de instalar la migración, los partidos siguen cargando y la aprobación usa el
  flujo anterior con comprobación de cambios; informa que aún falta activar el historial.
  La comprobación anterior de correo del login se conserva solo si la RPC de roles
  todavía no existe. Después, la lista explícita de administradores decide el acceso.
- Se conservan las políticas existentes de `partidos`; la nueva RPC es security invoker.
  Revisar las políticas de esas tablas en el proyecto real. No se amplían permisos de
  escritura de partidos mediante esta migración.

## Contraseñas de mesa

La función únicamente lista cuentas vinculadas activas y cambia la contraseña de una
de ellas. No muestra contraseñas actuales. Exige 12–128 caracteres, excluye cuentas
administradoras y reserva un intento con límite de 30 segundos por cuenta. El registro
de operaciones contiene actor, destinatario, fecha y resultado; nunca la contraseña.
Un intento puede permanecer pendiente si el proceso se interrumpe entre Auth y el
registro final: no se debe interpretar como confirmación de éxito o fracaso.

El cambio afecta al próximo ingreso con contraseña; no se promete cerrar las sesiones
ya abiertas. No crea cuentas, no manda correos ni concede permisos de administrador.

## Comprobaciones locales

```sh
node --test tests/admin-panel.test.mjs
node --liftoff-only --no-wasm-tier-up tests/admin-panel-sql.test.mjs
```

La prueba SQL usa PGlite instalado localmente en `.local-work/tmp/knockout-sql-test`:

```sh
npm install --prefix .local-work/tmp/knockout-sql-test @electric-sql/pglite
```

Usa usuarios y partidos sintéticos. Los tests de la función usan
un transporte simulado: no cambian credenciales reales.

Documentación de referencia: [actualización administrativa de usuarios](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
y [autorización de funciones](https://supabase.com/docs/guides/functions/auth).

La migración y la función quedan listas en el repositorio. No se han aplicado ni
desplegado sobre el proyecto remoto desde este entorno.
## Configuración y actualizaciones del panel

Más → Configuración permite buscar e instalar actualizaciones del PWA y recargar
la aplicación conservando la sesión y la sección abierta. Los formularios sin
guardar se pierden al recargar; la pantalla lo indica antes del botón.

El PWA usa `admin/manifest.webmanifest` y `admin/sw.js`, con alcance exclusivo
en `/admin/`. Se registra por HTTPS (localhost permite pruebas). Su estrategia
es solo red: no crea cachés ni guarda actas, carnets, fotografías o respuestas de
Supabase. Requiere conexión para trabajar.

Al publicar cambios al panel, incrementar `ADMIN_RELEASE` en `admin/sw.js` y los
parámetros de versión de los archivos modificados. El nuevo worker espera hasta
que el usuario pulse **Instalar actualización**; entonces acepta `SKIP_WAITING`,
reclama sus clientes y recarga. Si el navegador no admite PWA, queda disponible
la recarga web. No borra cookies, almacenamiento de sesión ni cachés de otros sitios.

Referencias del mecanismo: [instalación PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
y [activación de actualizaciones](https://developer.chrome.com/docs/workbox/handling-service-worker-updates).
