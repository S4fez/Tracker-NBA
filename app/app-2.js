/* NBA Bet Tracker (Courtside Ledger). Loads live, read-only data from Supabase; contains no betting data. */
'use strict';
  /* ---------- player_impact: ported from classic.html (parseImpact / renderImpactEntry / renderImpactBlock) — every stored shape, never raw JSON ---------- */
  const PI_FIELDS = ['player', 'player_name', 'name', 'team', 'status', 'event_type', 'reason', 'impact', 'note', 'notes', 'report_date', 'date', 'source', 'url'];
  const piFirst = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return null; };
  const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const blank = (v) => v === null || v === undefined || (typeof v === 'string' && !v.trim());
  const looksLikeEvent = (o) => PI_FIELDS.some((k) => k in o);
  const hasContent = (o) => Object.keys(o).some((k) => !blank(o[k]) && !(Array.isArray(o[k]) && !o[k].length) && !(isPlainObj(o[k]) && !Object.keys(o[k]).length));
  function parseImpact(raw, depth = 0) {
    const out = { events: [], malformed: false, notes: [] };
    const merge = (r) => { out.events.push(...r.events); out.notes.push(...r.notes); if (r.malformed) out.malformed = true; };
    if (depth > 5 || raw === null || raw === undefined) return out;
    if (typeof raw === 'string') { const s = raw.trim(); if (!s || s === 'null' || s === '[]' || s === '{}' || s === '""') return out;
      if (/^[\[{"]/.test(s)) { let v; try { v = JSON.parse(s); } catch (e) { out.malformed = true; return out; } merge(parseImpact(v, depth + 1)); return out; }
      out.events.push({ impact: s }); return out; }
    if (typeof raw === 'number' || typeof raw === 'boolean') { out.events.push({ impact: String(raw) }); return out; }
    if (Array.isArray(raw)) { for (const x of raw) { if (isPlainObj(x) && looksLikeEvent(x)) { if (hasContent(x)) out.events.push(x); } else merge(parseImpact(x, depth + 1)); } return out; }
    if (!isPlainObj(raw)) return out;
    const keys = Object.keys(raw); if (!keys.length) return out;
    if ('events' in raw) { const ev = raw.events;
      if (ev === null || ev === undefined || Array.isArray(ev) || isPlainObj(ev) || typeof ev === 'string') merge(parseImpact(ev, depth + 1)); else out.malformed = true;
      for (const k of keys) if (k !== 'events' && !blank(raw[k])) out.notes.push({ key: k, value: raw[k] });
      return out; }
    if (looksLikeEvent(raw)) { if (hasContent(raw)) out.events.push(raw); return out; }
    for (const k of keys) { const v = raw[k]; if (blank(v)) continue; /* legacy {"Player A":"note"} map */
      if (isPlainObj(v)) out.events.push(looksLikeEvent(v) ? { player: k, ...v } : { player: k, details: v });
      else if (Array.isArray(v)) merge(parseImpact(v, depth + 1));
      else out.events.push({ player: k, impact: String(v) }); }
    return out;
  }
  const humanKey = (k) => String(k).replace(/_/g, ' ');
  function textOf(v, depth = 0) { if (v === null || v === undefined) return ''; if (typeof v !== 'object') return String(v); if (depth > 2) return '…';
    if (Array.isArray(v)) return v.map((x) => textOf(x, depth + 1)).filter(Boolean).join(', ');
    return Object.keys(v).filter((k) => !blank(v[k])).map((k) => `${humanKey(k)}: ${textOf(v[k], depth + 1)}`).join(' · '); }
  const EVENT_TYPES = { pre_game_absence: { label: 'ขาดก่อนเกม', sev: 'out' }, pre_game_questionable: { label: 'ไม่แน่นอนก่อนเกม', sev: 'q' }, injury_during_game: { label: 'บาดเจ็บระหว่างเกม', sev: 'inj' }, ejection: { label: 'ถูกไล่ออกจากเกม', sev: 'ej' }, returned: { label: 'กลับมาลงเล่น', sev: 'ok' }, return: { label: 'กลับมาลงเล่น', sev: 'ok' } };
  const SEV_PILL = { out: 'pp-out', q: 'pp-q', ok: 'pp-ok', inj: 'pp-inj', ej: 'pp-ej', unv: 'pp-unv' };
  function sevClass(status) { const s = String(status || '').toLowerCase().trim(); if (!s) return '';
    if (/ไม่บันทึกเป็นข้อเท็จจริง|ยังไม่มีข้อมูลยืนยัน|ต้องยืนยัน|unverified|unconfirmed/.test(s)) return 'unv';
    if (/eject|ไล่ออก/.test(s)) return 'ej';
    if (/during (the )?game|left (the )?game|left in (the )?\w+ (quarter|half)|(did )?not return|ออกระหว่างเกม|บาดเจ็บระหว่างเกม|ไม่กลับมา/.test(s)) return 'inj';
    const lead = s.split('/')[0];
    if (/return|available|\bactive\b|no injur|ไม่พบ|ลงได้|พร้อม|กลับมา/.test(lead)) return 'ok';
    if (/question|doubt|game-time|probable|day-to-day|ไม่แน่นอน/.test(lead)) return 'q';
    if (/\bout\b|ruled out|suspend|ไม่ลง|พักยาว/.test(lead)) return 'out';
    return ''; }
  function eventKind(e) { const t = String(piFirst(e, ['event_type']) ?? '').trim(); if (!t) return null; return EVENT_TYPES[t.toLowerCase()] || { label: humanKey(t), sev: '' }; }
  function piSafeUrl(u) { const s = String(u || '').trim(); if (!/^https?:\/\/[^\s"'<>]+$/i.test(s)) return ''; try { const p = new URL(s); return /^https?:$/.test(p.protocol) ? p.href : ''; } catch (e) { return ''; } }
  function daysBetween(a, b) { if (!/^\d{4}-\d{2}-\d{2}$/.test(a || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return null; return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  const teamLabel = (t) => { const s = textOf(t); return s === 'data_quality' ? 'หมายเหตุคุณภาพข้อมูล' : s; };
  function renderImpactEntry(e, gDate) {
    const player = piFirst(e, ['player', 'player_name', 'name']), tm = piFirst(e, ['team']), status = piFirst(e, ['status']), reason = piFirst(e, ['reason']), impact = piFirst(e, ['impact', 'note', 'notes']);
    const date = piFirst(e, ['report_date', 'date']), rawSrc = piFirst(e, ['source', 'url']), src = piSafeUrl(rawSrc), kind = eventKind(e), stSev = sevClass(status);
    const sev = String(tm) === 'data_quality' ? 'unv' : (kind && kind.sev) || stSev;
    const extra = Object.keys(e).filter((k) => !PI_FIELDS.includes(k) && !blank(e[k])).map((k) => `${esc(humanKey(k))}: ${esc(textOf(e[k]))}`);
    const title = blank(player) ? '<span class="faint">ไม่ระบุผู้เล่น</span>' : esc(textOf(player));
    const dateTxt = textOf(date), gap = daysBetween(dateTxt.slice(0, 10), gDate || '');
    const stale = gap !== null && gap > 1 ? `<p class="pi-stale">รายงานก่อนวันแข่ง ${gap} วัน · ไม่ใช่การยืนยันสถานะในเกมนี้</p>` : '';
    const badges = (kind ? `<span class="pi-pill ${SEV_PILL[kind.sev] || ''}">${esc(kind.label)}</span>` : '') + (blank(status) ? '' : `<span class="pi-pill ${SEV_PILL[stSev] || ''}">${esc(textOf(status))}</span>`);
    const srcHtml = src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">↗ ${esc(host(src))}</a>` : (blank(rawSrc) ? '' : '<span>แหล่งข้อมูล: ลิงก์ไม่ถูกต้อง</span>');
    return `<div class="pi ${sev}"><div class="pi-head"><div><strong>${title}</strong>${blank(tm) ? '' : `<small>${esc(teamLabel(tm))}</small>`}</div>${badges ? `<div class="pi-badges">${badges}</div>` : ''}</div>${blank(reason) ? '' : `<p><b>สาเหตุ:</b> ${esc(textOf(reason))}</p>`}${blank(impact) ? '' : `<p><b>ผลกระทบต่อเกม:</b> ${esc(textOf(impact))}</p>`}${extra.length ? `<div class="pi-extra">${extra.join(' · ')}</div>` : ''}${stale}${dateTxt || srcHtml ? `<div class="pi-foot">${dateTxt ? `<span>รายงาน ${esc(dateTxt)}</span>` : ''}${srcHtml}</div>` : ''}</div>`;
  }
  /* empty string when nothing is stored for this leg */
  function piBlock(b, open = false) {
    const parsed = parseImpact(b.pi), list = parsed.events;
    const warn = parsed.malformed ? '<div class="pi-warn">ข้อมูลผลกระทบผู้เล่นบางส่วนอยู่ในรูปแบบที่อ่านไม่ได้ จึงไม่แสดง</div>' : '';
    if (!list.length) return warn;
    const counts = new Map(); for (const e of list) { const k = eventKind(e); const lbl = k ? k.label : ({ out: 'รายงาน Out', q: 'ไม่แน่นอน', ej: 'ถูกไล่ออก', inj: 'บาดเจ็บระหว่างเกม' })[sevClass(piFirst(e, ['status']))]; if (lbl) counts.set(lbl, (counts.get(lbl) || 0) + 1); }
    const sum = [...counts].map(([k, n]) => `${esc(k)} ${n}`).join(' · ');
    const notes = parsed.notes.map((n) => `${esc(humanKey(n.key))}: ${esc(textOf(n.value))}`).join(' · ');
    return `<details class="impact"${open ? ' open' : ''}><summary><span>ผลกระทบผู้เล่น · ${list.length} รายการ${sum ? ` <span class="faint">· ${sum}</span>` : ''}</span></summary><div class="impact-list">${list.map((e) => renderImpactEntry(e, b.date)).join('')}${notes ? `<div class="pi-extra">${notes}</div>` : ''}${warn}</div></details>`;
  }

  /* ---------- compact mobile leg card ("mini scoreboard" + player-impact chips) ---------- */
  const ML_TAG = { out: 'ไม่ลง', q: 'ไม่แน่นอน', inj: 'เจ็บกลางเกม', ej: 'โดนไล่ออก', ok: 'ลงเล่น', unv: 'ยังไม่ยืนยัน' };
  function mlSev(e) { if (String(piFirst(e, ['team'])) === 'data_quality') return 'unv'; const k = eventKind(e); return (k && k.sev) || sevClass(piFirst(e, ['status'])) || ''; }
  function mlChip(e, b) {
    const sev = mlSev(e), player = piFirst(e, ['player', 'player_name', 'name']), tmRaw = piFirst(e, ['team']);
    const isDQ = String(tmRaw) === 'data_quality';
    const tag = isDQ ? 'หมายเหตุข้อมูล' : (ML_TAG[sev] || (eventKind(e) ? eventKind(e).label : '') || textOf(piFirst(e, ['status'])) || 'หมายเหตุ');
    const full = blank(player) ? '' : textOf(player), parts = full.split(/\s+/).filter(Boolean);
    const lastBit = parts.slice(1).join(' '), short = parts.length > 1 && lastBit.length > 2 ? lastBit : full;
    const tm = blank(tmRaw) || isDQ ? '' : C.abbr(textOf(tmRaw));
    return `<span class="ml-chip k-${esc(sev || 'na')}"><i aria-hidden="true"></i><b>${esc(tag)}</b>${short ? `<span>${esc(short)}</span>` : ''}${tm ? `<span class="ml-tm">${esc(tm)}</span>` : ''}</span>`;
  }
  function mlSide(e, b) {
    const tmRaw = piFirst(e, ['team']); if (blank(tmRaw) || String(tmRaw) === 'data_quality') return '';
    if (b.market !== 'Spread') return 'เกมรวมแต้ม';
    const t = C.canonicalTeam(textOf(tmRaw)); return t === b.pick ? 'ฝั่งที่เลือก' : t === b.opponent ? 'ฝั่งคู่แข่ง' : '';
  }
  function mlCard(b, i) {
    const res = b.result, total = b.market !== 'Spread';
    const parsed = parseImpact(b.pi), evs = parsed.events;
    const perTeam = b.final && !b.combined;
    const row = (tm, sc, other) => `<span class="ml-t${perTeam && sc > other ? ' w' : ''}"><i style="--c:${esc(C.teamColor(tm))}" aria-hidden="true"></i><b title="${esc(C.canonicalTeam(tm))}">${esc(C.abbr(tm))}</b><span class="ml-sc">${perTeam ? esc(sc) : ''}</span></span>`;
    const pickTxt = total ? `${b.market === 'Over' ? 'สูง' : 'ต่ำ'} ${b.line}` : `${C.abbr(b.pick)} ${F.line(b.line)}`;
    const tip = res === 'pending' ? tipFor(b) : null;
    const when = b.final ? (total ? `รวม ${b.totalPts}` : 'จบเกม') : res === 'pending' ? (tip ? `${tip} ICT` : 'รอผล') : 'ไม่ได้บันทึกสกอร์';
    const chips = evs.length ? `<span class="ml-chips">${evs.slice(0, 3).map((e) => mlChip(e, b)).join('')}${evs.length > 3 ? `<span class="ml-chip k-na"><b>+${evs.length - 3}</b></span>` : ''}</span>` : '';
    const warn = parsed.malformed ? '<div class="pi-warn">ข้อมูลผลกระทบผู้เล่นบางส่วนอยู่ในรูปแบบที่อ่านไม่ได้ จึงไม่แสดง</div>' : '';
    const notes = parsed.notes.map((n) => `${esc(humanKey(n.key))}: ${esc(textOf(n.value))}`).join(' · ');
    const evHtml = evs.map((e) => { const sd = mlSide(e, b); return `<div class="ml-ev">${sd ? `<span class="ml-side">${esc(sd)}</span>` : ''}${renderImpactEntry(e, b.date)}</div>`; }).join('');
    const facts = `<div class="ml-facts"><span>${esc(F.dateTH(b.date))}</span><span>ราคา ${b.odds == null ? '—' : esc(Number(b.odds).toFixed(2))}</span>${b.final ? `<span>${esc(b.score)}</span>` : ''}${b.verdict ? `<span>${esc(b.verdict)}</span>` : ''}</div>`;
    const evBlock = evs.length || notes || warn ? `<div class="ml-evs">${evHtml}${notes ? `<div class="pi-extra">${notes}</div>` : ''}${warn}</div>`
      : b.final ? '<div class="faint ml-none">ไม่มีบันทึกผู้เล่นคนสำคัญที่ไม่ลง เจ็บ หรือโดนไล่ออก</div>' : '';
    const st = (C.STATUS[res] || { th: res }).th;
    return `<details class="ml is-${esc(res)}"><summary aria-label="คู่ที่ ${i + 1} ${esc(pickTxt)} ${esc(st)}${evs.length ? ` · ผลกระทบผู้เล่น ${evs.length} รายการ` : ''}">
      <span class="ml-teams">${row(b.teams[0], b.ss, b.os)}${row(b.teams[1], b.os, b.ss)}</span>
      <span class="ml-rule" aria-hidden="true"></span>
      <span class="ml-right"><span class="ml-pick">${esc(pickTxt)}</span><span class="ml-st"><span class="ml-ic r-${esc(res)}" aria-hidden="true">${ic(ST_ICON[res] || 'info')}</span><span class="ml-stt">${esc(st)}</span><span class="faint">${esc(when)}</span></span></span>
      ${chips}</summary><div class="ml-det">${facts}${evBlock}</div></details>`;
  }

  /* ---------- ticket detail ---------- */
  function impactBlock(list) {
    if (!list || !list.length) return '';
    return `<details class="imp"><summary>${ic('right')}ผลกระทบผู้เล่น ${list.length} รายการในเกมนี้</summary><div class="imp-list">${list.map((e) => {
      const k = C.EVENT[e.event_type] || { th: e.event_type };
      return `<div class="imp-row"><b>${esc(e.player)}</b>${team(e.team)}<span class="type-badge ${e.event_type === 'injury_during_game' ? 'ig' : e.event_type === 'ejection' ? 'ej' : ''}">${esc(k.th)}</span><span>${esc(e.reason)}</span><span class="faint">· รายงาน ${esc(F.dateTH(e.report_date))}</span>${srcLink(e.source)}</div>`; }).join('')}</div></details>`;
  }
  function scoreCell(b) {
    if (b.final) return `<span class="lead">${esc(b.score)}</span>${b.market !== 'Spread' ? `<div class="faint" style="font-size:var(--fs-11)">รวม ${b.totalPts}</div>` : ''}`;
    if (b.result !== 'pending') return '<span class="faint">ไม่ได้บันทึกสกอร์</span>';
    const tip = tipFor(b); return `<span class="faint">ยังไม่แข่ง</span>${tip ? `<div class="amber" style="font-size:var(--fs-12)">${esc(F.dateTH(b.date))} ${esc(tip)} ICT</div>` : ''}`;
  }
  function viewTicket(id, inPanel = false) {
    const base = inPanel ? '#/tickets/' : '#/ticket/';
    const t = C.ticket(id);
    if (!t) return `<div class="ph"><div><h1>ไม่พบบิล</h1></div></div>${empty('ไม่พบบิล #' + id, 'ไม่มีบิลเลขนี้ในข้อมูลที่โหลดมา', 'ticket')}<p><a class="btn" href="#/tickets">กลับไปหน้าบิล</a></p>`;
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
      chain = `<div style="margin-bottom:var(--sp-3)">${pips(t)}</div>${note(`ไม่มีรายการคู่ของบิล #${t.id} ในฐานข้อมูล — ทราบเฉพาะจำนวน: ${legLabel(t)}`)}`;
    }
    const legRows = t.bets.map((b, i) => { const pb = piBlock(b); return `<tr class="is-${esc(b.result)}${pb ? ' has-sub' : ''}">
        <td class="tight faint">${i + 1}</td>
        <td class="tight">${team(b.teams[0])} <span class="faint">vs</span> ${team(b.teams[1])}<div class="faint" style="font-size:var(--fs-11)">${esc(F.dateTH(b.date))}</div></td>
        <td><span class="lead">${b.market === 'Spread' ? esc(C.abbr(b.pick)) : esc(b.market === 'Over' ? 'สูง' : 'ต่ำ')}</span></td>
        <td class="tight muted">${esc(marketTxt(b))}</td>
        <td class="num">${esc(b.market === 'Spread' ? F.line(b.line) : String(b.line))}</td>
        <td class="num muted">${b.odds == null ? '—' : esc(Number(b.odds).toFixed(2))}</td>
        <td class="tight">${scoreCell(b)}</td>
        <td class="muted" style="font-size:var(--fs-12)">${b.verdict ? esc(b.verdict) : '<span class="faint">รอผลการแข่งขัน</span>'}</td>
        <td class="tight">${badge(b.result)}</td></tr>
        ${pb ? `<tr class="sub"><td></td><td colspan="8">${pb}</td></tr>` : ''}`; }).join('');
    const legCards = t.bets.map((b, i) => mlCard(b, i)).join('');
    const legsSection = t.hasDetail
      ? `<section class="card" aria-labelledby="h-legs"><div class="card-h"><h2 id="h-legs">รายการคู่ในบิล</h2><span class="sub">${t.legs} คู่ · ${esc(legLabel(t))}</span></div>
          <div class="card-b flush tbl-wrap"><table class="dt stack-m"><thead><tr><th scope="col">#</th><th scope="col">เกม</th><th scope="col">เลือก</th><th scope="col">ตลาด</th><th scope="col" class="num">เส้น</th><th scope="col" class="num">ราคา</th><th scope="col">สกอร์จริง</th><th scope="col">วิเคราะห์ผล</th><th scope="col">ผล</th></tr></thead><tbody>${legRows}</tbody></table>
          <div class="stacked legcards">${legCards}</div></div>
          <div class="card-f">ผลรายคู่ใช้คอลัมน์ result ในฐานข้อมูลโดยตรง · ราคาเป็นราคาที่บันทึกในบิล · แต้มต่อติดลบ = ทีมต่อ</div></section>`
      : `<section class="card" aria-labelledby="h-legs"><div class="card-h"><h2 id="h-legs">รายการคู่ในบิล</h2><span class="sub">${t.legs} คู่</span></div>
          <div class="card-b">${empty('ไม่มีรายการคู่ในฐานข้อมูล', `บิล #${t.id} ไม่มีแถวในตาราง bets`, 'ticket')}</div></section>`;
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
      return `<div class="gc-team${w ? ' win' : ''}" style="--tc:${esc(C.teamColor(tm))}"><span class="gc-name"><b>${esc(C.abbr(tm))}</b>${esc(C.shortName(tm))}${g.home ? `<small>${g.home === tm ? 'เหย้า' : 'เยือน'}</small>` : ''}${w ? '<span class="sr-only"> ชนะ</span>' : ''}</span>${ph === 'final' && g.scores[tm] != null ? `<span class="gc-score">${esc(g.scores[tm])}</span>` : ''}</div>`; };
    const sc = g.scores[a] != null && g.scores[b] != null ? `${g.scores[a]}–${g.scores[b]}` : g.total != null ? `รวม ${g.total}` : 'ไม่ได้บันทึกสกอร์';
    const lbl = `${C.abbr(a)} พบ ${C.abbr(b)}${ph === 'final' ? ` สกอร์ ${sc}` : ''}`;
    const noTeam = ph === 'final' && (g.scores[a] == null || g.scores[b] == null) ? `<div class="gc-total">${g.total != null ? `รวม ${esc(g.total)} แต้ม · ไม่มีสกอร์แยกทีม` : 'ไม่ได้บันทึกสกอร์'}</div>` : '';
    return `<article class="gc" id="game-${i}" tabindex="-1" aria-label="${esc(lbl)}"><div class="gc-hd">${hd}</div><div class="gc-body">${row(a)}${row(b)}${noTeam}</div>
      <div class="gc-picks"><h4>คู่ของฉันในเกมนี้ · ${g.legs.length}</h4><div class="mylegs">${legChips(g)}</div></div>
      ${g.impact && g.impact.length ? `<a class="gc-imp" href="#/impact">${ic('users')}ผลกระทบผู้เล่น ${g.impact.length} รายการ →</a>` : ''}</article>`;
  }
  function gameMatch(g) {
    const q = state.gq.trim().toLowerCase();
    return (!q || g.teams.some((tm) => tm.toLowerCase().includes(q) || C.abbr(tm).toLowerCase() === q) || g.legs.some((l) => l.label.toLowerCase().includes(q) || String(l.ticketId) === q.replace('#', '')))
      && (!state.gd || g.date === state.gd) && (state.gr === 'all' || g.legs.some((l) => l.result === state.gr))
      && (state.gi === 'all' || (state.gi === 'yes' ? !!(g.impact && g.impact.length) : !(g.impact && g.impact.length)));
  }
  function viewGames() {
    const dates = [...new Set(GAMES.map((g) => g.date))].sort();
    const tools = `<section class="card" style="margin-bottom:var(--sp-4)" aria-label="ตัวกรองเกม"><div class="toolbar wrap" style="border:0">
      <div class="field"><label for="gq">ค้นหาทีม / บิล</label><div class="search">${ic('search')}<input id="gq" class="input" type="search" placeholder="เช่น DEN, Lakers, #49" value="${esc(state.gq)}" autocomplete="off"></div></div>
      <div class="field"><label for="gd">วันที่แข่ง (ICT)</label><input id="gd" class="input" type="date" min="${dates[0] || ''}" max="${dates[dates.length - 1] || ''}" value="${esc(state.gd)}"></div>
      <div class="field"><label for="gr">ผลคู่ของฉัน</label><select id="gr" class="select">${[['all', 'ทั้งหมด'], ['won', 'มีคู่ที่ชนะ'], ['lost', 'มีคู่ที่แพ้'], ['push', 'มีคู่ที่เสมอ'], ['pending', 'มีคู่ที่รอผล']].map(([k, l]) => `<option value="${k}" ${state.gr === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="gi">ผลกระทบผู้เล่น</label><select id="gi" class="select">${[['all', 'ทั้งหมด'], ['yes', 'มีบันทึก'], ['no', 'ไม่มีบันทึก']].map(([k, l]) => `<option value="${k}" ${state.gi === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <button type="button" class="btn ghost" id="gClear">ล้างตัวกรอง</button></div></section>`;
    return gamesHead() + tools + `<div id="gResults">${gamesBody()}</div>`;
  }
  function gamesHead() {
    const f = state.games; const open = GAMES.filter((g) => g.status !== 'final'), fin = GAMES.filter((g) => g.status === 'final');
    const seg = `<div class="seg m-scroll" role="group" aria-label="กรองเกม" id="gSeg">${[['all', 'ทั้งหมด', GAMES.length], ['upcoming', 'รอผล / กำลังจะแข่ง', open.length], ['live', 'สด', 0], ['final', 'จบแล้ว', fin.length]].map(([k, l, n]) => `<button type="button" data-g="${k}" aria-pressed="${f === k}">${esc(l)}<span class="n">${n}</span></button>`).join('')}</div>`;
    return `<div class="ph"><div><div class="eyebrow">Schedule & results</div><h1>เกม NBA</h1><p>เกมในหน้านี้สร้างจากคู่ที่อยู่ในบิลของฉันเท่านั้น (${GAMES.length} เกม) — ไม่ใช่ตารางแข่งขันเต็มของลีก · สกอร์มาจากผลที่บันทึกในบิล</p></div>${seg}</div>`;
  }
  function gamesBody() {
    const shown = GAMES.filter(gameMatch);
    const open = shown.filter((g) => g.status !== 'final').sort((a, b) => a.date.localeCompare(b.date) || (a.tipoff || '').localeCompare(b.tipoff || ''));
    const fin = shown.filter((g) => g.status === 'final');
    const nStarted = open.filter((g) => phase(g) === 'started').length;
    const f = state.games;
    const filtered = shown.length !== GAMES.length;
    let out = filtered ? `<p class="result-meta" role="status">แสดง ${shown.length} จาก ${GAMES.length} เกมตามตัวกรอง</p>` : '';
    if (!shown.length) return out + empty('ไม่พบเกมตามตัวกรอง', 'ลองล้างคำค้นหรือเปลี่ยนวันที่/ผล', 'search');
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
  function bindGames() {
    const upd = () => { $('#gResults').innerHTML = gamesBody(); };
    $('#gSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (!b) return; state.games = b.dataset.g; $$('#gSeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); upd(); });
    $('#gq').addEventListener('input', (e) => { state.gq = e.target.value; upd(); });
    $('#gd').addEventListener('change', (e) => { state.gd = e.target.value; upd(); });
    $('#gr').addEventListener('change', (e) => { state.gr = e.target.value; upd(); });
    $('#gi').addEventListener('change', (e) => { state.gi = e.target.value; upd(); });
    $('#gClear').addEventListener('click', () => { state.gq = ''; state.gd = ''; state.gr = 'all'; state.gi = 'all'; $('#gq').value = ''; $('#gd').value = ''; $('#gr').value = 'all'; $('#gi').value = 'all'; upd(); });
  }

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
      groups += `<section class="card ev-game" aria-label="${esc(C.abbr(a) + ' vs ' + C.abbr(b))}"><div class="card-h"><h3>${team(a)} <span class="faint">${g.scores[a] ?? ''}</span> <span class="faint">–</span> <span class="faint">${g.scores[b] ?? ''}</span> ${team(b)}</h3><span class="sub">${esc(F.dateTH(g.date))} · ${evs.length} เหตุการณ์ · คู่ของฉัน: ${[...new Set(g.legs.map((l) => l.label))].map(esc).join(', ')}</span></div>
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
  const anTeamOf = (b) => (b.total ? `${/^\s*over/i.test(b.sel) ? 'Over' : 'Under'}${b.opp ? ` (${b.opp.split(/\s+vs\.?\s+/i).map((x) => C.abbr(x)).join('/')})` : ''}` : C.canonicalTeam(b.sel));
  const AN_TEAMS = (() => { const R = window.__RAW; return R ? [...new Set(R.B.map(anTeamOf))].sort((a, b) => a.localeCompare(b)) : []; })();
  const anOn = () => !!(state.an.from || state.an.to || state.an.team !== 'all' || state.an.res !== 'all');
  function anData() {
    if (!anOn()) return { A, K, mOct, mNov, empty: false };
    const f = window.__filteredAgg(state.an, anTeamOf); const AA = C.analyticsFrom(f.agg), k = f.k, L = AA.legsTotal;
    const KK = { roi: k.stake ? k.net / k.stake : null, net: k.net, stakeSettled: k.stake, ticketWinRate: k.won + k.lost ? k.won / (k.won + k.lost) : null, won: k.won, lost: k.lost,
      legWinRate: L.won + L.lost ? L.won / (L.won + L.lost) : null, legs: L, settled: k.settled };
    const mo = AA.monthly; return { A: AA, K: KK, mNov: mo[mo.length - 1], mOct: mo[mo.length - 2] || mo[mo.length - 1], empty: !AA.daily.length || !L.n };
  }
  function anTools() {
    const dates = C.tickets.map((t) => t.date).sort();
    return `<section class="card" style="margin-bottom:var(--sp-4)" aria-label="ตัวกรองการวิเคราะห์"><div class="toolbar wrap" style="border:0">
      <div class="field"><label for="anFrom">ตั้งแต่วันที่</label><input id="anFrom" class="input" type="date" min="${dates[0] || ''}" max="${dates[dates.length - 1] || ''}" value="${esc(state.an.from)}"></div>
      <div class="field"><label for="anTo">ถึงวันที่</label><input id="anTo" class="input" type="date" min="${dates[0] || ''}" max="${dates[dates.length - 1] || ''}" value="${esc(state.an.to)}"></div>
      <div class="field"><label for="anTeam">ทีม / ตลาด</label><select id="anTeam" class="select"><option value="all">ทุกทีม</option>${AN_TEAMS.map((t) => `<option value="${esc(t)}" ${state.an.team === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label for="anRes">ผลคู่</label><select id="anRes" class="select">${[['all', 'ทั้งหมด'], ['won', 'ชนะ'], ['lost', 'แพ้'], ['push', 'เสมอ'], ['pending', 'รอผล']].map(([k, l]) => `<option value="${k}" ${state.an.res === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <button type="button" class="btn ghost" id="anClear">ล้างตัวกรอง</button>
      <div class="grow"></div><span class="result-meta" role="status">${anOn() ? 'กรองแล้ว · คู่กรองตามวันแข่ง/ทีม/ผล · บิลกรองตามวันที่วางบิล' : 'ข้อมูลทั้งหมด'}</span></div></section>`;
  }
  function viewAnalytics() {
    const D = anData(); const { A, K, mOct, mNov } = D; CH = A;
    if (D.empty) return `<div class="ph"><div><div class="eyebrow">Analytics</div><h1>วิเคราะห์ผลงาน</h1></div></div>${anTools()}${empty('ไม่มีข้อมูลที่ตัดสินแล้วตามตัวกรอง', 'ลองขยายช่วงวันที่ หรือเลือกทีม/ผลอื่น', 'chart')}`;
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
      ${anTools()}${kpiStrip(kp)}
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
  function bindAnalytics() {
    const keep = (fn) => { const y = window.scrollY; fn(); render(); window.scrollTo(0, y); };
    const ts = $('#tmSeg'); if (ts) ts.addEventListener('click', (e) => { const b = e.target.closest('button[data-ts]'); if (!b) return; keep(() => { state.teamSort = b.dataset.ts; }); });
    $('#anFrom').addEventListener('change', (e) => keep(() => { state.an.from = e.target.value; }));
    $('#anTo').addEventListener('change', (e) => keep(() => { state.an.to = e.target.value; }));
    $('#anTeam').addEventListener('change', (e) => keep(() => { state.an.team = e.target.value; }));
    $('#anRes').addEventListener('change', (e) => keep(() => { state.an.res = e.target.value; }));
    $('#anClear').addEventListener('click', () => keep(() => { state.an = { from: '', to: '', team: 'all', res: 'all' }; }));
  }
