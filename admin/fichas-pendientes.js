export function initFichasPendientes(supabase) {
  const pendingCount = document.getElementById('pending-count');
  const pendingContent = document.getElementById('pending-content');
  const safe = s => String(s ?? '').replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
  let loading = false;
  let refreshQueued = false;

  async function refresh() {
    if (loading) {
      refreshQueued = true;
      return;
    }
    loading = true;
    pendingCount.textContent = '…';
    pendingContent.className = 'pending-message';
    pendingContent.textContent = 'Verificando fichas publicadas...';
    try {
      const [
        { data: equipos, error: equiposError },
        { data: inscripciones, error: inscripcionesError },
        { data: posiciones, error: posicionesError }
      ] = await Promise.all([
        supabase.from('equipos').select('id, nombre, logo_url').order('nombre'),
        supabase.from('inscripciones_equipos').select('equipo_id, categoria'),
        supabase.from('view_posiciones').select('categoria, grupo, equipo_id, pj, pts, dg, gf')
      ]);

      if (equiposError || inscripcionesError || !equipos) {
        throw equiposError || inscripcionesError || new Error('No se pudieron cargar los equipos');
      }

      const categoriasPorEquipo = new Map(equipos.map(eq => [eq.id, new Set()]));
      (inscripciones || []).forEach(inscripcion => {
        const categoria = String(inscripcion.categoria || '').trim();
        if (categoria) categoriasPorEquipo.get(inscripcion.equipo_id)?.add(categoria);
      });
      const data = equipos.map(eq => ({
        ...eq,
        categorias: [...(categoriasPorEquipo.get(eq.id) || [])].sort().join(',')
      }));
      await loadPendingSheets(data, posicionesError ? [] : (posiciones || []));
    } catch (error) {
      console.error('No se pudo cargar el control de fichas pendientes:', error);
      pendingCount.textContent = '!';
      pendingContent.className = 'pending-message';
      pendingContent.textContent = 'No se pudo verificar el estado de las fichas. Intenta nuevamente.';
    } finally {
      loading = false;
      if (refreshQueued) {
        refreshQueued = false;
        void refresh();
      }
    }
  }

  async function loadPendingSheets(equipos, posiciones) {
    const checks = equipos.flatMap(eq => {
      const categorias = String(eq.categorias || '').split(',').map(c => c.trim()).filter(Boolean);
      return categorias.map(categoria => ({ equipo: eq, categoria }));
    });

    if (checks.length === 0) {
      pendingCount.textContent = '0';
      pendingContent.textContent = 'No hay categorías inscritas en el torneo.';
      return;
    }

    const results = await Promise.all(checks.map(async item => {
      const fichaUrl = `https://uzyqpruqiqubwnqttnwf.supabase.co/storage/v1/object/public/fichas/${item.equipo.id}_${item.categoria}.pdf`;
      try {
        const response = await fetch(fichaUrl, { method: 'HEAD', cache: 'no-store' });
        return { ...item, exists: response.ok, verified: true };
      } catch (error) {
        console.error('No se pudo verificar la ficha:', fichaUrl, error);
        return { ...item, exists: false, verified: false };
      }
    }));

    if (results.some(result => !result.verified)) {
      pendingCount.textContent = '!';
      pendingContent.textContent = 'No se pudieron verificar todas las fichas. Intente nuevamente.';
      return;
    }

    const sortStandings = (a, b) =>
      Number(b.pts || 0) - Number(a.pts || 0) ||
      Number(b.dg || 0) - Number(a.dg || 0) ||
      Number(b.gf || 0) - Number(a.gf || 0);

    function getQualificationStatus(item) {
      const categoria = String(item.categoria);
      const teamRows = posiciones.filter(row =>
        String(row.categoria) === categoria && row.equipo_id === item.equipo.id
      );
      const standing = categoria === '2014'
        ? teamRows.find(row => row.grupo)
        : teamRows.find(row => !row.grupo);

      if (!standing) {
        return {
          level: 'eliminated', rank: null, group: null, remainingMatches: null,
          maximumPoints: null, label: 'Sin posición disponible'
        };
      }

      const cutoff = categoria === '2014' ? 2 : 4;
      const pool = posiciones.filter(row => {
        if (String(row.categoria) !== categoria) return false;
        if (categoria === '2014') return row.grupo === standing.grupo;
        return !row.grupo;
      }).sort(sortStandings);
      const rank = pool.findIndex(row => row.equipo_id === item.equipo.id) + 1;
      const cutoffPoints = Number(pool[cutoff - 1]?.pts ?? Infinity);
      const remainingMatches = Math.max(0, pool.length - 1 - Number(standing.pj || 0));
      const maximumPoints = Number(standing.pts || 0) + remainingMatches * 3;

      if (rank > 0 && rank <= cutoff) {
        return {
          level: 'critical', rank, group: standing.grupo,
          remainingMatches, maximumPoints, label: '⚠ Clasificando: ficha urgente'
        };
      }

      if (rank > cutoff && maximumPoints >= cutoffPoints) {
        return {
          level: 'warning', rank, group: standing.grupo,
          remainingMatches, maximumPoints, label: '⚠ Todavía puede clasificar'
        };
      }

      return {
        level: 'eliminated', rank, group: standing.grupo,
        remainingMatches, maximumPoints, label: 'Ya no puede clasificar'
      };
    }

    const priority = { critical: 0, warning: 1, eliminated: 2 };
    const pendientes = results
      .filter(result => !result.exists)
      .map(result => ({ ...result, status: getQualificationStatus(result) }))
      .sort((a, b) =>
        priority[a.status.level] - priority[b.status.level] ||
        (a.status.rank ?? Infinity) - (b.status.rank ?? Infinity) ||
        a.equipo.nombre.localeCompare(b.equipo.nombre) ||
        a.categoria.localeCompare(b.categoria)
      );
    const totalPendientes = pendientes.length;
    pendingCount.textContent = totalPendientes;

    if (pendientes.length === 0) {
      pendingContent.className = 'pending-message';
      pendingContent.textContent = '✅ Todos los equipos tienen sus fichas PDF publicadas.';
      return;
    }

    pendingContent.className = 'pending-table-wrap';
    pendingContent.innerHTML = `
      <div class="pending-rule">Clasifican los 4 primeros por categoría; en 2014 clasifican los 2 primeros de cada grupo.</div>
      <table class="pending-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Categoría</th>
            <th>Posición</th>
            <th>Partidos restantes</th>
            <th>Máximo posible</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${pendientes.map(item => `
            <tr class="pending-row-${item.status.level}">
              <td>${safe(item.equipo.nombre)}</td>
              <td><span class="pending-category">${safe(item.categoria)}</span></td>
              <td>
                ${item.status.rank ? `${item.status.rank}.º` : '—'}
                ${item.status.group ? `<span class="position-detail">Grupo ${safe(item.status.group)}</span>` : ''}
              </td>
              <td>${item.status.remainingMatches ?? '—'}</td>
              <td>${item.status.maximumPoints !== null ? `${item.status.maximumPoints} pts` : '—'}</td>
              <td><span class="risk-badge risk-${item.status.level}">${safe(item.status.label)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return { refresh };
}
