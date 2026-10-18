const assetCache = new Map();
let posterFonts;
async function loadPosterFonts() {
  if (typeof FontFace === 'undefined') return;
  if (!posterFonts) posterFonts = Promise.all([
    ['Copa Display','BigShoulders-Bold.ttf'],
    ['Copa Sans','InstrumentSans-Bold.ttf']
  ].map(async ([family,file]) => {
    const font = await new FontFace(family, `url(/assets/fonts/${file})`, {weight:'700'}).load();
    document.fonts.add(font);
  })).catch(() => {
    posterFonts = undefined;
    throw new Error('No se pudo cargar la tipografía del banner. Vuelve a intentarlo.');
  });
  await posterFonts;
}
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!assetCache.has(src)) {
    const pending = new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const finish = image => {
        clearTimeout(timer); img.onload = img.onerror = null; resolve(image);
      };
      const timer = setTimeout(() => finish(null), 15000);
      img.onload = () => finish(img.naturalWidth ? img : null);
      img.onerror = () => finish(null); img.src = src;
    }).then(image => {
      // A stopped server or interrupted download must not poison later exports.
      if (!image && assetCache.get(src) === pending) assetCache.delete(src);
      return image;
    });
    assetCache.set(src, pending);
  }
  return assetCache.get(src);
}
export async function bracketAssets(bracket) {
  await loadPosterFonts();
  await document.fonts.ready;
  const teams = [...bracket.matches.flatMap(m => m.teams), bracket.champion].filter(Boolean);
  const [cup, bg, logo, images] = await Promise.all([
    loadImage('/assets/img/copa-eliminatorias-poster.svg?v=3'),
    loadImage('/assets/img/fondo-eliminatorias-tunel.png'),
    loadImage('/assets/img/logo.png'),
    Promise.all(teams.map(t => loadImage(t.logo)))
  ]);
  const missing = !bg ? 'el fondo' : !cup ? 'la copa' : !logo ? 'el logo del campeonato' : null;
  if (missing) {
    const error = new Error(`No se pudo cargar ${missing} del banner. Vuelve a intentarlo.`);
    error.code = 'BANNER_ASSET_MISSING';
    throw error;
  }
  return { cup, bg, logo, teams: new Map(teams.map((t,i) => [t.id, images[i]])) };
}
const C={navy:'#06162e',gold:'#ffd029',white:'#fff9ef',muted:'#b2c1d0',line:'#bfd2e0'};
function text(ctx,s,x,y,size=30,color=C.white,align='left',family='Copa Display',maxWidth){ctx.font=`700 ${size}px "${family}", sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(s),x,y,maxWidth);}
function fit(ctx,s,size,width,family='Copa Display'){ctx.font=`700 ${size}px "${family}", sans-serif`;return Math.min(size,size*width/ctx.measureText(String(s)).width);}
function display(ctx,s,x,y,size,color,width,align='left'){ctx.save();ctx.translate(x,y);ctx.transform(1,0,-.09,1,0,0);const actual=fit(ctx,s,size,width);text(ctx,s,2,4,actual,'#030e20',align);text(ctx,s,0,0,actual,color,align);ctx.restore();}
function contain(ctx,img,x,y,w,h){if(!img)return;const scale=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);}
function polygon(ctx,points,fill){ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function path(ctx,points,color=C.line,width=3){ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
function teamName(ctx,name,x,y,width,size,color=C.white){
 const words=String(name).split(/\s+/),lines=[''];ctx.font=`700 ${size}px "Copa Display", sans-serif`;
 for(const word of words){const last=lines.length-1,next=(lines[last]+' '+word).trim();if(ctx.measureText(next).width>width&&lines[last]&&last===0)lines.push(word);else lines[last]=next;}
 const actual=Math.min(size,...lines.map(line=>fit(ctx,line,size,width)));
 lines.forEach((line,i)=>text(ctx,line,x,y+(i-(lines.length-1)/2)*(actual+3),actual,color,'center'));
}
function mark(ctx,t,assets,cx,y,size){
 const img=assets.teams.get(t.id);ctx.save();ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=12;ctx.shadowOffsetY=6;
 if(img)contain(ctx,img,cx-size/2,y,size,size);else text(ctx,t.pending?'?':t.name.split(/\s+/).slice(0,2).map(s=>s[0]).join(''),cx,y+size/2,size*.6,C.muted,'center');ctx.restore();
}
function caption(ctx,m,cx,y,width){
 const pens=m.penalties?.every(n=>n!==null&&n!==undefined)?`Penales ${m.penalties.join(' – ')}`:'';
 const date=m.date?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(m.date)):'';
 if(pens){text(ctx,pens,cx,y,fit(ctx,pens,20,width,'Copa Sans'),C.muted,'center','Copa Sans');return;}
 if(date||m.cancha){
  if(date)text(ctx,date,cx,y-10,fit(ctx,date,19,width,'Copa Sans'),C.muted,'center','Copa Sans');
  if(m.cancha)text(ctx,m.cancha,cx,y+12,fit(ctx,m.cancha,17,width,'Copa Sans'),C.muted,'center','Copa Sans');
  return;
 }
 const label=m.estado==='OFICIAL'?'Resultado oficial':m.estado==='EN_VIVO'?'En vivo':m.estado==='EN_REVISION'?'Finalizado por Mesa':'Por programar';
 text(ctx,label,cx,y,fit(ctx,label,20,width,'Copa Sans'),C.muted,'center','Copa Sans');
}
export function bannerStage(bracket){if(bracket.champion)return 'champion';if(bracket.matches.slice(0,2).every(m=>m.decision)&&bracket.matches[2].teams.every(t=>t.id&&!t.pending))return 'final';return 'semifinals';}
function backdrop(ctx,bg){
 ctx.fillStyle=C.navy;ctx.fillRect(0,0,1080,1350);
 if(bg){const scale=Math.max(1080/bg.width,1350/bg.height);ctx.drawImage(bg,(1080-bg.width*scale)/2,(1350-bg.height*scale)/2,bg.width*scale,bg.height*scale);}
 const shade=ctx.createLinearGradient(0,0,0,1350);shade.addColorStop(0,'rgba(2,13,31,.78)');shade.addColorStop(.28,'rgba(2,13,31,.48)');shade.addColorStop(.6,'rgba(2,13,31,.38)');shade.addColorStop(1,'rgba(2,13,31,.88)');ctx.fillStyle=shade;ctx.fillRect(0,0,1080,1350);
 // Deterministic print grain preserves identical artwork between downloads.
 let seed=2026;for(let i=0;i<12000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%1080;seed=(seed*1664525+1013904223)>>>0;const y=seed%1350;ctx.fillStyle=i%2?'rgba(255,249,239,.025)':'rgba(0,0,0,.04)';ctx.fillRect(x,y,1,1);}
}
function header(ctx,bracket,assets,stage){
 polygon(ctx,[[0,0],[1080,0],[1080,10],[0,10]],C.gold);contain(ctx,assets.logo,54,51,166,166);
 display(ctx,'COPA CAJAMARCA',245,139,118,C.white,790);
 const edition=bracket.edition,label=edition?`ETAPA ${edition.stage.toUpperCase()} ${edition.year}`:'ETAPA POR CONFIRMAR';text(ctx,label,250,216,29,C.gold,'left','Copa Sans',770);
 polygon(ctx,[[0,254],[1080,229],[1080,345],[0,370]],'#071a36');path(ctx,[[0,254],[1080,229]],C.gold,3);
 const phase=stage==='semifinals'?'SEMIFINAL':stage==='final'?'FINAL':'CAMPEÓN';display(ctx,`${phase} · CATEGORÍA ${bracket.category}`,540,300,69,C.gold,954,'center');
}
function node(ctx,m,i,assets,cx,y,size,width,muted=false){
 const team=m.teams[i];ctx.save();ctx.globalAlpha=muted?.42:1;mark(ctx,team,assets,cx,y,size);
 const pendingFinal=team.pending&&size<80;
 teamName(ctx,team.name,cx,y+size+(pendingFinal?30:36),pendingFinal?116:width,pendingFinal?20:size>=160?37:28,team.pending?C.muted:m.decision?.winnerIndex===i?C.gold:C.white);
 if(m.goals?.[i]!==null&&m.goals?.[i]!==undefined){const bx=cx+size/2+5,by=y+size/2;ctx.fillStyle=C.navy;ctx.fillRect(bx-17,by-23,34,46);text(ctx,m.goals[i],bx,by,33,C.gold,'center');}ctx.restore();
}
function thirdPlace(ctx,m,assets){
 path(ctx,[[72,1080],[1008,1080]],'rgba(255,208,41,.38)',1);text(ctx,'TERCER PUESTO',540,1096,24,C.gold,'center');
 // Give each crest its own column above the name, including two-line names.
 m.teams.forEach((team,i)=>{
  const cx=i===0?300:780;
  mark(ctx,team,assets,cx,1114,60);
  teamName(ctx,team.pending?`Perdedor semifinal ${i+1}`:team.name,cx,1201,320,21,team.pending?C.muted:C.white);
 });
 text(ctx,m.goals?.every(g=>g!==null&&g!==undefined)?m.goals.join(' – '):'VS',540,1144,29,C.gold,'center');
 if(m.penalties?.every(n=>n!==null&&n!==undefined))text(ctx,`Penales ${m.penalties.join(' – ')}`,540,1176,17,C.muted,'center','Copa Sans');
}
function bracketPoster(ctx,bracket,assets,stage){
 const isFinal=stage==='final',final=bracket.matches[2],outerSize=isFinal?106:175,outerCx=isFinal?[110,970]:[159,921],innerSize=isFinal?190:62,innerCx=isFinal?[333,747]:[342,738];
 const top=isFinal?445:425,bottom=isFinal?850:775,innerY=isFinal?616:654,upper=top+outerSize/2,lower=bottom+outerSize/2,mid=(upper+lower)/2;
 text(ctx,'FINAL',540,isFinal?531:582,40,C.gold,'center');
 bracket.matches.slice(0,2).forEach((m,i)=>{
  const dir=i===0?1:-1,cx=outerCx[i],end=innerCx[i]-dir*(innerSize/2+12),edge=cx+dir*(outerSize/2+10),join=isFinal?(i===0?212:868):(i===0?276:804),ink=m.decision?C.gold:C.line;
  text(ctx,`SEMIFINAL ${i+1}`,cx,385,isFinal?27:32,isFinal?C.muted:C.gold,'center');
  path(ctx,[[edge,upper],[join,upper],[join,lower],[edge,lower]],ink);path(ctx,[[join,mid],[join,innerY+innerSize/2],[end,innerY+innerSize/2]],ink);
  node(ctx,m,0,assets,cx,top,outerSize,isFinal?180:222,isFinal&&m.decision?.winnerIndex!==0);node(ctx,m,1,assets,cx,bottom,outerSize,isFinal?180:222,isFinal&&m.decision?.winnerIndex!==1);
  node(ctx,final,i,assets,innerCx[i],innerY,innerSize,isFinal?205:116);caption(ctx,m,cx,isFinal?1040:1050,isFinal?220:250);
 });
 const cupW=isFinal?220:230,cupX=540-cupW/2,cupY=isFinal?608:620;
 ctx.save();ctx.shadowColor='rgba(0,0,0,.42)';ctx.shadowBlur=18;ctx.shadowOffsetY=10;contain(ctx,assets.cup,cupX,cupY,cupW,isFinal?275:282);ctx.restore();
 innerCx.forEach((cx,i)=>{const dir=i===0?1:-1,start=cx+dir*(innerSize/2+9),end=540-dir*(cupW/2+8);if(dir*(end-start)>0)path(ctx,[[start,innerY+innerSize/2],[end,innerY+innerSize/2]],C.gold,2);});
 if(isFinal&&final.goals?.every(g=>g!==null&&g!==undefined))text(ctx,final.goals.join(' – '),540,943,57,C.gold,'center');else display(ctx,isFinal?'LA GLORIA LOS ESPERA':'RUMBO A LA FINAL',540,955,isFinal?42:49,C.gold,isFinal?640:560,'center');
 caption(ctx,final,540,1008,570);thirdPlace(ctx,bracket.matches[3],assets);
}
function championPoster(ctx,bracket,assets){
 const glow=ctx.createRadialGradient(540,667,40,540,667,365);glow.addColorStop(0,'rgba(255,208,41,.24)');glow.addColorStop(1,'rgba(255,208,41,0)');ctx.fillStyle=glow;ctx.fillRect(175,360,730,730);
 mark(ctx,bracket.champion,assets,540,424,320);teamName(ctx,bracket.champion.name,540,821,900,89);contain(ctx,assets.cup,390,887,300,200);
 const m=bracket.matches[2];text(ctx,'RESULTADO DE LA FINAL',540,1120,27,C.gold,'center');teamName(ctx,m.teams[0].name,285,1166,350,32);text(ctx,m.goals.join(' – '),540,1166,49,C.gold,'center');teamName(ctx,m.teams[1].name,795,1166,350,32);
}
function signature(ctx){
 // Keep the web call-to-action separate from the sporting information above it.
 polygon(ctx,[[0,1228],[1080,1228],[1080,1350],[0,1350]],C.gold);
 text(ctx,'FIXTURE Y RESULTADOS',540,1252,17,C.navy,'center','Copa Sans');
 ctx.save();ctx.translate(540,1306);ctx.transform(1,0,-.06,1,0,0);text(ctx,'COPACAJAMARCA.COM',0,0,fit(ctx,'COPACAJAMARCA.COM',70,900),C.navy,'center');ctx.restore();
}
export function drawBracket(canvas,bracket,assets){canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d'),stage=bannerStage(bracket);backdrop(ctx,assets.bg);header(ctx,bracket,assets,stage);if(stage==='champion')championPoster(ctx,bracket,assets);else bracketPoster(ctx,bracket,assets,stage);signature(ctx);}
