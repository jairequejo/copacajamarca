export async function loadCarnetPeople(client) {
  const people = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from('personas')
      .select('*, equipos(nombre, logo_url)')
      .in('rol', ['ENTRENADOR', 'DELEGADO', 'JUGADOR'])
      .order('equipo_id').order('apellidos').order('nombres').order('dni')
      .range(start, start + 499);
    if (error) throw error;
    people.push(...(data || []));
    if (!data || data.length < 500) return people;
  }
}

export function carnetPersonName(person) {
  return [person.apellidos, person.nombres].filter(Boolean).join(', ') || person.nombre_completo || 'Sin nombre';
}

export function carnetFileName(person, index) {
  const clean = (value) => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${clean(person.team) || 'Independiente'}/${clean(person.role)}_${clean(person.name)}_${clean(person.dni) || index}.pdf`;
}
