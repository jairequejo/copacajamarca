import { isFinished } from './eliminatorias-model.js?v=3';

const categoryOf = row => String(row.categoria ?? '').trim();
const groupOf = row => String(row.grupo ?? '').trim();
export const fixtureGroupKey = (category, group) => group ? `${category} GRP ${group}` : category;

function groupsFinished(category, groups, matches, standings) {
  if (groups.length < 2 || matches.some(m => m.equipo_local_id && m.equipo_visitante_id && !groupOf(m))) return false;
  return groups.every(group => {
    const games = matches.filter(m => groupOf(m) === group && m.equipo_local_id && m.equipo_visitante_id);
    if (!games.length || games.some(m => !isFinished(m))) return false;
    const teams = [...new Set([
      ...standings.filter(row => categoryOf(row) === category && groupOf(row) === group).map(row => row.equipo_id),
      ...games.flatMap(m => [m.equipo_local_id, m.equipo_visitante_id])
    ].filter(Boolean).map(String))];
    // A missing pairing is not a completed group, even if all loaded scores are official.
    return teams.length >= 2 && teams.every((a, i) => teams.slice(i + 1).every(b => games.some(m =>
      (String(m.equipo_local_id) === a && String(m.equipo_visitante_id) === b) ||
      (String(m.equipo_local_id) === b && String(m.equipo_visitante_id) === a)
    )));
  });
}

export function fixtureCategoryTabs(matches, standings = []) {
  const categories = [...new Set(matches.map(categoryOf).filter(Boolean))].sort();
  return categories.flatMap(category => {
    const games = matches.filter(m => categoryOf(m) === category);
    const groups = [...new Set([...games, ...standings.filter(row => categoryOf(row) === category)].map(groupOf).filter(Boolean))].sort();
    if (groupsFinished(category, groups, games, standings)) {
      return [{id:category, category, group:null, groups, merged:true}];
    }
    const keys = [...new Set(games.map(m => fixtureGroupKey(category, groupOf(m))))].sort();
    return keys.map(id => ({id, category, group:id === category ? null : id.slice(category.length + 5), groups, merged:false}));
  });
}

export function resolveFixtureSelection(tabs, categoryId, requestedGroup) {
  const category = String(categoryId ?? '').split(' GRP ')[0];
  const group = requestedGroup || String(categoryId ?? '').split(' GRP ')[1] || null;
  const tab = tabs.find(t => t.id === categoryId) || tabs.find(t => t.category === category && (t.merged || t.group === group)) || tabs.find(t => t.category === category) || tabs[0];
  if (!tab) return {tab:null, group:null};
  return {tab, group:tab.merged ? (tab.groups.includes(group) ? group : tab.groups[0]) : tab.group};
}
