/* ============================================================
   玛塔塔 MATATA · AI 适配度自测
   ============================================================
   8 道题，纯前端算分，不依赖后端。
   结论必须能落到"从哪个场景开始 / 花多少钱 / 多久见效"，
   否则客户答完还是不知道干什么。

   评分设计（透明、可解释）：
   · 总分 0–22，看"现在能不能做"
   · 场景分三路：知识库 / 单据提取 / 培训上手，取最高
   · 本地必要性 = 数据敏感度 + 网络环境（0–5）
   · 结论会带"为什么"，让客户看到依据，而不是一个莫名其妙的分数
   ============================================================ */
(function () {
  'use strict';

  var QUIZ = [
    {
      q: '你们公司的资料（制度、工艺、产品、客户资料）主要放在哪？',
      opts: [
        { t: '共享盘或网盘，基本能找', s: 2, k: 'q1' },
        { t: '纸质、微信群、个人电脑里都有', s: 1, k: 'q1' },
        { t: '分散在几个系统里，互相不通', s: 3, k: 'q1' },
        { t: '基本没有成型的资料', s: 0, k: 'q1' }
      ]
    },
    {
      q: '有没有一件事，员工每天都在重复做？',
      opts: [
        { t: '有，而且很清楚是哪件', s: 3, k: 'q2' },
        { t: '有，但说不清算哪件最费时间', s: 2, k: 'q2' },
        { t: '没有，大家做的都不一样', s: 0, k: 'q2' }
      ]
    },
    {
      q: '客户资料、图纸、合同这类东西，能传到外部服务器上吗？',
      opts: [
        { t: '绝对不能，出了内网就是事故', s: 3, k: 'q3' },
        { t: '尽量别，能不出门最好', s: 2, k: 'q3' },
        { t: '可以，没什么特别敏感的', s: 1, k: 'q3' }
      ]
    },
    {
      q: '这件事一年大概发生多少次？',
      opts: [
        { t: '每天都在发生', s: 3, k: 'q4' },
        { t: '每周几次', s: 2, k: 'q4' },
        { t: '每月几次', s: 1, k: 'q4' },
        { t: '很少，一年没几次', s: 0, k: 'q4' }
      ]
    },
    {
      q: '如果要上这套东西，谁负责推？',
      opts: [
        { t: '有能拍板的业务负责人', s: 2, k: 'q5' },
        { t: 'IT 或行政兼着，业务不管', s: 1, k: 'q5' },
        { t: '还没人管，老板让我先看看', s: 0, k: 'q5' }
      ]
    },
    {
      q: '你们的办公或生产现场，网络情况怎么样？',
      opts: [
        { t: '经常断网，或者纯内网不接外网', s: 2, k: 'q6' },
        { t: '一般，能用但不算快', s: 1, k: 'q6' },
        { t: '很好，稳定高速', s: 0, k: 'q6' }
      ]
    },
    {
      q: '这件事大概能拿出多少预算？',
      opts: [
        { t: '5 万以内', s: 1, k: 'q7' },
        { t: '5–15 万', s: 2, k: 'q7' },
        { t: '15 万以上', s: 3, k: 'q7' },
        { t: '还没想过，先了解', s: 1, k: 'q7' }
      ]
    },
    {
      q: '希望多久看到效果？',
      opts: [
        { t: '一个月内', s: 3, k: 'q8' },
        { t: '三个月内', s: 2, k: 'q8' },
        { t: '半年内', s: 1, k: 'q8' },
        { t: '不着急，先规划', s: 1, k: 'q8' }
      ]
    }
  ];

  var state = { i: 0, ans: {} };

  var elQuiz, elQ, elBar, elNo, elBack, elRes;

  function score() {
    var q = state.ans;
    var total = 0;
    Object.keys(q).forEach(function (k) { total += q[k].s; });

    var kb = q.q1.s + q.q2.s + q.q4.s;
    var extract = q.q1.s + q.q3.s + q.q4.s;
    var train = q.q2.s + q.q5.s + q.q8.s;
    var local = q.q3.s + q.q6.s;

    return { total: total, kb: kb, extract: extract, train: train, local: local };
  }

  function pickScene(s) {
    if (s.kb >= s.extract && s.kb >= s.train) return 'kb';
    if (s.extract >= s.train) return 'extract';
    return 'train';
  }

  var SCENE = {
    kb: {
      name: '本地知识库问答',
      why: '资料分散、又有人天天在找东西——这是最容易先做出效果的一类。',
      price: '¥9,800 试点 → ¥68,000 标准部署',
      priceNote: '试点费可全额抵扣'
    },
    extract: {
      name: '单据与文档信息提取',
      why: '单据量大、字段固定、人工录入费时间——这类规则明确，AI 上手快。',
      price: '¥4,800–¥15,000 起',
      priceNote: '按单据种类与字段量评估'
    },
    train: {
      name: '培训与新人上手',
      why: '新人上手慢、老员工反复答同样问题——先把资料和标准答法建起来。',
      price: '¥6,000 起（培训 + 知识库）',
      priceNote: '可并入标准部署'
    }
  };

  function buildResult() {
    var s = score();
    var scene = SCENE[pickScene(s)];
    var q = state.ans;

    var tier, headline, lead, timeText, budget, budgetNote, localText, localNote;
    if (s.total >= 16) {
      tier = 'ready';
      headline = '现在就可以动手，从「' + scene.name + '」开始';
      lead = '资料、场景、负责人这三样你们都具备，属于少数可以直接进入实施的类型。建议先做一个场景，跑通后再复制到其他部门。';
      timeText = '3–6 周';
      budget = '¥68,000 起';
      budgetNote = '或先做 ¥9,800 试点，再抵扣';
    } else if (s.total >= 10) {
      tier = 'pilot';
      headline = '适合先做一个小试点验证';
      lead = '条件基本具备，但还不足以一次铺开。建议先用一台机器、一个场景跑 1–2 周，看到效果再决定要不要扩大。';
      timeText = '1–2 周见效果';
      budget = '¥9,800 起';
      budgetNote = '试点费全额抵扣正式部署';
    } else {
      tier = 'foundation';
      headline = '建议先把地基打好，再谈上 AI';
      lead = '现在直接投入大概率用不起来。问题不在 AI，而在资料、场景或负责人还没就位——先把这三样补上，投入会少很多。';
      timeText = '2–4 周整理';
      budget = '¥0（诊断）';
      budgetNote = '先出一份机会清单';
    }

    if (s.local >= 4) { localText = '必须本地'; localNote = '数据不能出门 / 网络受限'; }
    else if (s.local >= 2) { localText = '建议本地'; localNote = '数据较敏感，本地更稳'; }
    else { localText = '可先用公有云'; localNote = '无敏感数据、网络良好'; }

    /* 为什么：只讲有依据的几条 */
    var why = [];
    if (q.q1.s >= 2) why.push({ ok: true, t: '资料已经存在，只是找起来慢——这是知识库最理想的前提。' });
    if (q.q1.s <= 1) why.push({ ok: false, t: '资料还没整理成型。建议先花 2–4 周把最常被问的 50 个问题整理成文档。' });
    if (q.q2.s >= 2) why.push({ ok: true, t: '有明确的重复性工作，说明场景是真实的，不是凭空想出来的。' });
    if (q.q4.s >= 2) why.push({ ok: true, t: '发生频率高，投入产出容易算清楚，做出来当月就能看到差别。' });
    if (q.q4.s <= 1) why.push({ ok: false, t: '这件事一年没几次，用现成工具手动做更划算，不必专门部署系统。' });
    if (q.q5.s <= 1) why.push({ ok: false, t: '还没有能拍板的业务负责人。这件事比预算更重要——没人负责，系统上线了也没人用。' });
    if (q.q3.s >= 2) why.push({ ok: true, t: '数据敏感，本地部署不是可选项而是前提：模型和资料都在您自己的机器里。' });

    return {
      tier: tier, headline: headline, lead: lead, scene: scene,
      timeText: timeText, budget: budget, budgetNote: budgetNote,
      localText: localText, localNote: localNote, why: why, score: s
    };
  }

  function renderResult() {
    var r = buildResult();
    var whyHtml = r.why.map(function (w) {
      var tick = w.ok
        ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>';
      return '<li class="' + (w.ok ? '' : 'warn') + '">' + tick + '<span>' + w.t + '</span></li>';
    }).join('');

    elQuiz.hidden = true;
    elRes.hidden = false;
    elRes.innerHTML =
      '<div class="res">' +
        '<div class="res__head">' +
          '<span class="res__tag">自测结论</span>' +
          '<h2 class="res__h">' + r.headline + '</h2>' +
          '<p class="res__lead">' + r.lead + '</p>' +
        '</div>' +
        '<div class="res__grid">' +
          '<div class="res__cell"><small>推荐场景</small><b>' + r.scene.name + '</b><span>' + r.scene.why + '</span></div>' +
          '<div class="res__cell"><small>预算区间</small><b>' + r.budget + '</b><span>' + r.budgetNote + '</span></div>' +
          '<div class="res__cell"><small>上线时间</small><b>' + r.timeText + '</b><span>' + r.localText + ' · ' + r.localNote + '</span></div>' +
        '</div>' +
        '<div class="res__body">' +
          '<h3>为什么是这个结论</h3>' +
          '<ul class="res__why">' + whyHtml + '</ul>' +
          '<div class="res__actions">' +
            '<a class="btn btn--primary" href="contact.html?plan=' + encodeURIComponent('自测·' + r.scene.name) + '">约 60 分钟聊聊（免费）</a>' +
            '<a class="btn btn--ghost" href="pricing.html">看详细报价</a>' +
            '<button class="btn btn--ghost" type="button" id="resCopy">复制报告</button>' +
            '<button class="btn btn--ghost" type="button" id="resAgain">重新测</button>' +
          '</div>' +
          '<form class="lead" id="leadForm">' +
            '<h3>把这份结论发给您自己</h3>' +
            '<p>留个联系方式，我们把完整报告和改进建议发过去。不发广告，也不会转给第三方。</p>' +
            '<div class="lead__row">' +
              '<input name="name" placeholder="怎么称呼您" autocomplete="name" required>' +
              '<input name="contact" placeholder="手机 / 微信" autocomplete="tel" required>' +
            '</div>' +
            '<div class="lead__row">' +
              '<input name="company" placeholder="公司名称（选填）" autocomplete="organization">' +
              '<button class="btn btn--primary" type="submit" style="width:100%;">发送给我</button>' +
            '</div>' +
            '<div class="lead__ok" id="leadOk" hidden>已收到。我们会在 1 个工作日内联系您，把报告发过去。</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    elRes.scrollIntoView({ block: 'start', behavior: 'smooth' });

    /* 复制报告 */
    document.getElementById('resCopy').addEventListener('click', function () {
      var text = '【玛塔塔 · AI 适配度自测】\n' + r.headline + '\n' +
        '推荐场景：' + r.scene.name + '\n' +
        '预算区间：' + r.budget + '\n' +
        '上线时间：' + r.timeText + '\n' +
        '部署方式：' + r.localText + '\n\n' + r.lead;
      var btn = this;
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

    document.getElementById('resAgain').addEventListener('click', function () {
      state = { i: 0, ans: {} };
      elRes.hidden = true; elRes.innerHTML = '';
      elQuiz.hidden = false;
      renderQuestion();
    });

    /* 留资提交 */
    var form = document.getElementById('leadForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var cfg = window.MATATA_CONFIG || {};
      var endpoint = (cfg.form && cfg.form.endpoint) || '';
      var extra = (cfg.form && cfg.form.extra) || {};
      var data = {
        _subject: '【玛塔塔官网】AI 适配度自测报告',
        _captcha: 'false',
        _template: 'table',
        来源: 'AI 适配度自测',
        结论: r.headline,
        推荐场景: r.scene.name,
        预算区间: r.budget,
        部署方式: r.localText,
        得分: r.score.total + '/22',
        称呼: fd.get('name') || '',
        联系方式: fd.get('contact') || '',
        公司: fd.get('company') || '',
        答题摘要: JSON.stringify(state.ans).slice(0, 900)
      };
      Object.keys(extra).forEach(function (k) { if (data[k] === undefined) data[k] = extra[k]; });

      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = '发送中…';

      var ctrl = null;
      try { ctrl = new AbortController(); } catch (e) {}
      var timer = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 20000);

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        document.getElementById('leadOk').hidden = false;
        btn.textContent = '已发送 ✓';
      }).catch(function () {
        clearTimeout(timer);
        // 网络慢或服务未激活时不让人干等，直接给出替代路径
        btn.disabled = false;
        btn.textContent = '发送失败，点这里重试';
        var ok = document.getElementById('leadOk');
        if (ok) {
          ok.hidden = false;
          ok.style.background = '#FFF8E8';
          ok.style.borderColor = 'rgba(180,114,15,.3)';
          ok.style.color = '#8A6A1F';
          ok.innerHTML = '网络不太顺畅，没发出去。您也可以直接电话 <a href="tel:13810625550" style="color:#8A6A1F;text-decoration:underline">138 1062 5550</a> 或微信同号，把结论告诉我们就行。';
        }
      });
    });
  }

  function renderQuestion() {
    var q = QUIZ[state.i];
    var n = QUIZ.length;
    elNo.textContent = String(state.i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    elBar.style.width = Math.round((state.i / n) * 100) + '%';
    elBack.disabled = state.i === 0;

    var opts = q.opts.map(function (o, idx) {
      return '<button class="quiz__opt" type="button" data-idx="' + idx + '">' + o.t + '</button>';
    }).join('');

    elQ.innerHTML = '<h2 class="quiz__q">' + q.q + '</h2><div class="quiz__opts">' + opts + '</div>';

    elQ.querySelectorAll('.quiz__opt').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = q.opts[Number(b.getAttribute('data-idx'))];
        state.ans[o.k] = { s: o.s, t: o.t };
        if (state.i < n - 1) {
          state.i++;
          renderQuestion();
        } else {
          elBar.style.width = '100%';
          renderResult();
        }
      });
    });
  }

  function init() {
    elQuiz = document.getElementById('quiz');
    if (!elQuiz) return;
    elQ = document.getElementById('quizQ');
    elBar = document.getElementById('quizBar');
    elNo = document.getElementById('quizNo');
    elBack = document.getElementById('quizBack');
    elRes = document.getElementById('quizResult');

    elBack.addEventListener('click', function () {
      if (state.i > 0) { state.i--; renderQuestion(); }
    });

    renderQuestion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
