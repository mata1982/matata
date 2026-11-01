/* ============================================================
   玛塔塔 MATATA · 站点脚本
   ============================================================
   职责（全部为渐进增强，JS 失效时页面仍可正常浏览）：

   1. 把 config.js 里的联系方式填入页面（[data-contact] 元素）
   2. 表单留资：
      · 配了接口 → JSON POST，成功显示"已收到"
      · 没配接口 → 不让线索悄悄丢掉：展示"复制内容 / 发邮件 / 打电话"
        三个动作，并同时本地暂存一份
   3. 统计：按 config.js 配置注入百度统计；同时提供 track() 记录关键动作
   4. CTA 点击埋点（所有指向 contact.html 的链接）

   为什么不再依赖 localStorage 静默保存：
   以前没配接口时，用户点提交后信息只存在他自己浏览器里，
   我们永远收不到——这是最隐蔽的漏斗漏洞。现在改成必须让用户
   完成一个"真的发出去"的动作。
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.MATATA_CONFIG || {};
  var STORAGE_KEY = 'matata_leads';

  function cfg(path, dflt) {
    var cur = CFG;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return dflt;
      cur = cur[parts[i]];
    }
    return (cur === undefined || cur === null || cur === '') ? dflt : cur;
  }

  /* ============================================================
     1. 联系方式注入
     ------------------------------------------------------------
     没配置的项直接隐藏整行，而不是在页面上显示"待确认"。
     理由：真实的电话邮箱旁边挂一个"待确认"，比不显示更可疑。
     以后补上微信或备案号，只要在 config.js 填一行，这里会自动出现。
     ============================================================ */
  function applyContact() {
    var els = document.querySelectorAll('[data-contact]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-contact');
      var val = cfg('contact.' + key, '');

      if (!val) {
        if (key === 'icp') {
          el.style.display = 'none';
          var sep = el.parentNode && el.parentNode.querySelector('.sep-icp');
          if (sep) sep.style.display = 'none';
        } else {
          var row = el.closest ? el.closest('li') : null;
          (row || el).style.display = 'none';
        }
        continue;
      }

      el.textContent = val;
      el.classList.remove('tbd');

      // 电话与邮箱自动变成可点击
      if (key === 'phone') {
        var a = document.createElement('a');
        a.href = 'tel:' + String(val).replace(/[^\d+]/g, '');
        a.textContent = val;
        el.textContent = '';
        el.appendChild(a);
      } else if (key === 'email') {
        var m = document.createElement('a');
        m.href = 'mailto:' + val;
        m.textContent = val;
        el.textContent = '';
        el.appendChild(m);
      }
    }
  }

  /* ============================================================
     2. 统计
     ============================================================ */
  function initAnalytics() {
    var provider = cfg('analytics.provider', '');
    var id = cfg('analytics.id', '');
    if (!provider || !id) return;

    if (provider === 'baidu') {
      window._hmt = window._hmt || [];
      var hm = document.createElement('script');
      hm.src = 'https://hm.baidu.com/hm.js?' + encodeURIComponent(id);
      hm.async = true;
      document.head.appendChild(hm);
    }
    // 其它平台按同样方式扩展：把官方 snippet 放这里即可
  }

  /** 记录动作：有平台就上报，没平台也至少打到 console，便于本地核对 */
  function track(action, label) {
    try {
      if (window._hmt) window._hmt.push(['_trackEvent', 'site', action, label || '']);
      if (CFG.trackEndpoint) {
        var body = JSON.stringify({ action: action, label: label || '', page: location.pathname, at: Date.now() });
        if (navigator.sendBeacon) navigator.sendBeacon(CFG.trackEndpoint, body);
      }
      if (window.console && console.debug) console.debug('[track]', action, label || '');
    } catch (e) { /* 统计失败绝不影响页面 */ }
  }
  window.MATATA_TRACK = track;

  /* ============================================================
     3. 输入校验（联系页与自测页共用同一套规则）
     ------------------------------------------------------------
     现在没有后端，校验只能做在浏览器里。但规则写在一处：
     将来接自建接口时，服务端照抄这一套，两边不会各说各话。
     ============================================================ */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /**
   * 联系方式：手机 / 固话 / 邮箱 / 微信号，认一种就放行。
   * 宁可放宽也不能误伤——把真实客户挡在提交按钮前，代价比少收一条脏数据大得多。
   */
  function checkContact(value) {
    var v = String(value || '').trim();
    if (!v) return { ok: false, msg: '请留一个能联系到您的方式，手机、微信、邮箱任一即可。' };

    if (v.indexOf('@') > -1) {
      return EMAIL_RE.test(v)
        ? { ok: true }
        : { ok: false, msg: '邮箱看着不完整，检查一下 @ 后面那截，例如 name@company.com。' };
    }

    var digits = v.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 20) {
      if (digits.charAt(0) === '1' && digits.length !== 11) {
        return { ok: false, msg: '手机号是 11 位，现在这串是 ' + digits.length + ' 位，确认一下？座机请连区号一起写。' };
      }
      return { ok: true };
    }
    // 微信号：字母数字下划线横线，4–32 位
    if (/^[A-Za-z][-_A-Za-z0-9]{3,31}$/.test(v)) return { ok: true };
    return { ok: false, msg: '这个联系方式我们看不懂，换手机号、微信号或邮箱吧。' };
  }

  function checkProblem(value) {
    var v = String(value || '').trim();
    if (!v) return { ok: false, msg: '简单说一句您现在最想解决的问题就行。' };
    if (v.length < 4) return { ok: false, msg: '再多写几个字，我们第一次沟通才有的聊。' };
    if (v.length > 600) return { ok: false, msg: '超过 600 字了，挑最要紧的说，剩下的当面聊。' };
    return { ok: true };
  }

  window.MATATA_VALIDATE = { contact: checkContact, problem: checkProblem };

  /* ============================================================
     4. 表单
     ============================================================ */
  function endpoint() {
    return (cfg('form.endpoint', '') || window.MATATA_FORM_ENDPOINT || '').trim();
  }

  /* ============================================================
     本地暂存：只在没确认送达时留一份给用户自己复制
     ------------------------------------------------------------
     四条约束（隐私页的承诺要靠代码兜住，不能只写在页面上）：
       1. 只有失败/无接口时才写，确认送达就删掉这一条
       2. 最多 10 条，旧的先进先出
       3. 7 天后自动过期，下次打开页面时清掉
       4. 老版本留下的扁平结构读进来时自动规范化
     ============================================================ */
  var LEAD_TTL = 7 * 24 * 60 * 60 * 1000;
  var LEAD_MAX = 10;

  function readLeads() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      var now = Date.now();
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        var it = raw[i];
        if (!it || typeof it !== 'object') continue;
        var t = Date.parse(it.at || (it.data && it.data.at) || '') || 0;
        if (t && now - t > LEAD_TTL) continue;   // 过期直接丢
        out.push(it.data ? { at: it.at || (it.data.at || ''), data: it.data } : { at: it.at || '', data: it });
      }
      return out.slice(-LEAD_MAX);
    } catch (e) { return []; }
  }

  function writeLeads(list) {
    try {
      if (!list.length) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-LEAD_MAX)));
      return true;
    } catch (e) { return false; }
  }

  function saveLocally(data) {
    if (cfg('form.localBackup', true) === false) return false;   // 配置里关掉就一点都不留
    var list = readLeads();
    list.push({ at: data.at || new Date().toISOString(), data: data });
    return writeLeads(list);
  }

  /** 确认送达后把这一条删掉——用户的机器上不该长期留 PII */
  function dropLocally(data) {
    try {
      var list = readLeads().filter(function (it) {
        return !(it.data && it.data.at === data.at && it.data.contact === data.contact);
      });
      writeLeads(list);
    } catch (e) { /* 清不掉也不影响使用 */ }
  }

  /** 页面启动时清一次：过期条目和旧格式都在这里被规范化 */
  function pruneLeads() { writeLeads(readLeads()); }

  /**
   * 提交到表单服务。两种格式：
   *   json —— 带 CORS 的接口（Formspree / Getform / 自建），能判断成功失败
   *   form —— 表单编码 + no-cors（金数据等），只能按"已发出"处理
   *
   * 为什么要分开：第三方表单服务多数不返回 CORS 头，
   * 用 json 会直接被浏览器拦掉；用 no-cors + 表单编码属于"简单请求"，
   * 不触发预检，能正常送达。
   *
   * 失败一律带 code，页面上按 code 给不同的话——「网络断了」和
   * 「服务拒收」对用户是两件完全不同的事，笼统一句"发送失败"等于没说。
   */
  var SUBMIT_TIMEOUT = 15000;

  var FAIL_COPY = {
    noendpoint: ['还差一步', '本站尚未接入在线留言服务。请把下面整理好的内容发给我们，或者直接打电话。'],
    offline: ['网络好像断了', '这次没发出去。检查一下网络再点提交，或者直接用下面任意一种方式发给我们。'],
    timeout: ['等太久，还没确认收到', '网络慢或服务忙，建议先别反复点。用下面任意一种方式发给我们最快。'],
    network: ['提交被浏览器拦住了', '可能是网络波动或插件拦截。内容已经整理好，复制一下发给我们即可。'],
    rejected: ['提交没通过', '接收服务拒收了这次提交（多半是格式或额度问题）。请用下面任意一种方式发给我们。'],
    rate: ['提交有点频繁', '等一分钟再试，或者直接用下面任意一种方式发给我们。'],
    server: ['我们这边的接收服务出了点问题', '不确定有没有收到。为了不耽误您，请直接用下面任意一种方式发给我们。'],
    unknown: ['提交没成功', '这次没能确认送达。请用下面任意一种方式发给我们，内容已经整理好了。']
  };

  function submitError(code, detail) {
    var err = new Error(code);
    err.code = code;
    err.detail = detail || '';
    return err;
  }

  function submitToEndpoint(url, data) {
    // 合并服务商要求的附加字段（FormSubmit 的 _subject / _captcha 等）
    var extra = cfg('form.extra', null);
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (data[k] === undefined) data[k] = extra[k];
      });
    }

    var method = cfg('form.method', 'POST');
    var format = (cfg('form.format', 'json') || 'json').toLowerCase();
    var opts;

    if (format === 'form') {
      var body = new URLSearchParams();
      Object.keys(data).forEach(function (k) {
        if (data[k] !== undefined && data[k] !== null) body.append(k, data[k]);
      });
      opts = {
        method: method,
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString()
      };
    } else {
      opts = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }

    /* 超时：第三方服务偶尔会挂着不回，用户不能一直盯着"正在提交…" */
    var ctrl = null;
    try { ctrl = new AbortController(); } catch (e) { /* 老浏览器没有超时，退化为等响应 */ }
    if (ctrl) {
      opts.signal = ctrl.signal;
      setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, SUBMIT_TIMEOUT);
    }

    return fetch(url, opts).then(function (res) {
      if (format === 'form') return true;   // no-cors 读不到响应，只能按"已发出"处理
      if (res.ok) return true;
      throw submitError(
        res.status === 429 ? 'rate' : (res.status >= 500 ? 'server' : 'rejected'),
        'HTTP ' + res.status
      );
    }).catch(function (err) {
      if (err && err.code) throw err;
      if (err && err.name === 'AbortError') throw submitError('timeout');
      if (navigator.onLine === false) throw submitError('offline');
      throw submitError('network', err && err.message);
    });
  }

  /* 给自测/检测这些页面脚本复用：一份超时与分流逻辑，不要各写一套 */
  window.MATATA_FORM = {
    endpoint: endpoint,
    submit: submitToEndpoint,
    failCopy: function (code) { return FAIL_COPY[code] || FAIL_COPY.unknown; }
  };

  function collect(form) {
    var fd = new FormData(form);
    var data = {};
    fd.forEach(function (v, k) { data[k] = String(v).trim(); });
    data.page = location.pathname.split('/').pop() || 'index.html';
    data.at = new Date().toISOString();
    return data;
  }

  /** 把表单内容整理成一段可读文本（用于复制/邮件） */
  function asText(d) {
    var map = {
      name: '称呼', contact: '联系方式', industry: '行业', size: '公司规模',
      visit: '是否上门', problem: '最想解决的问题', plan: '已选方案'
    };
    var lines = [];
    Object.keys(map).forEach(function (k) {
      if (d[k]) lines.push(map[k] + '：' + d[k]);
    });
    return '【玛塔塔 · 免费诊断预约】\n' + lines.join('\n') + '\n来源页面：' + d.page;
  }

  /**
   * @param {string} mode 'ok' | 'fallback'
   * @param {string} text 整理好的可读文本（复制/邮件用）
   * @param {string} reason 失败原因代码，决定标题与说明怎么写
   * @param {boolean} saved 本机是否真的存了一份（决定最后那句提示）
   */
  function showDone(form, mode, text, reason, saved) {
    var fields = form.querySelector('.form-fields');
    var done = form.querySelector('.form-done');
    var note = form.querySelector('.form-done__note');
    if (fields) fields.hidden = true;
    if (done) done.hidden = false;
    if (note) { note.hidden = true; }

    // 成功：直接显示已收到
    if (mode === 'ok') {
      if (note) {
        note.textContent = '我们会在 1 个工作日内联系您，先约 60 分钟聊清楚。';
        note.hidden = false;
      }
      if (done) done.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    /* 没确认送达：必须让用户完成一个"真的发出去"的动作。
       文案按原因分开写——「网络断了」和「服务拒收」该说的话不一样。 */
    var copy = FAIL_COPY[reason] || FAIL_COPY.unknown;
    var h3 = done && done.querySelector('h3');
    var p = done && done.querySelector('p');
    if (h3) h3.textContent = copy[0];
    if (p) p.textContent = copy[1];

    var box = done.querySelector('.form-fallback');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-fallback';
      done.appendChild(box);
    }
    box.innerHTML = '';
    box.style.marginTop = '20px';
    box.style.display = 'grid';
    box.style.gap = '10px';

    // 复制
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn--primary btn--block';
    copyBtn.textContent = '复制内容';
    copyBtn.addEventListener('click', function () {
      var ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text); ok = true;
        }
      } catch (e) { ok = false; }
      if (!ok) {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok = true; } catch (e2) { ok = false; }
        document.body.removeChild(ta);
      }
      copyBtn.textContent = ok ? '已复制，请粘贴发送给我们' : '复制失败，请手动选择上面的文字';
      track('form_copy', (reason || 'noendpoint') + '|' + (ok ? 'ok' : 'fail'));
    });
    box.appendChild(copyBtn);

    // 邮件
    var mail = cfg('leadEmail', '') || cfg('contact.email', '');
    if (mail) {
      var a = document.createElement('a');
      a.className = 'btn btn--ghost btn--block';
      a.href = 'mailto:' + mail + '?subject=' + encodeURIComponent('免费诊断预约') +
               '&body=' + encodeURIComponent(text);
      a.textContent = '用邮件发送';
      a.addEventListener('click', function () { track('form_mail', reason || 'noendpoint'); });
      box.appendChild(a);
    }

    // 电话
    var phone = cfg('contact.phone', '');
    if (phone) {
      var t = document.createElement('a');
      t.className = 'btn btn--ghost btn--block';
      t.href = 'tel:' + String(phone).replace(/[^\d+]/g, '');
      t.textContent = '打电话：' + phone;
      t.addEventListener('click', function () { track('form_tel', reason || 'noendpoint'); });
      box.appendChild(t);
    }

    // 兜底提示：只在真的存了的时候说这句，不能拿"不会丢失"安慰一个没存住的人
    if (saved) {
      var tip = document.createElement('p');
      tip.className = 'tiny';
      tip.textContent = '内容已在本机暂存一份（7 天后自动清除），复制失败也不怕。';
      box.appendChild(tip);
    }

    if (done) done.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /** 让浏览器原生的校验气泡说人话（规则在 checkContact / checkProblem 里） */
  function bindFieldValidation(form) {
    var contact = form.querySelector('[name="contact"]');
    var problem = form.querySelector('[name="problem"]');
    var nameEl = form.querySelector('[name="name"]');

    function apply(el, result) {
      if (!el) return;
      if (!result.ok) {
        el.setCustomValidity(result.msg);
        el.setAttribute('aria-invalid', 'true');
      } else {
        el.setCustomValidity('');
        el.removeAttribute('aria-invalid');
      }
    }

    if (contact) {
      var checkC = function () { apply(contact, checkContact(contact.value)); };
      contact.addEventListener('blur', checkC);
      contact.addEventListener('input', function () {
        if (contact.getAttribute('aria-invalid') === 'true') checkC();
      });
    }
    if (problem) {
      var checkP = function () { apply(problem, checkProblem(problem.value)); };
      problem.addEventListener('blur', checkP);
      problem.addEventListener('input', function () {
        if (problem.getAttribute('aria-invalid') === 'true') checkP();
      });
    }
    if (nameEl) {
      nameEl.addEventListener('blur', function () {
        apply(nameEl, nameEl.value.trim() ? { ok: true } : { ok: false, msg: '请告诉我们怎么称呼您。' });
      });
    }

    return { contact: contact, problem: problem, name: nameEl, apply: apply };
  }

  function bind(form) {
    var fields = bindFieldValidation(form);
    var started = false;

    /* 开始填就算一次"意向开始"：能看出有多少人打开表单却一个字没写 */
    function markStart() {
      if (started) return;
      started = true;
      track('form_start', form.getAttribute('data-form-name') || 'contact');
    }
    form.addEventListener('focusin', markStart, { passive: true });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // 提交时再整体校验一次（必填为空也走同一套提示）
      if (fields.contact) fields.apply(fields.contact, checkContact(fields.contact.value));
      if (fields.problem) fields.apply(fields.problem, checkProblem(fields.problem.value));
      if (!form.checkValidity()) {
        form.reportValidity();
        track('form_invalid', 'blocked');
        return;
      }

      var data = collect(form);
      var text = asText(data);
      var url = endpoint();
      track('form_submit', (data.plan || 'no-plan') + '|' + (url ? 'api' : 'local'));

      if (!url) {
        var saved0 = saveLocally(data);
        track('form_fallback', 'noendpoint|' + (saved0 ? 'saved' : 'nosave'));
        showDone(form, 'fallback', text, 'noendpoint', saved0);
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var old = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '正在提交…'; }

      submitToEndpoint(url, data)
        .then(function () {
          dropLocally(data);                     // 确认送到，就别在用户机器上留着
          track('form_ok', data.plan || 'no-plan');
          showDone(form, 'ok');
        })
        .catch(function (err) {
          var code = (err && err.code) || 'unknown';
          var saved = saveLocally(data);         // 没送出去才存，给用户复制用
          track('form_fail', code + '|' + (saved ? 'saved' : 'nosave'));
          if (typeof window.MATATA_REPORT === 'function') {
            window.MATATA_REPORT('form_fail', { message: '表单提交失败：' + code });
          }
          if (window.console && console.warn) {
            console.warn('[form] 提交失败：' + code + (err && err.detail ? '（' + err.detail + '）' : ''));
          }
          showDone(form, 'fallback', text, code, saved);
        })
        .then(function () { if (btn) { btn.disabled = false; btn.textContent = old; } });
    });
  }

  /* ============================================================
     5. CTA 埋点
     ============================================================ */
  function bindCtaTracking() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.indexOf('contact.html') === 0) track('cta_contact', a.textContent.trim().slice(0, 20));
      else if (href.indexOf('pricing.html') === 0) track('cta_pricing', a.textContent.trim().slice(0, 20));
    }, { passive: true });
  }

  /* ============================================================
     启动
     ============================================================ */
  function boot() {
    applyContact();
    pruneLeads();          // 清掉过期/旧格式的本机暂存
    initAnalytics();
    bindCtaTracking();
    var forms = document.querySelectorAll('form[data-lead-form]');
    for (var i = 0; i < forms.length; i++) bind(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================
   导航主按钮的展开菜单（分离式：主体链接 + 箭头）
   ============================================================ */
(function () {
  'use strict';
  var root = document.querySelector('[data-navcta]');
  if (!root) return;
  var toggle = root.querySelector('[data-navcta-toggle]');
  var menu = root.querySelector('[data-navcta-menu]');
  if (!toggle || !menu) return;

  function open() {
    menu.hidden = false;
    root.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  }
  function close() {
    menu.hidden = true;
    root.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function isOpen() { return !menu.hidden; }

  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    cancelHover();
    if (isOpen()) close(); else open();
  });

  /* 桌面端：鼠标移上去就展开（点击仍然保留，供键盘与触屏使用）。
     两个延迟：展开 90ms 防止划过误触发，收起 180ms 留出移入菜单的时间。 */
  var canHover = false;
  try { canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (err) {}
  var openTimer = null, closeTimer = null;

  function cancelHover() {
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  }

  if (canHover) {
    root.addEventListener('mouseenter', function () {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (isOpen()) return;
      openTimer = setTimeout(function () { open(); openTimer = null; }, 90);
    });
    root.addEventListener('mouseleave', function () {
      if (openTimer) { clearTimeout(openTimer); openTimer = null; }
      closeTimer = setTimeout(function () { close(); closeTimer = null; }, 180);
    });
    // 键盘聚焦时也展开，方便 Tab 到箭头后直接看到内容
    toggle.addEventListener('focus', function () {
      if (!isOpen()) open();
    });
  }

  document.addEventListener('click', function (e) {
    if (isOpen() && !root.contains(e.target)) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) { close(); toggle.focus(); }
  });

  // 菜单里点走之后收起（同页锚点场景也适用）
  menu.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.navcta__item')) close();
  });
})();

/* ============================================================
   错误与致命故障自报（没有后端阶段的监控通道）
   ============================================================
   只做三件事：
   1. 捕获致命错误：运行时异常、未处理的 Promise、关键资源（CSS/JS）加载失败
   2. 去重 + 限流之后，经表单通道发一封【错误告警】邮件（通道可一行关掉）
   3. 带 ?debug=1 打开页面时，把最近 20 条错误渲染成可复制文本（人工上报用）

   隐私边界（硬约束，别在这里加字段）：
   · 只上报：页面路径、错误类型、指纹、脱敏后的错误消息/堆栈、构建版本、浏览器大类、屏宽档
   · 绝不上报：用户填写的任何内容、cookie、URL 查询串、完整 UA、任何可识别个人的标识

   为什么不做成"全量日志"：没有后端，通道本身不可靠，报得多只会淹掉真正的告警。
   宁可漏掉长尾，也要保证"表单挂了/脚本挂了"这类致命故障一定能到人。
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.MATATA_CONFIG || {};
  var M = CFG.monitor || {};
  if (M.enabled === false) return;          // 配置里一行关掉

  var KEY_LOG = 'matata_err_log';
  var KEY_SEEN = 'matata_err_seen';
  var KEY_SESS = 'matata_err_session';
  var LOG_MAX = 20;
  var MAX_PER_SESSION = Number(M.maxPerSession || 3);
  var DEDUPE_MS = Number(M.dedupeHours || 24) * 3600 * 1000;
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname || '');

  function iso() { try { return new Date().toISOString(); } catch (e) { return ''; } }

  /* ---------- 构建版本 ----------
     发布脚本会把 tag 注入镜像的 config.js（window.MATATA_CONFIG.build）。
     本地预览、-FromBuild 预览、以及注入前的镜像里它是 undefined——
     读取处必须兜底，不能让告警/面板因为版本号缺失而自己出错。 */
  function buildTag() {
    try {
      var v = (window.MATATA_CONFIG || {}).build;
      if (v == null) return '';
      var s = String(v).trim();
      return /^[\w.\-]{1,64}$/.test(s) ? s : '';   // 不是正常 tag 就当没填，避免把脏值带进告警
    } catch (e) { return ''; }
  }
  function buildLabel() { return buildTag() || '未发布'; }

  function readJSON(k, dflt) {
    try {
      var v = JSON.parse(localStorage.getItem(k) || '');
      return v == null ? dflt : v;
    } catch (e) { return dflt; }
  }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- 脱敏：即使某天错误消息里混进了用户输入，也不能原样发出去 ---------- */
  function scrub(s) {
    return String(s == null ? '' : s)
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, '[邮箱]')
      .replace(/\+?\d[\d\s()-]{6,}\d/g, '[号码]')
      .replace(/https?:\/\/[^\s"')]+/g, function (m) {
        var q = m.indexOf('?');
        return q > -1 ? m.slice(0, q) + '?…' : m;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- 指纹：同一类错误在多台机器上要能归并成一条 ---------- */
  function fpOf(parts) {
    var s = parts.join('|');
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function uaClass() {
    var ua = navigator.userAgent || '';
    var b = /Edg\//.test(ua) ? 'Edge'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari' : 'other';
    return b + (/Mobi|Android|iPhone|iPad/.test(ua) ? '/mobile' : '/desktop');
  }
  function wBucket() {
    var w = window.innerWidth || 0;
    return w <= 390 ? '<=390' : w <= 768 ? '<=768' : w <= 1024 ? '<=1024' : '>1024';
  }

  function pushLog(rec) {
    var log = readJSON(KEY_LOG, []);
    if (!Array.isArray(log)) log = [];
    log.push(rec);
    writeJSON(KEY_LOG, log.slice(-LOG_MAX));
  }

  function endpoint() {
    if (M.endpoint) return String(M.endpoint).trim();
    try {
      if (window.MATATA_FORM && window.MATATA_FORM.endpoint) return window.MATATA_FORM.endpoint();
    } catch (e) {}
    return '';
  }

  function send(rec) {
    var url = endpoint();
    if (!url || isLocal) return;
    var payload = {
      _subject: (M.subjectPrefix || '【错误告警】') + rec.fp,
      _captcha: 'false',
      _template: 'table',
      页面: rec.page,
      类型: rec.type,
      指纹: rec.fp,
      消息: rec.msg,
      位置: rec.where,
      构建: rec.build || '未发布',
      浏览器: rec.ua,
      屏宽: rec.wch,
      时间: rec.at
    };
    try {
      if (window.MATATA_FORM && typeof window.MATATA_FORM.submit === 'function') {
        window.MATATA_FORM.submit(url, payload).catch(function () {});
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* 上报失败绝不能影响页面 */ }
  }

  /** 对外唯一入口：window.MATATA_REPORT(type, err|{message,stack}) */
  function report(type, detail) {
    try {
      var page = String(location.pathname || '').split('?')[0];
      var msg = scrub(detail && detail.message != null ? detail.message : detail || '');
      var stackLines = detail && detail.stack ? String(detail.stack).split('\n').slice(1, 11) : [];
      var where = scrub(stackLines.join(' '));

      /* 指纹只认「文件名」，不认行号列号：
         同一段代码重排一行不该算一条新错误；但换了个构建产物（指纹文件）就该重新提醒一次。 */
      var srcFile = '';
      for (var si = 0; si < stackLines.length; si++) {
        var fm = /([\w.-]+\.js)(?::\d+:\d+)?/.exec(stackLines[si]);
        if (fm) { srcFile = fm[1]; break; }
      }

      var rec = {
        at: iso(),
        page: page,
        type: String(type || 'unknown'),
        fp: fpOf([type, msg.slice(0, 120), page, srcFile]),
        msg: msg.slice(0, 200),
        where: where.slice(0, 400),
        build: buildTag(),
        ua: uaClass(),
        wch: wBucket()
      };
      pushLog(rec);

      /* 去重：同一指纹 24 小时内只发一次 */
      var seen = readJSON(KEY_SEEN, {});
      var t = Number(seen[rec.fp] || 0);
      if (t && Date.now() - t < DEDUPE_MS) return rec;

      /* 限流：每会话最多 3 封，防止一个循环错误把我们自己的邮箱打爆 */
      var n = 0;
      try {
        n = (Number(sessionStorage.getItem(KEY_SESS) || '0') || 0);
        if (n >= MAX_PER_SESSION) return rec;
        sessionStorage.setItem(KEY_SESS, String(n + 1));
      } catch (e) { /* 隐私模式下拿不到 sessionStorage，就按不限流处理 */ }

      seen[rec.fp] = Date.now();
      var cutoff = Date.now() - DEDUPE_MS * 2;
      Object.keys(seen).forEach(function (k) { if (Number(seen[k]) < cutoff) delete seen[k]; });
      writeJSON(KEY_SEEN, seen);

      send(rec);
      return rec;
    } catch (e) { return null; }
  }
  window.MATATA_REPORT = report;

  /* ---------- 捕获 ---------- */
  window.addEventListener('error', function (ev) {
    try {
      var t = ev && ev.target;
      if (t && t !== window && t.tagName) {
        var tag = String(t.tagName).toUpperCase();
        if (tag !== 'SCRIPT' && tag !== 'LINK') return;   // 只报 CSS/JS，图片挂了先不管
        var src = t.getAttribute('src') || t.getAttribute('href') || '';
        report('resource_' + tag.toLowerCase(), { message: '关键资源加载失败：' + String(src).split('?')[0] });
        return;
      }
      report('runtime', (ev && ev.error) || { message: (ev && ev.message) || '' });
    } catch (e) {}
  }, true);

  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var r = ev && ev.reason;
      report('promise', (r && r.message) ? r : { message: String(r) });
    } catch (e) {}
  });

  /* ---------- ?debug=1 诊断面板：人工上报用，不依赖任何 CSS ---------- */
  function debugOn() {
    try { return /(?:^|[?&])debug=1(?:&|$)/.test(location.search); } catch (e) { return false; }
  }

  function renderDebug() {
    if (!debugOn()) return;
    try {
      var log = readJSON(KEY_LOG, []);
      var lines = [
        '【玛塔塔 · 诊断信息】',
        '页面：' + location.pathname,
        '时间：' + iso(),
        '构建：' + buildLabel(),
        '浏览器：' + uaClass() + ' · 屏宽 ' + wBucket(),
        '已记录错误：' + (log.length || 0) + ' 条',
        ''
      ];
      (log || []).slice(-LOG_MAX).forEach(function (r, i) {
        lines.push((i + 1) + '. [' + r.type + '] ' + r.at + ' · 指纹 ' + r.fp);
        lines.push('   ' + r.msg + (r.where ? '\n   ' + r.where : ''));
      });
      var text = lines.join('\n');

      var box = document.createElement('div');
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', '诊断信息');
      box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-height:46vh;overflow:auto;' +
        'background:#111;color:#eee;font:12px/1.5 ui-monospace,Consolas,monospace;padding:12px;border-radius:10px;' +
        'box-shadow:0 10px 30px rgba(0,0,0,.4)';

      var pre = document.createElement('pre');
      pre.style.cssText = 'margin:0 0 10px;white-space:pre-wrap;word-break:break-word';
      pre.textContent = text;

      var bar = document.createElement('div');
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = '复制诊断信息';
      copy.style.cssText = 'margin-right:8px;padding:6px 10px;border-radius:6px;border:0;background:#fff;color:#111;cursor:pointer';
      copy.addEventListener('click', function () {
        try {
          navigator.clipboard.writeText(text);
          copy.textContent = '已复制';
        } catch (e) { copy.textContent = '复制失败，请手动选择'; }
      });

      var close = document.createElement('button');
      close.type = 'button';
      close.textContent = '关闭';
      close.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid #666;background:transparent;color:#eee;cursor:pointer';
      close.addEventListener('click', function () { box.remove(); });

      bar.appendChild(copy);
      bar.appendChild(close);
      box.appendChild(pre);
      box.appendChild(bar);
      (document.body || document.documentElement).appendChild(box);
    } catch (e) { /* 面板坏了也不影响页面 */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderDebug);
  else renderDebug();
})();