/* NBA Bet Tracker · hybrid design preview (A + D/B/C). Part of preview/hybrid.html — loads live, read-only data; contains no betting data. */
'use strict';
  /* =================== D · scores ticker =================== */
  function tickerCell(g) {
    const i = GAME_IDX.get(g.key); const ph = phase(g); const [a, b] = homeAway(g); const c = legCount(g);
    const head = ph === 'final' ? `<span class="fin">FINAL</span><span>${esc(F.dateShort(g.date))}</span>`
      : ph === 'started' ? `<span class="run">รอบันทึกผล</span><span class="tip">${esc(g.tipoff || '')}</span>`
      : `<span>${esc(F.dateShort(g.date))}</span><span class="tip">${esc(g.tipoff || '—')}</span>`;
    const row = (tm) => { const w = g.winner === tm, l = g.winner && !w; return `<span class="tk-row ${w ? 'w' : l ? 'l' : ''}">${team(tm)}<span class="s">${ph === 'final' ? esc(g.scores[tm]) : ''}</span></span>`; };
    const mine = [c.w ? `<span class="pos">✓${c.w}</span>` : '', c.l ? `<span class="neg">✗${c.l}</span>` : '', c.p ? `<span class="pd">◷${c.p}</span>` : ''].join('');
    const lbl = `${C.abbr(a)} พบ ${C.abbr(b)} · ${ph === 'final' ? `จบเกม ${g.scores[a]}–${g.scores[b]}` : ph === 'started' ? 'เริ่มแล้ว รอบันทึกผล' : `เริ่ม ${g.tipoff || 'ไม่ทราบเวลา'} น.`} · คู่ของฉัน ${g.legs.length} คู่: ชนะ ${c.w} แพ้ ${c.l} รอผล ${c.p}`;
    return `<a class="tk-cell" href="#/games/${i}" aria-label="${esc(lbl)}"><span class="tk-st">${head}</span>${row(a)}${row(b)}<span class="tk-mine">คู่ของฉัน ${g.legs.length} ${mine}</span></a>`;
  }
  function renderTicker() {
    const open = GAMES.filter((g) => g.status !== 'final').sort((a, b) => a.date.localeCompare(b.date) || (a.tipoff || '').localeCompare(b.tipoff || ''));
    const fin = GAMES.filter((g) => g.status === 'final').slice(0, 18);
    $('#ticker').innerHTML = (open.length ? `<span class="tk-sep" aria-hidden="true">รอผล</span>${open.map(tickerCell).join('')}` : '') + `<span class="tk-sep" aria-hidden="true">จบแล้ว</span>${fin.map(tickerCell).join('')}`;
  }
  $('#tkPrev').addEventListener('click', () => $('#ticker').scrollBy({ left: -456, behavior: 'smooth' }));
  $('#tkNext').addEventListener('click', () => $('#ticker').scrollBy({ left: 456, behavior: 'smooth' }));

  /* =================== C · ticket slide-over =================== */
  const soRoot = $('#soRoot'); let soId = null;
  function openSO(id) {
    const t = C.ticket(id); if (!t) { location.replace('#/tickets'); return; }
    soId = t.id;
    soRoot.innerHTML = `<div class="so-scrim" data-so-close></div><aside class="so" role="dialog" aria-modal="true" aria-labelledby="soTitle">
      <div class="so-bar"><div class="crumbs"><span class="crumb-root">บิลเดิมพัน</span><span class="crumb-sep" aria-hidden="true">/</span><b id="soTitle">บิล #${t.id}</b></div>
        <a class="btn" href="#/ticket/${t.id}">${ic('ext')}เปิดเต็มหน้า</a><a class="btn ghost" href="#/tickets" id="soClose" aria-label="ปิดรายละเอียดบิล" style="width:34px;padding:0">${ic('x')}</a></div>
      <div class="so-body">${viewTicket(t.id, true)}</div></aside>`;
    document.body.classList.add('locked');
    $('#soClose').focus();
    $$('#tkResults tr.rowlink').forEach((tr) => tr.classList.toggle('sel', tr.dataset.href === '#/tickets/' + t.id));
  }
  function closeSO() {
    if (!soRoot.innerHTML) return; const back = soId; soRoot.innerHTML = ''; soId = null;
    if ($('#cmdk').hidden) document.body.classList.remove('locked');
    $$('#tkResults tr.rowlink.sel').forEach((tr) => tr.classList.remove('sel'));
    const a = back && $(`#tkResults a[href="#/tickets/${back}"]`); if (a) a.focus({ preventScroll: false });
  }
  soRoot.addEventListener('click', (e) => { if (e.target.closest('[data-so-close]')) location.hash = '#/tickets'; });

  /* =================== router =================== */
  const TITLES = { dashboard: 'ภาพรวม', tickets: 'บิลเดิมพัน', ticket: 'รายละเอียดบิล', games: 'เกม NBA', impact: 'ผลกระทบผู้เล่น', analytics: 'วิเคราะห์' };
  function parse() { const p = location.hash.replace(/^#\/?/, '').split('/'); const r = TITLES[p[0]] ? p[0] : 'dashboard'; return { r, id: p[1] }; }
  let lastRoute = '';
  function render() {
    const { r, id } = parse();
    if (r === 'tickets' && id && !isWide()) { location.replace('#/ticket/' + id); return; }
    if (r === 'tickets' && lastRoute === 'tickets/' && $('#tkResults')) { if (id) openSO(id); else closeSO(); return; }
    closeSO();
    const v = $('#view');
    let html;
    if (r === 'tickets') html = viewTickets();
    else if (r === 'ticket') html = viewTicket(id);
    else if (r === 'games') { if (id != null) state.games = 'all'; html = viewGames(); }
    else if (r === 'impact') html = viewImpact();
    else if (r === 'analytics') html = viewAnalytics();
    else html = viewDashboard();
    v.innerHTML = html;
    const navR = r === 'ticket' ? 'tickets' : r;
    $$('#sideNav a, #tabbar a').forEach((a) => { if (a.dataset.r === navR) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const title = r === 'ticket' ? `บิล #${esc(id)}` : TITLES[r];
    $('#crumbs').innerHTML = `<span class="crumb-root">Courtside Ledger</span><span class="crumb-sep" aria-hidden="true">/</span>${r === 'ticket' ? '<a class="crumb-root" href="#/tickets">บิลเดิมพัน</a><span class="crumb-sep" aria-hidden="true">/</span>' : ''}<b>${title}</b>`;
    $('#mBack').hidden = r !== 'ticket';
    document.title = `${TITLES[r]} · Courtside Ledger`;
    if (r === 'tickets') bindTickets();
    if (r === 'games') bindGames();
    if (r === 'impact') bindImpact();
    if (r === 'analytics') bindAnalytics();
    drawCharts();
    const key = r + '/' + (r === 'tickets' ? '' : id || '');
    if (key !== lastRoute) { if (lastRoute) { window.scrollTo(0, 0); v.focus({ preventScroll: true }); } lastRoute = key; }
    if (r === 'tickets' && id) openSO(id);
    if (r === 'games' && id != null) { const el = document.getElementById('game-' + Number(id)); if (el) { el.classList.add('focus'); el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); } }
  }
  /* row click → detail (anchor inside keeps keyboard access) */
  document.addEventListener('click', (e) => {
    const sc = e.target.closest('[data-scale]');
    if (sc) { state.scale = sc.dataset.scale; $$('[data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scale === state.scale))); drawCharts(); return; }
    const tr = e.target.closest('tr.rowlink'); if (!tr || e.target.closest('a,button')) return;
    location.hash = tr.dataset.href;
  });

  /* =================== C · command palette =================== */
  const cmdk = $('#cmdk'), cq = $('#cmdkQ'), clist = $('#cmdkList');
  let cItems = [], cSel = 0, cReturn = null;
  function cmdItems(q) {
    const s = q.trim().toLowerCase().replace(/^#/, '');
    const out = NAV.filter(([r, th]) => !s || th.toLowerCase().includes(s) || r.includes(s)).map(([r, th, icn], n) => ({ group: 'หน้า', icon: icn, label: th, hint: `กด ${n + 1}`, href: '#/' + r }));
    const tks = C.tickets.filter((t) => !s || String(t.id) === s || t.code.toLowerCase().includes(s) || t.bets.some((b) => b.teams.some((tm) => C.abbr(tm).toLowerCase() === s || tm.toLowerCase().includes(s))))
      .sort((a, b) => (String(b.id) === s) - (String(a.id) === s) || b.id - a.id).slice(0, s ? 8 : 5);
    tks.forEach((t) => out.push({ group: s ? 'บิล' : 'บิลล่าสุด', icon: ST_ICON[t.status] || 'ticket', label: `#${t.id} · ${t.short} · ${t.legs} คู่`, hint: `${C.STATUS[t.status].th} · ${F.dateTH(t.date)}`, href: (isWide() ? '#/tickets/' : '#/ticket/') + t.id }));
    if (s) {
      A.teams.filter((r) => r.abbr.toLowerCase().startsWith(s) || r.team.toLowerCase().includes(s)).slice(0, 4)
        .forEach((r) => out.push({ group: 'ทีม', icon: 'search', label: `${r.abbr} · ${r.team}`, hint: `ค้นหาบิลที่มี ${r.abbr}`, href: '#/tickets', act: () => { state.q = r.abbr; state.status = 'all'; } }));
      GAMES.filter((g) => g.teams.some((tm) => C.abbr(tm).toLowerCase().startsWith(s) || tm.toLowerCase().includes(s))).slice(0, 5)
        .forEach((g) => out.push({ group: 'เกม', icon: 'court', label: `${C.abbr(g.teams[0])} vs ${C.abbr(g.teams[1])}`, hint: g.status === 'final' ? `${g.scores[g.teams[0]]}–${g.scores[g.teams[1]]} · ${F.dateTH(g.date)}` : `${F.dateTH(g.date)} · ${g.tipoff || 'รอผล'}`, href: '#/games/' + GAME_IDX.get(g.key) }));
    }
    return out;
  }
  function renderCmd() {
    cItems = cmdItems(cq.value); cSel = 0;
    if (!cItems.length) { clist.innerHTML = `<li class="cmdk-empty" role="presentation">ไม่พบ "${esc(cq.value)}" · ลองเลขบิล (เช่น 49) รหัส 4 หลัก หรือตัวย่อทีม (เช่น DEN)</li>`; cq.removeAttribute('aria-activedescendant'); return; }
    let g = '', html = '';
    cItems.forEach((c, i) => { if (c.group !== g) { g = c.group; html += `<li class="cmdk-group" role="presentation">${esc(g)}</li>`; }
      html += `<li class="cmdk-opt" role="option" id="co-${i}" data-i="${i}" aria-selected="${i === cSel}"><span class="ico">${ic(c.icon)}</span><span class="grow">${esc(c.label)}</span><span class="hint">${esc(c.hint)}</span></li>`; });
    clist.innerHTML = html; cq.setAttribute('aria-activedescendant', 'co-0');
  }
  function moveSel(d) { if (!cItems.length) return; cSel = (cSel + d + cItems.length) % cItems.length; $$('.cmdk-opt', clist).forEach((o) => o.setAttribute('aria-selected', String(Number(o.dataset.i) === cSel))); cq.setAttribute('aria-activedescendant', 'co-' + cSel); const el = $('#co-' + cSel); if (el) el.scrollIntoView({ block: 'nearest' }); }
  function openCmd() { if (!cmdk.hidden) return; cReturn = document.activeElement; if (sheet.open) sheet.close(); cmdk.hidden = false; document.body.classList.add('locked'); cq.value = ''; renderCmd(); cq.focus(); }
  function closeCmd(restore = true) { cmdk.hidden = true; if (!soRoot.innerHTML) document.body.classList.remove('locked'); if (restore && cReturn && document.body.contains(cReturn)) cReturn.focus(); }
  function runCmd(i) { const c = cItems[i]; if (!c) return; closeCmd(false); if (c.act) c.act(); if (location.hash === c.href) { lastRoute = ''; render(); } else location.hash = c.href; }
  $('#cmdBtn').addEventListener('click', openCmd);
  cq.addEventListener('input', renderCmd);
  cq.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmd(cSel); }
  });
  clist.addEventListener('click', (e) => { const o = e.target.closest('.cmdk-opt'); if (o) runCmd(Number(o.dataset.i)); });
  cmdk.addEventListener('click', (e) => { if (e.target.closest('[data-cmdk-close]')) closeCmd(); });

  /* =================== keyboard: ⌘K / Ctrl K / "/" (C) · 1–5 views (B) · Esc · focus trap =================== */
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, select, textarea, [contenteditable="true"]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.hidden ? openCmd() : closeCmd(); return; }
    if (!cmdk.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
      else if (e.key === 'Tab') { e.preventDefault(); cq.focus(); }
      return;
    }
    if (soRoot.innerHTML) {
      if (e.key === 'Escape') { e.preventDefault(); location.hash = '#/tickets'; return; }
      if (e.key === 'Tab') { const f = $$('.so a[href], .so button, .so summary, .so [tabindex]:not([tabindex="-1"])').filter((x) => x.offsetParent !== null); if (f.length) { const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } else if (!e.target.closest('.so')) { e.preventDefault(); first.focus(); } } }
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || sheet.open) return;
    if (e.key === '/') { e.preventDefault(); openCmd(); return; }
    if (/^[1-5]$/.test(e.key) && !soRoot.innerHTML) { location.hash = '#/' + NAV[Number(e.key) - 1][0]; }
  });

  window.addEventListener('hashchange', render);
  buildNav();
  renderTicker();
  if (!location.hash) history.replaceState(null, '', '#/dashboard');
  render();
