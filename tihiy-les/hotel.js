// Hotel first screen: the estate as a model; each place has a small icon on the map and its name
// opens next to it on hover (and in turn on its own); a live weather line.
// All hotel-specific data comes from the JSON block in index.html.
(() => {
  const cfg = JSON.parse(document.getElementById('hotel').textContent);
  const hero = document.getElementById('hero');
  const img = hero.querySelector('.photo');
  const pinsBox = hero.querySelector('.pins');
  const list = hero.querySelector('.list');

  // thin line icons, 24×24; add new ones here for other hotels (баня, ресторан, причал…)
  const ICONS = {
    house: '<path d="M3.5 11.5 12 4.5l8.5 7"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/>',
    swim: '<circle cx="16.5" cy="6.5" r="2"/><path d="M4.5 13.5 9 10.5l3 2.5 4.5-2.5"/><path d="M2.5 17.5c1.6 1.2 3.2 1.2 4.8 0s3.2-1.2 4.8 0 3.2 1.2 4.8 0 3.2-1.2 4.8 0"/>',
    rings: '<circle cx="9" cy="14" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="M13.5 4.5 15 3l1.5 1.5L15 6z"/>',
    racket: '<ellipse cx="14.5" cy="9.5" rx="4.6" ry="5.8" transform="rotate(45 14.5 9.5)"/><path d="M11.2 12.8 4.5 19.5"/><path d="M12 7l5 5M14.5 5.5l3.5 3.5M10.5 9.5 14 13"/><circle cx="5.5" cy="6" r="1.5"/>',
    boat: '<path d="M2.5 14.5h19l-3 5h-13z"/><path d="M7 14.5l2.5-4.5h5.5l3 4.5"/><path d="M11 10V7.5"/>',
    sail: '<path d="M12 3v13"/><path d="M12 4.5 18.5 15H12"/><path d="M10 7.5 5.5 15H10"/><path d="M3.5 18h17l-2 2.5h-13z"/>',
    beach: '<path d="M3.5 11.5a8.5 8.5 0 0 1 17 0z"/><path d="M12 11.5V19a1.8 1.8 0 0 1-3.6 0"/>',
    steam: '<path d="M8 3.5c-1.2 1.4 1.2 2.6 0 4.5M12 3.5c-1.2 1.4 1.2 2.6 0 4.5M16 3.5c-1.2 1.4 1.2 2.6 0 4.5"/><path d="M4 12h16l-1.5 7.5h-13z"/>',
    glass: '<path d="M3 10.5 12 4.5l9 6"/><path d="M5 9.5V20h14V9.5"/><path d="M9.7 20v-9M14.3 20v-9M5 14.5h14"/>',
    fire: '<path d="M12 3.5c3 3.2 5 5.8 5 8.8a5 5 0 0 1-10 0c0-1.8.8-3.2 2-4.3.3 1.5 1 2.4 2 2.9-.4-2.7.1-5.1 1-7.4z"/><path d="M5 20.5h14"/>',
    tent: '<path d="M12 4 2.5 20h19z"/><path d="M12 4v16"/><path d="M9 20l3-6 3 6"/>',
    dish: '<path d="M3.5 17.5h17"/><path d="M5 17.5a7 7 0 0 1 14 0"/><path d="M12 10.5V8.5"/><path d="M10.5 8.5h3"/>',
    tree: '<path d="M12 3 6.5 10.5h3l-4 6h13l-4-6h3z"/><path d="M12 16.5V21"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // on narrow screens the photo pans so the chosen place is in view; fx is the current horizontal focus
  let fx = cfg.image.focusX;
  const setFocus = () => { img.style.objectPosition = `${fx * 100}% ${cfg.image.focusY * 100}%`; };
  setFocus();

  const pins = cfg.places.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = `<span class="tag">${icon(p.icon)}<em>${p.title}</em></span><i></i><b></b>`;
    pinsBox.appendChild(el);
    const li = document.createElement('li');
    li.innerHTML = `${icon(p.icon)}${p.title}`;
    list.appendChild(li);
    for (const t of [el, li]) {
      t.addEventListener('pointerenter', () => { stopAuto(); select(i); });
      t.addEventListener('click', () => { stopAuto(); select(i); });
    }
    return { el, li, p };
  });

  // image pixels -> screen pixels, same maths as object-fit: cover
  let map = () => [0, 0];
  function layout() {
    const W = hero.clientWidth, H = hero.clientHeight, { w, h, focusY } = cfg.image;
    const s = Math.max(W / w, H / h), ox = (W - w * s) * fx, oy = (H - h * s) * focusY;
    map = (x, y) => [ox + x * s, oy + y * s];
    pins.forEach(({ el, p }) => {
      const [x, y] = map(p.x, p.y);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.display = x < 16 || x > W - 16 ? 'none' : '';
    });
  }

  let cur = -1;
  function select(i) {
    if (i === cur) return;
    cur = i;
    pins.forEach((q, k) => { q.el.classList.toggle('on', k === i); q.li.classList.toggle('on', k === i); });
    const W = hero.clientWidth, H = hero.clientHeight;
    const s = Math.max(W / cfg.image.w, H / cfg.image.h), spare = cfg.image.w * s - W;
    if (H > W && spare > W * 0.25) { // portrait phone: bring the place to the middle of the screen
      fx = Math.min(1, Math.max(0, (pins[i].p.x * s - W * 0.5) / spare));
      setFocus(); layout();
    }
  }

  // until someone points at a place, open the names one by one on our own (also what the letter's GIF shows)
  let auto = null, resume = null;
  function startAuto() {
    clearInterval(auto);
    let k = cur;
    auto = setInterval(() => select(k = (k + 1) % pins.length), 3000);
  }
  function stopAuto() { clearInterval(auto); clearTimeout(resume); auto = null; }
  for (const box of [pinsBox, list]) box.addEventListener('pointerleave', () => {
    clearTimeout(resume);
    resume = setTimeout(startAuto, 4000);
  });

  addEventListener('resize', layout);
  const ready = () => { layout(); setTimeout(() => { select(0); startAuto(); }, 1300); };
  img.complete ? ready() : img.addEventListener('load', ready, { once: true });

  // live weather line from Open-Meteo (free, no key); hidden if it does not answer
  const wx = hero.querySelector('.weather');
  const sky = c => c === 0 ? 'ясно' : c <= 2 ? 'малооблачно' : c === 3 ? 'пасмурно' : c <= 48 ? 'туман'
    : c <= 57 ? 'морось' : c <= 67 ? 'дождь' : c <= 77 ? 'снег' : c <= 82 ? 'ливень' : c <= 86 ? 'снегопад' : 'гроза';
  const hm = s => s.slice(11, 16).replace(/^0/, '');
  const { lat, lon, name } = cfg.weather;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=Europe%2FMoscow&forecast_days=2`)
    .then(r => r.json())
    .then(d => {
      const t = Math.round(d.current.temperature_2m);
      const temp = (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '°';
      // daytime: time left until sunset (or just the hour when it is far off); night: the next sunrise
      const now = new Date(d.current.time), rise = new Date(d.daily.sunrise[0]), set = new Date(d.daily.sunset[0]);
      let sun;
      if (now >= rise && now < set) {
        const m = Math.round((set - now) / 60000);
        sun = m > 180 ? `закат в ${hm(d.daily.sunset[0])}` : m < 60 ? `до заката ${m} мин`
          : `до заката ${Math.floor(m / 60)} ч${m % 60 ? ' ' + (m % 60) + ' мин' : ''}`;
      } else {
        sun = `рассвет в ${hm(now < rise ? d.daily.sunrise[0] : d.daily.sunrise[1])}`;
      }
      wx.innerHTML = `Сейчас ${name} <b>${temp}</b>, ${sky(d.current.weather_code)} · ${sun}`;
      wx.hidden = false;
    })
    .catch(() => {});
})();
