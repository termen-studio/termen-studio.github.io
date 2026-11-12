// Live weather line for the «Буклет» hotel template: data-at="lat,lon,where" on the .live element (hidden if Open-Meteo does not answer).
(() => {
  const live = document.querySelector('.live');
  if (!live || !live.dataset.at) return;
  const [lat, lon, where] = live.dataset.at.split(',');
  const say = c => c === 0 ? 'ясно' : c <= 2 ? 'малооблачно' : c === 3 ? 'пасмурно' : c <= 48 ? 'туман' : c <= 57 ? 'морось'
    : c <= 67 ? 'дождь' : c <= 77 ? 'снег' : c <= 82 ? 'ливень' : c <= 86 ? 'снегопад' : 'гроза';
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Europe%2FMoscow`)
    .then(r => r.json()).then(d => {
      const t = Math.round(d.current.temperature_2m);
      live.innerHTML = `Сейчас ${where} <b>${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t)}°</b>, ${say(d.current.weather_code)}`;
      live.hidden = false;
    }).catch(() => {});
})();
