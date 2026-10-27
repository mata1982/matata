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
     3. 表单
     ============================================================ */
  function endpoint() {
    return (cfg('form.endpoint', '') || window.MATATA_FORM_ENDPOINT || '').trim();
  }

  function saveLocally(data) {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      list.push(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) { return false; }
  }

  /**
   * 提交到表单服务。两种格式：
   *   json —— 带 CORS 的接口（Formspree / Getform / 自建），能判断成功失败
   *   form —— 表单编码 + no-cors（金数据等），只能按"已发出"处理
   *
   * 为什么要分开：第三方表单服务多数不返回 CORS 头，
   * 用 json 会直接被浏览器拦掉；用 no-cors + 表单编码属于"简单请求"，
   * 不触发预检，能正常送达。
   */
  function submitToEndpoint(url, data) {
    var method = cfg('form.method', 'POST');
    var format = (cfg('form.format', 'json') || 'json').toLowerCase();

    if (format === 'form') {
      var body = new URLSearchParams();
      Object.keys(data).forEach(function (k) {
        if (data[k] !== undefined && data[k] !== null) body.append(k, data[k]);
      });
      return fetch(url, {
        method: method,
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString()
      }).then(function () {
        // no-cors 读不到响应，只要没抛错就认为已送达
        return true;
      });
    }

    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return true;
    });
  }

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

  function showDone(form, mode, text) {
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

    /* 没配接口：必须让用户完成一个"真的发出去"的动作 */
    var h3 = done && done.querySelector('h3');
    var p = done && done.querySelector('p');
    if (h3) h3.textContent = '还差一步';
    if (p) p.textContent = '本站尚未接入在线留言服务。请把下面整理好的内容发给我们，或者直接打电话。';

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
      track('form_copy', ok ? 'ok' : 'fail');
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
      box.appendChild(a);
    }

    // 电话
    var phone = cfg('contact.phone', '');
    if (phone) {
      var t = document.createElement('a');
      t.className = 'btn btn--ghost btn--block';
      t.href = 'tel:' + String(phone).replace(/[^\d+]/g, '');
      t.textContent = '打电话：' + phone;
      box.appendChild(t);
    }

    // 兜底提示
    var tip = document.createElement('p');
    tip.className = 'tiny';
    tip.textContent = '您的填写已在本机暂存一份，不会丢失。';
    box.appendChild(tip);

    if (done) done.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function bind(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var data = collect(form);
      saveLocally(data);                        // 无论如何先保一份
      var text = asText(data);
      var url = endpoint();
      track('form_submit', (data.plan || 'no-plan') + '|' + (url ? 'api' : 'local'));

      if (!url) {
        showDone(form, 'fallback', text);
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var old = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '正在提交…'; }

      submitToEndpoint(url, data)
        .then(function () { showDone(form, 'ok'); })
        .catch(function () { showDone(form, 'fallback', text); })
        .then(function () { if (btn) { btn.disabled = false; btn.textContent = old; } });
    });
  }

  /* ============================================================
     4. CTA 埋点
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
    initAnalytics();
    bindCtaTracking();
    var forms = document.querySelectorAll('form[data-lead-form]');
    for (var i = 0; i < forms.length; i++) bind(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
