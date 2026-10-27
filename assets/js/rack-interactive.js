/* ============================================================
   玛塔塔 MATATA · 四层设备图：可点 + 滚动点亮
   ============================================================
   用途：服务流程页页头那台"四层机器"，让它不只是静态示意图。
   · 滚到视口时，四层依次点亮（从下往上，像开机自检）
   · 悬停预览 / 点击锁定某一层，下方说明跟着换
   · 支持键盘：Tab 聚焦、Enter/Space 切换

   为什么值得做：客户看这张图的第一反应是"这是什么"，
   可点之后他不用猜，点一下就得到一句人话解释。
   ============================================================ */
(function () {
  'use strict';

  var COPY = {
    kb:      '制度、工艺、产品、话术都收进一个库，问一句就能翻到出处。',
    model:   '按场景选参数规模——能跑得动，也跑得快。',
    compute: '用您现成的显卡或工作站，不用另外租服务器。',
    logs:    '谁在什么时候问了什么，可查、可导出。'
  };
  var DEFAULT = '四层装在同一台机器里，拔掉网线也能答。';

  function init() {
    var svg = document.querySelector('.rack');
    if (!svg) return;
    var rows = Array.prototype.slice.call(svg.querySelectorAll('.rack__row'));
    var cap = document.querySelector('[data-rack-cap]');
    if (!rows.length) return;

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    var pinned = null;   // 点击锁定的层

    function setCaption(id) {
      if (!cap) return;
      cap.textContent = id && COPY[id] ? COPY[id] : DEFAULT;
      cap.classList.toggle('is-topic', !!(id && COPY[id]));
    }

    function setActive(id) {
      rows.forEach(function (r) {
        r.classList.toggle('is-active', r.getAttribute('data-rack') === id);
      });
      setCaption(id);
    }

    /* ---- 1. 滚到视口时依次点亮（从下往上） ---- */
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          // 从底部那层开始，像开机自检
          var order = rows.slice().reverse();
          order.forEach(function (r, i) {
            window.setTimeout(function () { r.classList.add('is-lit'); }, 120 + i * 140);
          });
          io.disconnect();
        });
      }, { threshold: 0.35 });
      io.observe(svg);
    } else {
      rows.forEach(function (r) { r.classList.add('is-lit'); });
    }

    /* ---- 2. 悬停预览 / 点击锁定 ---- */
    rows.forEach(function (r) {
      var id = r.getAttribute('data-rack');

      r.addEventListener('mouseenter', function () {
        if (!pinned) setActive(id);
      });
      r.addEventListener('mouseleave', function () {
        if (!pinned) setActive(null);
      });
      r.addEventListener('focus', function () {
        if (!pinned) setActive(id);
      });
      r.addEventListener('blur', function () {
        if (!pinned) setActive(null);
      });

      function toggle() {
        pinned = (pinned === id) ? null : id;
        setActive(pinned);
      }
      r.addEventListener('click', toggle);
      r.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          toggle();
        } else if (e.key === 'Escape') {
          pinned = null;
          setActive(null);
        }
      });
    });

    /* 点空白处取消锁定 */
    document.addEventListener('click', function (e) {
      if (!svg.contains(e.target)) {
        pinned = null;
        setActive(null);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
