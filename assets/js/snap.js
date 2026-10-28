/* ============================================================
   玛塔塔 MATATA · 分节导航 + 分节滚动
   ============================================================
   两件事必须分开看：

   1) 圆点（章节导航）
      只要有内容章节就显示，和屏幕高度无关。
      否则在大屏上（视口高、区块相对矮）会一个点都不出。

   2) 吸附（"一屏一块"的手感）
      只有区块高度接近一屏时才有意义。
      大屏上区块本来就矮于屏幕，强行吸附反而怪，所以自动不启用。

   规则：
   · 圆点：首屏 + 含 h1/h2 的章节，高度 ≥ 260px，最多 6 个
   · 吸附：高度在 0.75–1.6 屏之间的块
   · 触屏 / 窄屏（<1025px）/ 减少动效 → 圆点隐藏、吸附关闭
   ============================================================ */
(function () {
  'use strict';

  var MIN_WIDTH = 1025;
  var SNAP_MIN = 0.75;    // 吸附：下限（屏）
  var SNAP_MAX = 1.6;     // 吸附：上限
  var DOT_MIN_PX = 260;   // 圆点：区块最小高度（像素）
  var DOT_MAX = 6;        // 圆点：最多几个

  function init() {
    var main = document.querySelector('main');
    if (!main || !document.body.classList.contains('has-snap')) return;

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) return;

    var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > section'));
    if (sections.length < 2) return;

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

    var dots = [];
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

    /* 章节筛选：首屏 + 有标题的块；超过上限时去掉最矮的 */
    function pickSections() {
      var vh = window.innerHeight;
      var list = [];
      sections.forEach(function (sec, i) {
        var h = sec.getBoundingClientRect().height;
        var hasHead = !!sec.querySelector('h1, h2, .h2');
        if ((i === 0 || hasHead) && h >= DOT_MIN_PX) {
          list.push({ sec: sec, i: i, h: h, r: h / vh });
        }
      });
      if (list.length > DOT_MAX) {
        var keepFirst = list[0];
        var rest = list.slice(1).sort(function (a, b) { return b.h - a.h; }).slice(0, DOT_MAX - 1);
        rest.sort(function (a, b) { return a.i - b.i; });
        list = [keepFirst].concat(rest);
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

    /* 吸附只看"接近一屏"的块，与圆点是否显示无关 */
    function markSnap() {
      var wide = window.innerWidth >= MIN_WIDTH;
      var vh = window.innerHeight;
      var any = false;
      sections.forEach(function (sec) {
        var r = sec.getBoundingClientRect().height / vh;
        var on = wide && r >= SNAP_MIN && r <= SNAP_MAX;
        sec.classList.toggle('snap-sec', on);
        if (on) any = true;
      });
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

    function rebuild() {
      var picked = pickSections();
      markSnap();

      if (!picked.length) {
        nav.classList.remove('is-ready');
        return;
      }
      buildDots(picked);
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
