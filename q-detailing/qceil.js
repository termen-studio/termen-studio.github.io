/* Q-Detailing «Потолок Q»: the studio's hexagon ceiling as the whole first screen.
   The lamps switch on in a wave and light the car; the lamps near the cursor (or a tap) burn brighter. */
(() => {
  const scene = document.querySelector('[data-ceil]');
  if (!scene) return;
  const canvas = scene.querySelector('[data-ceil-canvas]');
  const video = scene.querySelector('video');
  const poster = new Image();
  poster.src = video.getAttribute('poster');
  const hint = scene.querySelector('[data-ceil-hint]');
  const ctx = canvas.getContext('2d');
  const root = document.documentElement;
  const calm = root.classList.contains('calm');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (hint) hint.textContent = fine ? 'Ведите курсором по машине' : 'Нажмите на машину';

  let W = 0, H = 0, R = 0, dpr = 1, cells = [];
  let px = -1e4, py = -1e4, tx = -1e4, ty = -1e4, user = false, lastMove = 0, t0 = performance.now(), seen = true;

  const layout = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = scene.clientWidth; H = scene.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    R = Math.max(40, Math.min(66, W * 0.042));
    const w = Math.sqrt(3) * R, cx = W / 2, cy = H * 0.46;
    cells = [];
    for (let row = -1, y = -R; y < H + R * 2; row++, y += 1.5 * R) {
      for (let x = (row & 1 ? w / 2 : 0) - w; x < W + w; x += w) {
        const ring = Math.hypot(x - cx, y - cy) / w;
        cells.push({ x, y, i: 0, g: 0, on: 350 + ring * 55 + Math.random() * 160 });
      }
    }
  };

  const hex = (x, y, r) => {
    ctx.moveTo(x, y + r);
    for (let k = 1; k < 6; k++) { const a = Math.PI / 180 * (90 + 60 * k); ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    ctx.closePath();
  };

  const cover = (src, sw, sh) => {
    const s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  };

  const aim = (e) => {
    const b = scene.getBoundingClientRect();
    tx = e.clientX - b.left; ty = e.clientY - b.top;
    user = true; lastMove = performance.now();
    if (hint) hint.classList.add('is-gone');
  };
  scene.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') aim(e); });
  scene.addEventListener('pointerdown', (e) => { aim(e); if (e.pointerType !== 'mouse') setTimeout(() => { user = false; }, 1600); });
  scene.addEventListener('pointerleave', () => { user = false; });
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; }).observe(scene);
  addEventListener('resize', layout);
  layout();
  if (calm) t0 -= 1e5;   // no wave: every lamp is already on

  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!seen) return;
    const el = now - t0;
    px += (tx - px) * (px < -1e3 ? 1 : 0.14); py += (ty - py) * (py < -1e3 ? 1 : 0.14);
    const reach = R * 3.8;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (video.readyState >= 2) cover(video, video.videoWidth, video.videoHeight);
    else if (poster.complete && poster.naturalWidth) cover(poster, poster.naturalWidth, poster.naturalHeight);

    // the wave: every cell is black until its lamp switches on, then the car is lit in full
    for (const c of cells) {
      const since = el - c.on;
      c.i += ((since < 0 ? 0 : 1) - c.i) * 0.2;
      if (c.i > 0.995) continue;
      ctx.beginPath(); hex(c.x, c.y, R + 0.8);
      ctx.fillStyle = `rgba(4,5,6,${(1 - c.i).toFixed(3)})`;
      ctx.fill();
      ctx.lineWidth = 1;   // a lamp that is still off shows as a faint outline
      ctx.strokeStyle = `rgba(238,240,238,${(0.06 * (1 - c.i)).toFixed(3)})`;
      ctx.beginPath(); hex(c.x, c.y, R); ctx.stroke();
    }

    // the lamps glow: as each one switches on, and later only around the cursor, like their reflections in paint
    ctx.shadowColor = 'rgba(143,208,255,0.95)';
    for (const c of cells) {
      const since = el - c.on;
      const flash = since < 0 ? 0 : Math.max(0, 1 - since / 900);
      const near = user ? Math.pow(Math.max(0, 1 - Math.hypot(c.x - px, c.y - py) / reach), 1.5) : 0;
      c.g += (near - c.g) * 0.12;
      const a = Math.max(flash, c.g * 0.85);
      if (a < 0.03) continue;
      if (c.g > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); hex(c.x, c.y, R * 0.985);
        ctx.fillStyle = `rgba(205,232,255,${(0.07 * c.g).toFixed(3)})`;
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.lineWidth = 1.4 + 1.2 * a;
      ctx.shadowBlur = 14 * a;
      ctx.strokeStyle = `rgba(236,247,255,${(0.9 * a).toFixed(3)})`;
      ctx.beginPath(); hex(c.x, c.y, R); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };
  requestAnimationFrame(frame);
})();
