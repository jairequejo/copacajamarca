const TEAMS =
  "equipo_local:equipos!partidos_equipo_local_id_fkey(nombre,logo_url),equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre,logo_url)";
const GROUP_FIELDS =
  "id,torneo_id,categoria,grupo,jornada,estado,goles_local,goles_visitante,fecha_hora,cancha,lugar,reclamo,equipo_local_id,equipo_visitante_id," +
  TEAMS;
const KNOCKOUT_FIELDS =
  "id,torneo_id,categoria,fase,estado,goles_local,goles_visitante,penales_local,penales_visitante,reclamo,fecha_hora,cancha,equipo_local_id,equipo_visitante_id," +
  TEAMS.replaceAll("partidos_equipo_", "eliminatorias_partidos_equipo_");
async function readAll(client, table, fields) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client
      .from(table)
      .select(fields)
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function loadPanelMatches(client) {
  const matches = await readAll(client, "partidos", GROUP_FIELDS);
  let knockoutWarning = "";
  try {
    let knockout;
    try { knockout = await readAll(client, "eliminatorias_partidos", KNOCKOUT_FIELDS); }
    catch (error) {
      if (error.code !== '42703' || !String(error.message).includes('reclamo')) throw error;
      knockout = await readAll(client, "eliminatorias_partidos", KNOCKOUT_FIELDS.replace(',reclamo', ''));
      knockoutWarning = 'Eliminatorias sin soporte de reclamos: falta aplicar la actualización SQL de Mesa.';
    }
    matches.push(...knockout.map((m) => ({ ...m, origen: "eliminatorias" })));
  } catch (error) {
    knockoutWarning = ["PGRST205", "42P01"].includes(error.code)
      ? "Eliminatorias todavía sin activar."
      : "No se pudieron actualizar las eliminatorias.";
  }
  return { matches, knockoutWarning };
}
