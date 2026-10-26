/* Q-Detailing only: the polishing light, the protection map and the works cards. Runs after main.js. */
(() => {
  const root = document.documentElement;
  const calm = root.classList.contains('calm');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- First screen: a hexagon of studio light polishes the paint under the cursor ---------- */
  const stage = document.querySelector('[data-polish]');
  if (stage) {
    const after = stage.querySelector('[data-polish-after]');
    const ring = stage.querySelector('[data-polish-ring]');
    const hint = stage.querySelector('[data-polish-hint]');
    const [base, copy] = stage.querySelectorAll('video');
    if (hint) hint.textContent = fine ? 'Ведите курсором' : 'Нажмите на машину';
    let tx = 0.5, ty = 0.46, x = tx, y = ty, user = false, t0 = performance.now(), seen = true;
    const aim = (e) => {
      const b = stage.getBoundingClientRect();
      tx = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
      ty = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
      user = true;
    };
    stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') aim(e); });
    stage.addEventListener('pointerdown', aim);
    stage.addEventListener('pointerleave', () => { user = false; t0 = performance.now(); });
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; }).observe(stage);
    const draw = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      const r = Math.min(w, h) * (w < 600 ? 0.34 : 0.3);
      const cx = x * w, cy = y * h, pts = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 180 * (90 + 60 * k);
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)}px ${(cy + r * Math.sin(a)).toFixed(1)}px`);
      }
      after.style.clipPath = `polygon(${pts.join(',')})`;
      ring.style.width = ring.style.height = `${(2 * r).toFixed(1)}px`;
      ring.style.transform = `translate(${(cx - r).toFixed(1)}px, ${(cy - r).toFixed(1)}px)`;
    };
    const loop = (now) => {
      if (seen) {
        if (!user && !calm) {   // wander slowly, so the light is noticed before anyone moves the mouse
          const s = (now - t0) / 1000;
          tx = 0.5 + 0.2 * Math.sin(s * 0.55);
          ty = 0.46 + 0.14 * Math.sin(s * 0.8 + 1.2);
        }
        x += (tx - x) * 0.12;
        y += (ty - y) * 0.12;
        draw();
      }
      requestAnimationFrame(loop);
    };
    draw();
    requestAnimationFrame(loop);
    addEventListener('resize', draw);
    // the polished copy plays the same file; keep it in step with the dull one
    if (base && copy) setInterval(() => { if (!base.paused && Math.abs(base.currentTime - copy.currentTime) > 0.06) copy.currentTime = base.currentTime; }, 500);
  }

  /* ---------- Protection map: one zone at a time, from a dot or from the legend ---------- */
  const map = document.querySelector('[data-map]');
  if (map) {
    const dots = [...map.querySelectorAll('.qmap__dot')];
    const items = [...map.querySelectorAll('.qmap__item')];
    const tip = map.querySelector('[data-tip]');
    const pick = (k) => {
      const d = dots[k];
      dots.forEach((el, j) => el.classList.toggle('is-on', j === k));
      items.forEach((el, j) => el.classList.toggle('is-on', j === k));
      tip.style.setProperty('--x', d.style.getPropertyValue('--x'));
      tip.style.setProperty('--y', d.style.getPropertyValue('--y'));
      tip.dataset.side = d.dataset.side;
      tip.querySelector('[data-tip-zone]').textContent = d.dataset.zone;
      tip.querySelector('[data-tip-what]').textContent = d.dataset.what;
      tip.querySelector('[data-tip-price]').textContent = d.dataset.price;
    };
    dots.forEach((d, k) => { d.addEventListener('click', () => pick(k)); d.addEventListener('mouseenter', () => pick(k)); d.addEventListener('focus', () => pick(k)); });
    items.forEach((it, k) => { it.addEventListener('click', () => pick(k)); it.addEventListener('mouseenter', () => pick(k)); });
  }

  /* ---------- Works: the card in focus plays, its car's name is drawn behind the row ---------- */
  const works = document.querySelector('[data-works]');
  if (works) {
    const cards = [...works.querySelectorAll('.qworks__card')];
    const big = works.querySelector('[data-works-big]');
    let on = 0, seen = false;
    const play = () => cards.forEach((c, j) => {
      const v = c.querySelector('video');
      if (j === on && seen && !calm) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
    });
    const pick = (k) => {
      if (k === on) return;
      on = k;
      cards.forEach((c, j) => c.classList.toggle('is-on', j === k));
      big.style.opacity = '0';
      setTimeout(() => { big.textContent = cards[k].dataset.big; big.style.opacity = '1'; }, 180);
      play();
    };
    cards.forEach((c, k) => { c.addEventListener('mouseenter', () => pick(k)); c.addEventListener('click', () => pick(k)); });
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; play(); }, { threshold: 0.2 }).observe(works);
  }
})();
