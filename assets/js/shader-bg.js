/* ============================================================
   玛塔塔 MATATA · WebGL 着色器背景 v7
   ============================================================
   当前版本：**有机流体**——三级域扭曲 + 旋转八度噪声 + 宽光带。

   沿革：v6 是"等高线场"（仪器感，线条偏硬）。参照 threeui 的
   kage 落地页后，改成本版的 fbm 有机流动：更像墨/光在缓动，
   同时保持极浅，不抢标题。旧版已移除，如需回退见 git 历史。

   噪声改进了三点：
   1. 用 quintic 插值（f³(f(6f−15)+10)），比 smoothstep 更顺
   2. 每个八度旋转坐标系，消除横平竖直的轴向纹理
   3. 三级域扭曲（q → r → f），出现卷曲的丝带形态

   工程约束全部沿用：
   · WebGL 不可用 / 编译失败 / prefers-reduced-motion → 不初始化，回落 CSS
   · DPR 上限 1.5（移动端 1）；页面隐藏时暂停
   · canvas 纯装饰：aria-hidden、pointer-events:none
   ============================================================ */
(function () {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var HEAD = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uPointer;',
    'uniform float uIntensity;',
    ''
  ].join('\n');

  /* ---------------- 新版：有机流体 ---------------- */
  var FRAG_FLOW = HEAD + [
    '// 哈希：不用 sin，避免大坐标下的条纹伪影',
    'float hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  // quintic 插值：比 smoothstep 更平滑，过渡更"流体"',
    '  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    '',
    '// 八度旋转：去掉水平/垂直方向的规则纹理',
    'float fbm(vec2 p){',
    '  float v = 0.0;',
    '  float amp = 0.5;',
    '  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);',
    '  for (int i = 0; i < 5; i++) {',
    '    v += amp * noise(p);',
    '    p = rot * p * 2.03 + 11.7;',
    '    amp *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
    '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes.xy) / min(uRes.x, uRes.y);',
    '',
    '  float t = uTime * 0.016;',
    '  vec2 drift = uPointer * 0.05;',
    '',
    '  // 纵向拉伸：让形态偏向横向的"光带"而不是圆斑',
    '  vec2 pp = p * vec2(1.0, 1.28);',
    '',
    '  // ---- 三级域扭曲：这一层是"卷曲"的来源 ----',
    '  vec2 q = vec2(fbm(pp * 1.05 + t * 0.34 + drift),',
    '                fbm(pp * 1.05 + vec2(4.7, 2.3) - t * 0.27));',
    '  vec2 r = vec2(fbm(pp * 1.45 + 2.1 * q + t * 0.21),',
    '                fbm(pp * 1.45 + 2.1 * q + vec2(9.2, 3.1) - t * 0.17));',
    '  float f = fbm(pp * 0.88 + 2.5 * r);',
    '',
    '  // ---- 宽光带：正弦叠加后做很宽的 smoothstep，形成柔和流动 ----',
    '  float band = sin((f * 5.2 + q.x * 1.6 - t * 0.6) * 3.14159);',
    '  band = smoothstep(-0.25, 1.0, band);',
    '',
    '  // 第二层更细的光带，增加纵深（透明度很低，只做质感）',
    '  float band2 = sin((f * 11.0 - r.y * 2.2 - t * 0.42) * 3.14159);',
    '  band2 = smoothstep(0.55, 1.0, band2);',
    '',
    '  // ---- 留白：中心区域（标题背后）必须干净 ----',
    '  float clearCore = smoothstep(0.12, 0.66, length(p * vec2(1.02, 0.86)));',
    '  float vis = mix(0.18, 1.0, clearCore) * smoothstep(0.10, 0.62, f);',
    '',
    '  vec3 base = vec3(0.985, 0.986, 0.994);   // #FBFCFE',
    '  vec3 cBlue = vec3(0.640, 0.790, 0.980);',
    '  vec3 cLav  = vec3(0.800, 0.780, 0.985);',
    '  vec3 cCyan = vec3(0.700, 0.900, 0.960);',
    '  vec3 cPink = vec3(0.990, 0.870, 0.910);',
    '',
    '  // ---- 上色：都是极浅的混合，保证文字对比度 ----',
    '  vec3 col = base;',
  '  // 大尺度方向色：让画面有"从左上来光"的方向感',
  '  float dir = clamp(uv.x * 0.55 + (1.0 - uv.y) * 0.45, 0.0, 1.0);',
  '  col = mix(col, vec3(0.945, 0.938, 0.995), smoothstep(0.55, 1.0, 1.0 - dir) * 0.55);',
  '  col = mix(col, vec3(0.915, 0.945, 0.995), smoothstep(0.50, 1.0, dir) * 0.50);',
    '  col = mix(col, cBlue, smoothstep(0.18, 0.86, f) * 0.78);',
    '  col = mix(col, cLav,  smoothstep(0.38, 0.98, f) * 0.52);',
    '  col = mix(col, cCyan, band * 0.30 * vis);',
    '  col = mix(col, cPink, smoothstep(0.58, 1.06, f) * 0.32);',
    '',
    '  // ---- 光带提亮：用白色而不是彩色，避免发灰 ----',
    '  col = mix(col, vec3(1.0), band * 0.16 * vis);',
    '  col = mix(col, vec3(1.0), band2 * 0.08 * vis);',
    '',
    '  // ---- 收边：四周向白靠，与下一屏衔接 ----',
    '  float vig = smoothstep(1.34, 0.06, length(p * vec2(0.74, 0.98)));',
    '  col = mix(vec3(0.996, 0.996, 0.999), col, 0.18 + 0.82 * vig);',
    '  col = mix(col, vec3(1.0), (1.0 - uv.y) * 0.08);',
    '',
    '  // ---- 颗粒：消除渐变色带 ----',
    '  col += (hash21(gl_FragCoord.xy + uTime) - 0.5) * 0.006;',
    '',
    '  gl_FragColor = vec4(col * uIntensity, 1.0);',
    '}'
  ].join('\n');

  var FRAG = FRAG_FLOW;

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

    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) { /* 忽略 */ }

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' })
        || canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return;

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
    // 渲染缓冲缩放：这是**背景**，本身是柔和渐变，缩小缓冲再放大看不出差别，
    // 但填充率直接降一半以上——低端机和软件渲染下差别很大。
    var renderScale = isMobile ? 0.55 : 0.72;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var start = performance.now();
    var running = true;
    var rafId = 0;

    function resize() {
      var w = Math.max(1, Math.floor(canvas.clientWidth * renderScale));
      var h = Math.max(1, Math.floor(canvas.clientHeight * renderScale));
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
