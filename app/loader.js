/* NBA Bet Tracker — loader. Reads settings (localStorage "nbaTrackerConfig", same as classic.html), applies the theme,
   fetches public.tickets and public.bets read-only through the Supabase REST API with the publishable key, normalises
   every row (legacy totals, nicknames, text statuses) and starts the app. Never writes to the database.
   tickets.user_id is never requested for the default table. No betting data is stored in this file. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TICKET_COLS = 'id,ticket_code,bet_date,stake,payout_if_win,status,net_profit';
  const BET_COLS = 'id,ticket_id,selected_team,opponent,spread,odds,selected_score,opponent_score,result,game_date,player_impact';

  /* ---------- themes (same 8 presets as classic.html + 9 = Courtside Ledger + 10 = Arena Night, mobile design 10) ---------- */
  const THEMES = [
    { name: '1. Neon Court', bg: '#080d1d', panel: '#111a34', panel2: '#182747', line: '#2d3b61', text: '#f6f7ff', muted: '#a7b1d0', accent: '#ff4f91', accent2: '#ff9b52', good: '#45dfb0', bad: '#ff617b', on: '#1d0611' },
    { name: '2. Midnight Blue', bg: '#071522', panel: '#0e2435', panel2: '#153249', line: '#25465d', text: '#edf8ff', muted: '#94b5c7', accent: '#31c8d8', accent2: '#71e6f0', good: '#48d9a7', bad: '#ff7185', on: '#032026' },
    { name: '3. Black & Gold', bg: '#100f0c', panel: '#242116', panel2: '#302a19', line: '#6b562c', text: '#fff6df', muted: '#c5b996', accent: '#d8ad4b', accent2: '#f2d88e', good: '#62d5a0', bad: '#ff737b', on: '#17130a' },
    { name: '4. Clean Light', bg: '#f3f5fa', panel: '#ffffff', panel2: '#edf0f7', line: '#d9dfeb', text: '#172033', muted: '#5f6a80', accent: '#536de8', accent2: '#3d55c9', good: '#14865f', bad: '#d84359', on: '#ffffff', light: true },
    { name: '5. Forest Green', bg: '#081811', panel: '#10271d', panel2: '#193629', line: '#2c5942', text: '#effff4', muted: '#9abca8', accent: '#43c982', accent2: '#a1edac', good: '#70e2aa', bad: '#ff7788', on: '#04170d' },
    { name: '6. Sunset', bg: '#1b1016', panel: '#2b1822', panel2: '#3b202b', line: '#6a3544', text: '#fff3f1', muted: '#cba8ae', accent: '#ff785f', accent2: '#ffc078', good: '#64d9a5', bad: '#ff687e', on: '#220b06' },
    { name: '7. Royal Gold', bg: '#0b1020', panel: '#141f35', panel2: '#1b2a45', line: '#354764', text: '#f7f7fb', muted: '#a6b3c9', accent: '#c9a34b', accent2: '#f0d58b', good: '#4bd6a4', bad: '#ff7185', on: '#17130a' },
    { name: '8. Navy Teal', bg: '#07111f', panel: '#0d1b2e', panel2: '#13253d', line: '#21364f', text: '#eef6fb', muted: '#93a8bf', accent: '#2dd4bf', accent2: '#7ee8da', good: '#3ddc97', bad: '#ff6b81', on: '#04201c' },
    { name: '9. Courtside Ledger', bg: '#0B1220', panel: '#111A2E', panel2: '#16213A', line: '#24314F', text: '#E6EDF7', muted: '#A7B3C9', accent: '#3CC8D8', accent2: '#67D8E5', good: '#63C08F', bad: '#EC7F78', on: '#0B1220' },
    { name: '10. Arena Night', bg: '#05070D', panel: '#0D1322', panel2: '#121A2D', line: '#1E2A44', text: '#EEF3FF', muted: '#8C97B2', accent: '#3CF0FF', accent2: '#7FF6FF', good: '#5CF2A6', bad: '#FF7A8A', on: '#05070D', ui: 'arena' }
  ];
  const DEFAULT_THEME = '10';
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } } };
  /* one-time switch to the chosen redesign's palette; any later choice in ⚙ is kept */
  if (!store.get('nbaTrackerThemeV4')) { store.set('nbaTrackerTheme', DEFAULT_THEME); store.set('nbaTrackerThemeV3', '1'); store.set('nbaTrackerThemeV4', '1'); }
  const currentTheme = () => { const n = store.get('nbaTrackerTheme'); return THEMES[Number(n) - 1] ? String(n) : DEFAULT_THEME; };
  function applyTheme(n) {
    const t = THEMES[Number(n) - 1] || THEMES[Number(DEFAULT_THEME) - 1]; const r = document.documentElement.style;
    const mix = (a, b, p) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
    const set = { '--bg': t.bg, '--surface-1': t.panel, '--surface-2': t.panel2, '--surface-3': mix(t.panel2, t.line, 60), '--border': t.line,
      '--border-strong': mix(t.line, t.text, 78), '--text': t.text, '--text-2': t.muted, '--text-3': mix(t.muted, t.bg, t.light ? 88 : 82),
      '--accent': t.accent, '--accent-strong': t.accent2, '--accent-tint': mix(t.accent, 'transparent', 13), '--accent-line': mix(t.accent, 'transparent', 45),
      '--win': t.good, '--win-tint': mix(t.good, 'transparent', 13), '--loss': t.bad, '--loss-tint': mix(t.bad, 'transparent', 13),
      '--focus': t.accent2, '--on-accent': t.on, '--amber': t.light ? '#8a5a00' : '#E3B252', '--amber-tint': t.light ? 'rgba(138,90,0,.10)' : 'rgba(227,178,82,.13)',
      '--pending': t.light ? '#3c58b0' : '#9FB2E3', '--pending-tint': t.light ? 'rgba(60,88,176,.10)' : 'rgba(159,178,227,.13)',
      '--push': t.light ? '#5b6475' : '#B3BCCD', '--push-tint': t.light ? 'rgba(91,100,117,.10)' : 'rgba(179,188,205,.12)', '--ring': t.light ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.28)' };
    for (const k in set) r.setProperty(k, set[k]);
    r.colorScheme = t.light ? 'light' : 'dark';
    if (t.ui) document.documentElement.dataset.ui = t.ui; else delete document.documentElement.dataset.ui;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.bg;
    store.set('nbaTrackerTheme', String(THEMES.indexOf(t) + 1));
  }
  applyTheme(currentTheme());

  /* ---------- settings (same storage and validation as classic.html) ---------- */
  function config() { let c = {}; try { c = JSON.parse(store.get('nbaTrackerConfig') || '{}') || {}; } catch (e) { c = {}; } return { url: c.url || '', key: c.key || '', ticketsTable: c.ticketsTable || 'tickets', betsTable: c.betsTable || 'bets' }; }
  const validConfig = (c) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url) && /^sb_publishable_/.test(c.key);
  function setSettingsStatus(msg, type) { const el = $('#settingsStatus'); if (!el) return; el.hidden = !msg; el.className = 'statusline' + (type ? ' ' + type : ''); el.textContent = msg; }
  function renderThemes() {
    const cur = currentTheme(); const g = $('#themeGrid'); if (!g) return;
    g.innerHTML = THEMES.map((t, i) => `<button type="button" class="theme-choice" data-theme="${i + 1}" aria-pressed="${String(i + 1) === cur}"><span class="swatch" style="background:linear-gradient(135deg,${t.accent},${t.bg})"></span><b>${escH(t.name)}</b><small>${i + 1 === Number(DEFAULT_THEME) ? 'ค่าเริ่มต้น (ดีไซน์ใหม่)' : 'Color preset'}</small></button>`).join('');
  }
  function openSettings() {
    const d = $('#settingsDlg'); if (!d) return; const c = config();
    $('#projectUrl').value = c.url; $('#publishableKey').value = c.key; $('#ticketsTable').value = c.ticketsTable; $('#betsTable').value = c.betsTable;
    setSettingsStatus('', ''); renderThemes(); if (!d.open) d.showModal(); $('#projectUrl').focus();
  }
  window.__openSettings = openSettings;
  function bindSettings() {
    const d = $('#settingsDlg'); if (!d) return;
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#refreshBtn').addEventListener('click', () => location.reload());
    $('#closeSettings').addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    $('#saveSettings').addEventListener('click', () => {
      const c = { url: $('#projectUrl').value.trim().replace(/\/+$/, ''), key: $('#publishableKey').value.trim(), ticketsTable: $('#ticketsTable').value.trim() || 'tickets', betsTable: $('#betsTable').value.trim() || 'bets' };
      if (!validConfig(c)) { setSettingsStatus('ตรวจรูปแบบ URL หรือ key อีกครั้ง · ต้องใช้ URL ของโปรเจกต์ (https://xxxx.supabase.co) และ sb_publishable_... เท่านั้น', 'err'); return; }
      store.set('nbaTrackerConfig', JSON.stringify(c)); setSettingsStatus('บันทึกแล้ว · กำลังโหลดข้อมูลใหม่…', 'ok'); setTimeout(() => location.reload(), 300);
    });
    $('#clearSettings').addEventListener('click', () => { store.del('nbaTrackerConfig'); setSettingsStatus('ล้างการตั้งค่าจากอุปกรณ์นี้แล้ว', 'ok'); ['projectUrl', 'publishableKey'].forEach((i) => { $('#' + i).value = ''; }); });
    $('#themeGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-theme]'); if (!b) return; applyTheme(b.dataset.theme); renderThemes(); if (window.__redrawCharts) window.__redrawCharts(); });
  }

  /* ---------- REST (read-only) ---------- */
  async function api(c, table, cols) {
    const url = c.url + '/rest/v1/' + encodeURIComponent(table) + '?select=' + encodeURIComponent(cols) + '&limit=5000';
    const r = await fetch(url, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Accept: 'application/json' } });
    const txt = await r.text(); let body; try { body = JSON.parse(txt); } catch (e) { body = txt; }
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}${body && (body.message || body.hint) ? ' — ' + (body.message || body.hint) : ''}`);
    if (!Array.isArray(body)) throw new Error(`${table}: รูปแบบข้อมูลที่ได้รับไม่ใช่ array`);
    return body;
  }
  async function loadTickets(c) { if (c.ticketsTable !== 'tickets') return api(c, c.ticketsTable, '*'); try { return await api(c, 'tickets', TICKET_COLS); } catch (e) { if (/HTTP 400/.test(e.message)) return api(c, 'tickets', 'id,ticket_code,bet_date,stake,payout_if_win,status,net_profit'); throw e; } }
  async function loadBets(c) { try { return await api(c, c.betsTable, BET_COLS); } catch (e) { if (/HTTP 400/.test(e.message)) return api(c, c.betsTable, '*'); throw e; } }

  /* ---------- normalisers (same meanings as classic.html) ---------- */
  const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/[฿,\s]/g, '')); return Number.isFinite(n) ? n : null; };
  const str = (v) => (v == null ? '' : String(v));
  const day = (v) => { const s = str(v); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(+d) ? '' : new Date(+d + 7 * 3600e3).toISOString().slice(0, 10); };
  function resultOf(v) { const s = str(v).toLowerCase();
    if (/partial|บางส่วน/.test(s)) return 'partial'; if (/won|win|ชนะ|ถูก/.test(s)) return 'won'; if (/lost|lose|แพ้|ผิด/.test(s)) return 'lost';
    if (/void|refund|cancel|คืนทุน|โมฆะ/.test(s)) return 'void'; if (/push|draw|tie|เสมอ/.test(s)) return 'push'; return 'pending'; }
  const isTotal = (s) => /^\s*(over|under)\b/i.test(str(s));
  const splitTeams = (opp) => str(opp).split(/\s+vs\.?\s+/i).map((x) => x.trim()).filter(Boolean);
  function parsePI(v) { if (v == null || v === '') return null; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } } return v && typeof v === 'object' ? v : null; }
  const SETTLED = new Set(['won', 'lost', 'push', 'void']);
  const tally = () => ({ n: 0, won: 0, lost: 0, push: 0, void: 0 });
  const add = (r, res) => { r.n++; if (res in r) r[res]++; };

  /* one normalised record per row; everything downstream reads these */
  function normTickets(T) { return T.map((t) => ({ id: num(t.id), code: str(t.ticket_code ?? t.code ?? t.id), date: day(t.bet_date ?? t.date ?? t.created_at), stake: num(t.stake) || 0, payout: num(t.payout_if_win), status: resultOf(t.status), net: num(t.net_profit) }))
    .filter((t) => t.id !== null).sort((a, b) => a.id - b.id); }
  function normBets(B, tickById) {
    return B.map((b) => {
      const tot = isTotal(b.selected_team); let ss = num(b.selected_score), os = num(b.opponent_score); let combined = false;
      let line = num(b.spread);
      if (tot) { if (line !== null) line = Math.abs(line); else { const m = str(b.selected_team).match(/(\d+(?:\.\d+)?)/); line = m ? Number(m[1]) : null; }
        if (ss !== null && (os === null || os === 0)) { combined = true; os = null; } } /* legacy rows store the combined total in selected_score */
      const t = tickById.get(num(b.ticket_id));
      return { id: num(b.id), ticketId: num(b.ticket_id), sel: str(b.selected_team).trim(), opp: str(b.opponent).trim(), line, odds: num(b.odds), ss, os, combined,
        result: resultOf(b.result), date: day(b.game_date) || (t ? t.date : ''), pi: b.player_impact ?? null, total: tot };
    }).filter((b) => b.id !== null).sort((a, b) => (a.ticketId - b.ticketId) || (a.id - b.id));
  }
  /* aggregates — same definitions as snapshot.sql / classic analytics */
  function aggregates(T, B, legCnt) {
    const sb = B.filter((b) => SETTLED.has(b.result));
    const legsTotal = tally(); sb.forEach((b) => add(legsTotal, b.result));
    const groupBy = (rows, keyF) => { const m = new Map(); for (const r of rows) { const k = keyF(r); const g = m.get(k) || []; g.push(r); m.set(k, g); } return m; };
    const res = (rows) => { const r = tally(); rows.forEach((b) => add(r, b.result)); return r; };
    const mkt = (b) => (b.total ? (/^\s*over/i.test(b.sel) ? 'Over' : 'Under') : b.line < 0 ? 'Favorite' : b.line > 0 ? 'Underdog' : 'PK');
    const MO = ['Favorite', 'Underdog', 'PK', 'Over', 'Under'];
    const market = [...groupBy(sb, mkt)].sort((x, y) => MO.indexOf(x[0]) - MO.indexOf(y[0])).map(([m, rows]) => { const r = res(rows); return [m, r.n, r.won, r.lost, r.push, r.void]; });
    const teamRows = []; sb.forEach((b) => (b.total ? splitTeams(b.opp) : [b.sel]).forEach((t) => teamRows.push({ t, result: b.result })));
    const teamsRaw = [...groupBy(teamRows, (x) => x.t)].map(([t, rows]) => { const r = res(rows); return [t, r.n, r.won, r.lost, r.push]; }).sort((a, b) => b[1] - a[1]);
    const BK = [['0–3', 3], ['3.5–6.5', 6.5], ['7–10', 10], ['10.5+', Infinity]];
    const bg = groupBy(sb.filter((b) => !b.total), (b) => BK.find(([, mx]) => Math.abs(b.line || 0) <= mx)[0]);
    const spreadBuckets = BK.filter(([l]) => bg.has(l)).map(([l]) => { const r = res(bg.get(l)); return [l, r.n, r.won, r.lost, r.push]; });
    const profit = (t) => (t.net !== null ? t.net : t.status === 'won' ? (t.payout || 0) - t.stake : t.status === 'lost' ? -t.stake : 0);
    const st = T.filter((t) => t.status !== 'pending').map((t) => ({ ...t, n: (legCnt.get(t.id) || tally()).n, prof: profit(t) }));
    const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0); const r2 = (x) => Math.round(x * 100) / 100;
    const roll = (keyF) => [...groupBy(st, keyF)].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, rows]) => [k, rows.length, r2(sum(rows, (r) => r.stake)), r2(sum(rows, (r) => r.prof)), rows.filter((r) => r.status === 'won').length]);
    const parlay = [...groupBy(st, (r) => r.n)].sort((a, b) => a[0] - b[0])
      .map(([n, rows]) => [n, rows.length, rows.filter((r) => r.status === 'won').length, r2(sum(rows, (r) => r.stake)), r2(sum(rows, (r) => r.prof))]);
    const k = { settled: st.length, won: st.filter((t) => t.status === 'won').length, lost: st.filter((t) => t.status === 'lost').length,
      stake: r2(sum(st, (r) => r.stake)), net: r2(sum(st, (r) => r.prof)) };
    return { agg: { legsTotal, market, teamsRaw, spreadBuckets, parlay, daily: roll((r) => r.date), monthly: roll((r) => r.date.slice(0, 7)) }, k };
  }
  function build(Tn, Bn, gameKey) {
    const legCnt = new Map();
    for (const b of Bn) { const r = legCnt.get(b.ticketId) || tally(); add(r, b.result); legCnt.set(b.ticketId, r); }
    const tickets = Tn.map((t) => { const r = legCnt.get(t.id) || tally(); return [t.id, t.code, t.date, t.stake, t.payout, t.status, t.net, r.n, r.won, r.lost, r.push, r.void]; });
    const bets = Bn.map((b) => [b.id, b.ticketId, b.sel, b.opp, b.line, b.odds, b.ss, b.os, b.result, b.date, b.combined, b.pi]);
    const impacts = {};
    for (const b of Bn) {
      const pi = parsePI(b.pi); if (!pi || !Array.isArray(pi.events)) continue;
      const evs = pi.events.filter((e) => e && typeof e === 'object' && e.event_type); if (!evs.length) continue;
      const teams = b.total ? splitTeams(b.opp) : [b.sel, b.opp]; if (teams.length < 2) continue;
      const k = gameKey(b.date, teams[0], teams[1]); const list = impacts[k] || (impacts[k] = []);
      for (const e of evs) if (!list.some((x) => x.player === e.player && x.event_type === e.event_type))
        list.push({ player: str(e.player), team: str(e.team), event_type: str(e.event_type), status: str(e.status), reason: str(e.reason), report_date: day(e.report_date), source: str(e.source) });
    }
    let example = null;
    for (const b of Bn.slice().sort((a, c) => (a.id === 130 ? -1 : c.id === 130 ? 1 : a.id - c.id))) {
      const pi = parsePI(b.pi);
      if (pi && pi.actual_stats && pi.analysis) { example = { bet: [b.id, null, b.sel, b.opp, b.line, null, b.ss, b.os, b.result, b.date], player_impact: pi }; break; }
    }
    const now = new Date(Date.now() + 7 * 3600e3).toISOString();
    const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const { agg } = aggregates(Tn, Bn, legCnt);
    return { generatedAt: now, note: `ข้อมูลสดจาก Supabase · โหลด ${Number(now.slice(8, 10))} ${TH[Number(now.slice(5, 7)) - 1]} ${now.slice(11, 16)} · อ่านอย่างเดียว`,
      tickets, bets, aggregates: agg, impacts, statsVsAnalysisExample: example, tipoffs: {} };
  }
  /* analytics filters (same semantics as classic: bets by game date / team / result, tickets by bet date) */
  window.__filteredAgg = function ({ from = '', to = '', team = 'all', res = 'all' } = {}, teamOf) {
    const R = window.__RAW; if (!R) return null;
    const B = R.B.filter((b) => (!from || (b.date && b.date >= from)) && (!to || (b.date && b.date <= to)) && (team === 'all' || teamOf(b) === team) && (res === 'all' || b.result === res));
    const T = R.T.filter((t) => (!from || (t.date && t.date >= from)) && (!to || (t.date && t.date <= to)));
    return aggregates(T, B, R.legCnt);
  };

  function msg(title, body, action) { const v = $('#view'); if (v) v.innerHTML = `<div class="empty" role="status" style="margin-top:24px"><div><h3>${escH(title)}</h3><p>${escH(body)}</p>${action || ''}</div></div>`; }
  function loadScript(src) { return new Promise((ok, bad) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => bad(new Error('โหลดไฟล์ ' + src + ' ไม่สำเร็จ')); document.body.appendChild(el); }); }
  const settingsBtn = '<p style="margin-top:12px"><button type="button" class="btn primary" onclick="window.__openSettings()">⚙ เปิดตั้งค่า</button> <a class="btn" href="classic.html">หน้าตาแบบเดิม</a></p>';
  async function start() {
    bindSettings();
    const c = config();
    if (!c.url || !c.key) { msg('ยังไม่ได้ตั้งค่า Supabase บนอุปกรณ์นี้', 'กด ⚙ ตั้งค่า แล้วใส่ Project URL และ Publishable key (sb_publishable_...) — ห้ามใช้ secret/service_role key', settingsBtn); return; }
    if (!validConfig(c)) { msg('การตั้งค่าไม่ถูกต้อง', 'ต้องใช้ URL ของโปรเจกต์ (https://xxxx.supabase.co) และ sb_publishable_... เท่านั้น', settingsBtn); return; }
    msg('กำลังโหลดข้อมูล…', 'อ่านตาราง tickets และ bets จาก Supabase (อ่านอย่างเดียว)');
    try {
      const [T, B] = await Promise.all([loadTickets(c), loadBets(c)]);
      if (!T.length) { msg('ยังไม่มีบิลในฐานข้อมูล', `ตาราง ${c.ticketsTable} ว่าง หรือ RLS ไม่อนุญาตให้อ่าน`, settingsBtn); return; }
      const Tn = normTickets(T); const tickById = new Map(Tn.map((t) => [t.id, t])); const Bn = normBets(B, tickById);
      window.SNAPSHOT = { tickets: [], bets: [], impacts: {}, tipoffs: {}, aggregates: { legsTotal: tally(), market: [], teamsRaw: [], spreadBuckets: [], parlay: [], daily: [], monthly: [] } };
      window.__startCore(); /* first pass only to reuse the core's team-name normaliser for game keys */
      const C0 = window.Core; const gameKey = (d, a, b) => [d, ...[C0.canonicalTeam(a), C0.canonicalTeam(b)].sort()].join('|');
      const legCnt = new Map(); for (const b of Bn) { const r = legCnt.get(b.ticketId) || tally(); add(r, b.result); legCnt.set(b.ticketId, r); }
      window.__RAW = { T: Tn, B: Bn, legCnt };
      window.SNAPSHOT = build(Tn, Bn, gameKey);
      window.__startCore();
      $('#view').innerHTML = '';
      for (const f of ['app/app-1.js', 'app/app-2.js', 'app/app-3.js']) await loadScript(f);
    } catch (e) {
      msg('โหลดข้อมูลไม่สำเร็จ', String((e && e.message) || e) + ' · ตรวจ Project URL / publishable key / ชื่อตาราง และ SELECT policy ของ RLS', '<p style="margin-top:12px"><button type="button" class="btn" onclick="location.reload()">ลองใหม่</button> <button type="button" class="btn primary" onclick="window.__openSettings()">⚙ เปิดตั้งค่า</button></p>');
    }
  }
  window.__hybridBuild = build;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
