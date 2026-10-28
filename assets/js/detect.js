/* ============================================================
   玛塔塔 MATATA · 一键环境检测
   ============================================================
   能自动读到的：
     · CPU 线程数（navigator.hardwareConcurrency）
     · 内存下限（navigator.deviceMemory，Chrome 最高只报 8）
     · 显卡型号（WebGL / WebGPU 的 renderer 字符串）
     · 系统平台、屏幕、语言
     · 到本站的网络延迟
     · 浏览器内运算基准（JS 矩阵乘法，衡量 CPU 侧）

   读不到的（浏览器隐私限制）：
     · 显存 VRAM —— 没有任何 API 可读
     · 真实内存上限
     · 磁盘剩余空间
   所以页面会让用户确认这两项，并明确说明「结论是建议档位，不是保证」。

   评分（满分 100）：
     显卡档位 45 / 内存 25 / CPU 线程 15 / 运算基准 15
   ============================================================ */
(function () {
  'use strict';

  var SCENARIOS = [
    { id: 'kb', name: '内部知识库问答', desc: '资料检索、制度问答、新人答疑', need: 42,
      why: '主要吃显存和内存，7B–14B 量化模型即可跑起来。' },
    { id: 'extract', name: '单据与文档提取', desc: '发票、合同、送货单结构化', need: 50,
      why: '识别 + 抽取两步，显存需求略高，建议 8GB 以上。' },
    { id: 'write', name: '内容生成与写作', desc: '文案、邮件、报告初稿', need: 38,
      why: '对延迟不敏感，入门级机器就能先跑试点。' },
    { id: 'code', name: '编码与复杂推理', desc: '代码补全、长文档推理', need: 70,
      why: '上下文长、推理链长，需要 16GB 以上显存才顺畅。' },
    { id: 'unsure', name: '还不确定，先试试', desc: '我只想知道这台机器够不够', need: 35,
      why: '先测出底子，具体做什么可以后面再定。' }
  ];

  var VRAM_OPTS = [
    { v: '0', t: '不知道（按型号推断）' },
    { v: '4', t: '8GB 以下' },
    { v: '8', t: '8–12GB' },
    { v: '12', t: '12–16GB' },
    { v: '16', t: '16–24GB' },
    { v: '24', t: '24GB 以上' }
  ];

  var RAM_OPTS = [
    { v: '0', t: '不知道（按检测值推断）' },
    { v: '8', t: '16GB 及以下' },
    { v: '16', t: '32GB' },
    { v: '32', t: '64GB' },
    { v: '64', t: '128GB 及以上' }
  ];

  var state = { scene: null, info: {}, vram: '0', ram: '0' };

  /* ---------------- 硬件信息采集 ---------------- */
  function getGPU() {
    var out = { renderer: '', vendor: '', source: '' };
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        out.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        out.vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        out.source = 'WebGL';
        out.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        // 无头浏览器 / 显卡被禁用时会回退到软件渲染，那不是真实显卡
        out.soft = /swiftshader|llvmpipe|software|basic\s*render|mesa\s*offscreen/i.test(out.renderer || '');
      }
    } catch (e) { /* 忽略 */ }
    return out;
  }

  function getGPUAsync(cb) {
    if (!navigator.gpu || !navigator.gpu.requestAdapter) { cb(null); return; }
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; cb(null); } }, 1200);
    navigator.gpu.requestAdapter().then(function (adapter) {
      if (!adapter || done) return;
      var p = adapter.info ? Promise.resolve(adapter.info)
        : (adapter.requestAdapterInfo ? adapter.requestAdapterInfo() : Promise.resolve({}));
      return p.then(function (info) {
        if (done) return;
        done = true; clearTimeout(timer);
        cb({
          vendor: info.vendor || '',
          architecture: info.architecture || '',
          device: info.device || '',
          description: info.description || ''
        });
      });
    }).catch(function () {
      if (!done) { done = true; clearTimeout(timer); cb(null); }
    });
  }

  /* 从型号字符串推断显卡档位 0–5 与估计显存 */
  function gpuTier(str) {
    var s = (str || '').toLowerCase();
    if (!s) return { tier: 0, vram: 0, label: '未知' };

    var high = /(rtx\s*(4090|4080|5090|5080)|a6000|a100|h100|l40|rx\s*7900|m3\s*ultra|m4\s*ultra|m2\s*ultra|m1\s*ultra)/;
    var good = /(rtx\s*(4070|3080|3090|5070)|a5000|rx\s*(68|69|78|90)[0-9]{2}|m3\s*max|m4\s*max|m2\s*max)/;
    var mid = /(rtx\s*(4060|3060|3070|5060)|rx\s*(6[67][0-9]{2}|76[0-9]{2})|arc\s*a[57][0-9]{2}|m3\s*pro|m4\s*pro|m2\s*pro|m1\s*max)/;
    var low = /(gtx|rtx\s*(3050|2060)|rx\s*5[0-9]{3}|arc\s*a3[0-9]{2}|m1\s*pro|m2|m3|m4|radeon\s*graphics)/;
    var igp = /(intel|iris|uhd|hd\s*graphics|mali|adreno|apple\s*m)/;

    if (high.test(s)) return { tier: 5, vram: 24, label: '专业级显卡' };
    if (good.test(s)) return { tier: 4, vram: 16, label: '高性能显卡' };
    if (mid.test(s)) return { tier: 3, vram: 12, label: '主流独显' };
    if (low.test(s)) return { tier: 2, vram: 8, label: '入门独显 / 集显' };
    if (igp.test(s)) return { tier: 1, vram: 4, label: '集成显卡' };
    return { tier: 0, vram: 0, label: '未知' };
  }

  /* 浏览器内运算基准：矩阵乘法，衡量 CPU 单线程能力 */
  function bench() {
    try {
      var n = 120;
      var A = new Float64Array(n * n), Bm = new Float64Array(n * n), C = new Float64Array(n * n);
      for (var i = 0; i < n * n; i++) { A[i] = (i % 7) + 1; Bm[i] = (i % 5) + 1; }
      var t0 = (window.performance || Date).now();
      for (var r = 0; r < 2; r++) {
        for (var a = 0; a < n; a++) {
          for (var b = 0; b < n; b++) {
            var s = 0;
            for (var k = 0; k < n; k++) s += A[a * n + k] * Bm[k * n + b];
            C[a * n + b] = s;
          }
        }
      }
      var ms = (window.performance || Date).now() - t0;
      if (ms <= 0) ms = 1;
      var ops = (2 * n * n * n * 2) / ms / 1000; // 百万次乘加/秒
      return { ms: Math.round(ms), ops: Math.round(ops * 10) / 10 };
    } catch (e) { return null; }
  }

  /* 网络：到本站取一个极小资源，测 3 次取中位数 */
  function netTest(cb) {
    var times = [];
    var done = 0;
    function one() {
      var t0 = (window.performance || Date).now();
      fetch('assets/img/favicon.svg?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function () { times.push((window.performance || Date).now() - t0); })
        .catch(function () { times.push(null); })
        .then(function () {
          done++;
          if (done < 3) one();
          else {
            var ok = times.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
            cb(ok.length ? Math.round(ok[Math.floor(ok.length / 2)]) : null);
          }
        });
    }
    one();
  }

  /* ---------------- 评分 ---------------- */
  function score(info) {
    var g = gpuTier(info.renderer);
    var tier = g.tier;

    // 用户确认的显存优先
    var vram = Number(state.vram) || 0;
    if (vram > 0) {
      tier = vram >= 24 ? 5 : vram >= 16 ? 4 : vram >= 12 ? 3 : vram >= 8 ? 2 : 1;
    }

    var gpuScore = Math.min(45, tier * 9);

    var ramRaw = Number(state.ram) || 0;
    if (!ramRaw && info.memHint) ramRaw = info.memHint >= 8 ? 16 : info.memHint;
    var ramScore = ramRaw >= 64 ? 25 : ramRaw >= 32 ? 20 : ramRaw >= 16 ? 14 : ramRaw >= 8 ? 7 : 4;

    var cores = info.cores || 2;
    var cpuScore = cores >= 16 ? 15 : cores >= 12 ? 13 : cores >= 8 ? 10 : cores >= 6 ? 8 : cores >= 4 ? 6 : 4;

    var bo = info.bench ? info.bench.ops : 0;
    var benchScore = bo >= 900 ? 15 : bo >= 500 ? 12 : bo >= 260 ? 9 : bo >= 120 ? 6 : 3;

    var total = Math.round(gpuScore + ramScore + cpuScore + benchScore);
    if (total > 100) total = 100;

    var name, tone;
    if (total >= 78) { name = '专业级'; tone = 'multi'; }
    else if (total >= 60) { name = '标准级'; tone = 'std'; }
    else if (total >= 42) { name = '入门级'; tone = 'pilot'; }
    else { name = '偏弱'; tone = 'weak'; }

    // 显卡既没读到、用户也没选 → 结论只能按最低档估算，必须标明
    var unknownGpu = (tier === 0 && !vram);

    return {
      total: total, name: name, tone: tone, gpuTier: tier, gpu: g, unknownGpu: unknownGpu,
      parts: [
        { k: '显卡', v: gpuScore, max: 45 },
        { k: '内存', v: ramScore, max: 25 },
        { k: 'CPU', v: cpuScore, max: 15 },
        { k: '运算基准', v: benchScore, max: 15 }
      ],
      vramUsed: vram || g.vram,
      ramUsed: ramRaw
    };
  }

  var TIER_INFO = {
    multi: {
      headline: '这台机器够做多部门部署',
      lead: '硬件达到专业级，可以承载 14B–32B 量化模型，支持多个部门同时使用。建议先做一个部门跑通，再横向扩展。',
      model: '14B–32B（量化）',
      machine: '现有工作站即可；如新购：RTX 4090 24G 或双卡，内存 64GB 以上',
      plan: '企业多部门部署 ¥138,000 起'
    },
    std: {
      headline: '这台机器适合做标准部署',
      lead: '硬件达到标准级，跑 7B–14B 量化模型没有问题，适合一个部门或一条业务线先用起来。',
      model: '7B–14B（量化）',
      machine: 'RTX 4060 Ti 16G / 4070 12G，内存 32–64GB',
      plan: '企业标准部署 ¥68,000 起（或一体机 ¥69,800）'
    },
    pilot: {
      headline: '这台机器适合先做试点',
      lead: '硬件属于入门级，跑小参数模型可以，适合先验证场景值不值得做。等看到效果，再决定要不要换机器。',
      model: '3B–8B（量化）',
      machine: 'RTX 3060 12G / 4060 8G，内存 16–32GB',
      plan: '单机试点 ¥9,800 起（可全额抵扣正式部署）'
    },
    weak: {
      headline: '这台机器的算力偏弱',
      lead: '直接在上面部署大模型体验会很差。两条路：用一台一体机（我们提供），或者先用云端 API 验证场景，跑通了再上本地。',
      model: '不建议本地推理',
      machine: '软硬一体交付 ¥39,800 起',
      plan: '先做免费诊断，确认再投入'
    }
  };

  /* ---------------- 渲染 ---------------- */
  var root, sceneBox, scanBox, vramSel, ramSel, resultBox;

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function renderScenes() {
    sceneBox.innerHTML = SCENARIOS.map(function (s) {
      return '<button class="dt-opt" type="button" data-scene="' + s.id + '">' +
        '<b>' + s.name + '</b><span>' + s.desc + '</span></button>';
    }).join('');
    sceneBox.querySelectorAll('[data-scene]').forEach(function (b) {
      b.addEventListener('click', function () {
        sceneBox.querySelectorAll('.dt-opt').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        state.scene = b.getAttribute('data-scene');
        startScan();
      });
    });
  }

  function scanRow(k, v, cls) {
    return '<div class="dt-scan__row"><span class="dt-scan__k">' + k + '</span>' +
      '<span class="dt-scan__v ' + (cls || '') + '">' + v + '</span></div>';
  }

  function startScan() {
    // 展开第 2、3 步
    var s2 = document.querySelector('.dt-step[data-step="2"]');
    var s3 = document.querySelector('.dt-step[data-step="3"]');
    if (s2) s2.hidden = false;
    if (s3) s3.hidden = false;
    if (s2) s2.scrollIntoView({ block: 'start', behavior: 'smooth' });

    var info = state.info;
    info.platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '未知';
    info.cores = navigator.hardwareConcurrency || 0;
    info.memHint = navigator.deviceMemory || 0;
    info.lang = navigator.language || '';

    var gpu = getGPU();
    info.renderer = gpu.renderer || '';
    info.gpuVendor = gpu.vendor || '';
    info.maxTex = gpu.maxTex || 0;

    scanBox.innerHTML =
      scanRow('系统', info.platform) +
      scanRow('CPU 线程', info.cores ? info.cores + ' 线程' : '读取失败', info.cores ? 'is-ok' : 'is-warn') +
      scanRow('内存（浏览器可见）', info.memHint ? '≥ ' + info.memHint + ' GB' + (info.memHint >= 8 ? '（浏览器上限）' : '') : '浏览器未提供', info.memHint ? 'is-ok' : 'is-warn') +
      scanRow('显卡型号', '正在读取…', 'is-pending') +
      scanRow('运算基准', '正在测试…', 'is-pending') +
      scanRow('网络延迟', '正在测试…', 'is-pending');

    var rows = scanBox.querySelectorAll('.dt-scan__row');
    var gpuV = rows[3].querySelector('.dt-scan__v');
    var benchV = rows[4].querySelector('.dt-scan__v');
    var netV = rows[5].querySelector('.dt-scan__v');

    getGPUAsync(function (g) {
      if (g && (g.device || g.description || g.vendor)) {
        info.renderer = [g.vendor, g.architecture, g.device, g.description].filter(Boolean).join(' / ') || info.renderer;
        info.source = 'WebGPU';
      }
      var t = gpuTier(info.renderer);
      info.gpuSoft = !!gpu.soft;
      if (gpu.soft) {
        gpuV.textContent = '未暴露（软件渲染）';
        gpuV.className = 'dt-scan__v is-warn';
      } else if (info.renderer) {
        gpuV.textContent = info.renderer.length > 46 ? info.renderer.slice(0, 46) + '…' : info.renderer;
        gpuV.className = 'dt-scan__v is-ok';
      } else {
        gpuV.textContent = '浏览器屏蔽了显卡信息';
        gpuV.className = 'dt-scan__v is-warn';
      }
      info.gpuTier = t.tier;

      // 基准
      var b = bench();
      info.bench = b;
      if (b) {
        benchV.textContent = b.ops + ' 百万次/秒';
        benchV.className = 'dt-scan__v is-ok';
      } else {
        benchV.textContent = '测试失败';
        benchV.className = 'dt-scan__v is-warn';
      }

      netTest(function (rtt) {
        info.rtt = rtt;
        if (rtt != null) {
          netV.textContent = rtt + ' ms';
          netV.className = 'dt-scan__v ' + (rtt < 300 ? 'is-ok' : 'is-warn');
        } else {
          netV.textContent = '测不到（不影响本地部署）';
          netV.className = 'dt-scan__v is-warn';
        }
      });

      // 预填显存选择
      if (t.vram) {
        var opt = Array.prototype.slice.call(vramSel.options).filter(function (o) {
          return Number(o.value) && Number(o.value) <= t.vram;
        });
        if (opt.length) vramSel.value = opt[opt.length - 1].value;
      }
      if (info.memHint) {
        ramSel.value = info.memHint >= 8 ? '16' : '8';
      }
    });
  }

  function runResult() {
    state.vram = vramSel.value;
    state.ram = ramSel.value;

    var s = score(state.info);
    var sc = SCENARIOS.filter(function (x) { return x.id === state.scene; })[0] || SCENARIOS[4];
    var ti = TIER_INFO[s.tone];

    // 显卡未知时不能下「偏弱」的结论，改成提示用户手动选
    if (s.unknownGpu) {
      ti = {
        headline: '还没读到您的显卡',
        lead: '浏览器出于隐私限制隐藏了显卡型号（也可能是显卡被禁用、走了软件渲染）。这很常见，不代表您的机器不行。请在上方「确认两个信息」里选一下显存，然后再生成一次报告。',
        model: '待确认',
        machine: '待确认（按您的显存选择判断）',
        plan: '或直接免费诊断，现场确认'
      };
    }

    var enough = s.total >= sc.need;

    var bars = s.parts.map(function (p) {
      return '<div class="dt-bar">' +
        '<span class="dt-bar__k">' + p.k + '</span>' +
        '<span class="dt-bar__track"><i data-w="' + Math.round((p.v / p.max) * 100) + '"></i></span>' +
        '<span class="dt-bar__v">' + p.v + '/' + p.max + '</span>' +
        '</div>';
    }).join('');

    var verdict = enough
      ? '<b>能跑「' + sc.name + '」</b>　' + sc.why
      : '<b>跑「' + sc.name + '」偏吃力</b>　' + sc.why + '　建议先做试点或换一体机。';

    resultBox.hidden = false;
    resultBox.innerHTML =
      '<div class="dt-result">' +
        '<div class="dt-result__head">' +
          '<div class="dt-score">' +
            '<span class="dt-score__n" data-count="' + s.total + '">0</span>' +
            '<span class="dt-score__unit">/ 100 分</span>' +
            '<span class="dt-score__tier">' + s.name + '</span>' +
          '</div>' +
          '<h2 class="dt-result__h">' + ti.headline + '</h2>' +
          '<p class="dt-result__lead">' + ti.lead + '</p>' +
        '</div>' +

        '<div class="dt-result__body">' +
          '<div class="dt-bars">' + bars + '</div>' +

          '<div class="dt-config">' +
            '<h3>建议配置</h3>' +
            '<div class="dt-config__grid">' +
              '<div class="dt-config__cell"><small>可承载模型</small><b>' + ti.model + '</b></div>' +
              '<div class="dt-config__cell"><small>机器参考</small><b>' + ti.machine + '</b></div>' +
              '<div class="dt-config__cell"><small>对应方案</small><b>' + ti.plan + '</b></div>' +
            '</div>' +
          '</div>' +

          '<div class="dt-note">' +
            '<h3>针对您选的场景</h3>' +
            '<ul>' +
              '<li>' + verdict + '</li>' +
              '<li>显存按 ' + (Number(state.vram) > 0 ? s.vramUsed + ' GB（您选择）' : '型号推断，可能不准') + '、内存按 ' + (Number(state.ram) > 0 ? state.ram + ' GB（您选择）' : '16 GB 推算，浏览器只能上报到 8GB') + ' 估算。</li>' +
              '<li>本地部署<b>不依赖外网</b>，断网也能用；网络只影响资料更新和远程维护。</li>' +
              '<li>分数是<b>建议档位</b>，不是保证。真实效果取决于您的资料质量、场景复杂度，以及模型选择。</li>' +
              (s.unknownGpu ? '<li style="color:#8A6A1F;">显卡未能识别，当前分数按最低档估算，<b>仅供参考</b>。选择显存后可重新生成。</li>' : '') +
            '</ul>' +
            '<details class="dt-raw"><summary>查看检测到的原始信息</summary><pre id="dtRaw"></pre></details>' +
          '</div>' +

          '<div class="dt-actions">' +
            '<a class="btn btn--primary" href="contact.html?plan=' + encodeURIComponent('环境检测·' + s.name) + '">带着报告预约免费诊断</a>' +
            '<button class="btn btn--ghost" type="button" id="dtCopy">复制报告</button>' +
            '<button class="btn btn--ghost" type="button" id="dtAgain">重新检测</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 分数滚动
    var numEl = resultBox.querySelector('[data-count]');
    var target = s.total, cur = 0;
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) { numEl.textContent = target; }
    else {
      (function tick() {
        cur += Math.max(1, Math.round(target / 24));
        if (cur >= target) cur = target;
        numEl.textContent = cur;
        if (cur < target) setTimeout(tick, 22);
      })();
    }

    // 进度条
    setTimeout(function () {
      resultBox.querySelectorAll('.dt-bar__track i').forEach(function (i) {
        i.style.width = i.getAttribute('data-w') + '%';
      });
    }, 120);

    // 原始信息
    resultBox.querySelector('#dtRaw').textContent = JSON.stringify({
      场景: sc.name,
      系统: state.info.platform,
      CPU线程: state.info.cores,
      '内存(浏览器可见)': state.info.memHint,
      显卡: state.info.renderer || '(未获取)',
      显卡来源: state.info.source || 'WebGL',
      运算基准: state.info.bench ? state.info.bench.ops + ' 百万次/秒' : null,
      网络延迟: state.info.rtt != null ? state.info.rtt + ' ms' : null,
      用户确认显存: state.vram,
      用户确认内存: state.ram,
      评分: s.total,
      档位: s.name,
      分项: s.parts
    }, null, 2);

    // 复制报告
    resultBox.querySelector('#dtCopy').addEventListener('click', function () {
      var btn = this;
      var text = '【玛塔塔 · 环境检测报告】\n' +
        '评分：' + s.total + '/100（' + s.name + '）\n' +
        '场景：' + sc.name + '\n' +
        '建议模型：' + ti.model + '\n' +
        '机器参考：' + ti.machine + '\n' +
        '对应方案：' + ti.plan + '\n' +
        '检测到的显卡：' + (state.info.renderer || '未获取') + '\n' +
        'CPU 线程：' + (state.info.cores || '未知') + '\n\n' +
        '注：结论为建议档位，最终以免费诊断确认为准。';
      var ok = false;
      try { navigator.clipboard.writeText(text); ok = true; } catch (e) {}
      if (!ok) {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok = true; } catch (e2) {}
        document.body.removeChild(ta);
      }
      btn.textContent = ok ? '已复制 ✓' : '复制失败';
      setTimeout(function () { btn.textContent = '复制报告'; }, 2000);
    });

    resultBox.querySelector('#dtAgain').addEventListener('click', function () {
      state = { scene: null, info: {}, vram: '0', ram: '0' };
      resultBox.hidden = true; resultBox.innerHTML = '';
      sceneBox.querySelectorAll('.dt-opt').forEach(function (x) { x.classList.remove('is-on'); });
      scanBox.innerHTML = '';
      vramSel.value = '0'; ramSel.value = '0';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    resultBox.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function init() {
    root = document.getElementById('detect');
    if (!root) return;
    sceneBox = document.getElementById('dtScene');
    scanBox = document.getElementById('dtScan');
    vramSel = document.getElementById('dtVram');
    ramSel = document.getElementById('dtRam');
    resultBox = document.getElementById('dtResult');

    vramSel.innerHTML = VRAM_OPTS.map(function (o) {
      return '<option value="' + o.v + '">' + o.t + '</option>';
    }).join('');
    ramSel.innerHTML = RAM_OPTS.map(function (o) {
      return '<option value="' + o.v + '">' + o.t + '</option>';
    }).join('');

    renderScenes();

    document.getElementById('dtRun').addEventListener('click', runResult);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
