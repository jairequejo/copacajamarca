import { supabase } from './supabase.js';

/* Ripple on tap */
function initRipple() {
  document.querySelectorAll('.nav-card').forEach(card => {
    card.addEventListener('pointerdown', e => {
      const r = document.createElement('span');
      const rect = card.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6;
      r.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;
        border-radius:50%;background:rgba(255,255,255,.08);
        transform:translate(-50%,-50%) scale(0);
        left:${e.clientX - rect.left}px;top:${e.clientY - rect.top}px;
        pointer-events:none;z-index:0;
        animation:ripple .55s ease-out forwards;
      `;
      card.style.position = 'relative';
      card.appendChild(r);
      setTimeout(() => r.remove(), 600);
    });
  });

  if (!document.getElementById('ripple-style')) {
    const s = document.createElement('style');
    s.id = 'ripple-style';
    s.textContent = '@keyframes ripple{to{transform:translate(-50%,-50%) scale(1);opacity:0}}';
    document.head.appendChild(s);
  }
}

async function loadMarquee() {
  try {
    const { data: equipos } = await supabase
      .from('equipos')
      .select('logo_url')
      .not('logo_url', 'is', null)
      .limit(30);

    if (!equipos || equipos.length === 0) return;
    
    const track = document.getElementById('marqueeTrack');
    const track2 = document.getElementById('marqueeTrack2');
    if (!track || !track2) return;

    let html = '';
    equipos.forEach(eq => {
      const src = eq.logo_url || 'assets/img/logo.png';
      html += `<img src="${src}" alt="Logo" onerror="this.style.display='none'">`;
    });
    

    track.innerHTML = html;
    track2.innerHTML = html;
    
    // Force reflow and add animation class for Safari WebKit fix
    requestAnimationFrame(() => {
      track.classList.add('running');
      track2.classList.add('running');
    });

  } catch(e) {
    console.error('Error fetching logos:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRipple();
  loadMarquee();
});
