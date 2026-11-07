(function () {
  'use strict';

  const DATA = window.TIDE_DATA;
  const TZ = 'America/New_York';
  const STAGES = [
    { key: 'major', label: 'Major Flood Stage', ft: 3.5 },
    { key: 'moderate', label: 'Moderate Flood Stage', ft: 2.5 },
    { key: 'minor', label: 'Minor Flood Stage', ft: 2.0 },
    { key: 'action', label: 'Action Stage', ft: 1.5 }
  ];
  const STATIONS = {
    '8677406': 'Howe Street Pier, Brunswick',
    '8677344': 'St. Simons Island'
  };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const STALE_MINUTES = 90;

  const failedFeeds = new Set();

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function signed(n) {
    const v = Number(n);
    return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v).toFixed(2);
  }
  function to12h(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  function fmtDate(iso, withYear) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${SHORT_MONTHS[m - 1]} ${d}${withYear ? ', ' + y : ''}`;
  }
  function fmtDateTime(isoString) {
    return new Date(isoString).toLocaleString('en-US', {
      timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }
  function todayEastern() {
    // YYYY-MM-DD in Eastern time
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  }
  function stageFor(ft) {
    for (const s of STAGES) if (ft >= s.ft) return s;
    return null;
  }
  function showDataStatus() {
    const banner = document.getElementById('data-status-banner');
    if (failedFeeds.size === 0) { banner.hidden = true; return; }
    const names = Array.from(failedFeeds).join(' and ');
    document.getElementById('data-status-text').textContent =
      `Live ${names} could not be loaded. Saved predictions from Nov 6, 2026 are still shown. Check weather.gov/jax for current conditions.`;
    banner.hidden = false;
  }

  // ---------- Screen 1: NWS alerts ----------
  async function checkLiveNwsAlerts() {
    const bar = document.getElementById('alert-bar');
    try {
      const res = await fetch('https://api.weather.gov/alerts/active/zone/GAZ154', { headers: { Accept: 'application/geo+json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const features = (json.features || []).filter(f => f && f.properties);
      if (features.length === 0) {
        bar.className = 'alert-box monitoring-status';
        bar.parentElement.classList.remove('is-hazard');
        bar.innerHTML = `<span class="alert-icon" aria-hidden="true">ℹ️</span>
          <div class="alert-content">
            <div class="alert-headline">No active National Weather Service alerts for Coastal Glynn right now. Conditions can change quickly.</div>
            <div class="alert-subtext">Zone GAZ154 (Coastal Glynn), checked ${esc(fmtDateTime(new Date().toISOString()))}. <a href="https://www.weather.gov/jax/" target="_blank" rel="noopener noreferrer">Check NWS Jacksonville for official updates &rarr;</a></div>
          </div>`;
        return;
      }
      const items = features.map(f => {
        const a = f.properties;
        const until = a.ends || a.expires;
        return `<li><strong>${esc(a.event || 'NWS alert')}</strong>${until ? ' in effect until ' + esc(fmtDateTime(until)) : ''}. ${esc(a.headline || '')}</li>`;
      }).join('');
      bar.className = 'alert-box active-hazard';
      bar.parentElement.classList.add('is-hazard');
      bar.innerHTML = `<span class="alert-icon" aria-hidden="true">⚠️</span>
        <div class="alert-content">
          <div class="alert-headline">${features.length === 1 ? 'Active NWS alert' : features.length + ' active NWS alerts'} for Coastal Glynn</div>
          <ul class="alert-list">${items}</ul>
          <div class="alert-subtext"><a href="https://forecast.weather.gov/showsigwx.php?warnzone=GAZ154" target="_blank" rel="noopener noreferrer">Read the full alert text from NWS &rarr;</a></div>
        </div>`;
    } catch (e) {
      bar.className = 'alert-box error-status';
      bar.parentElement.classList.add('is-hazard');
      bar.innerHTML = `<span class="alert-icon" aria-hidden="true">⚠️</span>
        <div class="alert-content">
          <div class="alert-headline">We could not load National Weather Service alerts. Do not assume there are none.</div>
          <div class="alert-subtext"><a href="https://www.weather.gov/jax/" target="_blank" rel="noopener noreferrer">Check NWS Jacksonville directly &rarr;</a></div>
        </div>`;
      failedFeeds.add('NWS alerts');
      showDataStatus();
    }
  }

  // ---------- Screen 2: Next king tide ----------
  function renderNextKingTide() {
    const box = document.getElementById('next-king-content');
    const today = todayEastern();
    const next = DATA.kingWindows.find(w => w.window_end >= today);
    if (!next) {
      box.innerHTML = `<p style="font-weight:600;">The saved predictions in this tool have run out. Check <a href="https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8677406" target="_blank" rel="noopener noreferrer">NOAA tide predictions for Brunswick</a>.</p>`;
      return;
    }
    const inWindow = next.window_start <= today;
    const startsSameYear = next.window_start.slice(0, 4) === next.window_end.slice(0, 4);
    const range = `${fmtDate(next.window_start, !startsSameYear)} to ${fmtDate(next.window_end, true)}`;
    box.innerHTML = `
      <p style="font-size: 1.15rem; font-weight: 600; color: var(--navy-800);">${inWindow ? 'A king tide window is happening now.' : 'Next predicted king tide peak:'} ${esc(fmtDate(next.peak_date, true))}, ${esc(to12h(next.peak_time_local))} (${esc(signed(next.peak_ft_above_mhhw))} ft above MHHW).</p>
      <div class="countdown-grid">
        <div class="stat-box">
          <div class="stat-label">Tide window dates</div>
          <div class="stat-value" style="font-size: 1.35rem; padding-top: 6px;">${esc(range)}</div>
          <div class="stat-sub">${inWindow ? 'Happening now' : 'Upcoming'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Predicted peak tide</div>
          <div class="stat-value" style="font-size: 1.35rem; padding-top: 6px;">${esc(fmtDate(next.peak_date))}, ${esc(to12h(next.peak_time_local))}</div>
          <div class="stat-sub">Howe Street Pier, Brunswick</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Peak height (MLLW)</div>
          <div class="stat-value">${esc(Number(next.peak_ft_above_mllw).toFixed(2))} ft</div>
          <div class="stat-sub">above chart datum (MLLW)</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Above normal high tide</div>
          <div class="stat-value" style="color: var(--warning-primary);">${esc(signed(next.peak_ft_above_mhhw))} ft</div>
          <div class="stat-sub">above normal high water (MHHW)</div>
        </div>
      </div>
      <div class="tide-warning-notice">King tides are among the highest predicted tides of the year. Low-lying roads and yards may flood, especially with wind or rain.</div>`;
  }

  // ---------- Screen 3: Calendar ----------
  const highestByDay = {};
  Object.keys(DATA.highTides).forEach(st => {
    const map = {};
    DATA.highTides[st].forEach(([date, time, mllw, mhhw]) => {
      if (!map[date] || mhhw > map[date].mhhw) map[date] = { time, mllw, mhhw };
    });
    highestByDay[st] = map;
  });
  const allDates = DATA.highTides['8677406'].map(r => r[0]).sort();
  const firstMonth = allDates[0].slice(0, 7);
  const lastMonth = allDates[allDates.length - 1].slice(0, 7);

  const calState = { station: '8677406', ym: null };
  (function initMonth() {
    const t = todayEastern().slice(0, 7);
    calState.ym = t < firstMonth ? firstMonth : t > lastMonth ? lastMonth : t;
  })();

  function shiftMonth(ym, delta) {
    let [y, m] = ym.split('-').map(Number);
    m += delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const [y, m] = calState.ym.split('-').map(Number);
    const dayMap = highestByDay[calState.station];
    document.getElementById('current-month-display').textContent = `${MONTHS[m - 1]} ${y}`;
    document.getElementById('meta-calendar').innerHTML =
      `Station ${calState.station} &bull; Highest predicted tide each day &bull; Eastern time`;
    document.getElementById('btn-prev-month').disabled = calState.ym <= firstMonth;
    document.getElementById('btn-next-month').disabled = calState.ym >= lastMonth;

    grid.innerHTML = '';
    WEEKDAYS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-day-header';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = d;
      grid.appendChild(el);
    });
    const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day-cell empty';
      empty.setAttribute('aria-hidden', 'true');
      grid.appendChild(empty);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = dayMap[iso];
      const moon = DATA.moon[iso];
      const moonIcon = moon === 'New Moon' ? '🌑' : moon === 'Full Moon' ? '🌕' : '';
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      const weekdayName = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      if (!rec) {
        cell.classList.add('no-data');
        cell.innerHTML = `<div class="day-num-row"><span>${day}</span></div><div class="tide-entry" style="background:none;"><span class="nodata-long">No saved data</span><span class="nodata-short">&ndash;</span></div>`;
        cell.setAttribute('aria-label', `${weekdayName}, ${MONTHS[m - 1]} ${day}: no saved prediction`);
      } else {
        const isKing = rec.mhhw >= 1.0;
        const isHigher = !isKing && rec.mhhw >= 0.5;
        if (isKing) cell.classList.add('is-king');
        if (isHigher) cell.classList.add('is-higher');
        cell.innerHTML = `
          <div class="day-num-row" aria-hidden="true"><span>${day}</span><span>${moonIcon}</span></div>
          <div aria-hidden="true">${isKing ? '<span class="badge badge-king"><span class="badge-long">King</span><span class="badge-short">K</span></span>' : isHigher ? '<span class="badge badge-higher"><span class="badge-long">Higher</span><span class="badge-short">H</span></span>' : ''}</div>
          <div class="tide-entry" aria-hidden="true">${esc(signed(rec.mhhw))}<span class="tide-time"> ft<br>${esc(to12h(rec.time))}</span></div>`;
        const label = `${weekdayName}, ${MONTHS[m - 1]} ${day}: highest predicted tide ${signed(rec.mhhw)} feet above MHHW at ${to12h(rec.time)}` +
          (isKing ? ', king tide' : isHigher ? ', higher than usual' : '') + (moon ? `, ${moon.toLowerCase()}` : '');
        cell.setAttribute('role', 'group');
        cell.setAttribute('aria-label', label);
      }
      grid.appendChild(cell);
    }
  }

  function setStation(st) {
    calState.station = st;
    const b = document.getElementById('btn-station-brunswick');
    const s = document.getElementById('btn-station-stsimons');
    b.classList.toggle('active', st === '8677406');
    s.classList.toggle('active', st === '8677344');
    b.setAttribute('aria-pressed', String(st === '8677406'));
    s.setAttribute('aria-pressed', String(st === '8677344'));
    renderCalendar();
  }

  // ---------- Screen 4: Chart ----------
  function renderChart() {
    const svg = document.getElementById('tide-comparison-chart');
    const rows = DATA.october;
    const X0 = 60, X1 = 790, Y0 = 330, Y1 = 30;
    const vMin = -1.5, vMax = 3.0;
    const xFor = i => X0 + (i / (rows.length - 1)) * (X1 - X0);
    const yFor = v => Y0 - ((v - vMin) / (vMax - vMin)) * (Y0 - Y1);
    let out = '';

    // grid + y axis labels
    for (let v = -1; v <= 3; v += 1) {
      const yy = yFor(v);
      out += `<line x1="${X0}" y1="${yy}" x2="${X1}" y2="${yy}" stroke="#e5e7eb" stroke-width="1"/>`;
      out += `<text x="${X0 - 8}" y="${yy + 4}" font-size="11" text-anchor="end" fill="#4b5866">${v > 0 ? '+' : ''}${v} ft</text>`;
    }
    out += `<text x="16" y="${(Y0 + Y1) / 2}" font-size="11" fill="#4b5866" transform="rotate(-90 16 ${(Y0 + Y1) / 2})" text-anchor="middle">Feet above MHHW</text>`;

    // flood stages
    [{ y: 2.5, c: '#991b1b', t: 'Moderate' }, { y: 2.0, c: '#dc2626', t: 'Minor' }, { y: 1.5, c: '#b45309', t: 'Action' }].forEach(s => {
      const yy = yFor(s.y);
      out += `<line x1="${X0}" y1="${yy}" x2="${X1}" y2="${yy}" stroke="${s.c}" stroke-width="1.5" stroke-dasharray="4,4"/>`;
      out += `<text x="${X1 + 6}" y="${yy + 4}" font-size="11" fill="${s.c}">${s.t} ${s.y}'</text>`;
    });

    // x axis date ticks (first high tide of selected dates)
    const seen = new Set();
    rows.forEach((r, i) => {
      const d = r[0];
      if (seen.has(d)) return;
      seen.add(d);
      const day = Number(d.slice(8, 10));
      if ([7, 14, 21, 28].includes(day) || d.endsWith('-11-01') || d.endsWith('-11-06')) {
        const xx = xFor(i);
        out += `<line x1="${xx}" y1="${Y0}" x2="${xx}" y2="${Y0 + 5}" stroke="#4b5866"/>`;
        out += `<text x="${xx}" y="${Y0 + 20}" font-size="11" text-anchor="middle" fill="#4b5866">${fmtDate(d)}</text>`;
      }
    });
    out += `<line x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" stroke="#4b5866"/>`;

    const path = idx => rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(r[idx]).toFixed(1)}`).join(' ');
    out += `<path d="${path(2)}" fill="none" stroke="#1b3b5a" stroke-width="2" stroke-dasharray="6,4"/>`;
    out += `<path d="${path(3)}" fill="none" stroke="#ba2d0b" stroke-width="2.5"/>`;
    rows.forEach((r, i) => {
      if (r[3] >= 2.0) out += `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(r[3]).toFixed(1)}" r="4" fill="#ba2d0b" stroke="#fff" stroke-width="1"/>`;
    });

    // keep <title>/<desc>
    const title = svg.querySelector('title');
    const desc = svg.querySelector('desc');
    svg.innerHTML = out;
    svg.insertBefore(desc, svg.firstChild);
    svg.insertBefore(title, svg.firstChild);

    // headline numbers from the data, not hard-coded
    const octFlood = rows.filter(r => r[0].startsWith('2026-10') && r[3] >= 2.0);
    const predFlood = octFlood.filter(r => r[2] >= 2.0).length;
    const maxExtra = Math.max(...rows.map(r => r[4]));
    const daysCount = new Set(octFlood.map(r => r[0])).size;
    document.getElementById('why-headline').textContent =
      `In October 2026, water at St. Simons reached flood stage on ${octFlood.length} high tides across ${daysCount} days. ` +
      (predFlood === 0 ? 'The tide predictions put none of them at flood stage.' : `The tide predictions put only ${predFlood} at flood stage.`);
    document.getElementById('why-max-extra').textContent = maxExtra.toFixed(1);

    const tbody = document.getElementById('october-table-body');
    tbody.innerHTML = '';
    rows.forEach(r => {
      const st = stageFor(r[3]);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(fmtDate(r[0], true))}</td><td>${esc(to12h(r[1]))}</td><td>${esc(signed(r[2]))} ft</td>` +
        `<td style="${st ? 'color:var(--warning-primary); font-weight:bold;' : ''}">${esc(signed(r[3]))} ft</td>` +
        `<td>${esc(signed(r[4]))} ft</td><td>${st ? esc(st.label.replace(' Stage', '')) : 'Below action'}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ---------- Screen 5: Live gauge ----------
  async function loadGauge() {
    const valEl = document.getElementById('gauge-current-val');
    const badge = document.getElementById('gauge-category-badge');
    const meta = document.getElementById('gauge-timestamp-meta');
    const stale = document.getElementById('gauge-stale-note');
    try {
      const res = await fetch('https://api.water.noaa.gov/nwps/v1/gauges/BRNG1');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const g = await res.json();
      const obs = g && g.status && g.status.observed;
      if (!obs || typeof obs.primary !== 'number' || obs.primary <= -900 || !obs.validTime) throw new Error('no observation');
      const ft = obs.primary;
      valEl.textContent = signed(ft);
      const st = stageFor(ft);
      if (st) {
        badge.className = 'stage-status-badge ' + st.key;
        badge.textContent = `At or above ${st.label} (${st.ft} ft)`;
      } else {
        badge.className = 'stage-status-badge below-flood';
        badge.textContent = 'Below Action Stage at this gauge';
      }
      meta.textContent = `Gauge BRNG1 (USGS 02226180) • Reading from ${fmtDateTime(obs.validTime)}`;
      const ageMin = (Date.now() - new Date(obs.validTime).getTime()) / 60000;
      if (ageMin > STALE_MINUTES) {
        stale.hidden = false;
        stale.textContent = `This reading is about ${Math.round(ageMin / 60)} hours old and may not reflect current water.`;
      } else {
        stale.hidden = true;
      }
    } catch (e) {
      valEl.textContent = '--';
      badge.className = 'stage-status-badge unknown';
      badge.textContent = 'Live reading unavailable';
      meta.textContent = 'Gauge BRNG1 (USGS 02226180) • No current reading';
      stale.hidden = false;
      stale.innerHTML = 'Check the <a href="https://water.noaa.gov/gauges/BRNG1" target="_blank" rel="noopener noreferrer">official BRNG1 gauge page</a> for the latest reading.';
      failedFeeds.add('water level readings');
      showDataStatus();
    }
  }

  // ---------- wire up ----------
  document.getElementById('btn-toggle-table').addEventListener('click', e => {
    const wrap = document.getElementById('accessible-table-container');
    const open = wrap.classList.toggle('expanded');
    e.currentTarget.setAttribute('aria-expanded', String(open));
    e.currentTarget.textContent = open ? 'Hide text table' : 'Show data as text table';
  });
  document.getElementById('btn-station-brunswick').addEventListener('click', () => setStation('8677406'));
  document.getElementById('btn-station-stsimons').addEventListener('click', () => setStation('8677344'));
  document.getElementById('btn-prev-month').addEventListener('click', () => { calState.ym = shiftMonth(calState.ym, -1); renderCalendar(); });
  document.getElementById('btn-next-month').addEventListener('click', () => { calState.ym = shiftMonth(calState.ym, 1); renderCalendar(); });

  renderNextKingTide();
  renderCalendar();
  renderChart();
  checkLiveNwsAlerts();
  loadGauge();
  // Refresh live feeds every 15 minutes while the page is open
  setInterval(() => { checkLiveNwsAlerts(); loadGauge(); }, 15 * 60 * 1000);
})();
