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
    loadImage('/assets/img/copa-eliminatorias-poster.svg?v=2'),
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
 const label=pens||[date,m.cancha].filter(Boolean).join(' · ')||(m.estado==='OFICIAL'?'Resultado oficial':m.estado==='EN_VIVO'?'En vivo':'Por programar');
 text(ctx,label,cx,y,fit(ctx,label,22,width,'Copa Sans'),C.muted,'center','Copa Sans');
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
 display(ctx,'COPA',257,69,78,C.white,760);display(ctx,'CAJAMARCA',245,159,140,C.white,780);
 const edition=bracket.edition,label=edition?`ETAPA ${edition.stage.toUpperCase()} ${edition.year}`:'ETAPA POR CONFIRMAR';text(ctx,label,250,243,29,C.gold,'left','Copa Sans',770);
 polygon(ctx,[[0,276],[1080,251],[1080,340],[0,365]],'#071a36');path(ctx,[[0,276],[1080,251]],C.gold,3);
 const phase=stage==='semifinals'?'SEMIFINAL':stage==='final'?'FINAL':'CAMPEÓN';display(ctx,`${phase} · CATEGORÍA ${bracket.category}`,540,309,73,C.gold,954,'center');
}
function node(ctx,m,i,assets,cx,y,size,width,muted=false){
 const team=m.teams[i];ctx.save();ctx.globalAlpha=muted?.42:1;mark(ctx,team,assets,cx,y,size);
 teamName(ctx,team.name,cx,y+size+36,width,size>=160?37:28,team.pending?C.muted:m.decision?.winnerIndex===i?C.gold:C.white);
 if(m.goals?.[i]!==null&&m.goals?.[i]!==undefined){const bx=cx+size/2+5,by=y+size/2;ctx.fillStyle=C.navy;ctx.fillRect(bx-17,by-23,34,46);text(ctx,m.goals[i],bx,by,33,C.gold,'center');}ctx.restore();
}
function thirdPlace(ctx,m,assets){
 path(ctx,[[54,1108],[1026,1108]],'rgba(255,208,41,.45)',1);text(ctx,'TERCER PUESTO',540,1130,27,C.gold,'center');
 m.teams.forEach((team,i)=>{const cx=i===0?300:780;if(!team.pending)mark(ctx,team,assets,cx-130,1141,42);teamName(ctx,team.pending?`Perdedor semifinal ${i+1}`:team.name,cx+(team.pending?0:20),1162,320,27);});
 text(ctx,m.goals?.every(g=>g!==null&&g!==undefined)?m.goals.join(' – '):'VS',540,1162,30,C.gold,'center');
}
function bracketPoster(ctx,bracket,assets,stage){
 const isFinal=stage==='final',final=bracket.matches[2],outerSize=isFinal?106:192,outerCx=isFinal?[110,970]:[159,921],innerSize=isFinal?190:70,innerCx=isFinal?[333,747]:[322,758];
 const top=isFinal?445:414,bottom=isFinal?872:823,innerY=isFinal?616:654,upper=top+outerSize/2,lower=bottom+outerSize/2,mid=(upper+lower)/2;
 text(ctx,'FINAL',540,isFinal?531:582,40,C.gold,'center');
 bracket.matches.slice(0,2).forEach((m,i)=>{
  const dir=i===0?1:-1,cx=outerCx[i],end=innerCx[i]-dir*(innerSize/2+12),edge=cx+dir*(outerSize/2+10),join=isFinal?(i===0?212:868):(i===0?276:804),ink=m.decision?C.gold:C.line;
  text(ctx,`SEMIFINAL ${i+1}`,cx,385,isFinal?27:32,isFinal?C.muted:C.gold,'center');
  path(ctx,[[edge,upper],[join,upper],[join,lower],[edge,lower]],ink);path(ctx,[[join,mid],[join,innerY+innerSize/2],[end,innerY+innerSize/2]],ink);
  node(ctx,m,0,assets,cx,top,outerSize,isFinal?180:222,isFinal&&m.decision?.winnerIndex!==0);node(ctx,m,1,assets,cx,bottom,outerSize,isFinal?180:222,isFinal&&m.decision?.winnerIndex!==1);
  node(ctx,final,i,assets,innerCx[i],innerY,innerSize,isFinal?205:142);caption(ctx,m,cx,1083,205);
 });
 const cupW=isFinal?220:256,cupX=540-cupW/2,cupY=isFinal?608:608;
 const glow=ctx.createRadialGradient(540,745,20,540,745,225);glow.addColorStop(0,'rgba(255,208,41,.14)');glow.addColorStop(1,'rgba(255,208,41,0)');ctx.fillStyle=glow;ctx.fillRect(315,520,450,450);contain(ctx,assets.cup,cupX,cupY,cupW,isFinal?275:300);
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
 // A full-width printed signature gives the address its own visual weight.
 polygon(ctx,[[0,1205],[1080,1182],[1080,1350],[0,1350]],C.gold);text(ctx,'FIXTURE Y RESULTADOS EN',54,1230,20,C.navy,'left','Copa Sans');
 ctx.save();ctx.translate(52,1290);ctx.transform(1,0,-.09,1,0,0);text(ctx,'COPACAJAMARCA.COM',0,0,fit(ctx,'COPACAJAMARCA.COM',110,976),C.navy);ctx.restore();
}
export function drawBracket(canvas,bracket,assets){canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d'),stage=bannerStage(bracket);backdrop(ctx,assets.bg);header(ctx,bracket,assets,stage);if(stage==='champion')championPoster(ctx,bracket,assets);else bracketPoster(ctx,bracket,assets,stage);signature(ctx);}
