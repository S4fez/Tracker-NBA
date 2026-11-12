/* NBA Bet Tracker · hybrid design preview (A + D/B/C). Part of preview/hybrid.html — loads live, read-only data; contains no betting data. */
'use strict';
  /* ---------- ticket detail ---------- */
  function impactBlock(list) {
    if (!list || !list.length) return '';
    return `<details class="imp"><summary>${ic('right')}ผลกระทบผู้เล่น ${list.length} รายการในเกมนี้</summary><div class="imp-list">${list.map((e) => {
      const k = C.EVENT[e.event_type] || { th: e.event_type };
      return `<div class="imp-row"><b>${esc(e.player)}</b>${team(e.team)}<span class="type-badge ${e.event_type === 'injury_during_game' ? 'ig' : e.event_type === 'ejection' ? 'ej' : ''}">${esc(k.th)}</span><span>${esc(e.reason)}</span><span class="faint">· รายงาน ${esc(F.dateTH(e.report_date))}</span>${srcLink(e.source)}</div>`; }).join('')}</div></details>`;
  }
  function scoreCell(b) {
    if (b.final) return `<span class="lead">${esc(b.score)}</span>${b.market !== 'Spread' ? `<div class="faint" style="font-size:var(--fs-11)">รวม ${b.totalPts}</div>` : ''}`;
    const tip = tipFor(b); return `<span class="faint">ยังไม่แข่ง</span>${tip ? `<div class="amber" style="font-size:var(--fs-12)">${esc(F.dateTH(b.date))} ${esc(tip)} ICT</div>` : ''}`;
  }
  function viewTicket(id, inPanel = false) {
    const base = inPanel ? '#/tickets/' : '#/ticket/';
    const t = C.ticket(id);
    if (!t) return `<div class="ph"><div><h1>ไม่พบบิล</h1></div></div>${empty('ไม่พบบิล #' + id, `บิลนี้ไม่อยู่ใน snapshot · ID ที่มีคือ 1–36 และ 40–${MAX_ID}`, 'ticket')}<p><a class="btn" href="#/tickets">กลับไปหน้าบิล</a></p>`;
    const ids = C.tickets.map((x) => x.id).sort((a, b) => a - b); const ix = ids.indexOf(t.id);
    const prev = ids[ix - 1], next = ids[ix + 1];
    const lostLegs = t.bets.filter((b) => b.result === 'lost');
    const firstLost = lostLegs[0];
    let verdict;
    if (t.status === 'lost') verdict = `<div class="verdict-box lost"><b>บิลแพ้ — ${t.legsLost} จาก ${t.legs} คู่ไม่ผ่าน</b>สเต็ปต้องผ่านทุกคู่ แค่คู่เดียวแพ้ บิลทั้งใบแพ้ ${t.hasDetail && firstLost ? `· คู่แรกที่ทำให้บิลขาดคือ <b style="display:inline">${esc(firstLost.label)}</b>` : ''}</div>`;
    else if (t.status === 'won') verdict = `<div class="verdict-box won"><b>บิลชนะ — ผ่านครบ ${t.legsWon}/${t.legs} คู่</b>ทุกข้อต่อในสเต็ปผ่าน จึงได้รับยอดจ่ายเต็ม</div>`;
    else if (t.status === 'pending') { const tips = [...new Set(t.bets.map(tipFor).filter(Boolean))].sort(); verdict = `<div class="verdict-box pending"><b>รอผล — ${t.legsPending} คู่ยังไม่บันทึกผล</b>ต้องผ่านทั้ง ${t.legs} คู่จึงจะได้ ${baht(t.payout)}${tips.length ? ` · เกมแรกเริ่ม ${esc(tips[0])} ICT วันที่ ${esc(F.dateTH(t.bets[0].date))}` : ''}</div>`; }
    else verdict = `<div class="verdict-box"><b>${esc(C.STATUS[t.status].th)}</b></div>`;

    let chain;
    if (t.hasDetail) {
      let seenLost = false;
      chain = `<ol class="chain" aria-label="ข้อต่อสเต็ป ${t.legs} คู่">${t.bets.map((b, i) => {
        let brk = '';
        if (b.result === 'lost') { brk = `<span class="brk ${seenLost ? '' : 'first'}">${seenLost ? 'แพ้' : 'ขาดตรงนี้'}</span>`; seenLost = true; }
        else if (b.result === 'pending') { const tp = tipFor(b); brk = `<span class="faint" style="font-size:var(--fs-11)">${tp ? esc(tp) + ' ICT' : 'รอผล'}</span>`; }
        else brk = `<span style="font-size:var(--fs-11)" class="${b.result === 'won' ? 'pos' : 'muted'}">${esc(C.STATUS[b.result].th)}</span>`;
        return `<li class="${esc(b.result)}"><span class="node" aria-hidden="true">${ic(ST_ICON[b.result] || 'info')}</span><span class="cl"><b>${i + 1}. ${esc(b.label)}</b><small>${esc(b.matchup)}${b.final ? ' · ' + esc(b.score) : ''}</small></span>${brk}</li>`; }).join('')}</ol>`;
    } else {
      chain = `<div style="margin-bottom:var(--sp-3)">${pips(t)}</div>${note(`ไม่มีรายละเอียดรายคู่ของบิล #${t.id} ใน snapshot นี้ — ทราบเฉพาะจำนวน: ${legLabel(t)} · ไม่ทราบลำดับและคู่ที่แพ้`)}`;
    }
    const legRows = t.bets.map((b, i) => `<tr class="is-${esc(b.result)}${b.impact ? ' has-sub' : ''}">
        <td class="tight faint">${i + 1}</td>
        <td class="tight">${team(b.teams[0])} <span class="faint">vs</span> ${team(b.teams[1])}<div class="faint" style="font-size:var(--fs-11)">${esc(F.dateTH(b.date))}</div></td>
        <td><span class="lead">${b.market === 'Spread' ? esc(C.abbr(b.pick)) : esc(b.market === 'Over' ? 'สูง' : 'ต่ำ')}</span></td>
        <td class="tight muted">${esc(marketTxt(b))}</td>
        <td class="num">${esc(b.market === 'Spread' ? F.line(b.line) : String(b.line))}</td>
        <td class="num muted">${b.odds == null ? '—' : esc(Number(b.odds).toFixed(2))}</td>
        <td class="tight">${scoreCell(b)}</td>
        <td class="muted" style="font-size:var(--fs-12)">${b.verdict ? esc(b.verdict) : '<span class="faint">รอผลการแข่งขัน</span>'}</td>
        <td class="tight">${badge(b.result)}</td></tr>
        ${b.impact ? `<tr class="sub"><td></td><td colspan="8">${impactBlock(b.impact)}</td></tr>` : ''}`).join('');
    const legCards = t.bets.map((b, i) => `<div class="srow is-${esc(b.result)}">
        <div class="srow-top"><span><span class="faint">${i + 1}.</span> <b>${esc(b.label)}</b></span>${badge(b.result)}</div>
        <div class="srow-mid"><span>${team(b.teams[0])} <span class="faint">vs</span> ${team(b.teams[1])}</span><span>${esc(marketTxt(b))}</span></div>
        <div class="srow-grid">
          <div><span>เส้น</span><b>${esc(b.market === 'Spread' ? F.line(b.line) : String(b.line))}</b></div>
          <div><span>ราคา</span><b>${b.odds == null ? '—' : esc(Number(b.odds).toFixed(2))}</b></div>
          <div style="grid-column:1/-1"><span>สกอร์</span><b>${b.final ? esc(b.score) : 'ยังไม่แข่ง' + (tipFor(b) ? ' · ' + esc(tipFor(b)) + ' ICT' : '')}</b></div>
          ${b.verdict ? `<div style="grid-column:1/-1"><span>ผล</span><b>${esc(b.verdict)}</b></div>` : ''}
        </div>${b.impact ? `<div style="margin-top:var(--sp-2)">${impactBlock(b.impact)}</div>` : ''}</div>`).join('');
    const legsSection = t.hasDetail
      ? `<section class="card" aria-labelledby="h-legs"><div class="card-h"><h2 id="h-legs">รายการคู่ในบิล</h2><span class="sub">${t.legs} คู่ · ${esc(legLabel(t))}</span></div>
          <div class="card-b flush tbl-wrap"><table class="dt stack-m"><thead><tr><th scope="col">#</th><th scope="col">เกม</th><th scope="col">เลือก</th><th scope="col">ตลาด</th><th scope="col" class="num">เส้น</th><th scope="col" class="num">ราคา</th><th scope="col">สกอร์จริง</th><th scope="col">วิเคราะห์ผล</th><th scope="col">ผล</th></tr></thead><tbody>${legRows}</tbody></table>
          <div class="stacked legcards">${legCards}</div></div>
          <div class="card-f">ผลรายคู่ใช้คอลัมน์ result ในฐานข้อมูลโดยตรง · ราคาเป็นราคาที่บันทึกในบิล · แต้มต่อติดลบ = ทีมต่อ</div></section>`
      : `<section class="card" aria-labelledby="h-legs"><div class="card-h"><h2 id="h-legs">รายการคู่ในบิล</h2><span class="sub">${t.legs} คู่</span></div>
          <div class="card-b">${empty('ไม่มีรายละเอียดรายคู่ใน snapshot นี้', `snapshot เก็บรายละเอียดรายคู่เฉพาะบิล #36–#${MAX_ID} · บิล #${t.id} ทราบเฉพาะสรุป: ${legLabel(t)} จากทั้งหมด ${t.legs} คู่`, 'ticket')}</div></section>`;
    return `<div class="tk-head"><div class="tk-title"><a class="btn ghost d-only" href="#/tickets">${ic('left')}บิลทั้งหมด</a><h1>บิล #${t.id}</h1>${badge(t.status)}<span class="code" title="รหัสบิลเต็ม">${esc(t.code)}</span><span class="faint">${esc(F.dateTH(t.date))} · ${t.legs} คู่</span></div>
      <div class="tk-nav">${prev ? `<a class="btn" href="${base}${prev}" aria-label="บิลก่อนหน้า #${prev}">${ic('left')}<span class="d-only">#${prev}</span></a>` : ''}${next ? `<a class="btn" href="${base}${next}" aria-label="บิลถัดไป #${next}"><span class="d-only">#${next}</span>${ic('right')}</a>` : ''}</div></div>
      <div class="split"><div>${legsSection}</div>
        <aside class="card settle" aria-labelledby="h-settle"><div class="card-h"><h2 id="h-settle">สรุปการชำระ</h2>${badge(t.status)}</div>
          <div class="card-b">${verdict}
            <dl class="kv">
              <div><dt>เงินเดิมพัน</dt><dd>${baht(t.stake)}</dd></div>
              <div><dt>ยอดจ่ายหากชนะ</dt><dd class="${t.payout == null ? 'faint' : ''}">${t.payout == null ? 'ไม่ได้บันทึก' : baht(t.payout)}</dd></div>
              <div><dt>ยอดจ่ายจริง</dt><dd>${t.actualPayout == null ? '<span class="faint">รอผล</span>' : baht(t.actualPayout)}</dd></div>
              <div class="total"><dt>กำไร/ขาดทุนสุทธิ</dt><dd class="${cls(t.profit)}">${t.profit == null ? '<span class="faint">รอผล</span>' : esc(sbaht(t.profit))}</dd></div>
            </dl>
            <div class="legsum" aria-label="สรุปผลรายคู่"><div><b class="pos">${t.legsWon}</b><span>ชนะ</span></div><div><b class="neg">${t.legsLost}</b><span>แพ้</span></div><div><b>${t.legsPush}</b><span>เสมอ</span></div><div><b>${t.legsVoid}</b><span>โมฆะ</span></div><div><b style="color:var(--pending)">${t.legsPending}</b><span>รอผล</span></div></div>
            <h3 style="font-size:var(--fs-12);color:var(--text-3);margin:var(--sp-4) 0 var(--sp-2);letter-spacing:.06em;text-transform:uppercase;font-weight:500">ข้อต่อสเต็ป</h3>
            ${chain}
          </div></aside></div>`;
  }

  /* ---------- games ---------- */
  function legChips(g) {
    const by = new Map(); g.legs.forEach((l) => { const k = l.label + '|' + l.result; const r = by.get(k) || { l, tks: [] }; r.tks.push(l.ticketId); by.set(k, r); });
    return [...by.values()].map(({ l, tks }) => `<div class="myleg"><span><b>${esc(l.label)}</b> <span class="tks">${tks.map(tkLink).join(' ')}</span></span>${badge(l.result)}</div>`).join('');
  }
  function gameCard(g) {
    const i = GAME_IDX.get(g.key); const ph = phase(g); const [a, b] = homeAway(g);
    const hd = ph === 'final' ? `<span class="fin">Final</span><span>${esc(F.dateTH(g.date))}</span>`
      : ph === 'started' ? `<span class="run">เริ่มแล้ว · รอบันทึกผล</span><span class="tip">${ic('clock')} ${esc(g.tipoff || '—')} ICT</span>`
      : `<span>${esc(F.dateTH(g.date))}</span><span class="tip">${ic('clock')} ${esc(g.tipoff || 'ไม่ทราบเวลา')} ICT</span>`;
    const row = (tm) => { const w = g.winner === tm;
      return `<div class="gc-team${w ? ' win' : ''}" style="--tc:${esc(C.teamColor(tm))}"><span class="gc-name"><b>${esc(C.abbr(tm))}</b>${esc(C.shortName(tm))}${g.home ? `<small>${g.home === tm ? 'เหย้า' : 'เยือน'}</small>` : ''}${w ? '<span class="sr-only"> ชนะ</span>' : ''}</span>${ph === 'final' ? `<span class="gc-score">${esc(g.scores[tm])}</span>` : ''}</div>`; };
    const lbl = `${C.abbr(a)} พบ ${C.abbr(b)}${ph === 'final' ? ` สกอร์ ${g.scores[a]}–${g.scores[b]}` : ''}`;
    return `<article class="gc" id="game-${i}" tabindex="-1" aria-label="${esc(lbl)}"><div class="gc-hd">${hd}</div><div class="gc-body">${row(a)}${row(b)}</div>
      <div class="gc-picks"><h4>คู่ของฉันในเกมนี้ · ${g.legs.length}</h4><div class="mylegs">${legChips(g)}</div></div>
      ${g.impact && g.impact.length ? `<a class="gc-imp" href="#/impact">${ic('users')}ผลกระทบผู้เล่น ${g.impact.length} รายการ →</a>` : ''}</article>`;
  }
  function viewGames() {
    const open = GAMES.filter((g) => g.status !== 'final').sort((a, b) => a.date.localeCompare(b.date) || (a.tipoff || '').localeCompare(b.tipoff || ''));
    const fin = GAMES.filter((g) => g.status === 'final');
    const nStarted = open.filter((g) => phase(g) === 'started').length;
    const f = state.games;
    const seg = `<div class="seg m-scroll" role="group" aria-label="กรองเกม" id="gSeg">${[['all', 'ทั้งหมด', GAMES.length], ['upcoming', 'รอผล / กำลังจะแข่ง', open.length], ['live', 'สด', 0], ['final', 'จบแล้ว', fin.length]].map(([k, l, n]) => `<button type="button" data-g="${k}" aria-pressed="${f === k}">${esc(l)}<span class="n">${n}</span></button>`).join('')}</div>`;
    let out = `<div class="ph"><div><div class="eyebrow">Schedule & results</div><h1>เกม NBA</h1><p>เกมในหน้านี้สร้างจากคู่ที่อยู่ในบิลของฉันเท่านั้น (${GAMES.length} เกม) — ไม่ใช่ตารางแข่งขันเต็มของลีก · สกอร์มาจากผลที่บันทึกในบิล</p></div>${seg}</div>`;
    if (f === 'all' || f === 'upcoming') {
      out += `<div class="sec-h"><h2>รอผล / กำลังจะแข่ง</h2><span class="sub">${open.length} เกม${nStarted ? ` · เริ่มแล้ว ${nStarted} เกม (รอบันทึกผล)` : ''} · เวลาไทย (ICT)</span></div>`;
      out += open.length ? `<div class="gc-grid">${open.map(gameCard).join('')}</div>` : empty('ไม่มีเกมที่รอผล', 'ไม่มีบิลรอผลที่อ้างถึงเกมในอนาคต');
    }
    if (f === 'all' || f === 'live') {
      out += `<div class="sec-h"><h2>กำลังแข่ง (สด)</h2><span class="sub">0 เกม</span></div>`;
      out += empty('ไม่มีข้อมูลสกอร์สด', 'ระบบนี้ไม่มีฟีดสกอร์แบบเรียลไทม์ — เกมที่เลยเวลาเริ่มแล้วจะขึ้นว่า "เริ่มแล้ว · รอบันทึกผล" จนกว่าจะอัปเดตผลลงในคู่ของบิล', 'live');
    }
    if (f === 'all' || f === 'final') {
      const dates = [...new Set(fin.map((g) => g.date))];
      out += dates.map((d) => { const gs = fin.filter((g) => g.date === d);
        return `<div class="sec-h"><h2>จบแล้ว · ${esc(F.dateTH(d))}</h2><span class="sub">${gs.length} เกม</span></div><div class="gc-grid">${gs.map(gameCard).join('')}</div>`; }).join('');
    }
    return out;
  }
  function bindGames() { $('#gSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (!b) return; state.games = b.dataset.g; render(); }); }

  /* ---------- player impact ---------- */
  function viewImpact() {
    const types = [['all', 'ทั้งหมด'], ['pre_game_absence', C.EVENT.pre_game_absence.th + ' (ก่อนเกม)'], ['injury_during_game', C.EVENT.injury_during_game.th], ['ejection', C.EVENT.ejection.th]];
    const cnt = (k) => (k === 'all' ? FEED.length : FEED.filter((e) => e.event_type === k).length);
    const teams = [...new Set(FEED.map((e) => C.canonicalTeam(e.team)))].sort();
    const list = FEED.filter((e) => (state.impType === 'all' || e.event_type === state.impType) && (state.impTeam === 'all' || C.canonicalTeam(e.team) === state.impTeam));
    const byGame = new Map(); list.forEach((e) => { const r = byGame.get(e.game.key) || []; r.push(e); byGame.set(e.game.key, r); });
    const hasEx = !!(C.S.statsVsAnalysisExample && C.S.statsVsAnalysisExample.bet); const ex = hasEx ? C.S.statsVsAnalysisExample : { bet: [], player_impact: {} }; const exb = ex.bet; const pi = ex.player_impact || {}; const as = pi.actual_stats || {}; const an = pi.analysis || {};
    const typeCls = (t) => (t === 'injury_during_game' ? 'ig' : t === 'ejection' ? 'ej' : '');
    let groups = '';
    if (!list.length) groups = empty('ไม่มีเหตุการณ์ตามตัวกรอง', state.impType === 'ejection' ? 'ไม่มีการบันทึกผู้เล่นถูกไล่ออกในเกมที่เกี่ยวกับบิลของฉัน' : 'ลองเปลี่ยนประเภทหรือทีม', 'users');
    else for (const [, evs] of byGame) {
      const g = evs[0].game; const [a, b] = g.teams;
      groups += `<section class="card ev-game" aria-label="${esc(C.abbr(a) + ' vs ' + C.abbr(b))}"><div class="card-h"><h3>${team(a)} <span class="faint">${g.status === 'final' ? g.scores[a] : ''}</span> <span class="faint">–</span> <span class="faint">${g.status === 'final' ? g.scores[b] : ''}</span> ${team(b)}</h3><span class="sub">${esc(F.dateTH(g.date))} · ${evs.length} เหตุการณ์ · คู่ของฉัน: ${[...new Set(g.legs.map((l) => l.label))].map(esc).join(', ')}</span></div>
        <div class="ev-head" aria-hidden="true"><span>ผู้เล่น</span><span>ทีม</span><span>ประเภท</span><span>สาเหตุ</span><span>แหล่งข้อมูล</span><span class="rel">คู่/บิลที่เกี่ยวข้อง</span></div>
        ${evs.map((e) => `<div class="ev"><div class="who"><b>${esc(e.player)}</b><span>${esc(e.status)} · รายงาน ${esc(F.dateTH(e.report_date))}</span></div>
          <div class="tcol">${team(e.team)}</div>
          <div><span class="type-badge ${typeCls(e.event_type)}">${esc(e.kind.th)}</span></div>
          <div class="why">${esc(e.reason)}</div>
          <div class="srcc" style="font-size:var(--fs-12)">${srcLink(e.source)}</div>
          <div class="rel">${e.relatedLegs.map((l) => `<span class="tag" title="บิล #${l.ticketId} · ${esc(C.STATUS[l.result].th)}">${esc(l.label)} · <a href="#/ticket/${l.ticketId}">#${l.ticketId}</a>&nbsp;<span class="${l.result === 'won' ? 'pos' : l.result === 'lost' ? 'neg' : 'muted'}">${esc(C.STATUS[l.result].th)}</span></span>`).join('')}</div></div>`).join('')}</section>`;
    }
    const leaders = (as.leaders || []).map((p) => `<tr><td>${esc(p.player)}</td><td>${team(p.team)}</td><td class="num">${p.pts == null ? '—' : esc(p.pts)}</td><td class="num">${p.ast == null ? '—' : esc(p.ast)}</td></tr>`).join('');
    return `<div class="ph"><div><div class="eyebrow">Player impact</div><h1>ผลกระทบผู้เล่น</h1><p>แสดงตามข้อมูล player_impact ที่บันทึกไว้ในคู่ของบิลเท่านั้น · ระบบไม่สร้างสถานะผู้เล่น คะแนน หรือบทวิเคราะห์ขึ้นเอง</p></div></div>
      ${hasEx ? `<div class="grid" style="margin-bottom:var(--sp-4)">
        <section class="card s12" aria-labelledby="h-cva"><div class="card-h"><h2 id="h-cva">ตัวอย่าง: สถิติยืนยันแล้ว vs บทวิเคราะห์</h2><span class="sub">แถวจริงจาก bets #${esc(exb[0])} · ${team(exb[2])} ${esc(F.line(exb[4]))} vs ${team(exb[3])} · ${badge(exb[8])}</span></div>
          <div class="cva">
            <section aria-labelledby="h-conf"><h3 id="h-conf">${ic('check')}สถิติยืนยันแล้ว <span class="tag" style="margin-left:auto">ข้อเท็จจริง</span></h3><div class="src-k">player_impact.actual_stats</div>
              <div style="margin-top:var(--sp-3);font-size:var(--fs-16);font-weight:600">${esc(as.final || '—')}</div>
              <table class="dt leaders"><thead><tr><th scope="col">ผู้เล่น</th><th scope="col">ทีม</th><th scope="col" class="num">PTS</th><th scope="col" class="num">AST</th></tr></thead><tbody>${leaders}</tbody></table>
              <div style="margin-top:var(--sp-3);font-size:var(--fs-12)" class="faint">ตรวจสอบเมื่อ ${esc(String(pi.checked_at || '').replace('T', ' ').slice(0, 16))} · ${(pi.source_urls || []).map(srcLink).join(' · ')}</div></section>
            <section aria-labelledby="h-ana"><h3 id="h-ana">${ic('info')}บทวิเคราะห์ <span class="tag amber" style="margin-left:auto">การตีความ</span></h3><div class="src-k">player_impact.analysis.bet_line_interpretation</div>
              <blockquote>${esc(an.bet_line_interpretation || '—')}</blockquote>
              <p class="faint" style="font-size:var(--fs-12);margin:var(--sp-3) 0 0">บทวิเคราะห์เป็นการตีความผลเทียบกับเส้นของบิล ไม่ใช่สถิติทางการ · แยกแสดงจากตัวเลขที่ยืนยันแล้วเสมอ</p></section>
          </div></section>
      </div>` : ''}
      <section class="card" style="margin-bottom:var(--sp-4)" aria-label="ตัวกรองผลกระทบผู้เล่น"><div class="toolbar wrap" style="border:0">
        <div class="field"><span id="tyLbl" style="font-size:var(--fs-11);color:var(--text-3)">ประเภทเหตุการณ์</span><div class="seg m-scroll" role="group" aria-labelledby="tyLbl" id="tySeg">${types.map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${state.impType === k}">${esc(l)}<span class="n">${cnt(k)}</span></button>`).join('')}</div></div>
        <div class="field"><label for="impTeam">ทีม</label><select class="select" id="impTeam"><option value="all">ทุกทีม (${teams.length})</option>${teams.map((t) => `<option value="${esc(t)}" ${state.impTeam === t ? 'selected' : ''}>${esc(C.abbr(t) + ' · ' + t)}</option>`).join('')}</select></div>
        <div class="grow"></div><span class="result-meta" role="status">${list.length} เหตุการณ์ใน ${byGame.size} เกม</span></div>
        <div style="padding:0 var(--sp-4) var(--sp-4)">${note('ไม่ได้ติดตามการเปลี่ยนแปลงตัวจริง (starting lineup) — ระบบบันทึกเฉพาะผู้เล่นที่ไม่ได้ลงเล่น เจ็บระหว่างเกม หรือถูกไล่ออก ตามที่ระบุใน player_impact · มีข้อมูลเฉพาะเกมวันที่ ' + IMP_RANGE + ' (เวลาไทย)')}</div></section>
      ${groups}`;
  }
  function bindImpact() {
    $('#tySeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (!b) return; state.impType = b.dataset.t; render(); });
    $('#impTeam').addEventListener('change', (e) => { state.impTeam = e.target.value; render(); });
  }

  /* ---------- analytics ---------- */
  function hbar(label, r, opts = {}) {
    const wr = r.winRate; const w = wr == null ? 0 : wr * 100;
    return `<div class="hbar"><span>${label}</span><span class="bullet" role="img" aria-label="${esc(F.pct(wr))}"><i class="${wr != null && wr >= 0.5 ? '' : 'l'}" style="width:${w}%"></i><span class="ref" style="left:50%"></span></span>
      <span class="pct">${esc(F.pct(wr))}</span><span class="rec">${r.won}-${r.lost}${r.push ? '-' + r.push : ''}${opts.n ? ` · ${r.n}` : ''}</span></div>`;
  }
  function viewAnalytics() {
    const teams = [...A.teams].sort(state.teamSort === 'wr' ? (a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.n - a.n : (a, b) => b.n - a.n || (b.winRate ?? 0) - (a.winRate ?? 0));
    const maxAbsNet = Math.max(...A.parlay.map((p) => Math.abs(p.net)));
    const kp = [
      { l: 'ROI รวม', v: `<span class="${cls(K.roi)}">${esc(F.signedPct(K.roi))}</span>`, c: `สุทธิ ${esc(sbaht(K.net))} บนเดิมพัน ${baht(K.stakeSettled)}` },
      { l: 'อัตราชนะรายบิล', v: esc(F.pct(K.ticketWinRate)), c: `${K.won} ชนะ / ${K.won + K.lost} บิลที่ตัดสิน` },
      { l: 'อัตราชนะรายคู่', v: esc(F.pct(K.legWinRate)), c: `${K.legs.won}-${K.legs.lost}-${K.legs.push} (ชนะ-แพ้-เสมอ)` },
      { l: 'ค่าเฉลี่ยคู่ต่อบิล', v: (A.parlay.reduce((s, p) => s + p.legs * p.tickets, 0) / A.parlay.reduce((s, p) => s + p.tickets, 0)).toFixed(2), c: `${K.legs.n} คู่ใน ${K.settled} บิลที่ตัดสินแล้ว` }
    ];
    const mRow = (k, l, fmtF, deltaF) => `<div>${esc(l)}</div><div class="r">${fmtF(mOct[k])}</div><div class="r">${fmtF(mNov[k])}</div><div class="r">${deltaF ? deltaF(mNov[k] - mOct[k]) : ''}</div>`;
    return `<div class="ph"><div><div class="eyebrow">Analytics</div><h1>วิเคราะห์ผลงาน</h1><p>สถิติรายคู่คำนวณจาก ${K.legs.n} คู่ที่ตัดสินแล้ว และสถิติรายบิลจาก ${K.settled} บิล · อัตราชนะ = ชนะ ÷ (ชนะ + แพ้) ไม่รวมเสมอ</p></div></div>
      ${kpiStrip(kp)}
      <div class="grid">
        <section class="card s7" aria-labelledby="a-cum"><div class="card-h"><h2 id="a-cum">แนวโน้มกำไร/ขาดทุนสะสม</h2><span class="sub">${esc(F.dateTH(A.daily[0].date))} – ${esc(F.dateTH(A.daily[A.daily.length - 1].date))}</span></div>
          <div class="card-b">${chartBox('aCum', 'cum', 260, 'ชี้ที่กราฟเพื่อดูยอดสะสมแต่ละวัน')}</div></section>
        <section class="card s5" aria-labelledby="a-mon"><div class="card-h"><h2 id="a-mon">${esc(mShort(mOct))} เทียบ ${esc(mShort(mNov))}</h2><span class="sub">รายเดือน</span></div>
          <div class="card-b flush"><div class="cmp" role="table" aria-label="เปรียบเทียบรายเดือน">
            <div class="h">ตัวชี้วัด</div><div class="h r">${esc(mOct.label)}</div><div class="h r">${esc(mNov.label)}</div><div class="h r">ต่าง</div>
            ${mRow('tickets', 'บิลที่ตัดสิน', (v) => v, (d) => `<span class="faint">${d > 0 ? '+' : ''}${d}</span>`)}
            ${mRow('won', 'บิลที่ชนะ', (v) => v, (d) => `<span class="faint">${d > 0 ? '+' : ''}${d}</span>`)}
            ${mRow('stake', 'เงินเดิมพัน', money, (d) => `<span class="faint">${esc(F.signed(d))}</span>`)}
            ${mRow('net', 'สุทธิ', (v) => signedSpan(v), (d) => signedSpan(d))}
            ${mRow('roi', 'ROI', (v) => `<span class="${cls(v)}">${esc(F.signedPct(v))}</span>`, null)}
          </div></div><div class="card-f">สองเดือนล่าสุด · สุทธิรวมทุกเดือน ${esc(sbaht(K.net))}</div></section>
        <section class="card s7" aria-labelledby="a-daily"><div class="card-h"><h2 id="a-daily">กำไร/ขาดทุนรายวัน</h2>${dailyLegend()}</div>
          <div class="card-b">${chartBox('aDaily', 'daily', 210, 'ยอดขาดทุนรายวันเล็กมากเมื่อเทียบกับวันที่ชนะ — กด LOG เพื่อดูให้ชัด หรือดูค่าจริงในตารางด้านขวา')}</div></section>
        <section class="card s5" aria-labelledby="a-dt"><div class="card-h"><h2 id="a-dt">ตารางรายวัน</h2><span class="sub">฿</span></div>
          <div class="card-b flush tbl-wrap scroll" style="max-height:290px"><table class="dt"><thead><tr><th scope="col">วันที่</th><th scope="col" class="num">บิล</th><th scope="col" class="num">เดิมพัน</th><th scope="col" class="num">สุทธิ</th><th scope="col" class="num">สะสม</th></tr></thead><tbody>
          ${[...A.daily].reverse().map((d) => `<tr><td>${esc(F.dateTH(d.date))}</td><td class="num">${d.won ? `<span class="pos" title="ชนะ ${d.won} บิล">${d.won}/</span>` : ''}${d.tickets}</td><td class="num muted">${money(d.stake)}</td><td class="num">${signedSpan(d.net)}</td><td class="num">${signedSpan(d.cumulative)}</td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="card s6" aria-labelledby="a-mkt"><div class="card-h"><h2 id="a-mkt">ผลงานตามตลาด</h2><span class="sub">อัตราชนะรายคู่ · เส้นอ้างอิง 50%</span></div>
          <div class="card-b flush"><div class="hbars">${A.markets.map((r) => hbar(`${esc(r.label)} <span class="faint">${r.n}</span>`, r)).join('')}</div></div>
          <div class="card-f">ต่อ = แต้มต่อติดลบ · รอง = แต้มต่อบวก · ${A.spreadVsTotal.map((s) => `${esc(s.label)} ${esc(F.pct(s.winRate))} (${s.n} คู่)`).join(' · ')}</div></section>
        <section class="card s6" aria-labelledby="a-sb"><div class="card-h"><h2 id="a-sb">ช่วงแต้มต่อ</h2><span class="sub">|เส้นแต้มต่อ| · เฉพาะตลาดแต้มต่อ</span></div>
          <div class="card-b flush"><div class="hbars">${A.spreadBuckets.map((r) => hbar(`${esc(r.label)} แต้ม <span class="faint">${r.n}</span>`, r)).join('')}</div></div>
          <div class="card-f">สูง/ต่ำไม่นับในตารางแต้มต่อ · ${A.spreadBuckets.reduce((s, r) => s + r.n, 0)} คู่</div></section>
        <section class="card s12" aria-labelledby="a-par"><div class="card-h"><h2 id="a-par">ผลงานตามขนาดสเต็ป</h2><span class="sub">จำนวนคู่ต่อบิล · บิลที่ตัดสินแล้ว</span></div>
          <div class="card-b flush tbl-wrap"><table class="dt"><thead><tr><th scope="col">คู่ต่อบิล</th><th scope="col" class="num">บิล</th><th scope="col" class="num">ชนะ</th><th scope="col" class="num">เดิมพัน ฿</th><th scope="col" class="num">สุทธิ ฿</th><th scope="col" class="num">ROI</th><th scope="col" class="d-only" style="width:34%">สุทธิ (เทียบศูนย์)</th></tr></thead><tbody>
          ${A.parlay.map((p) => { const w = (Math.abs(p.net) / maxAbsNet) * 50; return `<tr><td class="lead">${p.legs} คู่</td><td class="num">${p.tickets}</td><td class="num">${p.won ? `<span class="pos">${p.won}</span>` : '0'}</td><td class="num muted">${money(p.stake)}</td><td class="num">${signedSpan(p.net)}</td><td class="num"><span class="${cls(p.roi)}">${esc(F.signedPct(p.roi))}</span></td>
            <td class="d-only"><div style="position:relative;height:10px;background:var(--surface-3);border-radius:2px"><span style="position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--text-3)"></span><i style="position:absolute;top:0;bottom:0;border-radius:2px;${p.net >= 0 ? `left:50%;background:var(--win)` : `right:50%;background:var(--loss)`};width:${Math.max(w, 0.6)}%"></i></div></td></tr>`; }).join('')}
          </tbody></table></div><div class="card-f">แต่ละบิลที่ชนะมีผลต่อ ROI อย่างมาก — ขนาดตัวอย่างต่อกลุ่มยังเล็ก (2–12 บิล)</div></section>
        <section class="card s12" aria-labelledby="a-team"><div class="card-h"><h2 id="a-team">ผลงานตามทีมที่เลือก</h2>
          <div class="seg" role="group" aria-label="เรียงทีม" id="tmSeg"><button type="button" data-ts="n" aria-pressed="${state.teamSort === 'n'}">จำนวนคู่</button><button type="button" data-ts="wr" aria-pressed="${state.teamSort === 'wr'}">อัตราชนะ</button></div></div>
          <div class="card-b flush"><div class="teamgrid">${teams.map((r) => `<div class="hbar">${team(r.team)}<span class="bullet" role="img" aria-label="${esc(r.abbr)} ${esc(F.pct(r.winRate))}"><i class="${r.winRate != null && r.winRate >= 0.5 ? '' : 'l'}" style="width:${(r.winRate || 0) * 100}%"></i><span class="ref" style="left:50%"></span></span><span class="rec" title="จำนวนคู่">${r.n}</span><span class="rec">${r.won}-${r.lost}-${r.push}</span><span class="pct">${esc(F.pct(r.winRate))}</span></div>`).join('')}</div></div>
          <div class="card-f">${A.teams.length} ทีม · นับทีมที่เลือกในตลาดแต้มต่อ และทั้งสองทีมในตลาดสูง/ต่ำ ตามการรวมใน SQL · ชนะ-แพ้-เสมอ · เดิมพันสรุปที่ระดับบิล ไม่แบ่งลงรายทีม</div></section>
      </div>`;
  }
  function bindAnalytics() { $('#tmSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-ts]'); if (!b) return; state.teamSort = b.dataset.ts; const y = window.scrollY; render(); window.scrollTo(0, y); }); }
