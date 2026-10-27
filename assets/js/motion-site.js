/* ============================================================
   玛塔塔 MATATA · 动效引擎（全站共享）
   ============================================================
   设计原则：
   1. 不改 HTML：用选择器自动识别需要动效的区块，避免逐页标注。
   2. 默认可见：只在 html.mo-on 下隐藏元素，该类由本脚本添加。
      无 JS、脚本报错、或用户开启"减少动态效果"时，内容完整显示。
   3. 4 秒兜底：任何观察器不回调的情况，超时强制显示，绝不留白。
   4. 只动 transform / opacity / filter，且页面隐藏时暂停计数类动画。

   与旧脚本的关系：本文件取代 motion-v4.js 的入场逻辑（更稳、覆盖更全），
   motion-v4.js 保留但不再被引用。
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  // ---------- 是否启用动效 ----------
  var reduce = false;
  try {
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { /* 忽略 */ }
  var motionOn = !reduce;
  var canObserve = typeof window.IntersectionObserver === 'function';

  // 减少动态效果：直接不启用。内容本来就是可见的（隐藏只在 html.mo-on 下发生）
  if (motionOn) root.classList.add('mo-on');
  else return;

  // ---------- 需要动效的区块（自动识别，无需 HTML 标注） ----------
  // [选择器, 延迟步长(ms), 上限(ms)]
  //   说明：单元素用 data-mo="fade/zoom/left"；容器用 data-mo-group 让子项错峰
  var GROUPS = [
    // 通用卡片与列表
    '.pairs', '.quad', '.paths', '.tiers', '.steps', '.trades', '.cases',
    '.compare', '.pledges', '.qa', '.bento', '.flow', '.tier-cards',
    '.prods', '.principles', '.terms', '.ladder-steps',
    '.what3', '.start3', '.why3', '.more4', '.promise',
    // 内页常见容器
    '.grid', '.svc__body', '.boundary-list', '.faq'
  ];

  var SINGLES = [
    '.head', '.section-head', '.viz', '.stairs', '.pipe', '.riso',
    '.table-wrap', '.cta-panel', '.form', '.quote', '.notice', '.cta', '.infolist'
  ];

  var singles = [];   // 单元素入场
  var stagger = [];   // 容器子项错峰

  function push(list, nodes) {
    for (var i = 0; i < nodes.length; i++) {
      if (list.indexOf(nodes[i]) === -1) list.push(nodes[i]);
    }
  }

  // ---------- 1. 自动加标注 ----------
  function mark() {
    var i, j, g, kids;

    // 1.1 单元素
    for (i = 0; i < SINGLES.length; i++) {
      var nodes = document.querySelectorAll(SINGLES[i]);
      for (j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        // 图表类用 zoom，其余用默认上浮
        if (!el.hasAttribute('data-mo')) {
          el.setAttribute('data-mo', el.classList.contains('viz') || el.classList.contains('stairs') ? 'zoom' : '');
        }
        push(singles, [el]);
      }
    }

    // 1.2 容器子项错峰
    for (i = 0; i < GROUPS.length; i++) {
      g = document.querySelectorAll(GROUPS[i]);
      for (j = 0; j < g.length; j++) {
        var box = g[j];
        box.setAttribute('data-mo-group', '');
        kids = box.children;
        var n = 0;
        for (var k = 0; k < kids.length; k++) {
          var child = kids[k];
          // 子项自身也可能是单元素区块，避免重复处理
          if (child.hasAttribute('data-mo')) continue;
          child.style.setProperty('--mo-d', Math.min(n * 80, 480) + 'ms');
          n++;
          push(stagger, [child]);
        }
        push(singles, [box]);
      }
    }

    // 1.3 显式标注的也纳入
    push(singles, document.querySelectorAll('[data-mo]'));
  }

  // ---------- 2. 观察与点亮 ----------
  function observe() {
    var all = singles.concat(stagger);

    if (!canObserve) {
      for (var n = 0; n < all.length; n++) all[n].classList.add('mo-in');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('mo-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -50px 0px' });

    for (var i = 0; i < all.length; i++) io.observe(all[i]);

    // 兜底：4 秒后无论如何全部点亮
    window.setTimeout(function () {
      for (var j = 0; j < all.length; j++) all[j].classList.add('mo-in');
    }, 4000);
  }

  // ---------- 3. 顶部滚动进度 ----------
  function progress() {
    var bar = document.createElement('div');
    bar.className = 'mo-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      // 导航滚动状态
      var nav = document.querySelector('.nav');
      if (nav) {
        if (window.scrollY > 10) nav.classList.add('mo-scrolled');
        else nav.classList.remove('mo-scrolled');
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // ---------- 4. 数字计数：data-count="120" data-suffix="+" ----------
  function counters() {
    var nodes = document.querySelectorAll('[data-count]');
    if (!nodes.length || !canObserve) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var suffix = el.getAttribute('data-suffix') || '';
        var start = null;
        var dur = 1400;
        function step(ts) {
          if (start === null) start = ts;
          var t = Math.min(1, (ts - start) / dur);
          // ease-out-quart，与全站缓动一致
          var eased = 1 - Math.pow(1 - t, 4);
          var v = Math.round(target * eased);
          // 千分位：价格类数字更专业
          el.textContent = v.toLocaleString('zh-CN') + suffix;
          if (t < 1) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });

    for (var i = 0; i < nodes.length; i++) io.observe(nodes[i]);
  }

  // ---------- 4.1 首屏视差 ----------
  // 只位移背景层，文字不动；幅度很小（≤34px），避免眩晕。
  function parallax() {
    var heroEl = document.querySelector('.hero');
    var layer = document.querySelector('.shader');
    if (!heroEl || !layer) return;

    var ticking = false;
    function update() {
      ticking = false;
      var r = heroEl.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      // p: 0（首屏在顶部）→ 1（首屏完全滚出）
      var p = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
      // 基础放大 1.06，位移时不露边缘
      layer.style.transform =
        'translate3d(0,' + (p * 34).toFixed(1) + 'px,0) scale(' + (1.06 - p * 0.02).toFixed(4) + ')';
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // ---------- 5. 首屏错峰（首页专用，存在才执行） ----------
  function hero() {
    var inner = document.querySelector('.hero__inner');
    if (!inner) return;
    // 首屏用 animation（在 home.css 里），这里只确保内容不被隐藏
    inner.classList.add('is-in');
  }

  function boot() {
    mark();
    observe();
    progress();
    counters();
    parallax();
    hero();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
