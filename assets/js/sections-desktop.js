// Progressive enhancement: no DOM changes or extra data requests on mobile.
const desktop = window.matchMedia('(min-width: 992px)');
const target = document.querySelector('#matchesList, #fixtureContent, #standingsContainer');
const teamSelector = '.team.local, .team.visitante, .match-team, .team-name-pos';
let logos;
let loading;
let observer;
const normalize = value => value.trim().normalize('NFC').toLocaleUpperCase('es-PE').replace(/\s+/g, ' ');

async function loadLogos() {
  if (logos) return logos;
  if (!loading) loading = (async () => {
    const { supabase } = await import('./supabase.js');
    const { data, error } = await supabase.from('equipos').select('nombre, logo_url').not('logo_url', 'is', null);
    if (error) throw error;
    const result = new Map();
    for (const team of data || []) {
      try {
        const url = new URL(team.logo_url, location.href);
        if (url.protocol === 'https:' || url.origin === location.origin) result.set(normalize(team.nombre), url.href);
      } catch { /* An invalid logo must not prevent reading results. */ }
    }
    logos = result;
    return result;
  })().finally(() => { loading = null; });
  return loading;
}
function decorate() {
  if (!desktop.matches || !target || !logos) return;
  observer?.disconnect();
  for (const team of target.querySelectorAll(teamSelector)) {
    if (team.querySelector('.desktop-team-logo')) continue;
    const src = logos.get(normalize(team.textContent));
    if (!src) continue;
    const img = document.createElement('img');
    img.className = 'desktop-team-logo';
    img.hidden = true;
    img.alt = '';
    img.width = 44;
    img.height = 44;
    img.loading = 'lazy';
    img.src = src;
    img.addEventListener('error', () => { img.style.setProperty('display', 'none', 'important'); }, { once: true });
    team.prepend(img);
  }
  observer?.observe(target, { childList: true, subtree: true });
}
async function updateViewport() {
  if (!target) return;
  if (!desktop.matches) {
    observer?.disconnect();
    target.querySelectorAll('.desktop-team-logo').forEach(img => img.remove());
    return;
  }
  try {
    await loadLogos();
    if (!desktop.matches) return;
    observer ??= new MutationObserver(decorate);
    decorate();
  } catch (error) {
    console.warn('No se pudieron cargar los escudos de escritorio.', error.message);
  }
}
desktop.addEventListener('change', updateViewport);
updateViewport();
