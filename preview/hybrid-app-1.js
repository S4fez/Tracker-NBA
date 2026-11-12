/* NBA Bet Tracker · hybrid design preview (A + D/B/C). Part of preview/hybrid.html — loads live, read-only data; contains no betting data. */
'use strict';
  const C = window.Core, F = C.fmt, esc = F.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- static data ---------- */
  const K = C.kpis();
  const A = C.analytics();
  const GAMES = C.games();
  const GAME_BY_KEY = new Map(GAMES.map((g) => [g.key, g]));
  const FEED = C.impactFeed();
  const IMP_RANGE = (() => { const ds = [...new Set(FEED.map((e) => e.game.date))].sort(); return ds.length ? (ds.length > 1 ? F.dateTH(ds[0]) + ' – ' + F.dateTH(ds[ds.length - 1]) : F.dateTH(ds[0])) : '—'; })();
  const STATUSES = ['all', 'pending', 'won', 'lost', 'push', 'void', 'partial'];
  const SORTS = [['date-desc', 'วันที่ ใหม่ → เก่า'], ['date-asc', 'วันที่ เก่า → ใหม่'], ['profit-desc', 'กำไร/ขาดทุน มาก → น้อย'], ['payout-desc', 'ยอดจ่ายหากชนะ สูงสุด'], ['legs-desc', 'จำนวนคู่ มากสุด'], ['stake-desc', 'เงินเดิมพัน สูงสุด']];
  const MARKET_TH = { Spread: 'แต้มต่อ', Over: 'สูง (Over)', Under: 'ต่ำ (Under)' };
  const SIDE_TH = { Favorite: 'ต่อ', Underdog: 'รอง', PK: 'PK' };
  const state = { q: '', status: 'all', sort: 'date-desc', games: 'all', impType: 'all', impTeam: 'all', teamSort: 'n', legsMin: 0, legsMax: 0, dFrom: '', dTo: '', adv: false, scale: 'lin' };
  const GAME_IDX = new Map(GAMES.map((g, i) => [g.key, i]));
  const MAX_ID = Math.max(...C.tickets.map((t) => t.id));
  const LEG_OPTS = [...new Set(C.tickets.map((t) => t.legs))].sort((a, b) => a - b);
  const DATE_MIN = C.tickets.reduce((m, t) => (t.date < m ? t.date : m), '9999'), DATE_MAX = C.tickets.reduce((m, t) => (t.date > m ? t.date : m), '0000');
  const isWide = () => window.matchMedia('(min-width: 1100px)').matches;
  /* game phase: final (score recorded) · started (tip-off passed, result not yet recorded) · upcoming */
  function phase(g) {
    if (g.status === 'final') return 'final';
    if (g.tipoff) { const t = Date.parse(`${g.date}T${g.tipoff}:00+07:00`); if (!isNaN(t) && t <= Date.now()) return 'started'; }
    else if (g.date < new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)) return 'started';
    return 'upcoming';
  }
  const homeAway = (g) => (g.home ? [g.teams.find((t) => t !== g.home), g.home] : g.teams);
  const legCount = (g) => ({ w: g.legs.filter((l) => l.result === 'won').length, l: g.legs.filter((l) => l.result === 'lost').length, p: g.legs.filter((l) => l.result === 'pending').length });

  /* ---------- icons (static strings) ---------- */
  const I = {
    grid: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
    ticket: '<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    court: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/>',
    pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M7 15l4-4 3 3 5-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    minus: '<path d="M6 12h12"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
    slash: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',
    half: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
    ext: '<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>',
    sort: '<path d="M8 4v16M8 20l-4-4M16 20V4M16 4l4 4"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.8a3.5 3.5 0 0 1 0 6.4M21 20c0-2.8-1.6-5-4-5.8"/>'
  };
  const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const ST_ICON = { won: 'check', lost: 'x', push: 'minus', void: 'slash', partial: 'half', pending: 'clock' };

  /* ---------- formatting helpers ---------- */
  const money = (n) => F.money(n);
  const baht = (n) => (n == null ? '—' : '฿' + F.money(n));
  const sbaht = (n) => (n == null ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + '฿' + F.money(Math.abs(n)));
  const cls = (n) => (n == null ? 'faint' : n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');
  const signedSpan = (n) => `<span class="${cls(n)}">${esc(F.signed(n))}</span>`;
  const compact = (n) => { const a = Math.abs(n), s = n < 0 ? '−' : ''; if (a >= 1000) return s + (a / 1000).toFixed(a % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K'; return s + Math.round(a); };
  const badge = (s) => `<span class="st st-${esc(s)}">${ic(ST_ICON[s] || 'info')}${esc((C.STATUS[s] || { th: s }).th)}</span>`;
  const team = (name) => `<span class="tm" title="${esc(C.canonicalTeam(name))}"><i style="--c:${esc(C.teamColor(name))}" aria-hidden="true"></i>${esc(C.abbr(name))}</span>`;
  const tkLink = (id) => `<a href="#/ticket/${Number(id)}" class="code">#${Number(id)}</a>`;
  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u.trim()) ? u.trim() : null);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'ลิงก์'; } };
  const srcLink = (u) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer" title="${esc(s)}">${esc(host(s))} ${ic('ext')}</a>` : '<span class="faint">ลิงก์ไม่ถูกต้อง</span>'; };
  const marketTxt = (b) => b.market === 'Spread' ? `แต้มต่อ · ${SIDE_TH[b.side] || ''}` : MARKET_TH[b.market];
  const tipFor = (b) => (GAME_BY_KEY.get(b.gameKey) || {}).tipoff || null;
  const empty = (title, body, icon = 'info') => `<div class="empty" role="status"><span class="ei">${ic(icon)}</span><div><h3>${esc(title)}</h3><p>${esc(body)}</p></div></div>`;
  const note = (txt) => `<div class="note">${ic('info')}<span>${esc(txt)}</span></div>`;

  /* leg result pips: real order when detail exists, grouped counts otherwise */
  function legResults(t) {
    if (t.hasDetail) return t.bets.map((b) => b.result);
    return [].concat(Array(t.legsWon).fill('won'), Array(t.legsPush).fill('push'), Array(t.legsVoid).fill('void'), Array(t.legsLost).fill('lost'), Array(Math.max(0, t.legsPending)).fill('pending'));
  }
  function legLabel(t) {
    const parts = [`ชนะ ${t.legsWon}`, `แพ้ ${t.legsLost}`];
    if (t.legsPush) parts.push(`เสมอ ${t.legsPush}`);
    if (t.legsVoid) parts.push(`โมฆะ ${t.legsVoid}`);
    if (t.legsPending) parts.push(`รอผล ${t.legsPending}`);
    return parts.join(' · ');
  }
  function pips(t, withTxt = true) {
    const r = legResults(t);
    const txt = t.status === 'pending' ? `${t.legsPending}/${t.legs} รอผล` : `${t.legsWon}-${t.legsLost}${t.legsPush ? '-' + t.legsPush : ''}`;
    return `<span class="pips" role="img" aria-label="${esc(t.legs + ' คู่: ' + legLabel(t))}" title="${esc(legLabel(t))}">${r.map((x) => `<i class="pip ${esc(x)}"></i>`).join('')}</span>${withTxt ? `<span class="pips-txt">${esc(txt)}</span>` : ''}`;
  }

  /* ---------- nav ---------- */
  const NAV = [
    ['dashboard', 'ภาพรวม', 'grid', 'ภาพรวม'],
    ['tickets', 'บิลเดิมพัน', 'ticket', 'บิล'],
    ['games', 'เกม NBA', 'court', 'เกม'],
    ['impact', 'ผลกระทบผู้เล่น', 'pulse', 'ผู้เล่น'],
    ['analytics', 'วิเคราะห์', 'chart', 'วิเคราะห์']
  ];
  const navCount = { tickets: K.totalTickets, games: GAMES.length, impact: FEED.length };
  function buildNav() {
    $('#sideNav').innerHTML = '<div class="nav-sec">พื้นที่ทำงาน</div>' + NAV.map(([r, th, icn]) =>
      `<a href="#/${r}" data-r="${r}" title="${esc(th)}">${ic(icn)}<span class="nav-label">${esc(th)}</span>${navCount[r] != null ? `<span class="count">${navCount[r]}</span>` : ''}</a>`).join('');
    $('#tabbar').innerHTML = NAV.map(([r, th, icn, short]) => `<a href="#/${r}" data-r="${r}">${ic(icn)}<span>${esc(short)}</span></a>`).join('');
    $('#sideMeta').textContent = C.snapshotNote;
    $('#statusbar').innerHTML = `<span>${esc(C.snapshotNote)}</span><span class="sep" aria-hidden="true"></span><span>เกมและผลกระทบผู้เล่นมาจากคู่ที่บันทึกในบิลเท่านั้น · ไม่มีข้อมูลสด</span><span class="sep" aria-hidden="true"></span><span>เวลาแข่งเป็นเวลาไทย (ICT)</span><span class="sep d-only" aria-hidden="true"></span><span class="d-only"><kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd> ค้นหา · <kbd>1</kbd>–<kbd>5</kbd> สลับหน้า</span>`;
  }
  const app = $('#app');
  function setCollapsed(v) { app.dataset.collapsed = String(v); const b = $('#collapseBtn'); b.setAttribute('aria-expanded', String(!v)); b.querySelector('span').textContent = v ? 'ขยายเมนู' : 'ย่อเมนู'; b.setAttribute('aria-label', v ? 'ขยายเมนู' : 'ย่อเมนู'); }
  $('#collapseBtn').addEventListener('click', () => setCollapsed(app.dataset.collapsed !== 'true'));
  setCollapsed(window.innerWidth < 1280);

  /* =================== charts (hand-built SVG, rendered at real pixel width) =================== */
  function niceTicks(min, max, n) {
    const span = max - min || 1; const raw = span / n; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) || raw;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }
  const tfLog = (v) => Math.sign(v) * Math.log10(1 + Math.abs(v));
  function logTicks(lo, hi) {
    const out = [0];
    for (let p = 10; hi > 0; p *= 10) { out.push(p); if (p >= hi) break; }
    for (let p = 10; lo < 0; p *= 10) { out.unshift(-p); if (p >= -lo) break; }
    return out;
  }
  function chartFrame(el, data, h, log = false) {
    const W = Math.max(280, el.clientWidth), H = h;
    const m = { t: 20, r: 12, b: 26, l: 48 };
    const vals = data.map((d) => d.y);
    const tf = log ? tfLog : (v) => v;
    const ticks = log ? logTicks(Math.min(0, ...vals), Math.max(0, ...vals)) : niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), H < 200 ? 3 : 4);
    const y0 = tf(ticks[0]), y1 = tf(ticks[ticks.length - 1]);
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const ys = (v) => m.t + ih - ((tf(v) - y0) / (y1 - y0)) * ih;
    const step = iw / data.length;
    const xs = (i) => m.l + step * i + step / 2;
    const every = step >= 38 ? 1 : step >= 20 ? 2 : 3;
    let g = ticks.map((t) => `<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${ys(t)}" y2="${ys(t)}"/><text class="axis" x="${m.l - 8}" y="${ys(t) + 4}" text-anchor="end">${esc(compact(t))}</text>`).join('');
    g += `<line class="zero" x1="${m.l}" x2="${W - m.r}" y1="${ys(0)}" y2="${ys(0)}"/>`;
    g += data.map((d, i) => ((data.length - 1 - i) % every === 0) ? `<text class="axis" x="${xs(i)}" y="${H - 8}" text-anchor="middle">${esc(F.dateShort(d.x))}</text>` : '').join('');
    return { W, H, m, ys, xs, step, g, ih };
  }
  function hoverLayer(fr, data, id) {
    return data.map((d, i) => `<rect class="hit" x="${fr.m.l + fr.step * i}" y="${fr.m.t}" width="${fr.step}" height="${fr.ih}" data-read="${esc(d.read)}" data-for="${id}"><title>${esc(d.read)}</title></rect>`).join('');
  }
  function drawArea(el) {
    const data = A.daily.map((d) => ({ x: d.date, y: d.cumulative, read: `${F.dateTH(d.date)} · สะสม ${sbaht(d.cumulative)} · วันนั้น ${sbaht(d.net)} · ${d.tickets} บิล` }));
    const fr = chartFrame(el, data, Number(el.dataset.h) || 240);
    const pts = data.map((d, i) => [fr.xs(i), fr.ys(d.y)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${fr.ys(0)} L${pts[0][0].toFixed(1)} ${fr.ys(0)} Z`;
    const maxI = data.reduce((b, d, i) => (d.y > data[b].y ? i : b), 0); const last = data.length - 1;
    let s = fr.g + `<path class="area" d="${area}"/><path class="line" d="${line}"/>`;
    s += pts.map((p, i) => `<circle class="dotp${i === maxI ? ' hi' : ''}" cx="${p[0]}" cy="${p[1]}" r="${i === maxI || i === last ? 3.5 : 2.2}"/>`).join('');
    s += `<text class="lbl amber" x="${Math.min(pts[maxI][0], fr.W - 60)}" y="${pts[maxI][1] - 9}" text-anchor="middle">สูงสุด ${esc(compact(data[maxI].y))}</text>`;
    s += `<text class="lbl" x="${fr.W - fr.m.r}" y="${pts[last][1] + 18}" text-anchor="end">${esc(F.signed(data[last].y))}</text>`;
    s += hoverLayer(fr, data, el.id);
    el.innerHTML = `<svg width="${fr.W}" height="${fr.H}" role="img" aria-label="กราฟกำไรขาดทุนสะสมรายวัน ล่าสุด ${esc(sbaht(data[last].y))}">${s}</svg>`;
  }
  function drawBars(el) {
    const data = A.daily.map((d) => ({ x: d.date, y: d.net, read: `${F.dateTH(d.date)} · สุทธิ ${sbaht(d.net)} · เดิมพัน ${baht(d.stake)} · ชนะ ${d.won}/${d.tickets} บิล` }));
    const log = state.scale === 'log';
    const fr = chartFrame(el, data, Number(el.dataset.h) || 200, log);
    const bw = Math.max(4, Math.min(28, fr.step * 0.56)); const z = fr.ys(0);
    let s = fr.g;
    data.forEach((d, i) => {
      const y = fr.ys(d.y); let top = Math.min(y, z), h = Math.abs(y - z); if (h < 2) { h = 2; if (d.y < 0) top = z; else top = z - 2; }
      s += `<rect class="${d.y >= 0 ? 'bar-pos' : 'bar-neg'}" x="${fr.xs(i) - bw / 2}" y="${top}" width="${bw}" height="${h}" rx="1"/>`;
      if (fr.step >= 44 || d.y > 0 || log) s += `<text class="lbl ${d.y >= 0 ? 'pos' : 'neg'}" x="${fr.xs(i)}" y="${d.y >= 0 ? top - 5 : top + h + 12}" text-anchor="middle">${esc(compact(d.y))}</text>`;
    });
    s += hoverLayer(fr, data, el.id);
    el.innerHTML = `<svg width="${fr.W}" height="${fr.H}" role="img" aria-label="กราฟแท่งกำไรขาดทุนสุทธิรายวัน · ${log ? 'สเกลลอการิทึม' : 'สเกลเส้นตรง'}">${s}</svg>`;
    const sn = document.getElementById(el.id + '-scale'); if (sn) sn.textContent = log ? 'สเกล LOG: ระยะแกน Y ไม่เป็นเส้นตรง — ช่วยให้เห็นวันขาดทุนเล็ก ๆ ข้างวันที่ชนะก้อนใหญ่ · ตัวเลขบนแท่งคือค่าจริง' : '';
  }
  function drawCharts() {
    $$('.chart[data-chart]').forEach((el) => { if (el.dataset.chart === 'cum') drawArea(el); else if (el.dataset.chart === 'daily') drawBars(el); });
  }
  document.addEventListener('pointerover', (e) => {
    const r = e.target.closest && e.target.closest('rect.hit'); if (!r) return;
    const out = document.getElementById(r.dataset.for + '-read'); if (out) out.textContent = r.dataset.read;
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCharts, 120); });
  const chartBox = (id, kind, h, hint) => `<div class="chart" id="${id}" data-chart="${kind}" data-h="${h}"></div>${kind === 'daily' ? `<div class="scale-note" id="${id}-scale" aria-live="polite"></div>` : ''}<div class="chart-read" id="${id}-read" aria-live="polite">${esc(hint)}</div>`;
  const scaleSeg = () => `<div class="seg sm" role="group" aria-label="สเกลแกน Y"><button type="button" data-scale="lin" aria-pressed="${state.scale === 'lin'}">เส้นตรง</button><button type="button" data-scale="log" aria-pressed="${state.scale === 'log'}">LOG</button></div>`;
  const dailyLegend = () => `<div class="hd-tools"><div class="legend"><span><i class="w"></i>กำไร</span><span><i class="l"></i>ขาดทุน</span></div>${scaleSeg()}</div>`;

  /* =================== shared blocks =================== */
  function kpiStrip(items) {
    return `<section class="kpis" aria-label="ตัวชี้วัดหลัก">${items.map((k) => `<div class="kpi"><div class="kpi-l"><span>${esc(k.l)}</span>${k.delta || ''}</div><div class="kpi-v ${k.vc || ''}" ${k.title ? `title="${esc(k.title)}"` : ''}>${k.v}</div>${k.extra || ''}<div class="kpi-c">${k.c}</div></div>`).join('')}</section>`;
  }
  const monthly = A.monthly; const mNov = monthly[monthly.length - 1], mOct = monthly[monthly.length - 2] || mNov; /* last two months */
  const mShort = (m) => m.label.split(' ')[0];
  function statusStack() {
    const parts = [['won', K.won, 'var(--win)'], ['lost', K.lost, 'var(--loss)'], ['pending', K.pendingTickets, 'var(--pending)'], ['push', K.push, 'var(--push)'], ['void', K.void, 'var(--push)'], ['partial', K.partial, 'var(--push)']];
    return `<div class="stack" role="img" aria-label="${esc(parts.map((p) => C.STATUS[p[0]].th + ' ' + p[1]).join(', '))}" style="margin:6px 0 2px">${parts.filter((p) => p[1]).map((p) => `<i style="width:${(p[1] / K.totalTickets) * 100}%;background:${p[2]}"></i>`).join('')}</div>`;
  }
  function ticketTable(list, { sortable = false, compactCols = false, so = false } = {}) {
    const href = (id) => (so ? '#/tickets/' : '#/ticket/') + id;
    const th = (key, label, numCls) => {
      if (!sortable || !key) return `<th class="${numCls ? 'num' : ''}" scope="col">${label}</th>`;
      const isDate = key === 'date';
      const active = isDate ? state.sort.startsWith('date') : state.sort === key;
      const dir = isDate && state.sort === 'date-asc' ? 'ascending' : 'descending';
      return `<th class="${numCls ? 'num' : ''}" scope="col" ${active ? `aria-sort="${dir}"` : ''}><button type="button" class="sortbtn" data-sort="${key}">${label}${ic(active && dir === 'ascending' ? 'up' : 'down')}</button></th>`;
    };
    const rows = list.map((t) => `<tr class="rowlink is-${esc(t.status)}" data-href="${href(t.id)}">
      <td class="tight"><a class="lead" href="${href(t.id)}">#${t.id}</a> <span class="code">${esc(t.short)}</span></td>
      <td class="tight">${esc(F.dateTH(t.date))}</td>
      <td>${pips(t)}${t.hasDetail ? '' : ' <span class="faint" title="ไม่มีรายละเอียดรายคู่ใน snapshot">*</span>'}</td>
      <td class="num">${money(t.stake)}</td>
      ${compactCols ? '' : `<td class="num ${t.payout == null ? 'faint' : 'muted'}" ${t.payout == null ? 'title="ไม่ได้บันทึกยอดจ่ายหากชนะ"' : ''}>${money(t.payout)}</td>`}
      <td class="num">${t.actualPayout == null ? '<span class="faint">รอผล</span>' : money(t.actualPayout)}</td>
      <td class="num">${t.profit == null ? '<span class="faint">—</span>' : signedSpan(t.profit)}</td>
      <td class="tight">${badge(t.status)}</td></tr>`).join('');
    return `<table class="dt stack-m"><thead><tr>
      ${th(null, 'บิล')}${th('date', 'วันที่')}${th('legs-desc', 'คู่ (ผลรายขา)')}${th('stake-desc', 'เดิมพัน ฿', 1)}
      ${compactCols ? '' : th('payout-desc', 'ยอดจ่ายหากชนะ ฿', 1)}${th(null, 'จ่ายจริง ฿', 1)}${th('profit-desc', 'กำไร/ขาดทุน ฿', 1)}${th(null, 'สถานะ')}
      </tr></thead><tbody>${rows}</tbody></table>` + ticketCards(list);
  }
  function ticketCards(list) {
    return `<div class="stacked">${list.map((t) => `<a class="srow is-${esc(t.status)}" href="#/ticket/${t.id}" aria-label="${esc(`บิล #${t.id} ${C.STATUS[t.status].th}`)}">
      <div class="srow-top"><span><span class="id">#${t.id}</span> <span class="code">${esc(t.short)}</span></span>${badge(t.status)}</div>
      <div class="srow-mid"><span>${esc(F.dateTH(t.date))} · ${t.legs} คู่</span>${pips(t)}</div>
      <div class="srow-grid">
        <div><span>เดิมพัน</span><b>${baht(t.stake)}</b></div>
        <div><span>หากชนะ</span><b>${baht(t.payout)}</b></div>
        <div><span>จ่ายจริง</span><b>${t.actualPayout == null ? 'รอผล' : baht(t.actualPayout)}</b></div>
        <div><span>สุทธิ</span><b class="${cls(t.profit)}">${t.profit == null ? '—' : esc(sbaht(t.profit))}</b></div>
      </div></a>`).join('')}</div>`;
  }

  /* =================== views =================== */
  function viewDashboard() {
    const recent = C.queryTickets({ sort: 'date-desc' }).slice(0, 8);
    const pending = C.tickets.filter((t) => t.status === 'pending');
    const upcoming = GAMES.filter((g) => g.status === 'upcoming').sort((a, b) => (a.tipoff || '').localeCompare(b.tipoff || ''));
    const bw = K.biggestWin;
    const dNov = mNov.net - mOct.net;
    const kp = [
      { l: 'บิลทั้งหมด', v: String(K.totalTickets), c: `ตัดสินแล้ว <b>${K.settled}</b> · รอผล <b>${K.pendingTickets}</b>` },
      { l: 'เงินเดิมพันรวม', v: baht(K.stakeAll), c: `ตัดสินแล้ว <b>${baht(K.stakeSettled)}</b> · รอผล <b>${baht(K.stakePending)}</b>` },
      { l: 'ยอดจ่ายจริง', v: baht(K.payoutActual), c: `จาก ${K.won} บิลที่ชนะ · รอผลหากชนะ <b>${baht(K.potentialPending)}</b>` },
      { l: 'กำไร/ขาดทุนสุทธิ', v: `<span class="${cls(K.net)}">${esc(sbaht(K.net))}</span>`, delta: `<span class="delta ${dNov >= 0 ? 'up' : 'down'}" title="${esc(mShort(mNov))} ${sbaht(mNov.net)} เทียบ ${esc(mShort(mOct))} ${sbaht(mOct.net)}">${esc(mShort(mNov))} ${esc(sbaht(mNov.net))}</span>`, c: 'เฉพาะบิลที่ตัดสินแล้ว · ไม่รวมบิลรอผล' },
      { l: 'ROI', v: `<span class="${cls(K.roi)}">${esc(F.signedPct(K.roi))}</span>`, delta: `<span class="delta flat" title="ROI เดือนก่อนหน้า">${esc(mShort(mOct))} ${esc(F.signedPct(mOct.roi))}</span>`, c: 'กำไร ÷ เงินเดิมพันของบิลที่ตัดสินแล้ว' },
      { l: 'อัตราชนะรายบิล', v: esc(F.pct(K.ticketWinRate)), extra: `<div class="bullet" role="img" aria-label="อัตราชนะรายบิล ${esc(F.pct(K.ticketWinRate))}"><i class="a" style="width:${K.ticketWinRate * 100}%"></i></div>`, c: `ชนะ <b>${K.won}</b> · แพ้ <b>${K.lost}</b> (ชนะ ÷ ชนะ+แพ้)` },
      { l: 'อัตราชนะรายคู่', v: esc(F.pct(K.legWinRate)), extra: `<div class="bullet" role="img" aria-label="อัตราชนะรายคู่ ${esc(F.pct(K.legWinRate))} เส้นอ้างอิง 50%"><i style="width:${K.legWinRate * 100}%"></i><span class="ref" style="left:50%"></span></div>`, c: `ชนะ <b>${K.legs.won}</b> · แพ้ <b>${K.legs.lost}</b> · เสมอ <b>${K.legs.push}</b> จาก ${K.legs.n} คู่` },
      { l: 'สถานะบิล', v: `${K.won}<small>ชนะ</small> ${K.lost}<small>แพ้</small> ${K.pendingTickets}<small>รอ</small>`, extra: statusStack(), c: `เสมอ <b>${K.push}</b> · โมฆะ <b>${K.void}</b> · บางส่วน <b>${K.partial}</b>` }
    ];
    return `<div class="ph"><div><div class="eyebrow">Overview · ฤดูกาล 2026–27</div><h1>ภาพรวมพอร์ตเดิมพัน</h1>
      <p>ตัวเลขทั้งหมดคำนวณจากบิลจริง ${K.totalTickets} ใบ (${esc(F.dateTH(DATE_MIN))} – ${esc(F.dateTH(DATE_MAX))}) · บิลรอผลไม่ถูกนับในกำไร/ขาดทุน</p></div>
      <a class="btn" href="#/analytics">${ic('chart')}เปิดหน้าวิเคราะห์</a></div>
      ${kpiStrip(kp)}
      <div class="grid">
        <section class="card s8" aria-labelledby="h-cum"><div class="card-h"><h2 id="h-cum">กำไร/ขาดทุนสะสม</h2><span class="sub">รายวัน · ${A.daily.length} วันที่มีบิลตัดสินแล้ว</span></div>
          <div class="card-b">${chartBox('dCum', 'cum', 236, 'ชี้ที่กราฟเพื่อดูยอดแต่ละวัน')}</div></section>
        <section class="card s4" aria-labelledby="h-pend"><div class="card-h"><h2 id="h-pend">บิลรอผล</h2><span class="sub">${pending.length} ใบ · เดิมพัน ${baht(K.stakePending)}</span></div>
          <div class="card-b flush">${pending.map((t) => { const tips = [...new Set(t.bets.map(tipFor).filter(Boolean))].sort();
            return `<a class="srow is-pending" style="display:block" href="#/ticket/${t.id}"><div class="srow-top"><span><b>#${t.id}</b> <span class="code">${esc(t.short)}</span></span><span class="num"><span class="faint">หากชนะ</span> <b class="amber">${baht(t.payout)}</b></span></div>
              <div class="srow-mid" style="margin:0"><span>${t.legs} คู่ · เดิมพัน ${baht(t.stake)}${tips.length ? ` · เริ่ม ${esc(tips[0])} ICT` : ''}</span>${pips(t, false)}</div></a>`; }).join('')}</div>
          <div class="card-f">ยอดจ่ายหากชนะรวม <b class="amber">${baht(K.potentialPending)}</b> · ต้องผ่านทุกคู่ในบิล</div></section>
        <section class="card s8" aria-labelledby="h-daily"><div class="card-h"><h2 id="h-daily">สุทธิรายวัน</h2>${dailyLegend()}</div>
          <div class="card-b">${chartBox('dDaily', 'daily', 196, 'แท่งเทียบกับเส้นศูนย์ · วันที่ขาดทุนจะอยู่ใต้เส้น')}</div></section>
        <section class="card s4" aria-labelledby="h-best"><div class="card-h"><h2 id="h-best">ไฮไลต์</h2></div>
          <div class="card-b"><dl class="kv">
            <div><dt>บิลที่ได้มากสุด</dt><dd><a href="#/ticket/${bw.id}">#${bw.id}</a> · <span class="pos">${esc(sbaht(bw.profit))}</span></dd></div>
            <div><dt>วันที่ดีที่สุด</dt><dd>${(() => { const d = A.daily.reduce((a, b) => (b.net > a.net ? b : a)); return esc(F.dateTH(d.date)) + ' · <span class="pos">' + esc(sbaht(d.net)) + '</span>'; })()}</dd></div>
            <div><dt>เดือน ${esc(mShort(mOct))} → ${esc(mShort(mNov))}</dt><dd><span class="${cls(mOct.net)}">${esc(sbaht(mOct.net))}</span> → <span class="${cls(mNov.net)}">${esc(sbaht(mNov.net))}</span></dd></div>
            <div><dt>ขนาดสเต็ปที่ใช้บ่อย</dt><dd>${(() => { const p = A.parlay.reduce((a, b) => (b.tickets > a.tickets ? b : a)); return `${p.legs} คู่ · ${p.tickets} บิล`; })()}</dd></div>
            <div><dt>คู่ที่บันทึกทั้งหมด</dt><dd>${K.legs.n} คู่ (ตัดสินแล้ว)</dd></div>
          </dl></div></section>
        <section class="card s8" aria-labelledby="h-recent"><div class="card-h"><h2 id="h-recent">กิจกรรมล่าสุด</h2><a class="link-more" href="#/tickets">ดูบิลทั้งหมด →</a></div>
          <div class="card-b flush tbl-wrap">${ticketTable(recent, { compactCols: true })}</div>
          <div class="card-f">* บิลก่อน #36 ไม่มีรายละเอียดรายคู่ใน snapshot นี้ แสดงเฉพาะจำนวนคู่ที่ชนะ/แพ้ (ไม่ทราบลำดับ)</div></section>
        <section class="card s4" aria-labelledby="h-up"><div class="card-h"><h2 id="h-up">เกมที่รอผล</h2><a class="link-more" href="#/games">ทั้งหมด →</a></div>
          <div class="card-b flush tbl-wrap"><table class="dt"><thead><tr><th scope="col">ICT</th><th scope="col">เกม</th><th scope="col" class="num">คู่ของฉัน</th></tr></thead><tbody>
          ${upcoming.map((g) => `<tr class="rowlink" data-href="#/games/${GAME_IDX.get(g.key)}"><td class="tight amber">${phase(g) === 'started' ? '<span style="color:var(--pending)">เริ่มแล้ว</span>' : esc(g.tipoff || '—')}</td><td><a href="#/games/${GAME_IDX.get(g.key)}" class="sr-only">เปิดการ์ดเกม</a>${team(g.teams[0])} <span class="faint">vs</span> ${team(g.teams[1])}</td><td class="num">${g.legs.length}</td></tr>`).join('')}
          </tbody></table></div><div class="card-f">${esc(F.dateTH(upcoming[0] ? upcoming[0].date : null))} · เวลาไทย</div></section>
      </div>`;
  }

  function viewTickets() {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, s === 'all' ? C.tickets.length : C.tickets.filter((t) => t.status === s).length]));
    const statusLabel = (s) => (s === 'all' ? 'ทั้งหมด' : C.STATUS[s].th);
    return `<div class="ph"><div><div class="eyebrow">Ticket management</div><h1>บิลเดิมพัน</h1><p>ค้นหาด้วยรหัสบิลหรือทีม (เช่น DAL, Lakers) · กรองตามสถานะ · คลิกหัวคอลัมน์เพื่อเรียง</p></div></div>
      <section class="card" aria-label="ตารางบิล">
        <div class="toolbar">
          <div class="field grow-0"><label for="q" class="d-only">ค้นหา</label><label for="q" class="sr-only">ค้นหาบิล</label>
            <div class="search">${ic('search')}<input id="q" class="input" type="search" placeholder="รหัสบิล หรือทีม เช่น DAL" value="${esc(state.q)}" autocomplete="off"></div></div>
          <div class="field d-only"><label id="stLbl">สถานะ</label><div class="seg" role="group" aria-labelledby="stLbl" id="stSeg">
            ${STATUSES.map((s) => `<button type="button" data-status="${s}" aria-pressed="${state.status === s}">${esc(statusLabel(s))}<span class="n">${counts[s]}</span></button>`).join('')}</div></div>
          <div class="field d-only"><label for="sortSel">เรียงตาม</label><select id="sortSel" class="select">${SORTS.map(([k, l]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          <button type="button" class="btn d-only" id="advBtn" aria-expanded="${state.adv}" aria-controls="adv">${ic('filter')}ตัวกรองขั้นสูง<span class="tag accent" id="advBadge"></span></button>
          <button type="button" class="btn m-only" id="openSheet" aria-haspopup="dialog">${ic('filter')}ตัวกรอง<span class="tag accent" id="fBadge"></span></button>
        </div>
        <div class="adv d-only" id="adv" ${state.adv ? '' : 'hidden'} role="group" aria-label="ตัวกรองขั้นสูง">
          <div class="field"><label id="lgLbl">จำนวนคู่ในบิล</label><div class="range" role="group" aria-labelledby="lgLbl">
            <label class="sr-only" for="legMin">อย่างน้อย</label><select class="select" id="legMin">${legOpts(state.legsMin, 'ไม่จำกัด')}</select><span>ถึง</span>
            <label class="sr-only" for="legMax">ไม่เกิน</label><select class="select" id="legMax">${legOpts(state.legsMax, 'ไม่จำกัด')}</select></div></div>
          <div class="field"><label id="dtLbl">วันที่วางบิล</label><div class="range" role="group" aria-labelledby="dtLbl">
            <label class="sr-only" for="dFrom">ตั้งแต่</label><input class="input" type="date" id="dFrom" min="${DATE_MIN}" max="${DATE_MAX}" value="${esc(state.dFrom)}"><span>–</span>
            <label class="sr-only" for="dTo">ถึง</label><input class="input" type="date" id="dTo" min="${DATE_MIN}" max="${DATE_MAX}" value="${esc(state.dTo)}"></div></div>
          <div class="field"><label id="psLbl">ช่วงด่วน</label><div class="presets" role="group" aria-labelledby="psLbl">${PRESETS.map(([k, l]) => `<button type="button" class="btn" data-preset="${k}">${esc(l)}</button>`).join('')}</div></div>
          <button type="button" class="btn ghost" id="advReset">ล้างตัวกรองขั้นสูง</button>
        </div>
        <div id="tkResults"></div>
      </section>`;
  }
  function legOpts(sel, anyTxt) { return `<option value="0">${esc(anyTxt)}</option>` + LEG_OPTS.map((n) => `<option value="${n}" ${sel === n ? 'selected' : ''}>${n} คู่</option>`).join(''); }
  const PRESETS = (() => { const months = [...new Set(C.tickets.map((t) => t.date.slice(0, 7)))]; const TM = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return [['last3', '3 วันล่าสุด'], ...months.map((m) => ['m:' + m, TM[Number(m.slice(5)) - 1]])]; })();
  function applyPreset(k) {
    if (k === 'last3') { const d = new Date(DATE_MAX + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 2); state.dFrom = d.toISOString().slice(0, 10); state.dTo = DATE_MAX; }
    else if (k.startsWith('m:')) { const m = k.slice(2); const [y, mo] = m.split('-').map(Number); state.dFrom = m + '-01'; state.dTo = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); }
  }
  const advCount = () => (state.legsMin ? 1 : 0) + (state.legsMax ? 1 : 0) + (state.dFrom || state.dTo ? 1 : 0);
  function advFilter(list) {
    return list.filter((t) => (!state.legsMin || t.legs >= state.legsMin) && (!state.legsMax || t.legs <= state.legsMax) && (!state.dFrom || t.date >= state.dFrom) && (!state.dTo || t.date <= state.dTo));
  }
  function advTxt() {
    const p = [];
    if (state.legsMin || state.legsMax) p.push(state.legsMin && state.legsMax ? (state.legsMin === state.legsMax ? `${state.legsMin} คู่` : `${state.legsMin}–${state.legsMax} คู่`) : state.legsMin ? `≥ ${state.legsMin} คู่` : `≤ ${state.legsMax} คู่`);
    if (state.dFrom || state.dTo) p.push(`${state.dFrom ? F.dateTH(state.dFrom) : 'เริ่มต้น'} – ${state.dTo ? F.dateTH(state.dTo) : 'ล่าสุด'}`);
    return p.join(' · ');
  }
  function renderTicketResults() {
    const box = $('#tkResults'); if (!box) return;
    const list = advFilter(C.queryTickets({ q: state.q, status: state.status, sort: state.sort }));
    const stTxt = state.status === 'all' ? 'ทุกสถานะ' : C.STATUS[state.status].th;
    const sortTxt = (SORTS.find((s) => s[0] === state.sort) || SORTS[0])[1];
    const sumStake = list.reduce((s, t) => s + t.stake, 0), sumNet = list.reduce((s, t) => s + (t.profit || 0), 0);
    let body;
    if (!list.length) {
      const why = state.status !== 'all' && !C.tickets.some((t) => t.status === state.status)
        ? `ยังไม่มีบิลสถานะ "${stTxt}" ในประวัติทั้งหมด ${C.tickets.length} ใบ — ระบบแสดงสถานะนี้ไว้ให้กรองได้เมื่อมีข้อมูลจริง`
        : `ลองล้างคำค้น เปลี่ยนสถานะ หรือล้างตัวกรองขั้นสูง · การค้นหาตามทีมทำได้เฉพาะบิล #36–#${MAX_ID} ที่มีรายละเอียดรายคู่`;
      body = `<div style="padding:var(--sp-4)">${empty('ไม่พบบิลตามเงื่อนไขที่เลือก', why, 'search')}</div>`;
    } else body = `<div class="tbl-wrap scroll">${ticketTable(list, { sortable: true, so: isWide() })}</div>`;
    box.innerHTML = `<div class="toolbar" style="padding-top:var(--sp-2);padding-bottom:var(--sp-2);border-bottom:${list.length ? '1px solid var(--border)' : '0'}">
        <span class="result-meta" role="status" aria-live="polite" id="tkMeta" style="padding:0">${list.length} บิล · ${esc(stTxt)}${state.q ? ` · ค้นหา "${esc(state.q)}"` : ''}${advCount() ? ` · ${esc(advTxt())}` : ''} · <span class="m-inline">${esc(sortTxt)} · </span>เดิมพัน ${baht(sumStake)} · สุทธิ <span class="${cls(sumNet)}">${esc(sbaht(sumNet))}</span></span></div>${body}
      ${list.length ? '<div class="card-f">* ไม่มีรายละเอียดรายคู่ใน snapshot นี้ (บิลก่อน #36) — แท่งผลแสดงจำนวนชนะ/เสมอ/แพ้ ไม่ใช่ลำดับจริง · ค้นหาตามทีมได้เฉพาะบิลที่มีรายละเอียด</div>' : ''}`;
    $$('#stSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === state.status)));
    const fb = $('#fBadge'); if (fb) { const n = (state.status !== 'all') + (state.sort !== 'date-desc') + advCount(); fb.textContent = n ? String(n) : ''; fb.style.display = n ? '' : 'none'; }
    const ab = $('#advBadge'); if (ab) { const n = advCount(); ab.textContent = n ? String(n) : ''; ab.style.display = n ? '' : 'none'; }
  }
  function bindTickets() {
    $('#q').addEventListener('input', (e) => { state.q = e.target.value; renderTicketResults(); });
    $('#stSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-status]'); if (!b) return; state.status = b.dataset.status; renderTicketResults(); });
    $('#sortSel').addEventListener('change', (e) => { state.sort = e.target.value; renderTicketResults(); });
    $('#tkResults').addEventListener('click', (e) => {
      const sb = e.target.closest('.sortbtn');
      if (sb) { const k = sb.dataset.sort; state.sort = k === 'date' ? (state.sort === 'date-desc' ? 'date-asc' : 'date-desc') : k; $('#sortSel').value = state.sort; renderTicketResults(); const nb = $(`.sortbtn[data-sort="${k}"]`); if (nb) nb.focus(); return; }
    });
    $('#openSheet').addEventListener('click', openSheet);
    const syncAdv = () => { $('#legMin').value = String(state.legsMin); $('#legMax').value = String(state.legsMax); $('#dFrom').value = state.dFrom; $('#dTo').value = state.dTo; renderTicketResults(); };
    $('#advBtn').addEventListener('click', (e) => { state.adv = !state.adv; $('#adv').hidden = !state.adv; e.currentTarget.setAttribute('aria-expanded', String(state.adv)); if (state.adv) $('#legMin').focus(); });
    $('#legMin').addEventListener('change', (e) => { state.legsMin = Number(e.target.value); if (state.legsMax && state.legsMin > state.legsMax) state.legsMax = state.legsMin; syncAdv(); });
    $('#legMax').addEventListener('change', (e) => { state.legsMax = Number(e.target.value); if (state.legsMax && state.legsMin > state.legsMax) state.legsMin = state.legsMax; syncAdv(); });
    $('#dFrom').addEventListener('change', (e) => { state.dFrom = e.target.value; if (state.dTo && state.dFrom > state.dTo) state.dTo = state.dFrom; syncAdv(); });
    $('#dTo').addEventListener('change', (e) => { state.dTo = e.target.value; if (state.dFrom && state.dTo && state.dFrom > state.dTo) state.dFrom = state.dTo; syncAdv(); });
    $('#adv').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (!b) return; applyPreset(b.dataset.preset); syncAdv(); });
    $('#advReset').addEventListener('click', () => { state.legsMin = 0; state.legsMax = 0; state.dFrom = ''; state.dTo = ''; syncAdv(); });
    renderTicketResults();
  }
  /* bottom sheet (mobile filters) */
  const sheet = $('#filterSheet');
  function openSheet() {
    const cnt = (s) => (s === 'all' ? C.tickets.length : C.tickets.filter((t) => t.status === s).length);
    $('#sheetStatus').innerHTML = STATUSES.map((s) => `<label class="opt"><input type="radio" name="fst" value="${s}" ${state.status === s ? 'checked' : ''}><span>${esc(s === 'all' ? 'ทั้งหมด' : C.STATUS[s].th)}<span class="faint">${cnt(s)}</span></span></label>`).join('');
    $('#sheetSort').innerHTML = SORTS.map(([k, l]) => `<label class="opt" style="grid-column:span 2"><input type="radio" name="fso" value="${k}" ${state.sort === k ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('');
    $('#sLegMin').innerHTML = legOpts(state.legsMin, 'อย่างน้อย: ไม่จำกัด'); $('#sLegMax').innerHTML = legOpts(state.legsMax, 'ไม่เกิน: ไม่จำกัด');
    ['sFrom', 'sTo'].forEach((i) => { const el = $('#' + i); el.min = DATE_MIN; el.max = DATE_MAX; }); $('#sFrom').value = state.dFrom; $('#sTo').value = state.dTo;
    sheet.showModal();
  }
  function applySheet() {
    const st = $('input[name="fst"]:checked', sheet), so = $('input[name="fso"]:checked', sheet);
    if (st) state.status = st.value; if (so) state.sort = so.value;
    state.legsMin = Number($('#sLegMin').value); state.legsMax = Number($('#sLegMax').value); if (state.legsMin && state.legsMax && state.legsMin > state.legsMax) [state.legsMin, state.legsMax] = [state.legsMax, state.legsMin];
    state.dFrom = $('#sFrom').value; state.dTo = $('#sTo').value; if (state.dFrom && state.dTo && state.dFrom > state.dTo) [state.dFrom, state.dTo] = [state.dTo, state.dFrom];
    const sel = $('#sortSel'); if (sel) sel.value = state.sort;
    sheet.close(); renderTicketResults();
  }
  $('#sheetApply').addEventListener('click', applySheet);
  $('#sheetClose').addEventListener('click', () => sheet.close());
  $('#sheetReset').addEventListener('click', () => { state.status = 'all'; state.sort = 'date-desc'; state.legsMin = 0; state.legsMax = 0; state.dFrom = ''; state.dTo = ''; const sel = $('#sortSel'); if (sel) sel.value = state.sort; sheet.close(); renderTicketResults(); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
