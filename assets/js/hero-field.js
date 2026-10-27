/* ============================================================
   玛塔塔 MATATA · 首屏「封闭场」视觉层 v2
   ============================================================
   概念：数据在自己的边界里流动，撞到边界会被弹回来 ——
   这正是"数据不出门"的图形化表达，而不是随便飘一层粒子。

   实现：Canvas 2D + 极坐标
   · 粒子在圆内按角度/半径缓慢移动
   · 到达边界时反射（不会穿出去）
   · 近邻粒子之间连线，密度低、透明度低
   · 边界画一圈极淡的环 + 缓慢旋转的刻度弧（仪表感）
   · 与新 LOGO 的"层层堆叠"呼应：边界内另有一道内圈

   性能与可访问性：
   · 只用 transform 与 canvas 绘制，不触发重排
   · 页面隐藏时暂停
   · prefers-reduced-motion 下画一帧静态图后停止
   · DPR 上限 1.5，移动端 1
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var canvas = document.querySelector('[data-particle3d]');
    if (!canvas) return;

    var reduce = false;
    try {
      reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { /* 忽略 */ }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0, DPR = 1;
    var cx = 0, cy = 0, R = 0;

    var COUNT = 64;
    var parts = [];
    var ripples = [];      // 撞击点：数据撞到边界被弹回
    var t = 0;
    var raf = 0;
    var running = true;
    var last = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 720 ? 1 : 1.5);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      cx = W * 0.5;
      // 略微上移，让圆环居中在标题区域
      cy = H * 0.36;
      R = Math.min(W, H) * 0.245;
      if (R < 120) R = Math.max(104, Math.min(W, H) * 0.36);
    }

    function seed() {
      parts = [];
      for (var i = 0; i < COUNT; i++) {
        parts.push({
          a: Math.random() * Math.PI * 2,          // 角度
          r: 0.12 + Math.random() * 0.82,          // 半径比例
          va: (Math.random() - 0.5) * 0.055,       // 角速度
          vr: (Math.random() - 0.5) * 0.012,       // 径向速度
          s: 1.1 + Math.random() * 1.5             // 点大小
        });
      }
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);

      // ---- 1. 边界环：主环 + 内环 + 刻度 ----
      ctx.strokeStyle = 'rgba(0, 113, 227, 0.115)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.94, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 113, 227, 0.075)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 0.74, R * 0.74 * 0.94, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 1.1 外环刻度：48 根短线，像仪表盘
      ctx.strokeStyle = 'rgba(0, 113, 227, 0.16)';
      ctx.lineWidth = 1;
      for (var tick = 0; tick < 48; tick++) {
        var ta = (tick / 48) * Math.PI * 2;
        var long = (tick % 4 === 0) ? 7 : 3.5;
        var rx = R, ry = R * 0.94;
        var x1 = cx + Math.cos(ta) * rx, y1 = cy + Math.sin(ta) * ry;
        var x2 = cx + Math.cos(ta) * (rx + long), y2 = cy + Math.sin(ta) * (ry + long);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 1.2 撞击涟漪：粒子撞到边界处亮一小段，随后淡出
      for (var ri = ripples.length - 1; ri >= 0; ri--) {
        var rp = ripples[ri];
        rp.life -= dt * 0.9;
        if (rp.life <= 0) { ripples.splice(ri, 1); continue; }
        var span = 0.16 * rp.life;
        ctx.strokeStyle = 'rgba(0, 113, 227, ' + (rp.life * 0.55).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R, R * 0.94, 0, rp.a - span, rp.a + span);
        ctx.stroke();
      }

      // ---- 2. 缓慢旋转的刻度弧（仪表感） ----
      var sweep = (t * 0.06) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 113, 227, 0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.94, 0, sweep, sweep + 0.55);
      ctx.stroke();

      // ---- 3. 粒子推进 ----
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.a += p.va * dt;
        p.r += p.vr * dt;

        // 边界反射：到边缘就弹回，永远出不去
        if (p.r > 0.94) {
          p.r = 0.94;
          p.vr = -Math.abs(p.vr) * 0.9;
          if (ripples.length < 14) ripples.push({ a: p.a, life: 1 });
        }
        if (p.r < 0.08) { p.r = 0.08; p.vr = Math.abs(p.vr) * 0.9; }
      }

      // ---- 4. 近邻连线 ----
      var pts = [];
      for (var k = 0; k < parts.length; k++) {
        var q = parts[k];
        pts.push({
          x: cx + Math.cos(q.a) * q.r * R,
          y: cy + Math.sin(q.a) * q.r * R * 0.94,
          d: q.r
        });
      }
      var MAX = 86;
      ctx.lineWidth = 0.8;
      for (var m = 0; m < pts.length; m++) {
        for (var n = m + 1; n < pts.length; n++) {
          var dx = pts[m].x - pts[n].x;
          var dy = pts[m].y - pts[n].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX) {
            var al = (1 - dist / MAX) * 0.15;
            ctx.strokeStyle = 'rgba(0, 113, 227, ' + al.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(pts[m].x, pts[m].y);
            ctx.lineTo(pts[n].x, pts[n].y);
            ctx.stroke();
          }
        }
      }

      // ---- 5. 粒子点：越靠外越淡 ----
      for (var j = 0; j < pts.length; j++) {
        var pt = pts[j];
        var alpha = 0.22 + (1 - pt.d) * 0.34;
        ctx.fillStyle = 'rgba(0, 113, 227, ' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, parts[j].s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop(now) {
      if (!running) return;
      raf = window.requestAnimationFrame(loop);
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);   // 限幅，切后台回来不跳
      last = now;
      t += dt;
      draw(dt);
    }

    function start() {
      resize();
      seed();
      if (reduce) { draw(0); return; }   // 减少动态效果：只画一帧
      running = true;
      last = 0;
      raf = window.requestAnimationFrame(loop);
    }

    // 尺寸变化重建
    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        resize();
        if (!reduce) { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop); }
        else { draw(0); }
      }, 180);
    }, { passive: true });

    // 页面不可见时暂停
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        last = 0;
        raf = window.requestAnimationFrame(loop);
      }
    });

    start();
    canvas.classList.add('is-live');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
