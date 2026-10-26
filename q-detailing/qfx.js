/* Q-Detailing finishing touches: the lamp glint in the title, the hexagon cursor, magnetic buttons,
   and the running line of cars that speeds up and leans with the scroll. */
(() => {
  const root = document.documentElement;
  const calm = root.classList.contains('calm');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let mouseX = -1e4, mouseY = -1e4, moved = 0;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouseX = e.clientX; mouseY = e.clientY; moved = performance.now(); } }, { passive: true });

  /* ---------- the glint: a lamp reflection runs over the title; with a mouse it follows the cursor ---------- */
  const title = document.querySelector('.ceil__title');
  const shine = title && title.querySelector('.ceil__shine');
  let g = -20;
  const t0 = performance.now();
  const glint = (now) => {
    const b = title.getBoundingClientRect();
    const near = fine && now - moved < 2500 && mouseY > b.top - 160 && mouseY < b.bottom + 160;
    let target;
    if (near) target = ((mouseX - b.left) / b.width) * 100;
    else {
      const cycle = ((now - t0 - 2600) % 6000 + 6000) % 6000;   // a pass every six seconds, after the title is in
      target = cycle < 1600 ? -20 + (cycle / 1600) * 140 : 120;
      if (cycle < 40) g = -20;
    }
    g += (target - g) * (near ? 0.2 : 0.12);
    shine.style.setProperty('--g', g.toFixed(1) + '%');
  };
  if (shine && !calm) setTimeout(() => shine.style.setProperty('--so', '1'), 2600);

  /* ---------- hexagon cursor ---------- */
  let cursor = null, cx = -100, cy = -100;
  if (fine && !calm) {
    cursor = document.createElement('div');
    cursor.className = 'qcursor is-out';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<svg viewBox="0 0 40 40"><polygon points="20,1 36.5,10.5 36.5,29.5 20,39 3.5,29.5 3.5,10.5"/></svg>';
    document.body.appendChild(cursor);
    root.classList.add('has-qcursor');
    document.addEventListener('pointerover', (e) => { cursor.classList.toggle('is-hot', !!e.target.closest('a, button')); });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-out'));
  }

  /* ---------- magnetic buttons ---------- */
  if (fine && !calm) {
    document.querySelectorAll('[data-magnet]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const b = el.getBoundingClientRect();
        const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
        el.classList.add('is-pull');
        el.style.translate = `${(dx * 0.28).toFixed(1)}px ${(dy * 0.4).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('is-pull'); el.style.translate = ''; });
    });
  }

  /* ---------- running line: speeds up and leans with the scroll ---------- */
  const track = document.querySelector('[data-run]');
  let x = 0, lastY = scrollY, vel = 0, skew = 0, half = 0;
  const measure = () => { if (track) half = track.scrollWidth / 2; };
  measure();
  addEventListener('resize', measure);
  if (document.fonts) document.fonts.ready.then(measure);

  const frame = (now) => {
    requestAnimationFrame(frame);
    if (shine && !calm) glint(now);
    if (cursor) {
      cx += (mouseX - cx) * 0.3; cy += (mouseY - cy) * 0.3;
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      if (now - moved < 100) cursor.classList.remove('is-out');
    }
    if (track && half && !calm) {
      const dy = scrollY - lastY; lastY = scrollY;
      vel += (dy - vel) * 0.1;
      skew += (Math.max(-7, Math.min(7, -vel * 0.35)) - skew) * 0.1;
      x -= 0.55 + Math.abs(vel) * 0.45;
      if (-x >= half) x += half;
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
    }
  };
  requestAnimationFrame(frame);
})();
