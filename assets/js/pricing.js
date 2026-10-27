/* ============================================================
   玛塔塔 MATATA · 产品配置器
   ============================================================
   作用：让客户在页面上自己组合"服务 + 算力 + 加项"，立刻看到合计，
   并带着这份方案跳到预约表单。

   设计取舍：
   1. 价格只有一个来源 —— HTML 里的 data-price 属性。
      不在 JS 里再抄一份数字，避免两处不一致。
   2. B2B 不会在线付款，所以这里不做下单，只做"预期定价 + 提交意向"。
   3. 合计做数字滚动，但尊重 prefers-reduced-motion。
   4. 无 JS 时页面依然完整：所有价格都写在 HTML 卡片里，
      只是不能动态合计。
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('configForm');
  if (!form) return;

  var totalEl = document.getElementById('configTotal');
  var noteEl = document.getElementById('configNote');
  var submitEl = document.getElementById('configSubmit');
  if (!totalEl) return;

  var reduce = false;
  try {
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { /* 忽略 */ }

  function fmt(n) {
    return '¥' + n.toLocaleString('zh-CN');
  }

  function picked() {
    var base = form.querySelector('input[name="base"]:checked');
    var hw = form.querySelector('input[name="hw"]:checked');
    var addons = form.querySelectorAll('input[name="addon"]:checked');
    var total = 0;
    var names = [];

    if (base) {
      total += Number(base.getAttribute('data-price')) || 0;
      names.push(base.value);
    }
    if (hw && Number(hw.getAttribute('data-price')) > 0) {
      total += Number(hw.getAttribute('data-price'));
      names.push(hw.value);
    }
    for (var i = 0; i < addons.length; i++) {
      total += Number(addons[i].getAttribute('data-price')) || 0;
      names.push(addons[i].value);
    }
    return { total: total, names: names };
  }

  var shown = null;   // 当前显示的数字（用于滚动起点）

  function setTotal(target) {
    if (reduce || shown === null) {
      totalEl.textContent = fmt(target);
      shown = target;
      return;
    }
    var from = shown;
    shown = target;
    var start = null;
    var dur = 420;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      totalEl.textContent = fmt(Math.round(from + (target - from) * eased));
      if (t < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);

    // 轻微放大反馈
    totalEl.classList.add('is-bump');
    window.setTimeout(function () { totalEl.classList.remove('is-bump'); }, 190);
  }

  function update() {
    var p = picked();
    setTotal(p.total);

    if (noteEl) {
      noteEl.textContent = p.names.length
        ? '已选：' + p.names.join(' + ')
        : '选择后显示明细。最终价格以诊断后的书面方案为准。';
    }

    if (submitEl) {
      var plan = p.names.length ? p.names.join(' + ') : '免费诊断';
      submitEl.href = 'contact.html?plan=' + encodeURIComponent(plan) + '&total=' + p.total;
    }
  }

  form.addEventListener('change', update);
  update();
})();
