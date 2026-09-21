# Hora de oficialización

La migración `migrations/20260920000100_partidos_oficializado_at.sql` registra
`partidos.oficializado_at` con la hora del servidor al cambiar el estado a
`OFICIAL`. Las correcciones de marcador no reinician el plazo; si el partido
sale de `OFICIAL`, se borra la marca y una nueva oficialización inicia otro plazo.

## Aplicación

Ejecutar el archivo completo en el SQL Editor del proyecto Supabase antes de
publicar el cambio de Fixture. Esta migración todavía no se ha aplicado desde
este repositorio. No modifica resultados ni las políticas de acceso existentes.

El bloque de programación de Fixture se oculta 24 horas después de ese momento.
Los resultados históricos no reciben una fecha inventada y mantienen el bloque
oculto. Antes de aplicar la migración, Fixture sigue cargando mediante una consulta
compatible, pero los partidos oficiales no muestran el bloque de programación.

El diseño móvil y el filtro temporal de la página En vivo permanecen iguales.
