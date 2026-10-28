/* ============================================================
   玛塔塔 MATATA · 分节滚动（首页与二级页通用）
   ============================================================
   实测各页区块高度差异极大（有的块 3.9 屏高，有的 0.3 屏），
   所以不能"每块一个点、每块都吸"。

   规则：
   · 吸附：只给高度在 0.85–1.6 屏之间的块（差不多一屏的）
   · 圆点：高度 ≥ 0.8 屏的块才有资格，最多 6 个（多了取最高的几个）
   · 页面若没有合格的块 → 整个功能不启用
   · 触屏 / 窄屏 / 减少动效 → 不启用
   ============================================================ */
(function () {
  'use strict';

  var MIN_WIDTH = 1025;   // 与 CSS 断点一致
  var SNAP_MIN = 0.85;    // 吸附：下限（屏）
  var SNAP_MAX = 1.6;     // 吸附：上限
  var DOT_MIN = 0.8;      // 圆点：下限
  var DOT_MAX = 6;        // 圆点：最多几个

  function init() {
    var main = document.querySelector('main');
    if (!main || !document.body.classList.contains('has-snap')) return;

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) return;

    var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > section'));
    if (sections.length < 2) return;

    /* 让位高度：固定导航 + 吸顶的分节锚点条 */
    function topOffset() {
      var navEl = document.querySelector('.nav');
      var off = navEl ? navEl.offsetHeight : 76;
      var anchors = document.querySelector('.anchors');
      if (anchors) {
        var st = window.getComputedStyle(anchors);
        if (st.position === 'sticky' || st.position === 'fixed') off += anchors.offsetHeight;
      }
      return off + 8;
    }

    var nav = document.createElement('nav');
    nav.className = 'snapnav';
    nav.setAttribute('aria-label', '页面分节导航');
    document.body.appendChild(nav);

    var dots = [];      // {el, sec}
    var current = -1;

    function labelOf(sec, i) {
      var custom = sec.getAttribute('data-snap-label');
      if (custom) return custom;
      var h = sec.querySelector('h1, h2, .h2');
      if (h) {
        var t = (h.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) return t.length > 12 ? t.slice(0, 12) + '…' : t;
      }
      return '第 ' + (i + 1) + ' 节';
    }

    /* 选出"够一屏"的块；超过上限时保留最高的几个 */
    function pickSections() {
      var vh = window.innerHeight;
      var list = [];
      sections.forEach(function (sec, i) {
        var r = sec.getBoundingClientRect().height / vh;
        if (r >= DOT_MIN) list.push({ sec: sec, i: i, r: r });
      });
      if (list.length > DOT_MAX) {
        list = list.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, DOT_MAX)
          .sort(function (a, b) { return a.i - b.i; });
      }
      return list;
    }

    function buildDots(picked) {
      nav.innerHTML = '';
      dots = [];
      picked.forEach(function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'snapnav__dot';
        b.setAttribute('aria-label', '跳到：' + labelOf(item.sec, item.i));
        b.innerHTML = '<span class="snapnav__label">' + labelOf(item.sec, item.i) + '</span>';
        b.addEventListener('click', function () {
          var top = item.sec.getBoundingClientRect().top + window.pageYOffset - topOffset();
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        });
        nav.appendChild(b);
        dots.push({ el: b, sec: item.sec });
      });
    }

    function markSnap(picked) {
      var wide = window.innerWidth >= MIN_WIDTH;
      var any = false;
      sections.forEach(function (sec) { sec.classList.remove('snap-sec'); });
      if (wide) {
        picked.forEach(function (item) {
          if (item.r >= SNAP_MIN && item.r <= SNAP_MAX) {
            item.sec.classList.add('snap-sec');
            any = true;
          }
        });
      }
      document.documentElement.classList.toggle('snap-on', any);
      document.documentElement.style.scrollPaddingTop = topOffset() + 'px';
    }

    function update() {
      if (!dots.length) return;
      var mid = window.scrollY + window.innerHeight * 0.45;
      var idx = 0;
      dots.forEach(function (d, i) {
        if (d.sec.offsetTop <= mid) idx = i;
      });
      if (idx !== current) {
        if (dots[current]) dots[current].el.classList.remove('is-on');
        dots[idx].el.classList.add('is-on');
        current = idx;
      }
      var sec = dots[idx].sec;
      var dark = sec.classList.contains('invert') ||
        sec.classList.contains('section--deep') ||
        sec.getAttribute('data-snap-dark') === 'true';
      nav.classList.toggle('is-dark', !!dark);
    }

    var picked = [];
    function rebuild() {
      picked = pickSections();
      if (!picked.length) {
        nav.classList.remove('is-ready');
        document.documentElement.classList.remove('snap-on');
        return;
      }
      buildDots(picked);
      markSnap(picked);
      current = -1;
      nav.classList.toggle('is-ready', window.innerWidth >= MIN_WIDTH);
      update();
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { update(); ticking = false; });
    }, { passive: true });

    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(rebuild, 200);
    });

    rebuild();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
