/* ============================================================
   玛塔塔 MATATA · 场景演示引擎
   ============================================================
   作用：解决方案页 8 个通用场景，每张卡右上角自动注入「▶ 演示」，
   点击后在当前页面弹出模态框，自动播放该场景的核心操作流程。

   结构说明：
   · 演示不是录屏，是"模拟界面"——体积小、可随文案调整
   · 8 个场景归为 4 种演示形态，共用一套渲染器：
       ask     问答（提问 → 检索 → 答案 + 出处）
       extract 提取（单据 → 扫描 → 字段回填 → 核对）
       draft   起草（要点 → 成稿 → 可调项）
       table   汇总（多份资料 → 表格 → 合计）
   · 播放 = 一串"节拍"（beat），每拍只是给元素加一个 class，
     由 CSS transition 完成动画；JS 不逐帧绘制，性能可控。

   可访问性：
   · 用原生 <dialog>，自带 Esc / 焦点回收 / ::backdrop
   · prefers-reduced-motion 下直接呈现最终状态
   · 关闭或重播时清理所有定时器，避免残留
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 场景数据 ---------------- */
  var SCENES = [
    {
      title: '本地知识库问答',
      type: 'ask',
      q: '我们的设备保修期是多久？',
      find: '正在检索本地知识库… 命中 3 份文件',
      a: '标准保修期为 <b>12 个月</b>，自验收之日起算。延保需在到期前 30 天书面申请。',
      cite: '《售后服务管理办法》第 4.2 条'
    },
    {
      title: '单据与文档信息提取',
      type: 'extract',
      doc: '发票 / 送货单照片',
      fields: [
        ['单号', 'SH-2024-0871'],
        ['金额', '¥ 26,400.00'],
        ['日期', '2024 / 03 / 18'],
        ['抬头', '北京某某科技有限公司']
      ],
      ok: '已与合同金额核对一致'
    },
    {
      title: '客户沟通与销售支持',
      type: 'draft',
      brief: '客户问：设备能不能先试用两周？需要强调数据安全和后续服务。',
      paper: '可以的。我们支持先做两周单机试点：设备放在您自己机房，数据不出内网，试点结束再决定要不要铺开。试点费用可全额抵扣正式部署。',
      tags: ['语气：专业但不生硬', '提及数据不出内网', '提及试点费抵扣']
    },
    {
      title: '报价与方案初稿',
      type: 'config',
      groups: [
        { label: '选服务', multi: false, items: [
          { n: '免费现状诊断', p: 0 },
          { n: '单机试点包', p: 9800 },
          { n: '企业标准部署', p: 68000, on: true },
          { n: '企业多部门部署', p: 138000 }
        ]},
        { label: '选算力', multi: false, items: [
          { n: '用现有设备', p: 0, on: true },
          { n: '一体机 · 入门', p: 39800 },
          { n: '一体机 · 专业', p: 69800 }
        ]},
        { label: '加项（可多选）', multi: true, items: [
          { n: '上门安装调试', p: 4800 },
          { n: '额外培训 1 天', p: 6000 },
          { n: '系统对接', p: 15000 }
        ]}
      ],
      note: '含税：服务 6%、硬件 13%'
    },
    {
      title: '会议与文档整理',
      type: 'draft',
      brief: '把 40 分钟的会议录音整理成纪要和待办。',
      paper: '决议：先做知识库问答试点\n待办 1｜张工：整理制度文档（周五前）\n待办 2｜李经理：确认试点人员名单（下周二）\n风险：车间网络不稳定，需提前踩点',
      tags: ['决议 / 待办 / 风险分块', '每条附负责人与时间']
    },
    {
      title: '内部培训与新人上手',
      type: 'ask',
      q: '新员工入职第一周要做哪些事？',
      find: '正在检索培训手册与岗位说明… 命中 5 份文件',
      a: '第一天：领设备、开通账号；前三天：跟岗学习本岗位标准流程；<b>第一周结束前</b>完成制度考试与师傅评估。',
      cite: '《新员工上手手册》第 1 章'
    },
    {
      title: '数据与报表整理',
      type: 'table',
      head: ['月份', '单据数', '异常数'],
      rows: [
        ['2024-01', '1,284', '7'],
        ['2024-02', '1,096', '4'],
        ['2024-03', '1,432', '11'],
        ['2024-04', '1,508', '6']
      ],
      sumLabel: '四个月合计',
      sumValue: '28 条异常'
    },
    {
      title: '产品与业务系统的 AI 能力嵌入',
      type: 'table',
      head: ['接口', '调用内容', '返回'],
      rows: [
        ['/ask', '客户提问 + 会话 ID', '答案 + 出处'],
        ['/extract', '单据图片', '结构化字段'],
        ['/status', '设备号', '本地模型状态'],
        ['/log', '时间范围', '操作日志明细']
      ],
      sumLabel: '全部在客户内网运行',
      sumValue: '不经过我们的服务器'
    },
    {
      title: '效果评测与验收',
      type: 'eval',
      set: '评测集：100 条真实问题（试用期从客户现场收集）',
      correct: 85,
      partial: 9,
      fails: [
        ['保修期是多久？', '答成 24 个月', '应为 12 个月'],
        ['延保怎么申请？', '漏掉「书面」要求', '需书面申请'],
        ['发票丢了怎么办？', '未命中', '手册 6.3 条有规定']
      ],
      verdict: '正确率 85% ≥ 达标线 85% —— 可进入验收'
    },
    {
      title: '系统对接与权限',
      type: 'api',
      flow: ['ERP 发起调用', '网关校验权限', '本地模型生成', '回写并记日志'],
      req: '{\n  "user": "张三 / 销售部",\n  "q": "这批货什么时候到仓？"\n}',
      res: '{\n  "answer": "预计 3 月 21 日到仓",\n  "cite": "订单系统 #A-2031",\n  "ms": 1180\n}',
      log: '10:24:07  张三（销售部）查询订单 A-2031 · 成功 · 1180ms'
    }
  ];


  var reduce = false;
  try {
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { /* 忽略 */ }

  /* ---------------- 工具 ---------------- */
  var timers = [];
  function wait(fn, ms) {
    var t = window.setTimeout(fn, ms);
    timers.push(t);
    return t;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) window.clearTimeout(timers[i]);
    timers = [];
  }
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function typeInto(node, text, speed, done) {
    var i = 0;
    node.textContent = '';
    (function tick() {
      if (i > text.length) { if (done) done(); return; }
      node.textContent = text.slice(0, i);
      i++;
      wait(tick, speed);
    })();
  }

  /* ---------------- 渲染器 ---------------- */
  var RENDER = {
    ask: function (s) {
      var wrap = el(
        '<div class="mk">' +
          '<div class="mk__ask">' +
            '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>' +
            '<span data-q></span><span class="mk__cursor"></span>' +
          '</div>' +
          '<div class="mk__searching" data-search>' +
            '<span data-label>正在检索…</span>' +
            '<span class="mk__bar"></span>' +
          '</div>' +
          '<div class="mk__ans" data-ans>' +
            '<h4>来自本地知识库</h4>' +
            '<p data-a></p>' +
            '<span class="mk__cite" data-cite>' +
              '<svg viewBox="0 0 24 24"><path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/></svg>' +
              '<span data-cite-t></span>' +
            '</span>' +
          '</div>' +
        '</div>'
      );
      var q = wrap.querySelector('[data-q]');
      var search = wrap.querySelector('[data-search]');
      var label = wrap.querySelector('[data-label]');
      var ans = wrap.querySelector('[data-ans]');
      var a = wrap.querySelector('[data-a]');
      var cite = wrap.querySelector('[data-cite]');
      var citeT = wrap.querySelector('[data-cite-t]');

      if (reduce) {
        q.textContent = s.q; label.textContent = s.find;
        search.classList.add('is-on', 'is-run');
        a.innerHTML = s.a; citeT.textContent = s.cite;
        ans.classList.add('is-on'); cite.classList.add('is-on');
        return { el: wrap, beats: 1 };
      }

      typeInto(q, s.q, 34);
      wait(function () {
        label.textContent = s.find;
        search.classList.add('is-on');
        wait(function () { search.classList.add('is-run'); }, 90);
      }, 900);
      wait(function () {
        a.innerHTML = s.a;
        ans.classList.add('is-on');
      }, 2100);
      wait(function () {
        citeT.textContent = s.cite;
        cite.classList.add('is-on');
      }, 2700);
      return { el: wrap, beats: 4 };
    },

    extract: function (s) {
      var wrap = el(
        '<div class="mk">' +
          '<div class="mk__pair">' +
            '<div class="mk__doc" data-doc><span class="mk__scan"></span></div>' +
            '<div class="mk__fields" data-fields></div>' +
          '</div>' +
        '</div>'
      );
      var doc = wrap.querySelector('[data-doc]');
      var box = wrap.querySelector('[data-fields]');
      var fields = s.fields.map(function (f) {
        var n = el('<div class="mk__field"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>');
        box.appendChild(n);
        return n;
      });

      if (reduce) {
        fields.forEach(function (n) { n.classList.add('is-on'); });
        var last = el('<div class="mk__field mk__field--ok"><span>核对</span><b>' + s.ok + '</b></div>');
        box.appendChild(last); last.classList.add('is-on');
        return { el: wrap, beats: 1 };
      }

      wait(function () { doc.classList.add('is-scan'); }, 260);
      fields.forEach(function (n, i) {
        wait(function () { n.classList.add('is-on'); }, 900 + i * 300);
      });
      wait(function () {
        var ok = el('<div class="mk__field mk__field--ok"><span>核对</span><b>' + s.ok + '</b></div>');
        box.appendChild(ok);
        wait(function () { ok.classList.add('is-on'); }, 20);
      }, 900 + fields.length * 300 + 200);
      return { el: wrap, beats: fields.length + 2 };
    },

    draft: function (s) {
      var wrap = el(
        '<div class="mk">' +
          '<div class="mk__brief" data-brief></div>' +
          '<div class="mk__paper" data-paper></div>' +
          '<div class="mk__meta" data-meta></div>' +
        '</div>'
      );
      var brief = wrap.querySelector('[data-brief]');
      var paper = wrap.querySelector('[data-paper]');
      var meta = wrap.querySelector('[data-meta]');
      var tags = s.tags.map(function (t, i) {
        var n = el('<span class="mk__tag' + (i === 0 ? ' mk__tag--hi' : '') + '">' + t + '</span>');
        meta.appendChild(n);
        return n;
      });

      if (reduce) {
        brief.textContent = s.brief;
        paper.textContent = s.paper;
        tags.forEach(function (n) { n.classList.add('is-on'); });
        return { el: wrap, beats: 1 };
      }

      typeInto(brief, s.brief, 22);
      wait(function () { paper.textContent = ''; }, 1000);
      wait(function () {
        var chars = s.paper.split('');
        var i = 0;
        (function tick() {
          if (i > chars.length) return;
          paper.textContent = chars.slice(0, i).join('');
          i += 2;
          wait(tick, 16);
        })();
      }, 1200);
      tags.forEach(function (n, i) {
        wait(function () { n.classList.add('is-on'); }, 2100 + i * 260);
      });
      return { el: wrap, beats: tags.length + 1 };
    },

    table: function (s) {
      var head = s.head.map(function (h) { return '<th>' + h + '</th>'; }).join('');
      var wrap = el(
        '<div class="mk">' +
          '<table class="mk__tbl"><thead><tr>' + head + '</tr></thead><tbody data-tb></tbody></table>' +
          '<div class="mk__sum" data-sum><span data-sl></span><b data-sv></b></div>' +
        '</div>'
      );
      var tb = wrap.querySelector('[data-tb]');
      // 注意：不能把 <tr> 塞进 div.innerHTML —— 解析器会把 tr 丢掉，
      // 只留下裸文本，表格就塌成一行。必须在 tr 元素上设 innerHTML。
      var rows = s.rows.map(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML = r.map(function (c) { return '<td>' + c + '</td>'; }).join('');
        tb.appendChild(tr);
        return tr;
      });
      var sum = wrap.querySelector('[data-sum]');
      wrap.querySelector('[data-sl]').textContent = s.sumLabel;
      wrap.querySelector('[data-sv]').textContent = s.sumValue;

      if (reduce) {
        rows.forEach(function (r) { r.classList.add('is-on'); });
        sum.classList.add('is-on');
        return { el: wrap, beats: 1 };
      }

      rows.forEach(function (r, i) {
        wait(function () { r.classList.add('is-on'); }, 220 + i * 240);
      });
      wait(function () { sum.classList.add('is-on'); }, 220 + rows.length * 240 + 220);
      return { el: wrap, beats: rows.length + 1 };
    }
    ,

    config: function (s) {
      var wrap = el('<div class="mk mkcfg"></div>');
      var totalEl, countEl;

      function fmt(n) { return '¥' + n.toLocaleString('zh-CN'); }

      function recalc() {
        var sum = 0, count = 0;
        var opts = wrap.querySelectorAll('.mkcfg__opt.is-on');
        for (var i = 0; i < opts.length; i++) {
          sum += Number(opts[i].getAttribute('data-p')) || 0;
          count++;
        }
        totalEl.textContent = fmt(sum);
        countEl.textContent = count + ' 项';
        // 轻微反馈
        totalEl.classList.remove('is-bump');
        void totalEl.offsetWidth;
        totalEl.classList.add('is-bump');
      }

      s.groups.forEach(function (g) {
        var box = el('<div class="mkcfg__group"><span class="mkcfg__label">' + g.label + '</span></div>');
        var row = el('<div class="mkcfg__opts"></div>');
        g.items.forEach(function (it) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'mkcfg__opt' + (it.on ? ' is-on' : '');
          b.setAttribute('data-p', String(it.p));
          b.innerHTML = '<span>' + it.n + '</span><em>' + (it.p ? fmt(it.p) : '¥0') + '</em>';
          b.addEventListener('click', function () {
            if (g.multi) {
              b.classList.toggle('is-on');
            } else {
              var sib = row.querySelectorAll('.mkcfg__opt');
              for (var k = 0; k < sib.length; k++) sib[k].classList.remove('is-on');
              b.classList.add('is-on');
            }
            recalc();
          });
          row.appendChild(b);
        });
        box.appendChild(row);
        wrap.appendChild(box);
      });

      var bar = el(
        '<div class="mkcfg__bar">' +
          '<span class="mkcfg__meta">已选 <b data-count>1 项</b>　·　' + s.note + '</span>' +
          '<span class="mkcfg__total"><small>合计</small><b data-total>¥68,000</b></span>' +
        '</div>'
      );
      wrap.appendChild(bar);
      totalEl = wrap.querySelector('[data-total]');
      countEl = wrap.querySelector('[data-count]');
      recalc();

      return { el: wrap, beats: 0, interactive: true };
    }
  };

  /* ---------------- 弹窗 ---------------- */
  var dialog = null;
  var current = 0;

  /* ---------------- 工程型演示：效果评测 ---------------- */
  RENDER.eval = function (s) {
    function row(label, n, cls) {
      return '<div class="ev-row ' + cls + '">' +
        '<span class="ev-row__t">' + label + '</span>' +
        '<span class="ev-row__n">' + n + '<small>%</small></span>' +
        '<span class="ev-row__bar"><i style="width:' + n + '%"></i></span>' +
        '</div>';
    }

    var fails = s.fails.map(function (f) {
      return '<tr><td>' + f[0] + '</td><td class="ev-bad">' + f[1] + '</td><td>' + f[2] + '</td></tr>';
    }).join('');

    var wrap = el(
      '<div class="mk-eval">' +
        '<div class="mk-eval__head">' +
          '<span class="mk-eval__set">' + s.set + '</span>' +
          '<span class="mk-eval__pct" data-pct>0%</span>' +
        '</div>' +
        '<div class="mk-eval__track"><span data-fill></span></div>' +
        '<div class="mk-eval__rows" data-rows>' +
          row('正确', s.correct, 'ok') +
          row('部分正确', s.partial, 'part') +
          row('错误', 100 - s.correct - s.partial, 'bad') +
        '</div>' +
        '<div class="mk-eval__fails" data-fails>' +
          '<h4>错误样例（人工复核后修正）</h4>' +
          '<table class="mk__tbl"><thead><tr><th>问题</th><th>模型答成</th><th>正确应为</th></tr></thead>' +
          '<tbody>' + fails + '</tbody></table>' +
        '</div>' +
        '<div class="mk-eval__verdict" data-verdict>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
          '<span>' + s.verdict + '</span>' +
        '</div>' +
      '</div>'
    );

    var pct = wrap.querySelector('[data-pct]');
    var fill = wrap.querySelector('[data-fill]');
    var rows = wrap.querySelector('[data-rows]');
    var failsEl = wrap.querySelector('[data-fails]');
    var verdict = wrap.querySelector('[data-verdict]');

    if (reduce) {
      pct.textContent = s.correct + '%';
      fill.style.width = s.correct + '%';
      rows.classList.add('is-on');
      failsEl.classList.add('is-on');
      verdict.classList.add('is-on');
      return { el: wrap, beats: 1 };
    }

    var cur = 0;
    (function tick() {
      cur += 3;
      if (cur > s.correct) cur = s.correct;
      pct.textContent = cur + '%';
      fill.style.width = cur + '%';
      if (cur < s.correct) wait(tick, 34);
    })();

    wait(function () { rows.classList.add('is-on'); }, 900);
    wait(function () { failsEl.classList.add('is-on'); }, 1800);
    wait(function () { verdict.classList.add('is-on'); }, 2600);

    return { el: wrap, beats: 4 };
  };

  /* ---------------- 工程型演示：系统对接 ---------------- */
  RENDER.api = function (s) {
    var chips = s.flow.map(function (t, i) {
      return '<span class="api-chip" data-chip="' + i + '">' + t + '</span>' +
        (i < s.flow.length - 1
          ? '<span class="api-arrow" data-arrow="' + i + '" aria-hidden="true">→</span>'
          : '');
    }).join('');

    var wrap = el(
      '<div class="mk-api">' +
        '<div class="mk-api__flow">' + chips + '</div>' +
        '<div class="mk-api__io">' +
          '<div class="mk-api__box" data-req><h4>ERP 发出</h4><pre></pre></div>' +
          '<div class="mk-api__box" data-res><h4>本地返回</h4><pre></pre></div>' +
        '</div>' +
        '<div class="mk-api__log" data-log>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>' +
          '<span></span>' +
        '</div>' +
      '</div>'
    );

    // 用 textContent 写入 JSON，避免转义问题
    wrap.querySelector('[data-req] pre').textContent = s.req;
    wrap.querySelector('[data-res] pre').textContent = s.res;
    wrap.querySelector('[data-log] span').textContent = s.log;

    var chipEls = wrap.querySelectorAll('[data-chip]');
    var arrowEls = wrap.querySelectorAll('[data-arrow]');
    var reqBox = wrap.querySelector('[data-req]');
    var resBox = wrap.querySelector('[data-res]');
    var logBox = wrap.querySelector('[data-log]');

    if (reduce) {
      for (var i = 0; i < chipEls.length; i++) chipEls[i].classList.add('is-on');
      for (var j = 0; j < arrowEls.length; j++) arrowEls[j].classList.add('is-on');
      reqBox.classList.add('is-on');
      resBox.classList.add('is-on');
      logBox.classList.add('is-on');
      return { el: wrap, beats: 1 };
    }

    for (var k = 0; k < chipEls.length; k++) {
      (function (k) {
        wait(function () {
          chipEls[k].classList.add('is-on');
          if (arrowEls[k]) arrowEls[k].classList.add('is-on');
        }, 380 * k + 260);
      })(k);
    }
    wait(function () { reqBox.classList.add('is-on'); }, 700);
    wait(function () { resBox.classList.add('is-on'); }, 1500);
    wait(function () { logBox.classList.add('is-on'); }, 2200);

    return { el: wrap, beats: 4 };
  };

  function buildDialog() {
    var d = document.createElement('dialog');
    d.className = 'demo';
    d.setAttribute('aria-label', '场景演示');
    d.innerHTML =
      '<div class="demo__box">' +
        '<div class="demo__bar">' +
          '<span class="demo__dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span class="demo__name" data-name></span>' +
          '<button class="demo__close" type="button" aria-label="关闭演示">✕</button>' +
        '</div>' +
        '<div class="demo__stage" data-stage></div>' +
        '<div class="demo__foot">' +
          '<span class="demo__steps" data-steps aria-hidden="true"></span>' +
          '<button class="demo__replay" type="button" data-replay>重播</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);

    d.querySelector('.demo__close').addEventListener('click', function () { d.close(); });
    d.querySelector('[data-replay]').addEventListener('click', function () { play(current); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', clearTimers);
    return d;
  }

  function play(index) {
    var s = SCENES[index];
    if (!s || !dialog) return;
    current = index;
    clearTimers();

    var stage = dialog.querySelector('[data-stage]');
    var nameEl = dialog.querySelector('[data-name]');
    var stepsEl = dialog.querySelector('[data-steps]');
    var replay = dialog.querySelector('[data-replay]');

    nameEl.textContent = s.title + ' · 示意演示';
    stage.innerHTML = '';
    replay.disabled = true;

    var made = RENDER[s.type](s);
    stage.appendChild(made.el);

    // 交互型（如报价配置器）：不做自动播放，交给用户点
    if (made.interactive) {
      stepsEl.innerHTML = '<span class="demo__hint2">点上面的选项，总价会实时变化</span>';
      replay.disabled = true;
      var n0 = el('<p class="demo__note">示意演示，价格与报价页一致；正式报价以书面方案为准。</p>');
      stage.appendChild(n0);
      wait(function () { n0.classList.add('is-on'); }, 200);
      return;
    }

    // 进度点
    var n = Math.max(1, made.beats);
    var dots = '';
    for (var i = 0; i < n; i++) dots += '<i></i>';
    stepsEl.innerHTML = dots;
    var dotEls = stepsEl.querySelectorAll('i');

    var note = el('<p class="demo__note">示意演示，非真实数据与界面。</p>');
    stage.appendChild(note);
    wait(function () { note.classList.add('is-on'); }, 300);

    // 节拍推进：按演示形态给每个点着色
    var total = s.type === 'eval' ? 3100 : s.type === 'api' ? 2900
      : s.type === 'ask' ? 2700 : s.type === 'extract'
      ? 900 + s.fields.length * 300 + 400
      : s.type === 'draft' ? 2100 + s.tags.length * 260
      : 220 + s.rows.length * 240 + 300;

    for (var k = 0; k < n; k++) {
      (function (k) {
        wait(function () {
          if (dotEls[k]) dotEls[k].classList.add('is-done');
        }, (total / n) * (k + 1));
      })(k);
    }
    wait(function () { replay.disabled = false; }, total + 300);
  }

  function open(index) {
    if (!dialog) dialog = buildDialog();
    play(index);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    var c = dialog.querySelector('.demo__close');
    if (c) c.focus();
  }

  /* ---------------- 注入按钮 ---------------- */
  // 对外接口：页面上任何 [data-demo-open="索引"] 元素都能唤起演示
  // （首页首屏的「看它怎么答」就是用它，不必跳到解决方案页）
  window.MATATA_DEMO = { open: function (i) { open(Number(i) || 0); } };

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-demo-open]') : null;
    if (!t) return;
    e.preventDefault();
    open(Number(t.getAttribute('data-demo-open')) || 0);
  });

  function inject() {
    var cards = document.querySelectorAll('#scenes .scene, #proof .scene');
    if (!cards.length) return;
    for (var i = 0; i < cards.length; i++) {
      if (i >= SCENES.length) break;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scene__demo';
      // 必须和全局委托用的选择器一致（之前写成 data-demo，导致点了没反应）
      btn.setAttribute('data-demo-open', String(i));
      btn.setAttribute('aria-label', '演示：' + SCENES[i].title);
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>' +
        '<span>演示</span>';
      // 折叠行版本：按钮放进 summary；preventDefault 阻止点击时把行展开
      btn.addEventListener('click', function (e) { e.preventDefault(); });
      (cards[i].querySelector('summary') || cards[i]).appendChild(btn);
    }

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
