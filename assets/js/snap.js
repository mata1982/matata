/* ============================================================
   玛塔塔 MATATA · 分节滚动（首页专用）
   ============================================================
   只做两件事：
   1. 给"接近一屏"的区块打标，让 CSS 轻微吸附（不强制）
   2. 右侧渲染分节点导航，点击跳转、滚动高亮

   刻意不做：
   · 不劫持滚轮（不 preventDefault，不改 scrollTop）
   · 不强制一屏一块（内容长短不一，强制会卡住）
   · 触屏 / 窄屏 / 减少动效 → 完全不启用
   ============================================================ */
(function () {
  'use strict';

  var RATIO = 0.68;     // 高度不到视口的 68% 就不吸附
  var MIN_WIDTH = 1025; // 与 CSS 断点一致

  function init() {
    var main = document.querySelector('main');
    if (!main || !document.body.classList.contains('has-snap')) return;

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) return;

    var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > section'));
    if (sections.length < 2) return;

    /* 让位高度：固定导航 + 吸顶的分节锚点条（有的页面有 .anchors） */
    function topOffset() {
      var nav = document.querySelector('.nav');
      var off = nav ? nav.offsetHeight : 76;
      var anchors = document.querySelector('.anchors');
      if (anchors) {
        var st = window.getComputedStyle(anchors);
        if (st.position === 'sticky' || st.position === 'fixed') off += anchors.offsetHeight;
      }
      return off + 8;
    }
    function applyOffset() {
      document.documentElement.style.scrollPaddingTop = topOffset() + 'px';
    }

    var nav = document.createElement('nav');
    nav.className = 'snapnav';
    nav.setAttribute('aria-label', '页面分节导航');

    // 分节名称：优先 data-snap-label，其次 h1/h2 文本
    function labelOf(sec, i) {
      var custom = sec.getAttribute('data-snap-label');
      if (custom) return custom;
      var h = sec.querySelector('h1, h2, .h2');
      if (h) {
        var t = (h.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) return t.length > 16 ? t.slice(0, 16) + '…' : t;
      }
      return '第 ' + (i + 1) + ' 节';
    }

    var dots = [];
    sections.forEach(function (sec, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'snapnav__dot';
      b.setAttribute('aria-label', '跳到：' + labelOf(sec, i));
      b.innerHTML = '<span class="snapnav__label">' + labelOf(sec, i) + '</span>';
      b.addEventListener('click', function () {
        var top = sec.getBoundingClientRect().top + window.pageYOffset - topOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
      nav.appendChild(b);
      dots.push(b);
    });

    document.body.appendChild(nav);

    /* ---- 高度够的区块才吸附 ---- */
    function markSections() {
      var vh = window.innerHeight;
      var wide = window.innerWidth >= MIN_WIDTH;
      var any = false;
      sections.forEach(function (sec) {
        var tall = sec.getBoundingClientRect().height >= vh * RATIO;
        var on = wide && tall;
        sec.classList.toggle('snap-sec', on);
        if (on) any = true;
      });
      document.documentElement.classList.toggle('snap-on', any);
      applyOffset();
      nav.classList.toggle('is-ready', any);
    }

    /* ---- 高亮当前区块 + 深色区块反色 ---- */
    var current = 0;
    function update() {
      var mid = window.scrollY + window.innerHeight * 0.45;
      var idx = 0;
      sections.forEach(function (sec, i) {
        if (sec.offsetTop <= mid) idx = i;
      });
      if (idx !== current) {
        dots[current] && dots[current].classList.remove('is-on');
        dots[idx].classList.add('is-on');
        current = idx;
      }
      var sec = sections[idx];
      var dark = sec && (sec.classList.contains('invert') ||
        sec.classList.contains('section--deep') ||
        sec.getAttribute('data-snap-dark') === 'true');
      nav.classList.toggle('is-dark', !!dark);
    }

    dots[0] && dots[0].classList.add('is-on');

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { update(); ticking = false; });
    }, { passive: true });

    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { markSections(); update(); }, 180);
    });

    markSections();
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
