import { bracketAssets, drawBracket } from './eliminatorias-graphic.js?v=24';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const observers = new WeakMap();
function teamBlock(match, index) {
  const team = match.teams[index], winner = match.decision?.winnerIndex === index;
  const label = team.pending ? team.name.replace('Ganador semifinal ', 'Ganador SF ').replace('Perdedor semifinal ', 'Perdedor SF ') : team.name;
  return `<div class="ko-team${winner ? ' is-winner' : ''}${team.pending ? ' is-pending' : ''}">${team.logo ? `<img src="${escape(team.logo)}" alt="" loading="lazy">` : '<span class="ko-team-placeholder" aria-hidden="true">?</span>'}<span class="ko-team-name" title="${escape(team.name)}">${escape(label)}${winner ? '<small>Ganador</small>' : ''}</span>${match.goals?.[index] !== null && match.goals?.[index] !== undefined ? `<strong class="ko-score">${escape(match.goals[index])}</strong>` : ''}</div>`;
}
function matchInfo(match) {
  if (match.penalties?.every(n => n !== null && n !== undefined)) return `Penales ${match.penalties.join(' – ')}`;
  if (match.estado === 'OFICIAL') return 'Resultado oficial';
  if (match.estado === 'EN_VIVO') return 'En vivo';
  if (match.date) return new Intl.DateTimeFormat('es-PE', {timeZone:'America/Lima',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(match.date)) + (match.cancha ? ` · ${match.cancha}` : '');
  return 'Por programar';
}
function matchMarkup(match, className) {
  return `<article class="ko-match ${className}${match.decision ? ' is-decided' : ''}"><h3>${escape(match.title)}</h3><p class="ko-match-info">${escape(matchInfo(match))}</p><div class="ko-pair">${teamBlock(match, 0)}${teamBlock(match, 1)}</div></article>`;
}
export async function renderKnockout(container, bracket) {
  observers.get(container)?.disconnect();
  const [sf1, sf2, final, third] = bracket.matches;
  const cup = `<div class="ko-champion"><img class="ko-cup" src="/assets/img/copa-eliminatorias.svg?v=4" alt="Trofeo Copa Cajamarca" width="240" height="320"><small>${bracket.champion ? 'Campeón' : 'La copa te espera'}</small>${bracket.champion ? `<strong>${escape(bracket.champion.name)}</strong>` : ''}</div>`;
  const finalMarkup = `<article class="ko-match ko-final"><h3>Final</h3><div class="ko-final-contest">${teamBlock(final,0)}${cup}${teamBlock(final,1)}</div><p class="ko-match-info">${escape(matchInfo(final))}</p></article>`;
  container.innerHTML = `<section class="ko-section" aria-label="Eliminatorias categoría ${escape(bracket.category)}"><div class="ko-toolbar"><p class="ko-status${bracket.ready ? ' ko-ready' : ''}">${escape(bracket.message)}</p><button type="button" class="ko-share" ${bracket.ready ? '' : 'disabled'} aria-label="Generar banner de eliminatorias">↗ <span>Compartir</span></button></div><div class="ko-bracket"><svg class="ko-connectors" aria-hidden="true"></svg>${matchMarkup(sf1, 'ko-sf-one')}${matchMarkup(sf2, 'ko-sf-two')}${finalMarkup}${matchMarkup(third, 'ko-third')}</div><p class="ko-rule">${escape(bracket.rule)}</p><p class="ko-footnote">Los ganadores avanzan a la final; los perdedores disputan el tercer puesto. Avance al oficializar el resultado.</p></section>`;
  container.querySelector('.ko-share').addEventListener('click', e => previewBanner(bracket,e.currentTarget));
  const grid=container.querySelector('.ko-bracket'), svg=grid.querySelector('.ko-connectors');
  const measure=document.createElement('canvas').getContext('2d');
  const connect=()=>{
    // Keep club names legible within each responsive bracket column.
    grid.querySelectorAll('.ko-team-name').forEach(name=>{
      name.style.fontSize='';
      const style=getComputedStyle(name);
      measure.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const longest=Math.max(...name.firstChild.textContent.split(/\s+/).map(word=>measure.measureText(word).width));
      if(longest>name.clientWidth) name.style.fontSize=`${Math.max(8,parseFloat(style.fontSize)*name.clientWidth/longest-.2)}px`;
    });
    const root=grid.getBoundingClientRect();
    if(!root.width)return;
    svg.setAttribute('viewBox',`0 0 ${root.width} ${root.height}`);
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left-root.left,right:r.right-root.left,y:r.top-root.top+r.height/2};};
    const finalTeams=[...grid.querySelectorAll('.ko-final .ko-team')];
    const targetBlocks=finalTeams.map(rect);
    const targets=finalTeams.map(team=>rect(team.querySelector('img,.ko-team-placeholder')));
    svg.innerHTML=['.ko-sf-one','.ko-sf-two'].map((selector,i)=>{
      const nodes=[...grid.querySelectorAll(`${selector} .ko-team`)];
      const blocks=nodes.map(rect);
      const teams=nodes.map(team=>rect(team.querySelector('img,.ko-team-placeholder'))), target=targets[i];
      const leftSide=i===0;
      const from=leftSide?teams[0].right:teams[0].left, end=leftSide?target.left:target.right;
      // Keep the vertical line in the column gap, clear of club names.
      const join=leftSide?(blocks[0].right+targetBlocks[i].left)/2:(blocks[0].left+targetBlocks[i].right)/2;
      const middle=(teams[0].y+teams[1].y)/2;
      const d=`M ${from} ${teams[0].y} H ${join} V ${teams[1].y} H ${from} M ${join} ${middle} V ${target.y} H ${end}`;
      return `<path d="${d}" class="${bracket.matches[i].decision?'is-decided':''}"/>`;
    }).join('');
    const cup=rect(grid.querySelector('.ko-cup'));
    svg.innerHTML+=targets.map((target,i)=>`<path d="M ${i===0?target.right:target.left} ${target.y} H ${i===0?cup.left:cup.right}" class="is-decided"/>`).join('');
  };
  const observer=new ResizeObserver(connect);observer.observe(grid);observers.set(container,observer);connect();
  document.fonts.ready.then(()=>{if(grid.isConnected)connect();});
}
export async function createKnockoutBanner(bracket) {
  const assets=await bracketAssets(bracket),canvas=document.createElement('canvas');
  drawBracket(canvas,bracket,assets,'poster');
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo crear la imagen')),'image/png'));
}
async function previewBanner(bracket, button) {
  button.disabled = true; button.textContent = 'Preparando…';
  try {
    const blob = await createKnockoutBanner(bracket);
    const url = URL.createObjectURL(blob), name = `copa-cajamarca-${bracket.category}-eliminatorias.png`;
    const dialog = document.createElement('dialog'); dialog.className = 'ko-dialog';
    dialog.innerHTML = `<div class="ko-dialog-head"><h2>Banner para Facebook · Cat. ${escape(bracket.category)}</h2><button type="button" class="ko-close" aria-label="Cerrar vista previa">×</button></div><img class="ko-preview" alt="Cruces de eliminatorias de la categoría ${escape(bracket.category)}"><p class="ko-export-size">PNG · 1080 × 1350 px · Formato vertical 4:5</p><div class="ko-actions"><a class="ko-download">Descargar PNG</a><button class="ko-native-share" type="button" hidden>Compartir imagen</button></div><p class="ko-feedback" role="status"></p>`;
    dialog.querySelector('img').src = url;
    const download = dialog.querySelector('a'); download.href = url; download.download = name;
    const file = new File([blob], name, { type: 'image/png' });
    const share = dialog.querySelector('.ko-native-share');
    share.hidden = !navigator.canShare?.({ files: [file] });
    share.addEventListener('click', async () => {
      try { await navigator.share({ files: [file], title: `Eliminatorias · Cat. ${bracket.category}` }); }
      catch (error) { if (error.name !== 'AbortError') dialog.querySelector('.ko-feedback').textContent = 'No se pudo compartir. Puedes descargar la imagen.'; }
    });
    dialog.querySelector('.ko-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { URL.revokeObjectURL(url); dialog.remove(); button.focus(); }, { once: true });
    document.body.append(dialog); dialog.showModal();
  } catch (error) {
    const feedback = button.closest('.ko-section')?.querySelector('.ko-status');
    if (feedback) {
      feedback.setAttribute('role', 'alert');
      feedback.textContent = error.code === 'BANNER_ASSET_MISSING' ? error.message : 'No se pudo generar el banner. Intenta nuevamente.';
    }
    console.error('[Banner eliminatorias]', error);
  } finally { button.disabled = false; button.innerHTML = '↗ <span>Compartir</span>'; }
}
