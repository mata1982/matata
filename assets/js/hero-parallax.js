/* ============================================================
   玛塔塔 MATATA · 首屏鼠标视差
   ============================================================
   目的：让首屏"跟手"——鼠标移动时，粒子和光晕跟一点点。

   为什么只做这么小（±10px）：
   视差大了会让人追着眼睛看，反而干扰读标题。这里是"余光里的动"，
   不是"让你注意的动"。

   作用对象只限背景层（.shader / .shader__geo），不动文字。
   文字一动，阅读就散了。

   降级：
   · 触控设备 / 无 hover 能力 → 不绑定
   · prefers-reduced-motion → 不绑定
   · 页面不可见时停止计算
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var fine = false;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
    if (!fine) return;

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) return;

    var curX = 0, curY = 0, aimX = 0, aimY = 0;
    var raf = null;
    var MAX = 10;   // 最大位移（px）

    function render() {
      raf = null;
      // 缓动跟随，避免鼠标抖动直接传给画面
      curX += (aimX - curX) * 0.12;
      curY += (aimY - curY) * 0.12;

      hero.style.setProperty('--px', curX.toFixed(2) + 'px');
      hero.style.setProperty('--py', curY.toFixed(2) + 'px');

      if (Math.abs(aimX - curX) > 0.1 || Math.abs(aimY - curY) > 0.1) {
        raf = window.requestAnimationFrame(render);
      }
    }

    function onMove(e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;    // -0.5 ~ 0.5
      var ny = (e.clientY - r.top) / r.height - 0.5;
      aimX = Math.max(-MAX, Math.min(MAX, nx * 2 * MAX));
      aimY = Math.max(-MAX, Math.min(MAX, ny * 2 * MAX));
      if (!raf) raf = window.requestAnimationFrame(render);
    }

    function onLeave() {
      aimX = 0; aimY = 0;
      if (!raf) raf = window.requestAnimationFrame(render);
    }

    hero.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('mouseleave', onLeave, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
