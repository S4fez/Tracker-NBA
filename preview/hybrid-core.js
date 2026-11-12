/* Shared, framework-free logic for every design concept. Read-only: never writes anywhere.
   Mirrors the settlement rules of the production app (index.html / CLAUDE.md):
   ticket profit = stored net_profit, else won → payout_if_win − stake, lost → −stake, push/void → 0; pending excluded. */
window.__startCore = (function () {
  const S = window.SNAPSHOT;
  const TEAMS = {
    'Atlanta Hawks':['ATL','#C8102E'],'Boston Celtics':['BOS','#007A33'],'Brooklyn Nets':['BKN','#000000'],'Charlotte Hornets':['CHA','#1D1160'],
    'Chicago Bulls':['CHI','#CE1141'],'Cleveland Cavaliers':['CLE','#860038'],'Dallas Mavericks':['DAL','#00538C'],'Denver Nuggets':['DEN','#0E2240'],
    'Detroit Pistons':['DET','#C8102E'],'Golden State Warriors':['GSW','#1D428A'],'Houston Rockets':['HOU','#CE1141'],'Indiana Pacers':['IND','#002D62'],
    'LA Clippers':['LAC','#C8102E'],'Los Angeles Lakers':['LAL','#552583'],'Memphis Grizzlies':['MEM','#5D76A9'],'Miami Heat':['MIA','#98002E'],
    'Milwaukee Bucks':['MIL','#00471B'],'Minnesota Timberwolves':['MIN','#0C2340'],'New Orleans Pelicans':['NOP','#0C2340'],'New York Knicks':['NYK','#006BB6'],
    'Oklahoma City Thunder':['OKC','#007AC1'],'Orlando Magic':['ORL','#0077C0'],'Philadelphia 76ers':['PHI','#006BB6'],'Phoenix Suns':['PHX','#1D1160'],
    'Portland Trail Blazers':['POR','#E03A3E'],'Sacramento Kings':['SAC','#5A2D81'],'San Antonio Spurs':['SAS','#000000'],'Toronto Raptors':['TOR','#CE1141'],
    'Utah Jazz':['UTA','#002B5C'],'Washington Wizards':['WAS','#002B5C']
  };
  const ALIAS = new Map();
  for (const full of Object.keys(TEAMS)) {
    const nick = full === 'Portland Trail Blazers' ? 'Trail Blazers' : full.split(' ').slice(-1)[0];
    ALIAS.set(full.toLowerCase(), full); ALIAS.set(nick.toLowerCase(), full);
  }
  ALIAS.set('los angeles clippers', 'LA Clippers'); ALIAS.set('blazers', 'Portland Trail Blazers'); ALIAS.set('sixers', 'Philadelphia 76ers');
  const canonicalTeam = (n) => ALIAS.get(String(n ?? '').trim().toLowerCase()) || String(n ?? '').trim();
  const abbr = (n) => (TEAMS[canonicalTeam(n)] || [canonicalTeam(n)])[0];
  const teamColor = (n) => (TEAMS[canonicalTeam(n)] || [null, '#555555'])[1];
  const shortName = (n) => { const c = canonicalTeam(n); return c === 'Portland Trail Blazers' ? 'Trail Blazers' : c === 'LA Clippers' ? 'Clippers' : c.split(' ').slice(-1)[0]; };

  /* ---------- formatting ---------- */
  const TH_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const fmt = {
    money: (n, dp = 2) => n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
    signed: (n, dp = 2) => n == null ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
    pct: (n, dp = 1) => n == null || !isFinite(n) ? '—' : (n * 100).toFixed(dp) + '%',
    signedPct: (n, dp = 1) => n == null || !isFinite(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n * 100).toFixed(dp) + '%',
    line: (v) => v == null ? '—' : (v > 0 ? '+' : '') + Number(v),
    dateTH: (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + TH_MONTH[m - 1]; },
    dateShort: (d) => { if (!d) return '—'; const [, m, dd] = d.split('-').map(Number); return dd + '/' + m; },
    code: (c) => String(c).length > 8 ? '…' + String(c).slice(-8, -6) + String(c).slice(-6, -6 + 2 || undefined) : String(c),
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  };
  /* Ticket short id: long bookmaker codes like 1109002458031800660 → "2458" (the part users recognise); short codes stay as-is. */
  fmt.code = (c) => { c = String(c); return /^\d{19}$/.test(c) ? c.slice(6, 10) : c; };

  const STATUS = {
    pending: { th: 'รอผล', en: 'Pending' }, won: { th: 'ชนะ', en: 'Won' }, lost: { th: 'แพ้', en: 'Lost' },
    push: { th: 'เสมอ', en: 'Push' }, void: { th: 'โมฆะ', en: 'Void' }, partial: { th: 'บางส่วน', en: 'Partial' }
  };

  /* ---------- tickets ---------- */
  const tickets = S.tickets.map(([id, code, date, stake, payout, status, net, legs, lw, ll, lp, lv]) => {
    const profit = status === 'pending' ? null : net != null ? net : status === 'won' ? payout - stake : status === 'lost' ? -stake : 0;
    const actualPayout = status === 'pending' ? null : profit + stake;
    return { id, code, short: fmt.code(code), date, stake, payout, status, net, profit, actualPayout,
      legs, legsWon: lw, legsLost: ll, legsPush: lp, legsVoid: lv, legsPending: legs - lw - ll - lp - lv,
      potentialProfit: payout != null ? payout - stake : null, hasDetail: false, bets: [] };
  });
  const ticketById = new Map(tickets.map((t) => [t.id, t]));

  /* ---------- bets (legs) ---------- */
  const isTotal = (sel) => /^(over|under)/i.test(String(sel));
  const gameKey = (date, a, b) => [date, ...[canonicalTeam(a), canonicalTeam(b)].sort()].join('|');
  const bets = S.bets.map(([id, ticketId, sel, opp, line, odds, ss, os, result, date]) => {
    const total = isTotal(sel);
    const teams = total ? String(opp).split(/\s+vs\.?\s+/i).map(canonicalTeam) : [canonicalTeam(sel), canonicalTeam(opp)];
    const market = total ? (/^over/i.test(sel) ? 'Over' : 'Under') : 'Spread';
    const side = total ? null : line < 0 ? 'Favorite' : line > 0 ? 'Underdog' : 'PK';
    const final = ss != null && os != null;
    const totalPts = final ? ss + os : null;
    let verdict = null;
    if (final) {
      if (total) verdict = `รวม ${totalPts} แต้ม · เส้น ${line}`;
      else { const m = ss - os; verdict = (m > 0 ? `ชนะ ${m} แต้ม` : m < 0 ? `แพ้ ${-m} แต้ม` : 'เสมอ') + ` · ต่อ ${fmt.line(line)} → ${m + line > 0 ? 'ผ่าน' : m + line === 0 ? 'เท่าเส้น' : 'ไม่ผ่าน'}`; }
    }
    const key = gameKey(date, teams[0], teams[1]);
    const b = { id, ticketId, pick: total ? market : canonicalTeam(sel), opponent: total ? null : canonicalTeam(opp), teams,
      abbrs: teams.map(abbr), line, odds, ss, os, result, date, market, side, final, totalPts, verdict, gameKey: key,
      label: total ? `${market === 'Over' ? 'สูง' : 'ต่ำ'} ${line} (${teams.map(abbr).join('/')})` : `${abbr(sel)} ${fmt.line(line)}`,
      matchup: `${abbr(teams[0])} vs ${abbr(teams[1])}`,
      score: final ? (total ? `${abbr(teams[0])} ${ss} – ${os} ${abbr(teams[1])}` : `${abbr(sel)} ${ss} – ${os} ${abbr(opp)}`) : null,
      impact: S.impacts[key] || null };
    const t = ticketById.get(ticketId); if (t) { t.bets.push(b); t.hasDetail = true; }
    return b;
  });

  /* ---------- KPIs (all from real ticket rows) ---------- */
  function kpis() {
    const settled = tickets.filter((t) => t.status !== 'pending');
    const pending = tickets.filter((t) => t.status === 'pending');
    const stake = settled.reduce((s, t) => s + t.stake, 0);
    const returns = settled.reduce((s, t) => s + t.actualPayout, 0);
    const net = settled.reduce((s, t) => s + t.profit, 0);
    const count = (st) => tickets.filter((t) => t.status === st).length;
    const won = count('won'), lost = count('lost');
    const L = S.aggregates.legsTotal;
    return { totalTickets: tickets.length, settled: settled.length, pendingTickets: pending.length,
      stakeSettled: stake, stakePending: pending.reduce((s, t) => s + t.stake, 0), stakeAll: stake + pending.reduce((s, t) => s + t.stake, 0),
      payoutActual: returns, potentialPending: pending.reduce((s, t) => s + (t.payout || 0), 0), net, roi: stake ? net / stake : null,
      won, lost, push: count('push'), void: count('void'), partial: count('partial'),
      ticketWinRate: won + lost ? won / (won + lost) : null,
      legs: L, legWinRate: L.won / (L.won + L.lost),
      biggestWin: settled.reduce((m, t) => (t.profit > (m?.profit ?? -Infinity) ? t : m), null) };
  }

  /* ---------- tickets query ---------- */
  function queryTickets({ q = '', status = 'all', sort = 'date-desc' } = {}) {
    const needle = q.trim().toLowerCase();
    let list = tickets.filter((t) => (status === 'all' || t.status === status) &&
      (!needle || t.code.toLowerCase().includes(needle) || t.bets.some((b) => b.teams.some((tm) => tm.toLowerCase().includes(needle) || abbr(tm).toLowerCase() === needle))));
    const by = { 'date-desc': (a, b) => b.date.localeCompare(a.date) || b.id - a.id, 'date-asc': (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
      'profit-desc': (a, b) => (b.profit ?? -1e9) - (a.profit ?? -1e9), 'payout-desc': (a, b) => (b.payout ?? 0) - (a.payout ?? 0),
      'legs-desc': (a, b) => b.legs - a.legs || b.id - a.id, 'stake-desc': (a, b) => b.stake - a.stake || b.id - a.id };
    return list.sort(by[sort] || by['date-desc']);
  }

  /* ---------- games (derived from legs in the snapshot; there is no games table) ---------- */
  function games() {
    const m = new Map();
    for (const b of bets) {
      let g = m.get(b.gameKey);
      if (!g) {
        const tip = S.tipoffs[b.teams[0] + '|' + b.teams[1]] || S.tipoffs[b.teams[1] + '|' + b.teams[0]] || null;
        const homeKey = S.tipoffs[b.teams[0] + '|' + b.teams[1]] ? b.teams[0] : S.tipoffs[b.teams[1] + '|' + b.teams[0]] ? b.teams[1] : null;
        g = { key: b.gameKey, date: b.date, teams: [...b.teams].sort(), scores: {}, status: 'upcoming', tipoff: tip, home: homeKey, legs: [], impact: S.impacts[b.gameKey] ?? null };
        m.set(b.gameKey, g);
      }
      if (b.final) { g.status = 'final'; g.scores[b.teams[0]] = b.market === 'Spread' ? b.ss : b.ss; g.scores[b.teams[1]] = b.os; }
      g.legs.push(b);
    }
    for (const g of m.values()) {
      const [a, c] = g.teams;
      g.winner = g.status === 'final' ? (g.scores[a] > g.scores[c] ? a : c) : null;
      g.picks = [...new Set(g.legs.map((l) => l.label))];
    }
    return [...m.values()].sort((x, y) => y.date.localeCompare(x.date) || x.key.localeCompare(y.key));
  }

  /* ---------- player impact feed ---------- */
  const EVENT = { pre_game_absence: { th: 'ไม่ได้ลงเล่น', en: 'Out (pre-game)' }, injury_during_game: { th: 'เจ็บระหว่างเกม', en: 'In-game injury' },
    ejection: { th: 'ถูกไล่ออก', en: 'Ejected' }, pre_game_questionable: { th: 'ไม่แน่นอน', en: 'Questionable' } };
  function impactFeed() {
    const gs = games(); const out = [];
    for (const g of gs) for (const e of g.impact || []) out.push({ ...e, kind: EVENT[e.event_type] || { th: e.event_type, en: e.event_type }, game: g,
      relatedLegs: g.legs, relatedTickets: [...new Set(g.legs.map((l) => l.ticketId))] });
    return out;
  }

  /* ---------- analytics (from SQL aggregates over all rows) ---------- */
  function analytics() {
    const A = S.aggregates;
    const rate = (w, l) => (w + l ? w / (w + l) : null);
    const teamMap = new Map();
    for (const [n, c, w, l, p] of A.teamsRaw) { const k = canonicalTeam(n); const r = teamMap.get(k) || { team: k, abbr: abbr(k), n: 0, won: 0, lost: 0, push: 0 };
      r.n += c; r.won += w; r.lost += l; r.push += p; teamMap.set(k, r); }
    const teamsAll = [...teamMap.values()].map((r) => ({ ...r, winRate: rate(r.won, r.lost) })).sort((a, b) => b.n - a.n);
    let cum = 0;
    const daily = A.daily.map(([date, n, stake, net, won]) => { cum += net; return { date, tickets: n, stake, net, won, cumulative: cum }; });
    return {
      markets: A.market.map(([m, n, w, l, p, v]) => ({ market: m, label: { Favorite: 'แต้มต่อ (ต่อ)', Underdog: 'แต้มต่อ (รอง)', PK: 'PK', Over: 'สูง', Under: 'ต่ำ' }[m], n, won: w, lost: l, push: p, void: v, winRate: rate(w, l) })),
      spreadVsTotal: (() => { const s = A.market.filter((r) => !['Over','Under'].includes(r[0])), t = A.market.filter((r) => ['Over','Under'].includes(r[0]));
        const sum = (rs) => rs.reduce((a, r) => ({ n: a.n + r[1], won: a.won + r[2], lost: a.lost + r[3], push: a.push + r[4] }), { n: 0, won: 0, lost: 0, push: 0 });
        const S1 = sum(s), T1 = sum(t); return [{ label: 'แต้มต่อ (Spread)', ...S1, winRate: rate(S1.won, S1.lost) }, { label: 'สูง/ต่ำ (Total)', ...T1, winRate: rate(T1.won, T1.lost) }]; })(),
      spreadBuckets: A.spreadBuckets.map(([label, n, w, l, p]) => ({ label, n, won: w, lost: l, push: p, winRate: rate(w, l) })),
      parlay: A.parlay.map(([legs, n, won, stake, net]) => ({ legs, tickets: n, won, stake, net, roi: net / stake })),
      teams: teamsAll, daily, monthly: A.monthly.map(([m, n, stake, net, won]) => ({ month: m, label: /^\d{4}-\d{2}$/.test(m) ? TH_MONTH[Number(m.slice(5)) - 1] + ' ' + (Number(m.slice(0, 4)) + 543) : m, tickets: n, stake, net, won, roi: net / stake })),
      legsTotal: A.legsTotal
    };
  }

  window.Core = { S, tickets, bets, kpis, queryTickets, games, impactFeed, analytics, fmt, STATUS, EVENT, canonicalTeam, abbr, teamColor, shortName,
    ticket: (id) => ticketById.get(Number(id)) || null,
    snapshotNote: S.note || 'ข้อมูลจริงจาก Supabase · อ่านอย่างเดียว' };
});
