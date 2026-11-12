/* Live loader for preview/hybrid.html — no betting data is stored in this file or the repo.
   Reads the same connection settings the main app saves in ⚙ Settings (localStorage "nbaTrackerConfig":
   Project URL + publishable key), fetches public.tickets and public.bets read-only through the REST API,
   then builds the same window.SNAPSHOT shape the design was built on and starts the app.
   Never writes anything. tickets.user_id is never requested. */
(function () {
  'use strict';
  const DETAIL_FROM = 36; /* per-leg detail from ticket #36: older legs use legacy formats (combined totals, nicknames) — summarised by counts only */
  const TICKET_COLS = 'id,ticket_code,bet_date,stake,payout_if_win,status,net_profit';
  const BET_COLS = 'id,ticket_id,selected_team,opponent,spread,odds,selected_score,opponent_score,result,game_date,player_impact';
  const view = () => document.getElementById('view');
  const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function msg(title, body, action) {
    const v = view(); if (!v) return;
    v.innerHTML = `<div class="empty" role="status" style="margin-top:24px"><div><h3>${escH(title)}</h3><p>${escH(body)}</p>${action || ''}</div></div>`;
  }
  function config() { try { return JSON.parse(localStorage.getItem('nbaTrackerConfig') || '{}'); } catch (e) { return {}; } }
  async function api(c, table, cols) {
    const url = String(c.url).replace(/\/+$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?select=' + encodeURIComponent(cols) + '&limit=5000';
    const r = await fetch(url, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Accept: 'application/json' } });
    const txt = await r.text(); let body; try { body = JSON.parse(txt); } catch (e) { body = txt; }
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}${body && body.message ? ' — ' + body.message : ''}`);
    if (!Array.isArray(body)) throw new Error(`${table}: รูปแบบข้อมูลที่ได้รับไม่ใช่ array`);
    return body;
  }
  const num = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
  const str = (v) => (v == null ? '' : String(v));
  const day = (v) => str(v).slice(0, 10);
  const isTotal = (s) => /^(over|under)/i.test(str(s));
  const splitTeams = (opp) => str(opp).split(/\s+vs\.?\s+/i).map((x) => x.trim()).filter(Boolean);
  function parsePI(v) { if (v == null || v === '') return null; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } } return v && typeof v === 'object' ? v : null; }
  const SETTLED = new Set(['won', 'lost', 'push', 'void']);
  const tally = () => ({ n: 0, won: 0, lost: 0, push: 0, void: 0 });
  const add = (r, res) => { r.n++; if (res in r) r[res]++; };

  function build(T, B, gameKey) {
    const legCnt = new Map();
    for (const b of B) { const r = legCnt.get(b.ticket_id) || tally(); add(r, str(b.result)); legCnt.set(b.ticket_id, r); }
    const profit = (t) => (t.status === 'pending' ? null : num(t.net_profit) != null ? num(t.net_profit)
      : t.status === 'won' ? (num(t.payout_if_win) || 0) - (num(t.stake) || 0) : t.status === 'lost' ? -(num(t.stake) || 0) : 0);
    const tickets = T.slice().sort((a, b) => a.id - b.id).map((t) => { const r = legCnt.get(t.id) || tally();
      return [t.id, str(t.ticket_code), day(t.bet_date), num(t.stake) || 0, num(t.payout_if_win), str(t.status) || 'pending', num(t.net_profit), r.n, r.won, r.lost, r.push, r.void]; });
    const detail = B.filter((b) => b.ticket_id >= DETAIL_FROM).sort((a, b) => a.ticket_id - b.ticket_id || a.id - b.id);
    const bets = detail.map((b) => [b.id, b.ticket_id, str(b.selected_team), str(b.opponent), num(b.spread), num(b.odds), num(b.selected_score), num(b.opponent_score), str(b.result) || 'pending', day(b.game_date)]);
    /* player impact events (current {events:[...]} shape with event_type), de-duplicated per game */
    const impacts = {};
    for (const b of detail) {
      const pi = parsePI(b.player_impact); if (!pi || !Array.isArray(pi.events)) continue;
      const evs = pi.events.filter((e) => e && typeof e === 'object' && e.event_type);
      if (pi.events.length && !evs.length) continue;
      const teams = isTotal(b.selected_team) ? splitTeams(b.opponent) : [str(b.selected_team), str(b.opponent)];
      if (teams.length < 2) continue;
      const k = gameKey(day(b.game_date), teams[0], teams[1]); const list = impacts[k] || (impacts[k] = []);
      for (const e of evs) if (!list.some((x) => x.player === e.player && x.event_type === e.event_type))
        list.push({ player: str(e.player), team: str(e.team), event_type: str(e.event_type), status: str(e.status), reason: str(e.reason), report_date: day(e.report_date), source: str(e.source) });
    }
    /* aggregates — same definitions as snapshot.sql */
    const sb = B.filter((b) => SETTLED.has(b.result));
    const legsTotal = tally(); sb.forEach((b) => add(legsTotal, b.result));
    const groupBy = (rows, keyF) => { const m = new Map(); for (const r of rows) { const k = keyF(r); const g = m.get(k) || []; g.push(r); m.set(k, g); } return m; };
    const res = (rows) => { const r = tally(); rows.forEach((b) => add(r, b.result)); return r; };
    const mkt = (b) => (isTotal(b.selected_team) ? (/^over/i.test(b.selected_team) ? 'Over' : 'Under') : num(b.spread) < 0 ? 'Favorite' : num(b.spread) > 0 ? 'Underdog' : 'PK');
    const MO = ['Favorite', 'Underdog', 'PK', 'Over', 'Under'];
    const market = [...groupBy(sb, mkt)].sort((x, y) => MO.indexOf(x[0]) - MO.indexOf(y[0])).map(([m, rows]) => { const r = res(rows); return [m, r.n, r.won, r.lost, r.push, r.void]; });
    const teamRows = []; sb.forEach((b) => (isTotal(b.selected_team) ? splitTeams(b.opponent) : [str(b.selected_team).trim()]).forEach((t) => teamRows.push({ t, result: b.result })));
    const teamsRaw = [...groupBy(teamRows, (x) => x.t)].map(([t, rows]) => { const r = res(rows); return [t, r.n, r.won, r.lost, r.push]; }).sort((a, b) => b[1] - a[1]);
    const BK = [['0–3', 3], ['3.5–6.5', 6.5], ['7–10', 10], ['10.5+', Infinity]];
    const bucket = (b) => BK.find(([, mx]) => Math.abs(num(b.spread) || 0) <= mx)[0];
    const bg = groupBy(sb.filter((b) => !isTotal(b.selected_team)), bucket);
    const spreadBuckets = BK.filter(([l]) => bg.has(l)).map(([l]) => { const r = res(bg.get(l)); return [l, r.n, r.won, r.lost, r.push]; });
    const st = T.filter((t) => t.status !== 'pending').map((t) => ({ ...t, n: (legCnt.get(t.id) || tally()).n, prof: profit(t), d: day(t.bet_date) }));
    const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);
    const roll = (keyF) => [...groupBy(st, keyF)].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, rows]) => [k, rows.length, Math.round(sum(rows, (r) => num(r.stake)) * 100) / 100, Math.round(sum(rows, (r) => r.prof) * 100) / 100, rows.filter((r) => r.status === 'won').length]);
    const parlay = [...groupBy(st, (r) => r.n)].sort((a, b) => a[0] - b[0])
      .map(([n, rows]) => [n, rows.length, rows.filter((r) => r.status === 'won').length, Math.round(sum(rows, (r) => num(r.stake)) * 100) / 100, Math.round(sum(rows, (r) => r.prof) * 100) / 100]);
    const daily = roll((r) => r.d), monthly = roll((r) => r.d.slice(0, 7));
    /* a real row that stores confirmed stats separately from analysis (shown on the Player impact page) */
    let example = null;
    for (const b of B.slice().sort((a, c) => (a.id === 130 ? -1 : c.id === 130 ? 1 : a.id - c.id))) {
      const pi = parsePI(b.player_impact);
      if (pi && pi.actual_stats && pi.analysis) { example = { bet: [b.id, null, str(b.selected_team), str(b.opponent), num(b.spread), null, num(b.selected_score), num(b.opponent_score), str(b.result), day(b.game_date)], player_impact: pi }; break; }
    }
    const now = new Date(Date.now() + 7 * 3600e3).toISOString();
    const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return { generatedAt: now, note: `ข้อมูลสดจาก Supabase · โหลด ${Number(now.slice(8, 10))} ${TH[Number(now.slice(5, 7)) - 1]} ${now.slice(11, 16)} · อ่านอย่างเดียว`,
      tickets, bets, aggregates: { legsTotal, market, teamsRaw, spreadBuckets, parlay, daily, monthly }, impacts, statsVsAnalysisExample: example, tipoffs: {} };
  }

  function loadScript(src) { return new Promise((ok, bad) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => bad(new Error('โหลดไฟล์ ' + src + ' ไม่สำเร็จ')); document.body.appendChild(el); }); }
  async function start() {
    const c = config();
    if (!c.url || !c.key) {
      msg('ยังไม่ได้ตั้งค่าการเชื่อมต่อบนอุปกรณ์นี้', 'หน้าตัวอย่างนี้ใช้การตั้งค่าเดียวกับแอปหลัก — เปิดแอปหลัก ไปที่ ⚙ ตั้งค่า ใส่ Project URL และ publishable key แล้วกลับมาหน้านี้ (ไม่มีข้อมูลบิลเก็บไว้ในไฟล์นี้)', '<p style="margin-top:12px"><a class="btn primary" href="../">เปิดแอปหลัก</a></p>');
      return;
    }
    msg('กำลังโหลดข้อมูล…', 'อ่านตาราง tickets และ bets จาก Supabase (อ่านอย่างเดียว)');
    try {
      const [T, B] = await Promise.all([api(c, c.ticketsTable || 'tickets', TICKET_COLS), api(c, c.betsTable || 'bets', BET_COLS)]);
      if (!T.length) { msg('ยังไม่มีบิลในฐานข้อมูล', 'ตาราง tickets ว่าง'); return; }
      window.SNAPSHOT = { tickets: [], bets: [], impacts: {}, tipoffs: {}, aggregates: { legsTotal: tally(), market: [], teamsRaw: [], spreadBuckets: [], parlay: [], daily: [], monthly: [] } };
      window.__startCore(); /* first pass only to reuse the core's team-name normaliser for game keys */
      const C0 = window.Core;
      const gameKey = (d, a, b) => [d, ...[C0.canonicalTeam(a), C0.canonicalTeam(b)].sort()].join('|');
      window.SNAPSHOT = build(T, B, gameKey);
      window.__startCore();
      view().innerHTML = '';
      for (const f of ['hybrid-app-1.js', 'hybrid-app-2.js', 'hybrid-app-3.js']) await loadScript(f);
    } catch (e) {
      msg('โหลดข้อมูลไม่สำเร็จ', String(e && e.message || e) + ' — ตรวจ Project URL / publishable key ในแอปหลัก หรือการเชื่อมต่ออินเทอร์เน็ต', '<p style="margin-top:12px"><a class="btn" href="">ลองใหม่</a> <a class="btn" href="../">เปิดแอปหลัก</a></p>');
    }
  }
  window.__hybridBuild = build; /* exposed for tests */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
