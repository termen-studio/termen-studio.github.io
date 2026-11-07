// Барин, full concept: the gold thread that continues the first screen's line down the page and draws itself as you read,
// the entrances, a slow parallax on the big photographs, and ?font=pf to preview the titles in Playfair Display.
// The page reads in full without it: with motion off (or ?fx missing on a reduced-motion system) everything is shown drawn.
(() => {
  const root = document.documentElement, q = new URLSearchParams(location.search);
  if (q.get('font') === 'pf') root.classList.add('pf');
  const fx = q.has('fx');
  if (fx) root.classList.add('fx');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches && !fx;
  const wide = matchMedia('(min-width: 821px)');
  const NS = 'http://www.w3.org/2000/svg';
  const stack = document.querySelector('.hero .stack');
  const svg = document.querySelector('.thread'), path = svg.querySelector('path');
  let samples = [], total = 0, dots = [];

  // the spine is the x of the first screen's vertical line (4.5% into the photo stack); the chapters line their columns up on it
  const spineX = () => { const r = stack.getBoundingClientRect(); return r.left + r.width * .045 + scrollX; };

  function build() {
    root.style.setProperty('--spine', spineX() + 'px');
    dots.forEach(d => d.c.remove()); dots = []; samples = [];
    if (!wide.matches) return;
    const H = root.scrollHeight, W = root.clientWidth;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.style.height = H + 'px';
    const s = stack.getBoundingClientRect();
    const pts = [{ x: spineX(), y: s.bottom + scrollY }];
    for (const m of document.querySelectorAll('.mk')) {
      const b = m.getBoundingClientRect(), p = { x: b.left + scrollX, y: b.top + scrollY, el: m }, last = pts[pts.length - 1];
      if (Math.abs(p.x - last.x) > .5 && Math.abs(p.y - last.y) > .5)   // an L-shaped move: down then across, or across then down
        pts.push(m.dataset.turn === 'h' ? { x: p.x, y: last.y } : { x: last.x, y: p.y });
      pts.push(p);
    }
    // straight runs with rounded corners, like a line on a map
    const R = Math.min(72, innerWidth * .028);
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = c ? Math.hypot(c.x - b.x, c.y - b.y) : 0;
      if (c && l1 > 1 && l2 > 1 && Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 1) {
        const k = Math.min(R, l1 / 2, l2 / 2);
        d += ` L${b.x - (b.x - a.x) / l1 * k},${b.y - (b.y - a.y) / l1 * k} Q${b.x},${b.y} ${b.x + (c.x - b.x) / l2 * k},${b.y + (c.y - b.y) / l2 * k}`;
      } else if (l1 > .5) d += ` L${b.x},${b.y}`;
    }
    path.setAttribute('d', d);
    total = path.getTotalLength();
    const N = Math.max(240, Math.round(total / 5));
    for (let i = 0; i <= N; i++) { const L = total * i / N, p = path.getPointAtLength(L); samples.push({ L, x: p.x, y: p.y }); }
    for (const p of pts) {
      if (!p.el || !p.el.hasAttribute('data-dot')) continue;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', p.el.dataset.dot === 'big' ? 5 : 3.5);
      svg.appendChild(c);
      let L = 0, best = 1e9;
      for (const t of samples) { const e = Math.hypot(t.x - p.x, t.y - p.y); if (e < best) { best = e; L = t.L; } }
      dots.push({ c, L, li: p.el.parentElement.tagName === 'LI' ? p.el.parentElement : null });
    }
    path.style.strokeDasharray = `${total} ${total}`;
    draw(true);
  }

  // drawn up to the reading line, a little above the middle of the screen; the path only ever runs down or across
  function draw(now) {
    if (!samples.length) return;
    let L = total;
    if (!still) {
      const line = scrollY + innerHeight * .6;
      L = 0;
      for (const t of samples) { if (t.y > line + .5) break; L = t.L; }
    }
    if (now) path.style.transition = 'none';
    path.style.strokeDashoffset = total - L;
    if (now) { path.getBoundingClientRect(); path.style.transition = ''; }
    for (const d of dots) { const on = L >= d.L - 2; d.c.classList.toggle('lit', on); if (d.li) d.li.classList.toggle('lit', on); }
  }

  // the big photographs move a little slower than the page
  const par = [...document.querySelectorAll('[data-par] > img')];
  function parallax() {
    if (still) return;
    for (const im of par) {
      const b = im.parentElement.getBoundingClientRect();
      if (b.bottom < -200 || b.top > innerHeight + 200) continue;
      const p = (b.top + b.height / 2 - innerHeight / 2) / innerHeight;
      im.style.transform = `translate3d(0, ${(p * -b.height * .07).toFixed(1)}px, 0)`;
    }
  }

  // entrances: each part rises (or opens through its mask) once, in order within its group
  const parts = [...document.querySelectorAll('[data-rise]')];
  if (still) parts.forEach(el => el.classList.add('in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, group = [...el.parentElement.children].filter(x => x.hasAttribute('data-rise'));
      el.style.transitionDelay = Math.max(0, group.indexOf(el)) * 90 + 'ms';
      el.classList.add('in'); io.unobserve(el);
    }), { rootMargin: '0px 0px -8% 0px' });
    parts.forEach(el => io.observe(el));
  }

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { draw(); parallax(); ticking = false; });
  }, { passive: true });
  let t;
  const later = () => { clearTimeout(t); t = setTimeout(() => { build(); parallax(); }, 120); };
  addEventListener('resize', later);
  new ResizeObserver(later).observe(document.body);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(later);
  build(); parallax();
})();
