import { supabase } from './supabase.js';
export async function loadKnockoutResults() {
  const response = await supabase.from('eliminatorias_partidos').select('*');
  if (response.error && ['PGRST205', '42P01'].includes(response.error.code)) return { records: [], available: false };
  if (response.error) throw response.error;
  return { records: response.data || [], available: true };
}
export function tournamentFor(category, matches) {
  const ids = [...new Set(matches.filter(m => String(m.categoria) === String(category)).map(m => m.torneo_id).filter(Boolean))];
  return ids.length === 1 ? ids[0] : null;
}

export async function loadMatchesWithMetadata(fields) {
  const result=await supabase.from('partidos').select(`${fields},etapa,temporada`);
  if(['42703','PGRST204'].includes(result.error?.code)&&/\b(etapa|temporada)\b/.test(result.error.message)) {
    return supabase.from('partidos').select(fields);
  }
  return result;
}
