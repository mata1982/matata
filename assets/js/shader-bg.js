/* ============================================================
   玛塔塔 MATATA · WebGL 着色器背景 v6
   ============================================================
   设计主张：精密仪器 / Sealed Instrument
   —— 不是"AI 紫雾"，而是一张缓慢流动的等高线场（加工面 / 地形图）。
   理由：品牌承诺是"把 AI 装进你自己的机器、数据不出门"。
   等高线传达的是"被测量、被约束、被密封的场"，比蒸汽状噪声更贴切，
   也更有工程质感；同时锐利的细线在深底上对比度高，不糊。

   实现要点：
   1. 域扭曲 fBm 求出标量场，再对场取模抽等值线（两层不同密度）。
   2. 线体本身用窄 smoothstep 求锐利边缘，外面套一层宽 smoothstep 作光晕，
      形成"发光线"而不是"发光雾"。
   3. 中心加一层椭圆光晕，把标题区域托起来。
   4. 边缘暗角 + 上下渐隐，让首屏与下一区块自然衔接。

   工程约束（与原版一致，全部保留）：
   · 渐进增强：WebGL 不可用 / 编译失败 / prefers-reduced-motion → 不初始化，
     回落到 CSS 渐变底，内容不受影响。
   · 分辨率上限 1.5x，移动端 1x；页面隐藏时暂停。
   · canvas 纯装饰：aria-hidden，pointer-events:none。
   ============================================================ */
(function () {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uPointer;',
    'uniform float uIntensity;',
    '',
    'float hash(vec2 p){',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',
    '',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    '',
    'float fbm(vec2 p){',
    '  float v = 0.0;',
    '  float amp = 0.5;',
    '  for (int i = 0; i < 5; i++) {',
    '    v += amp * noise(p);',
    '    p = p * 2.02 + vec2(17.3, 9.1);',
    '    amp *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
    '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes.xy) / min(uRes.x, uRes.y);',
    '',
    '  float t = uTime * 0.018;',
    '  vec2 drift = uPointer * 0.045;',
    '',
    '  // ---- 1. 标量场：两级域扭曲，但幅度收敛，让线更像地形图而不是液体 ----',
    '  vec2 q = vec2(fbm(p * 1.25 + t * 0.7 + drift),',
    '                fbm(p * 1.25 + vec2(5.2, 1.3) - t * 0.55));',
    '  float f = fbm(p * 1.05 + 1.05 * q + drift * 0.35);',
    '',
    '  // ---- 2. 分区遮罩：只在部分区域显等高线，其余留黑 ----',
    '  // 这是"精致"与"嘈杂"的分界：满屏等值线会糊成一团，局部才有仪器感',
    '  float region = smoothstep(0.34, 0.76, fbm(p * 0.52 + vec2(11.0, 3.0)));',
    '  // 中心再让出一块，避免线条从标题背后穿过',
    '  float clearCore = smoothstep(0.16, 0.62, length(p * vec2(1.05, 0.82)));',
    '  float vis = region * mix(0.22, 1.0, clearCore);',
    '',
    '  // ---- 3. 主等值线：线体很细，靠低透明度发亮 ----',
    '  float a1 = abs(fract(f * 9.0 + t * 0.5) - 0.5);',
    '  float line1 = 1.0 - smoothstep(0.0, 0.024, a1);',
    '  float glow1 = 1.0 - smoothstep(0.0, 0.110, a1);',
    '',
    '  // ---- 4. 次等值线：更密更淡，制造纵深 ----',
    '  float f2 = fbm(p * 2.1 + 1.6 * q);',
    '  float a2 = abs(fract(f2 * 17.0 - t * 0.34) - 0.5);',
    '  float line2 = 1.0 - smoothstep(0.0, 0.038, a2);',
    '',
    '  vec3 base = vec3(0.984, 0.984, 0.992);   // #FBFBFD 亮底',
    '  vec3 cBlue = vec3(0.700, 0.820, 0.975);',
    '  vec3 cLav  = vec3(0.840, 0.820, 0.970);',
    '  vec3 cPink = vec3(0.985, 0.890, 0.900);',
    '',
    '  // ---- 5. 亮底极光：Apple 式柔和色晕，不是深色线 ----',
    '  vec3 col = base;',
    '  col = mix(col, cBlue, smoothstep(0.30, 0.95, f) * 0.62);',
    '  col = mix(col, cLav,  smoothstep(0.52, 1.05, f) * 0.38);',
    '  col = mix(col, cPink, smoothstep(0.70, 1.15, f) * 0.26);',
    '',
    '  // ---- 6. 极淡等值线：只作质感，不抢主体 ----',
    '  col = mix(col, vec3(0.55, 0.68, 0.92), line1 * 0.10 * vis);',
    '  col = mix(col, vec3(0.62, 0.74, 0.94), glow1 * 0.05 * vis);',
    '',
    '  // ---- 7. 四周向白收拢，标题区保持极干净 ----',
    '  float vig = smoothstep(1.30, 0.05, length(p * vec2(0.72, 0.96)));',
    '  col = mix(vec3(0.992, 0.992, 0.996), col, 0.30 + 0.70 * vig);',
    '  col = mix(col, vec3(1.0), (1.0 - uv.y) * 0.10);',
    '',
    '  // ---- 8. 极轻颗粒，消除色带 ----',
    '  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.006;',
    '',
    '  gl_FragColor = vec4(col * uIntensity, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console && console.warn) console.warn('shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function init() {
    var canvas = document.querySelector('[data-shader]');
    if (!canvas) return;

    // 偏好减少动态效果：不启动着色器，保留 CSS 底色
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) { /* 忽略 */ }

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' })
        || canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return;   // 不支持 WebGL：回落 CSS

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uPointer = gl.getUniformLocation(prog, 'uPointer');
    var uIntensity = gl.getUniformLocation(prog, 'uIntensity');

    var isMobile = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    var maxDpr = isMobile ? 1 : 1.5;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var start = performance.now();
    var running = true;
    var rafId = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    function frame(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(frame);
      resize();
      // 指针缓动：让流动方向跟随鼠标，但不生硬
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uIntensity, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add('is-live');
    }

    window.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = -((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });

    window.addEventListener('resize', resize, { passive: true });

    // 页面不可见时暂停，省电
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!running) {
        running = true;
        rafId = window.requestAnimationFrame(frame);
      }
    });

    rafId = window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
