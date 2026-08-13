-- Limpiar los partidos de Fútbol 9 (Sábado por la mañana) que se van a reprogramar o que fueron eliminados
UPDATE partidos p
SET 
  fecha_hora = NULL, 
  lugar = NULL, 
  cancha = NULL,
  estado = 'PROGRAMADO'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.fecha_hora::text LIKE '2026-08-15%'
  AND p.cancha = 'CAMPO 1' 
  AND EXTRACT(HOUR FROM p.fecha_hora AT TIME ZONE 'UTC') + 5 < 14; -- Menos de las 2 PM (mañana)


-- REPROGRAMACIÓN SÁBADO (EL GOLAZO) - FÚTBOL 9

UPDATE partidos p
SET fecha_hora = '2026-08-15T08:50:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2014 B' AND p.jornada = 2 AND ((el.nombre = 'JR STARS' AND ev.nombre = 'TALLERES LIMA') OR (el.nombre = 'TALLERES LIMA' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET fecha_hora = '2026-08-15T09:45:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2014 B' AND p.jornada = 2 AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET fecha_hora = '2026-08-15T10:30:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2014 A' AND p.jornada = 2 AND ((el.nombre = 'SAINTHORE' AND ev.nombre = 'SPORT REYES') OR (el.nombre = 'SPORT REYES' AND ev.nombre = 'SAINTHORE'));

UPDATE partidos p
SET fecha_hora = '2026-08-15T11:15:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2014 A' AND p.jornada = 2 AND ((el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'REAL JH') OR (el.nombre = 'REAL JH' AND ev.nombre = 'FC ESTUDIANTES'));

UPDATE partidos p
SET fecha_hora = '2026-08-15T12:00:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2013' AND p.jornada = 1 AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'FC ESTUDIANTES') OR (el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET fecha_hora = '2026-08-15T12:45:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2014 A' AND p.jornada = 2 AND ((el.nombre = 'PERFECT SOCCER' AND ev.nombre = 'U CAJAMARCA') OR (el.nombre = 'U CAJAMARCA' AND ev.nombre = 'PERFECT SOCCER'));

UPDATE partidos p
SET fecha_hora = '2026-08-15T13:30:00-05:00', lugar = 'EL GOLAZO', cancha = 'CAMPO 1', estado = 'PROGRAMADO'
FROM equipos el, equipos ev WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
AND p.categoria = '2013' AND p.jornada = 1 AND ((el.nombre = 'JR STARS' AND ev.nombre = 'JV CAJAMARCA') OR (el.nombre = 'JV CAJAMARCA' AND ev.nombre = 'JR STARS'));
