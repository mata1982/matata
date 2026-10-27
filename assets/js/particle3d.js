/* ============================================================
   玛塔塔 MATATA · 三维粒子几何层
   ============================================================
   作用：在 WebGL 着色器之上叠一层缓慢旋转的三维点位几何
   （球面分布的点 + 近邻连线），给首屏增加"技术纵深"。

   为什么用 2D canvas 手写投影而不是 three.js：
   只画点和线，性能开销极小、零依赖、移动端也能跑；
   引入 three.js 只为这点内容不值得。

   约束：
   - prefers-reduced-motion → 不初始化，静态画面由着色器/渐变承担
   - 不支持 canvas → 静默跳过
   - 页面隐藏时暂停
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var canvas = document.querySelector('[data-particle3d]');
    if (!canvas) return;

    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) { /* 忽略 */ }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---- 生成球面均匀分布的点 ----
    var COUNT = 140;
    var pts = [];
    for (var i = 0; i < COUNT; i++) {
      // 斐波那契球面：分布均匀，不会两极堆积
      var y = 1 - (i / (COUNT - 1)) * 2;
      var radius = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = i * Math.PI * (3 - Math.sqrt(5));
      pts.push({
        x: Math.cos(theta) * radius,
        y: y,
        z: Math.sin(theta) * radius
      });
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = 0, h = 0, cx = 0, cy = 0, scale = 1;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var running = true, rafId = 0;
    var start = performance.now();

    function resize() {
      var box = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(box.width * dpr));
      h = Math.max(1, Math.floor(box.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      cx = w * 0.5;
      cy = h * 0.52;
      scale = Math.min(w, h) * 0.34;
    }

    function draw(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(draw);
      resize();

      var t = (now - start) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      ctx.clearRect(0, 0, w, h);

      // 旋转矩阵：绕 Y 轴自转 + 指针带来的轻微俯仰
      var ry = t * 0.11 + pointer.x * 0.5;
      var rx = Math.sin(t * 0.07) * 0.24 + pointer.y * 0.3;
      var cosY = Math.cos(ry), sinY = Math.sin(ry);
      var cosX = Math.cos(rx), sinX = Math.sin(rx);

      var proj = [];
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        // 绕 Y
        var x1 = p.x * cosY - p.z * sinY;
        var z1 = p.x * sinY + p.z * cosY;
        // 绕 X
        var y1 = p.y * cosX - z1 * sinX;
        var z2 = p.y * sinX + z1 * cosX;

        var depth = 1 / (1.9 - z2 * 0.55);          // 近大远小
        proj.push({
          sx: cx + x1 * scale * depth * 1.5,
          sy: cy + y1 * scale * depth * 1.5,
          z: z2,
          a: 0.30 + 0.55 * ((z2 + 1) / 2)            // 越近越亮
        });
      }

      // 连线：只连距离足够近的点，避免一团糊
      var maxD = scale * 0.42;
      ctx.lineWidth = 1;
      for (var a = 0; a < proj.length; a++) {
        for (var b = a + 1; b < proj.length; b++) {
          var dx = proj[a].sx - proj[b].sx;
          var dy = proj[a].sy - proj[b].sy;
          var d2 = dx * dx + dy * dy;
          if (d2 > maxD * maxD) continue;
          var alpha = (1 - Math.sqrt(d2) / maxD) * 0.16 * ((proj[a].a + proj[b].a) / 2);
          ctx.strokeStyle = 'rgba(120, 150, 255, ' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(proj[a].sx, proj[a].sy);
          ctx.lineTo(proj[b].sx, proj[b].sy);
          ctx.stroke();
        }
      }

      // 点
      for (var k = 0; k < proj.length; k++) {
        var q = proj[k];
        var rad = (0.8 + q.a * 1.7) * dpr;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 205, 255, ' + (q.a * 0.75).toFixed(3) + ')';
        ctx.fill();
      }
    }

    window.addEventListener('pointermove', function (e) {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    window.addEventListener('resize', resize, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!running) {
        running = true;
        rafId = window.requestAnimationFrame(draw);
      }
    });

    rafId = window.requestAnimationFrame(draw);
    canvas.classList.add('is-live');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
