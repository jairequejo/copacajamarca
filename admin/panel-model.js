export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const STATUS = {PROGRAMADO:'Programado',EN_VIVO:'En vivo',EN_REVISION:'Por aprobar',FINALIZADO:'Finalizado',OFICIAL:'Oficial'};
const normalized = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function filterMatches(matches, {category='',status='',search='',claims=false}={}) {
  return matches.filter(m => (!category || String(m.categoria)===category) && (!status || m.estado===status) && (!claims || String(m.reclamo||'').trim()) && (!search || normalized([m.equipo_local?.nombre,m.equipo_visitante?.nombre,m.cancha,m.grupo,m.reclamo].join(' ')).includes(normalized(search))));
}
export function matchCounts(matches) {
  return {review:matches.filter(m=>m.estado==='EN_REVISION').length,claims:matches.filter(m=>String(m.reclamo||'').trim()).length,official:matches.filter(m=>m.estado==='OFICIAL').length,live:matches.filter(m=>m.estado==='EN_VIVO').length};
}
export function validateScore(a,b) {
  return [a,b].every(n=>n!=='' && n!==null && Number.isInteger(Number(n)) && Number(n)>=0 && Number(n)<=99);
}
export function peruDate(value,withTime=true) {
  if(!value || !Number.isFinite(Date.parse(value)))return 'Por programar';
  return new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(value));
}
