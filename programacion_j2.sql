-- ==========================================
-- SCRIPT DE PROGRAMACIÓN - JORNADA 2 (CORREGIDO SCHEMA)
-- ==========================================

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T08:50:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2014 B' AND p.jornada = 2
  AND ((el.nombre = 'JR STARS' AND ev.nombre = 'TALLERES LIMA') OR (el.nombre = 'TALLERES LIMA' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T09:45:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2014 B' AND p.jornada = 2
  AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T10:30:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2013' AND p.jornada = 1
  AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'FC ESTUDIANTES') OR (el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T11:15:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2014 A' AND p.jornada = 2
  AND ((el.nombre = 'SAINTHORE' AND ev.nombre = 'SPORT REYES') OR (el.nombre = 'SPORT REYES' AND ev.nombre = 'SAINTHORE'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T12:00:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2014 A' AND p.jornada = 2
  AND ((el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'REAL JH') OR (el.nombre = 'REAL JH' AND ev.nombre = 'FC ESTUDIANTES'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T12:45:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2014 A' AND p.jornada = 2
  AND ((el.nombre = 'PERFECT SOCCER' AND ev.nombre = 'U CAJAMARCA') OR (el.nombre = 'U CAJAMARCA' AND ev.nombre = 'PERFECT SOCCER'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T13:30:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2013' AND p.jornada = 1
  AND ((el.nombre = 'JR STARS' AND ev.nombre = 'JV CAJAMARCA') OR (el.nombre = 'JV CAJAMARCA' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T14:20:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2020' AND p.jornada = 2
  AND ((el.nombre = 'SAINTHORE' AND ev.nombre = 'U CAJAMARCA') OR (el.nombre = 'U CAJAMARCA' AND ev.nombre = 'SAINTHORE'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T14:20:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 2', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2020' AND p.jornada = 2
  AND ((el.nombre = 'JV CAJAMARCA' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'JV CAJAMARCA'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T14:20:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 3', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2020' AND p.jornada = 2
  AND ((el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'AAC RETOÑITOS') OR (el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'FC ESTUDIANTES'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T14:55:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2019' AND p.jornada = 2
  AND ((el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'JV CAJAMARCA') OR (el.nombre = 'JV CAJAMARCA' AND ev.nombre = 'ATLETICO JUNIOR'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T14:55:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 2', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2019' AND p.jornada = 2
  AND ((el.nombre = 'JR STARS' AND ev.nombre = 'U CAJAMARCA') OR (el.nombre = 'U CAJAMARCA' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T14:55:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 3', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2019' AND p.jornada = 2
  AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'SAINTHORE') OR (el.nombre = 'SAINTHORE' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T15:30:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2018' AND p.jornada = 2
  AND ((el.nombre = 'SAINTHORE' AND ev.nombre = 'TALLERES LIMA') OR (el.nombre = 'TALLERES LIMA' AND ev.nombre = 'SAINTHORE'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T15:30:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 2', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2018' AND p.jornada = 2
  AND ((el.nombre = 'U CAJAMARCA' AND ev.nombre = 'JR STARS') OR (el.nombre = 'JR STARS' AND ev.nombre = 'U CAJAMARCA'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-15T15:30:00-05:00', 
  lugar = 'EL GOLAZO', 
  cancha = 'CAMPO 3', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2018' AND p.jornada = 2
  AND ((el.nombre = 'SPORT REYES' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'SPORT REYES'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T09:00:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2015' AND p.jornada = 2
  AND ((el.nombre = 'JR STARS' AND ev.nombre = 'ALAN VILLATY') OR (el.nombre = 'ALAN VILLATY' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T09:45:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2015' AND p.jornada = 2
  AND ((el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'AAC RETOÑITOS') OR (el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'FC ESTUDIANTES'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T10:20:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2015' AND p.jornada = 2
  AND ((el.nombre = 'SPORT JUNIOR' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'SPORT JUNIOR'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T11:00:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2016' AND p.jornada = 2
  AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T11:35:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2016' AND p.jornada = 2
  AND ((el.nombre = 'JR STARS' AND ev.nombre = 'SPORT REYES') OR (el.nombre = 'SPORT REYES' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T12:15:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2016' AND p.jornada = 2
  AND ((el.nombre = 'JOTITAS' AND ev.nombre = 'U CAJAMARCA') OR (el.nombre = 'U CAJAMARCA' AND ev.nombre = 'JOTITAS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T12:50:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2017' AND p.jornada = 2
  AND ((el.nombre = 'JR STARS' AND ev.nombre = 'SPORT JUNIOR') OR (el.nombre = 'SPORT JUNIOR' AND ev.nombre = 'JR STARS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T13:40:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2017' AND p.jornada = 2
  AND ((el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'ATLETICO JUNIOR') OR (el.nombre = 'ATLETICO JUNIOR' AND ev.nombre = 'AAC RETOÑITOS'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T14:20:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2017' AND p.jornada = 2
  AND ((el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'JOTITAS') OR (el.nombre = 'JOTITAS' AND ev.nombre = 'FC ESTUDIANTES'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T14:55:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2017' AND p.jornada = 2
  AND ((el.nombre = 'JV CAJAMARCA' AND ev.nombre = 'JUVENIL U CAJAMARCA') OR (el.nombre = 'JUVENIL U CAJAMARCA' AND ev.nombre = 'JV CAJAMARCA'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T15:35:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2017' AND p.jornada = 2
  AND ((el.nombre = 'PERFECT SOCCER' AND ev.nombre = 'SPORT REYES') OR (el.nombre = 'SPORT REYES' AND ev.nombre = 'PERFECT SOCCER'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T16:10:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2017' AND p.jornada = 2
  AND ((el.nombre = 'SAINTHORE' AND ev.nombre = 'U CAJAMARCA') OR (el.nombre = 'U CAJAMARCA' AND ev.nombre = 'SAINTHORE'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T16:50:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2018' AND p.jornada = 2
  AND ((el.nombre = 'EFB BARCELONA' AND ev.nombre = 'AAC RETOÑITOS') OR (el.nombre = 'AAC RETOÑITOS' AND ev.nombre = 'EFB BARCELONA'));

UPDATE partidos p
SET 
  fecha_hora = '2026-08-16T17:30:00-05:00', 
  lugar = 'YESILÚ', 
  cancha = 'CAMPO 1', 
  estado = 'Programado'
FROM equipos el, equipos ev
WHERE p.equipo_local_id = el.id AND p.equipo_visitante_id = ev.id
  AND p.categoria = '2018' AND p.jornada = 2
  AND ((el.nombre = 'FC ESTUDIANTES' AND ev.nombre = 'JV CAJAMARCA') OR (el.nombre = 'JV CAJAMARCA' AND ev.nombre = 'FC ESTUDIANTES'));

