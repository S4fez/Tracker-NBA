/* Motion layer for the Courtside Ledger UI (styles in app/motion.css).
   It only adds classes and CSS variables to elements the app already rendered, and runs a
   count-up on KPI numbers that always ends on the exact original text. It never changes data,
   never touches Supabase and does nothing when the OS asks for reduced motion. */
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }
  var MAX_I = 12; // cap the stagger so long lists never wait

  /* elements below the fold wait (invisible) and play when they scroll into view */
  var io = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    var k = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target; io.unobserve(el);
      el.style.setProperty('--mo-i', String(Math.min(k++, MAX_I)));
      el.style.setProperty('--mo-base', '0ms');
      el.classList.remove('mo-wait');
      el.classList.add(el.getAttribute('data-mo') || 'mo-rise');
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;

  function stagger(nodes, cls, base) {
    var n = 0, vh = window.innerHeight || 800;
    Array.prototype.forEach.call(nodes, function (el) {
      if (!el || el.classList.contains(cls) || el.classList.contains('mo-wait')) return;
      if (io && el.getBoundingClientRect().top > vh) {
        el.setAttribute('data-mo', cls); el.classList.add('mo-wait'); io.observe(el); return;
      }
      el.style.setProperty('--mo-i', String(Math.min(n, MAX_I)));
      if (base != null) el.style.setProperty('--mo-base', base + 'ms');
      el.classList.add(cls);
      n++;
    });
  }

  /* KPI count-up: animate the first number of each text node, then restore the exact text */
  var NUM = /\d[\d,]*(?:\.\d+)?/;
  function countUp(el, delay) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], t;
    while ((t = walker.nextNode())) { if (NUM.test(t.nodeValue)) nodes.push(t); }
    nodes.forEach(function (node) {
      var orig = node.nodeValue, m = orig.match(NUM);
      var raw = m[0], target = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(target) || target === 0) return;
      var dec = (raw.split('.')[1] || '').length, comma = raw.indexOf(',') >= 0 || target >= 1000;
      var pre = orig.slice(0, m.index), post = orig.slice(m.index + raw.length);
      function fmt(v) {
        return comma ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
      }
      var dur = 1300, start = null;
      node.nodeValue = pre + fmt(0) + post;
      function step(ts) {
        if (!node.isConnected) return;
        if (start === null) start = ts + delay;
        var k = Math.min(1, Math.max(0, (ts - start) / dur));
        var e = 1 - Math.pow(1 - k, 4); // long-tail ease-out
        node.nodeValue = k >= 1 ? orig : pre + fmt(target * e) + post;
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function animateCharts(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.chart[data-chart] svg'), function (svg) {
      var line = svg.querySelector('path.line');
      if (line) line.setAttribute('pathLength', '1');
      Array.prototype.forEach.call(svg.querySelectorAll('circle.dotp'), function (c, i) { c.style.setProperty('--mo-i', String(i)); });
      Array.prototype.forEach.call(svg.querySelectorAll('rect.bar-pos, rect.bar-neg'), function (r, i) { r.style.setProperty('--mo-i', String(i)); });
      svg.classList.add('mo-chart');
    });
  }

  function animateList(root, base) {
    stagger(root.querySelectorAll('.dt tbody tr'), 'mo-rise', base);
    stagger(root.querySelectorAll('.srow'), 'mo-rise', base);
    stagger(root.querySelectorAll('.card-b > ul > li, .card-b > ol > li, .imp-list > li, .gc-grid > *, .impact-list > *, .hbars > .hbar, .imp-row, .pi'), 'mo-rise', base);
    Array.prototype.forEach.call(root.querySelectorAll('.pips'), function (p, row) {
      stagger(p.querySelectorAll('.pip'), 'mo-pop', (base || 0) + 120 + Math.min(row, MAX_I) * 45);
    });
  }

  function enterView(v) {
    if (reduced()) return;
    v.classList.remove('mo-enter'); void v.offsetWidth; v.classList.add('mo-enter');
    var ph = v.querySelector('.ph h1');
    if (ph) ph.classList.add('mo-blur');
    stagger(v.querySelectorAll('.kpi'), 'mo-rise', 60);
    stagger(v.querySelectorAll('.grid > .card, .grid > section, .grid > article'), 'mo-rise', 140);
    Array.prototype.forEach.call(v.querySelectorAll('.kpi-v'), function (el, i) { countUp(el, 120 + Math.min(i, MAX_I) * 60); });
    Array.prototype.forEach.call(v.querySelectorAll('.bullet > i'), function (b) { b.classList.add('mo-grow'); });
    animateCharts(v);
    animateList(v, 260);
    Array.prototype.forEach.call(v.querySelectorAll('.st-won'), function (b) { b.classList.add('mo-shine'); });
  }

  function start() {
    var v = document.getElementById('view');
    if (!v || !window.MutationObserver) return;
    var queued = false;
    new MutationObserver(function (muts) {
      var full = false, lists = [];
      muts.forEach(function (m) {
        if (m.target === v) full = true;
        else if (m.target.id && /Results$/.test(m.target.id)) lists.push(m.target);
      });
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        if (reduced()) return;
        if (full) enterView(v);
        else lists.forEach(function (el) { if (el.isConnected) animateList(el, 0); });
      });
    }).observe(v, { childList: true, subtree: true });
    var so = document.getElementById('soRoot');
    if (so) new MutationObserver(function () {
      if (reduced() || !so.firstChild) return;
      requestAnimationFrame(function () { animateList(so, 160); stagger(so.querySelectorAll('.so .card'), 'mo-rise', 120); });
    }).observe(so, { childList: true });
    if (v.firstChild) enterView(v);
    wireExtras(v);
  }

  /* ---- round 2 extras ---- */
  var lastClick = 0;
  function wireExtras(v) {
    // chart toggles (LIN/LOG, ranges): animate the redrawn chart if it changed right after a click
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button')) lastClick = Date.now(); }, true);
    new MutationObserver(function (muts) {
      if (reduced() || Date.now() - lastClick > 700) return;
      var seen = [];
      muts.forEach(function (m) {
        var c = m.target.closest ? m.target.closest('.chart[data-chart]') : null;
        if (c && seen.indexOf(c) < 0) seen.push(c);
      });
      seen.forEach(function (c) { requestAnimationFrame(function () { animateCharts(c.parentNode || c); }); });
    }).observe(v, { childList: true, subtree: true });

    // scores ticker: cells slide in when it is (re)built
    var tk = document.getElementById('ticker');
    function tickIn() { if (!reduced()) stagger(tk.querySelectorAll('.tk-cell'), 'mo-rise', 80); }
    if (tk) { new MutationObserver(tickIn).observe(tk, { childList: true }); if (tk.firstChild) tickIn(); }

    // command palette: results stagger each time the list is rebuilt
    var cl = document.querySelector('.cmdk-list');
    if (cl) new MutationObserver(function () {
      if (reduced()) return;
      Array.prototype.forEach.call(cl.querySelectorAll('.cmdk-opt'), function (o, i) {
        if (i < MAX_I) { o.style.setProperty('--mo-i', String(i)); o.style.setProperty('--mo-step', '22ms'); o.classList.add('mo-rise'); }
      });
    }).observe(cl, { childList: true });

    // mobile tab bar: one pill that slides to the active tab
    var tb = document.getElementById('tabbar');
    if (tb) {
      var pill = document.createElement('span'); pill.className = 'mo-tabpill'; pill.setAttribute('aria-hidden', 'true');
      function place() {
        var a = tb.querySelector('a[aria-current="page"]');
        if (!a || !tb.offsetWidth) { pill.style.opacity = '0'; return; }
        if (pill.parentNode !== tb) tb.insertBefore(pill, tb.firstChild);
        tb.classList.add('mo-has-pill');
        pill.style.width = a.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
        pill.style.opacity = '1';
      }
      new MutationObserver(function () { requestAnimationFrame(place); }).observe(tb, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current'] });
      window.addEventListener('resize', function () { requestAnimationFrame(place); });
      requestAnimationFrame(place);
    }

    // refresh button spins until the reload takes over
    var rb = document.getElementById('refreshBtn');
    if (rb) rb.addEventListener('click', function () { if (!reduced()) rb.classList.add('mo-spin'); });

    // Arena cards: spotlight follows the pointer (desktop only, via CSS media query)
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var c = e.target.closest ? e.target.closest('.card') : null;
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
