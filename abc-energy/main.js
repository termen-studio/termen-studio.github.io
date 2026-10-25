(() => {
  const root = document.documentElement;
  const motion = root.classList.contains('motion');
  const calm = root.classList.contains('calm'); // reduced motion: keep the films, drop flashes and shakes
  const behavior = motion && !calm ? 'smooth' : 'auto';

  /* ---------- Smooth wheel scrolling (Lenis): mouse only, off with reduced motion ---------- */
  if (motion && !calm && window.Lenis && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09, anchors: true });
    if (!root.classList.contains('is-ready')) {
      lenis.stop();
      new MutationObserver((m, o) => { if (root.classList.contains('is-ready')) { o.disconnect(); lenis.start(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
    }
  }
  const ready = () => root.classList.add('is-ready');
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const theme = document.body.dataset.theme || 'avr';

  /* ---------- Intro: power-up, waits for the first hero clip ---------- */
  const intro = document.querySelector('.intro');
  const firstClip = document.querySelector('[data-hero-video]');
  if (!motion || !intro) {
    ready();
  } else {
    const volt = intro.querySelector('[data-volt]');
    const lamp1 = intro.querySelector('[data-lamp="1"]');
    const lamp2 = intro.querySelector('[data-lamp="2"]');
    let loaded = !firstClip || firstClip.readyState >= 3;
    if (firstClip) {
      firstClip.addEventListener('canplaythrough', () => { loaded = true; }, { once: true });
      firstClip.addEventListener('loadeddata', () => { if (firstClip.readyState >= 3) loaded = true; });
    }
    const t0 = performance.now(), MIN = 1500, MAX = 3000;
    let shown = 0;
    const tick = (now) => {
      const el = now - t0;
      const cap = loaded || el > MAX ? 1 : Math.min(0.92, el / MAX);    // hold below 400 V until the clip can play
      const goal = Math.min(cap, el / MIN);
      shown += (goal - shown) * 0.18;
      if (goal >= 1 && shown > 0.995) shown = 1;
      if (theme === 'stab') {
        if (!tick.last || now - tick.last > 70 || shown >= 1) {
          tick.last = now;
          const amp = 46 * (1 - ease(shown));
          const val = shown >= 1 ? 220 : Math.round(220 + (Math.random() * 2 - 1) * amp);
          volt.textContent = String(val);
          lamp1.classList.toggle('is-warn', shown < 1 && Math.abs(val - 220) > 8);
        }
        lamp1.classList.toggle('is-on', shown >= 1);
        lamp2.classList.toggle('is-on', shown >= 1);
      } else {
        const maxV = +intro.dataset.max || 400;
        volt.textContent = String(Math.round(ease(shown) * maxV)).padStart(String(maxV).length, '0');
        lamp1.classList.toggle('is-on', shown > 0.55);
        lamp2.classList.toggle('is-on', shown >= 1);
      }
      if (shown < 1) { requestAnimationFrame(tick); return; }
      setTimeout(() => {
        intro.classList.add('is-open');
        setTimeout(ready, 360);
        setTimeout(() => intro.classList.add('is-gone'), 1300);
      }, 260);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Loops play only on screen ---------- */
  const loops = [...document.querySelectorAll('video[data-loop]')];
  if (!motion) {
    loops.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
    document.querySelectorAll('[data-clip]').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else { v.pause(); }
      }
    }, { rootMargin: '200px 0px' });
    loops.forEach((v) => vio.observe(v));
  }

  /* ---------- Hero: the clips switch like an АВР does ---------- */
  const hero = document.querySelector('[data-hero]');
  if (hero) {
    const clips = [...hero.querySelectorAll('[data-clip]')];
    const power = hero.querySelector('[data-power]');
    const film = hero.querySelector('.hero__film');
    const cap = hero.querySelector('[data-cap]');
    const tc = hero.querySelector('[data-tc]');
    const rows = { 1: hero.querySelector('[data-in="1"]'), 2: hero.querySelector('[data-in="2"]') };
    const STATE = { on: ['is-on', 'в работе'], off: ['is-off', 'нет напряжения'], switch: ['is-switch', 'переключение'], standby: ['', 'резерв'] };
    const HOLD = clips.map((c, k) => +c.dataset.hold || [6500, 2600, 5200][k] || 5000);
    let i = 0, visible = true, timer = 0;
    const setHud = (clip) => {
      if (theme === 'stab') { if (cap) cap.textContent = clip.dataset.cap; return; }
      for (const n of [1, 2]) {
        const [cls, text] = STATE[clip.dataset['in' + n]] || STATE.standby;
        const row = rows[n];
        row.classList.remove('is-on', 'is-off', 'is-switch');
        if (cls) row.classList.add(cls);
        row.querySelector('[data-state]').textContent = text;
      }
      if (cap) cap.textContent = clip.dataset.cap;
    };
    const show = (n) => {
      clips.forEach((c, k) => c.classList.toggle('is-on', k === n));
      const c = clips[n];
      try { c.currentTime = 0; } catch (e) { /* not seekable yet */ }
      const p = c.play(); if (p) p.catch(() => {});
      clips.forEach((o, k) => { if (k !== n) o.pause(); });
      setHud(c);
    };
    const next = () => {
      if (!visible || document.hidden) { timer = setTimeout(next, 800); return; }
      const n = (i + 1) % clips.length;
      if (power.animate && !calm) {
        power.animate([{ opacity: 0 }, { opacity: 0.92, offset: 0.1 }, { opacity: 0.25, offset: 0.2 }, { opacity: 1, offset: 0.34 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 620, easing: 'linear' });
        film.animate([{ transform: 'none' }, { transform: 'translate3d(-3px, 1px, 0) scale(1.004)', offset: 0.12 }, { transform: 'translate3d(2px, -1px, 0)', offset: 0.24 }, { transform: 'none', offset: 0.4 }, { transform: 'none' }], { duration: 620 });
        setTimeout(() => show(n), 280);
      } else { show(n); }
      i = n;
      timer = setTimeout(next, HOLD[n] || 5000);
    };
    if (theme === 'stab' && motion) {
      const inRow = rows[1], outRow = rows[2];
      let v = 214;
      outRow.classList.add('is-on'); outRow.querySelector('[data-state]').textContent = '220 В';
      setInterval(() => {
        if (document.hidden) return;
        v += (Math.random() - 0.5) * 12 + (220 - v) * 0.06 + (Math.random() < 0.07 ? (Math.random() - 0.5) * 56 : 0);
        v = Math.max(176, Math.min(252, v));
        const d = Math.round(v), far = Math.abs(d - 220) > 12;
        inRow.querySelector('[data-state]').textContent = d + ' В';
        inRow.classList.toggle('is-switch', far); inRow.classList.toggle('is-on', !far);
      }, 380);
    }
    if (motion && clips.length > 1) {
      setHud(clips[0]);
      const start = () => { clearTimeout(timer); timer = setTimeout(next, HOLD[0]); };
      if (root.classList.contains('is-ready')) start(); else new MutationObserver((m, o) => { if (root.classList.contains('is-ready')) { o.disconnect(); start(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (!visible) clips.forEach((c) => c.pause()); else { const p = clips[i].play(); if (p) p.catch(() => {}); } }).observe(hero);
      setInterval(() => {
        const c = clips[i];
        if (!c || !tc) return;
        const s = Math.floor(c.currentTime || 0);
        tc.textContent = `00:${String(s).padStart(2, '0')}`;
      }, 250);
    }
  }

  /* ---------- Reveals, once ---------- */
  const revealSel = '[data-chapter], [data-reveal], .sched__list, .visit, [data-reveal-section]';
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    document.querySelectorAll(revealSel).forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll(revealSel).forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Chapters: each film slides over the previous one ---------- */
  const chs = [...document.querySelectorAll('[data-chapter]')];
  if (motion && chs.length > 1) {
    let q = false;
    const stack = () => {
      q = false;
      for (let k = 0; k < chs.length - 1; k++) {
        const inner = chs[k].firstElementChild;
        const top = chs[k + 1].getBoundingClientRect().top;
        const p = Math.min(1, Math.max(0, 1 - top / innerHeight));
        inner.style.transform = p > 0 ? `scale(${(1 - 0.07 * p).toFixed(4)})` : '';
        inner.style.filter = p > 0 ? `brightness(${(1 - 0.7 * p).toFixed(3)})` : '';
      }
    };
    addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(stack); } }, { passive: true });
    stack();
  }

  /* ---------- Price board: the row you point at plays its own film ---------- */
  const boardEl = document.querySelector('[data-board]');
  if (boardEl) {
    const rowsB = [...boardEl.querySelectorAll('.board__row')];
    const clipsB = [...boardEl.querySelectorAll('.board__clip')];
    const capB = boardEl.querySelector('[data-board-cap]');
    let activeB = 0, seen = false;
    const setB = (k) => {
      if (k === activeB && seen) return;
      activeB = k;
      rowsB.forEach((r, j) => r.classList.toggle('is-on', j === k));
      clipsB.forEach((c, j) => {
        c.classList.toggle('is-on', j === k);
        if (j === k && motion && seen) { const pr = c.play(); if (pr) pr.catch(() => {}); } else if (j !== k) c.pause();
      });
      if (capB) capB.textContent = clipsB[k].dataset.cap;
    };
    rowsB.forEach((r, k) => {
      r.addEventListener('mouseenter', () => setB(k));
      r.firstElementChild.addEventListener('focus', () => setB(k));
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        for (const e of es) {
          seen = e.isIntersecting;
          const c = clipsB[activeB];
          if (seen && motion) { const pr = c.play(); if (pr) pr.catch(() => {}); } else c.pause();
          if (seen) boardEl.classList.add('is-in');
        }
      }, { threshold: 0.2 }).observe(boardEl);
      if (matchMedia('(hover: none)').matches) {
        const rio = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) setB(rowsB.indexOf(e.target)); }, { rootMargin: '-45% 0px -45% 0px' });
        rowsB.forEach((r) => rio.observe(r));
      }
    } else boardEl.classList.add('is-in');
  }

  /* ---------- Mouse drag for sideways rows ---------- */
  const dragScroll = (el, settle) => {
    let down = false, sx = 0, sl = 0, moved = false;
    el.style.cursor = 'grab';
    el.addEventListener('dragstart', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl = el.scrollLeft;
      el.style.scrollSnapType = 'none'; el.style.cursor = 'grabbing';
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { if (!down) return; down = false; el.style.cursor = 'grab'; settle(); });
    el.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  };

  /* ---------- Catalogue: line-up on an arc ---------- */
  const arc = document.querySelector('[data-arc]');
  if (arc) {
    const track = arc.querySelector('.arc__track');
    const items = [...track.querySelectorAll('.arc__item')];
    const nameEl = arc.querySelector('[data-arc-name]');
    const whatEl = arc.querySelector('[data-arc-what]');
    const priceEl = arc.querySelector('[data-arc-price]');
    const ask = arc.querySelector('[data-arc-ask]');
    let current = -1, queued = false;
    const centre = (k) => {
      const it = items[k];
      track.style.scrollSnapType = '';
      track.scrollTo({ left: it.offsetLeft + it.offsetWidth / 2 - track.clientWidth / 2, behavior });
    };
    const place = () => {
      queued = false;
      const tr = track.getBoundingClientRect();
      const cx = tr.left + tr.width / 2;
      const step = items[0].getBoundingClientRect().width || 1;
      let best = 0, bestD = Infinity;
      items.forEach((it, k) => {
        const r = it.getBoundingClientRect();
        const d = (r.left + r.width / 2 - cx) / step;
        const ad = Math.abs(d);
        if (ad < bestD) { bestD = ad; best = k; }
        const q = Math.round(d);
        const y = q === 0 ? 0 : (Math.abs(q) % 2 ? -22 : 14) * Math.min(ad, 1);
        const s = Math.pow(0.7, Math.min(ad, 3.2));
        const b = Math.max(0.18, 1 - 0.27 * Math.min(ad, 3.2));
        const pick = it.firstElementChild;
        pick.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
        pick.style.filter = `brightness(${b.toFixed(2)})`;
      });
      if (best !== current) {
        current = best;
        const it = items[best];
        nameEl.textContent = it.dataset.name;
        whatEl.textContent = it.dataset.what;
        priceEl.textContent = it.dataset.price;
        arc.style.setProperty('--arc-bg', it.dataset.tone);
        ask.href = 'mailto:info@meselectro.ru?subject=' + encodeURIComponent('Счёт: ' + it.dataset.name.replace(/ /g, ' '));
        items.forEach((x, k) => x.toggleAttribute('aria-current', k === best));
        if (motion && priceEl.animate) priceEl.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    };
    track.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(place); } }, { passive: true });
    addEventListener('resize', place);
    items.forEach((it, k) => it.querySelector('.arc__pick').addEventListener('click', () => centre(k)));
    track.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      centre(Math.max(0, Math.min(items.length - 1, current + (e.key === 'ArrowRight' ? 1 : -1))));
    });
    dragScroll(track, () => { place(); centre(current); });
    const start = Math.min(items.length - 1, parseInt(arc.dataset.start || '0', 10));
    const it0 = items[start];
    track.scrollLeft = it0.offsetLeft + it0.offsetWidth / 2 - track.clientWidth / 2;
    place();
  }

  /* ---------- How to order: drag row ---------- */
  const steps = document.querySelector('[data-steps]');
  if (steps) {
    const row = steps.querySelector('[data-steps-row]');
    const fill = steps.querySelector('[data-steps-fill]');
    const prev = steps.querySelector('[data-steps-prev]');
    const next = steps.querySelector('[data-steps-next]');
    const cols = [...row.children];
    const upd = () => {
      const max = row.scrollWidth - row.clientWidth;
      const vis = row.clientWidth / row.scrollWidth;
      const p = max > 0 ? row.scrollLeft / max : 1;
      fill.style.transform = `scaleX(${Math.min(1, vis + p * (1 - vis)).toFixed(3)})`;
      prev.disabled = row.scrollLeft < 4;
      next.disabled = row.scrollLeft > max - 4;
    };
    const stepW = () => cols[0].getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || '0');
    prev.addEventListener('click', () => row.scrollBy({ left: -stepW(), behavior }));
    next.addEventListener('click', () => row.scrollBy({ left: stepW(), behavior }));
    row.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    addEventListener('resize', upd);
    dragScroll(row, () => {
      let best = 0, bestD = Infinity;
      cols.forEach((c, k) => { const d = Math.abs(c.offsetLeft - row.offsetLeft - row.scrollLeft); if (d < bestD) { bestD = d; best = k; } });
      row.style.scrollSnapType = '';
      row.scrollTo({ left: cols[best].offsetLeft - row.offsetLeft, behavior });
    });
    upd();
  }

  /* ---------- Clients: one name lit at a time ---------- */
  const proof = document.querySelector('[data-proof]');
  if (proof) {
    const names = [...proof.querySelectorAll('.proof__name')];
    let k = 0, timer = 0;
    const lit = () => { names.forEach((n, j) => n.classList.toggle('is-lit', j === k)); k = (k + 1) % names.length; };
    lit();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        for (const e of entries) { clearInterval(timer); if (e.isIntersecting) timer = setInterval(lit, 1800); }
      }).observe(proof);
    }
  }

  /* ---------- Footer wordmark runs margin to margin ---------- */
  const fit = document.querySelector('[data-fit]');
  const doFit = () => {
    if (!fit) return;
    const box = fit.parentElement;
    box.style.fontSize = '100px';
    const w = fit.getBoundingClientRect().width;
    if (w > 0) box.style.fontSize = `${(100 * box.clientWidth / w * 0.995).toFixed(2)}px`;
  };

  /* ---------- The live cable: current runs down the page as you scroll ---------- */
  const svg = document.querySelector('[data-cable]');
  const page = document.querySelector('.page');
  if (svg && page) {
    const NS = 'http://www.w3.org/2000/svg';
    const base = svg.querySelector('.cable__base');
    const live = svg.querySelector('.cable__live');
    const spark = svg.querySelector('.cable__spark');
    const nodesG = svg.querySelector('.cable__nodes');
    const glow1 = live.cloneNode(); glow1.setAttribute('class', 'cable__glow'); glow1.style.cssText = 'stroke:#46f5aa;stroke-width:8;opacity:.18;fill:none;stroke-linecap:round;stroke-linejoin:round';
    const glow2 = live.cloneNode(); glow2.setAttribute('class', 'cable__glow'); glow2.style.cssText = 'stroke:#46f5aa;stroke-width:18;opacity:.06;fill:none;stroke-linecap:round;stroke-linejoin:round';
    live.style.filter = 'none';
    svg.insertBefore(glow2, live); svg.insertBefore(glow1, live);
    let samples = [], total = 1, nodes = [], cur = 0, target = 0, raf = 0;

    const pathFrom = (pts) => {
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let k = 1; k < pts.length; k++) {
        const [x, y] = pts[k];
        if (k < pts.length - 1) {
          const [px, py] = pts[k - 1], [nx, ny] = pts[k + 1];
          const r = Math.min(26, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
          const ax = x - Math.sign(x - px) * r, ay = y - Math.sign(y - py) * r;
          const bx = x + Math.sign(nx - x) * r, by = y + Math.sign(ny - y) * r;
          d += ` L${ax.toFixed(1)},${ay.toFixed(1)} Q${x},${y} ${bx.toFixed(1)},${by.toFixed(1)}`;
        } else d += ` L${x},${y}`;
      }
      return d;
    };
    const rel = (el) => { const r = el.getBoundingClientRect(), p = page.getBoundingClientRect(); return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height }; };

    const build = () => {
      root.classList.add('cable-measure');
      const W = page.clientWidth, H = page.scrollHeight;
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const phone = W < 720, wide = W >= 992;
      const m = parseFloat(getComputedStyle(hero).paddingLeft) || 24;
      const x0 = phone ? 9 : Math.round(m * 0.5);
      const heroR = rel(hero);
      const pts = [];
      if (phone) pts.push([x0, heroR.y + heroR.h - 6]);
      else { const xr = W - Math.round(m * 0.5); pts.push([xr, 0], [xr, heroR.y + heroR.h - 16], [x0, heroR.y + heroR.h - 16]); }
      const nodePts = [];
      const heads = [...page.querySelectorAll('[data-node]')];
      for (const h of heads) {
        const r = rel(h);
        const y = Math.round(r.y + Math.min(r.h, 60) / 2);
        if (h.hasAttribute('data-end')) {
          pts.push([x0, y], [Math.round(r.x - 18), y]);
          nodePts.push({ x: Math.round(r.x - 18), y, el: h, end: true });
          break;
        }
        pts.push([x0, y]);
        nodePts.push({ x: x0, y, el: h });
        if (wide && h.classList.contains('sched__title')) {
          const list = page.querySelector('.sched__list');
          const lr = rel(list);
          const cx = Math.round(W / 2);
          pts.push([x0, Math.round(lr.y - 18)], [cx, Math.round(lr.y - 18)], [cx, Math.round(lr.y + lr.h + 18)], [x0, Math.round(lr.y + lr.h + 18)]);
        }
      }
      const d = pathFrom(pts);
      [base, live, glow1, glow2].forEach((p) => p.setAttribute('d', d));
      total = live.getTotalLength();
      samples = [];
      for (let L = 0; L <= total; L += 6) { const p = live.getPointAtLength(L); samples.push([L, p.x, p.y]); }
      const last = live.getPointAtLength(total); samples.push([total, last.x, last.y]);
      [live, glow1, glow2].forEach((p) => { p.style.strokeDasharray = `${total} ${total}`; });
      nodesG.textContent = '';
      nodes = nodePts.map((n) => {
        let best = 0, bd = Infinity;
        for (let k = 0; k < samples.length; k++) { const dd = Math.hypot(samples[k][1] - n.x, samples[k][2] - n.y); if (dd < bd) { bd = dd; best = k; } }
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', n.x); c.setAttribute('cy', n.y); c.setAttribute('r', n.end ? 7 : 5); c.setAttribute('class', 'cable__node');
        nodesG.appendChild(c);
        return { len: samples[best][0], c, el: n.el };
      });
      root.classList.remove('cable-measure');
      if (!motion) { cur = target = total; }
      draw();
      onScroll();
    };
    const pointAt = (L) => {
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (samples[mid][0] <= L) lo = mid; else hi = mid - 1; }
      const a = samples[lo], b = samples[Math.min(samples.length - 1, lo + 1)];
      const t = b[0] > a[0] ? (L - a[0]) / (b[0] - a[0]) : 0;
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    const draw = () => {
      const off = Math.max(0, total - cur);
      [live, glow1, glow2].forEach((p) => { p.style.strokeDashoffset = off; });
      const [sx, sy] = pointAt(cur);
      spark.setAttribute('cx', sx.toFixed(1)); spark.setAttribute('cy', sy.toFixed(1));
      spark.style.opacity = cur > 2 && cur < total - 1 ? 1 : 0;
      for (const n of nodes) {
        const on = cur >= n.len - 3;
        n.c.classList.toggle('is-on', on);
        n.el.classList.toggle('is-powered', on);
      }
    };
    const loop = () => {
      const diff = target - cur;
      cur += Math.abs(diff) < 0.5 ? diff : diff * 0.11;
      draw();
      raf = Math.abs(target - cur) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const onScroll = () => {
      if (!motion || !samples.length) return;
      const pageTop = page.getBoundingClientRect().top + scrollY;
      const lineY = scrollY - pageTop + innerHeight * (root.classList.contains('is-ready') ? 0.66 : 0);
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (samples[mid][2] <= lineY) lo = mid; else hi = mid - 1; }
      target = samples[lo][2] <= lineY ? samples[lo][0] : 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    addEventListener('scroll', onScroll, { passive: true });
    let rt = 0;
    const rebuild = () => { clearTimeout(rt); rt = setTimeout(() => { doFit(); build(); }, 120); };
    addEventListener('resize', rebuild);
    addEventListener('load', rebuild);
    if (document.fonts) document.fonts.ready.then(rebuild);
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(page);
    new MutationObserver(() => onScroll()).observe(root, { attributes: true, attributeFilter: ['class'] });
    doFit(); build();
  } else {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(doFit);
    addEventListener('resize', doFit);
  }
})();
