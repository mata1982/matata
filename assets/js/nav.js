/* ============================================================
   玛塔塔 MATATA · 移动端导航 v1
   ============================================================
   为什么要单独一个脚本：
   motion-site.js 在"减少动态效果"时直接 return，不执行任何代码。
   导航菜单是功能而非装饰，不能受那条分支影响，所以独立成文件。

   设计取舍：
   不手工在 9 个页面里复制一份移动菜单（容易和主菜单不同步），
   而是运行时从 .nav__links 克隆。页面 HTML 一行都不用改。
   按钮与面板都由脚本创建 → 无 JS 时不会出现"点了没反应"的死按钮。

   可访问性：
   · aria-expanded / aria-controls 正确联动
   · Esc 关闭并把焦点还给按钮
   · 点击链接后自动关闭
   · 视口变宽时自动收起，避免状态残留
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var bar = document.querySelector('.nav__inner');
    var header = document.querySelector('.nav');
    if (!bar || !header) return;

    var links = bar.querySelector('.nav__links');
    if (!links) return;

    var items = links.querySelectorAll('a');
    if (!items.length) return;

    // ---------- 汉堡按钮 ----------
    var btn = document.createElement('button');
    btn.className = 'nav__burger';
    btn.type = 'button';
    btn.setAttribute('aria-label', '打开菜单');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'nav-panel');
    btn.innerHTML = '<span></span><span></span><span></span>';

    // ---------- 面板：从主菜单克隆链接 ----------
    var panel = document.createElement('div');
    panel.className = 'nav__panel';
    panel.id = 'nav-panel';
    panel.hidden = true;

    var panelNav = document.createElement('nav');
    panelNav.setAttribute('aria-label', '移动端导航');

    for (var i = 0; i < items.length; i++) {
      var src = items[i];
      var a = document.createElement('a');
      a.href = src.getAttribute('href');
      a.textContent = src.textContent;
      if (src.className) a.className = src.className;
      panelNav.appendChild(a);
    }

    // 主 CTA 也放进面板，移动端顶栏可以更干净
    var cta = bar.querySelector('.navcta__main') || bar.querySelector('.nav__cta');
    if (cta) {
      var ctaClone = document.createElement('a');
      ctaClone.href = cta.getAttribute('href');
      ctaClone.textContent = cta.textContent;
      ctaClone.className = 'btn btn--primary nav__panel-cta';
      panelNav.appendChild(ctaClone);
    }

    // 自测与检测也放进面板：移动端顶栏空间紧，不单独占位
    var tools = [['assessment.html', 'AI 适配度自测'], ['detect.html', '检测这台电脑']];
    for (var t = 0; t < tools.length; t++) {
      var ta = document.createElement('a');
      ta.href = tools[t][0];
      ta.textContent = tools[t][1];
      ta.className = 'nav__panel-tool';
      panelNav.appendChild(ta);
    }

    panel.appendChild(panelNav);

    // 遮罩：盖住菜单以下的页面，避免下方内容（如首屏按钮）与面板内容视觉打架
    var scrim = document.createElement('div');
    scrim.className = 'nav__scrim';
    scrim.hidden = true;
    scrim.setAttribute('aria-hidden', 'true');

    bar.appendChild(btn);
    header.appendChild(panel);
    header.appendChild(scrim);

    // 让 CSS 知道"脚本已就绪"，只有这时才显示汉堡按钮
    document.documentElement.classList.add('has-nav-js');

    // ---------- 开关逻辑 ----------
    var open = false;

    function setOpen(next) {
      if (next === open) return;
      open = next;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
      panel.hidden = !open;
      scrim.hidden = !open;
      // 用一帧延迟触发过渡，避免 hidden 与 class 同时切换导致无动画
      if (open) {
        window.requestAnimationFrame(function () {
          panel.classList.add('is-open');
          scrim.classList.add('is-open');
        });
        document.documentElement.classList.add('nav-open');
      } else {
        panel.classList.remove('is-open');
        scrim.classList.remove('is-open');
        document.documentElement.classList.remove('nav-open');
      }
    }

    btn.addEventListener('click', function () {
      setOpen(!open);
    });

    scrim.addEventListener('click', function () {
      setOpen(false);
    });

    panel.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        btn.focus();
      }
    });

    // 视口变宽：收起，避免面板在桌面态残留
    var mq = window.matchMedia('(max-width: 900px)');
    function onMq() {
      if (!mq.matches && open) setOpen(false);
    }
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  });
})();
