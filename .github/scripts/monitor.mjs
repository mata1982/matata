#!/usr/bin/env node
/**
 * 玛塔塔官网 · 可用性巡检（零成本、零依赖）
 * ================================================================
 * 跑在 GitHub Actions 的 ubuntu runner 上，只需要 Node 20+ 内置能力。
 *
 * 查什么（按“会不会直接丢钱”排序）：
 *   1. 发布集页面    200 + <title> 非空 + canonical 前缀正确
 *   2. 页面引用的 CSS/JS 逐个 200（从 HTML 解析，不硬编码指纹）
 *   3. sitemap / robots 可访问、条目数与域名正确
 *   4. 不存在路径返回自定义 404
 *   5. 表单通道健康（GET 探活；--deep 时真发一封带标记的测试邮件）
 *   6. 首页 CSS+JS 的 gzip 总量不超预算
 *
 * 出事怎么办：自动开 GitHub issue（label: monitor），恢复后自动关单。
 * 同一故障不会每 15 分钟刷一条 —— 有 open issue 就追加评论。
 *
 * 环境变量：
 *   SITE_BASE            站点根地址，默认 https://mata1982.github.io/matata/
 *   GITHUB_TOKEN         有则开/关 issue；本地跑没有也正常
 *   GITHUB_REPOSITORY    owner/repo，同上
 *   GITHUB_STEP_SUMMARY  Actions 摘要文件路径（系统自带）
 *   DEEP=1               连“真发一封测试邮件”一起做（每天只跑一次）
 *   LOCAL=1              本地跑：跳过需要公网条件的断言（表单通道、404 文案）
 */

import { gzipSync } from 'node:zlib';

const BASE = (process.env.SITE_BASE || 'https://mata1982.github.io/matata/').replace(/\/?$/, '/');
const BASE_TRIM = BASE.replace(/\/$/, '');
const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPOSITORY || '';
const DEEP = process.env.DEEP === '1';
const LOCAL = process.env.LOCAL === '1';
/** canonical / sitemap 里应该出现的正式域（本地跑时仍是生产域，否则会误报） */
const CANON = (process.env.EXPECT_CANONICAL ||
  (LOCAL ? 'https://mata1982.github.io/matata' : BASE_TRIM)).replace(/\/$/, '');
const RUN_URL = process.env.GITHUB_RUN_URL ||
  (REPO && process.env.GITHUB_RUN_ID ? `https://github.com/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}` : '');
const BUDGET_KB = Number(process.env.BUDGET_KB || 60);   // 构建后首页实测 49.5KB，留 20% 余量

const results = [];
let failed = 0;

function ok(name, detail) {
  results.push({ ok: true, name, detail: detail || '' });
}
function bad(name, detail) {
  failed++;
  results.push({ ok: false, name, detail: detail || '' });
  const one = String(detail || '').replace(/\s+/g, ' ').slice(0, 300);
  console.log(`::error title=巡检失败::${name}${one ? ' — ' + one : ''}`);
}
function note(msg) { console.log(msg); }

const TIMEOUT = 20000;
async function get(url, opts = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': 'matata-monitor/1.0' },
    ...opts
  });
  return res;
}

function abs(url) {
  try { return new URL(url, BASE).href; } catch { return url; }
}

/** 只留路径：告警里不回显完整 URL（查询串可能带方案名等信息） */
function pathOf(url) {
  try { const u = new URL(url, BASE); return u.pathname + (u.search ? '?…' : ''); } catch { return String(url).slice(0, 120); }
}

/* ---------------------------------------------------------------- 1. 页面 */
async function checkPages() {
  let locs = [];
  try {
    const res = await get(BASE + 'sitemap.xml');
    const xml = await res.text();
    if (res.status !== 200) { bad('sitemap.xml 可访问', `HTTP ${res.status}`); return []; }
    locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (locs.length < 20) bad('sitemap 条目数', `仅 ${locs.length} 条（应 ≥20）`);
    else ok('sitemap 条目数', `${locs.length} 条`);

    /* 域名断言用正式域，在改写成本地地址之前先查 */
    const wrong = locs.filter((l) => !l.startsWith(CANON));
    if (wrong.length) bad('sitemap 域名', `${wrong.length} 条不是 ${CANON}：${pathOf(wrong[0])}`);
    else ok('sitemap 域名', `全部为 ${CANON}`);

    /* 本地跑时把生产域名换成 BASE，避免打完本地又打线上 */
    if (LOCAL) {
      locs = locs.map((l) => {
        try { return BASE + (new URL(l).pathname.replace(/^\/matata\//, '')); } catch { return l; }
      });
    }
  } catch (e) {
    bad('sitemap.xml 可访问', e.message);
    return [];
  }

  const assetCache = new Map();
  let pageBad = 0;
  let checked = 0;

  for (const loc of locs) {
    const label = loc.replace(BASE_TRIM, '') || '/index.html';
    let html;
    try {
      const res = await get(loc);
      if (res.status !== 200) { bad(`页面 ${label}`, `HTTP ${res.status}`); pageBad++; continue; }
      html = await res.text();
    } catch (e) {
      bad(`页面 ${label}`, e.message); pageBad++; continue;
    }

    checked++;
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    if (!title || !title.trim()) bad(`标题 ${label}`, '<title> 为空');

    const canonical = (html.match(/rel="canonical"\s+href="([^"]+)"/i) || [])[1];
    if (!canonical) bad(`canonical ${label}`, '未找到');
    else if (!canonical.startsWith(CANON)) bad(`canonical ${label}`, canonical);

    /* 页面引用的 CSS/JS：构建换指纹也不会误报 */
    const refs = [...html.matchAll(/(?:href|src)="(assets\/[^"]+\.(?:css|js))"/g)].map((m) => abs(m[1]));
    for (const ref of [...new Set(refs)]) {
      if (assetCache.has(ref)) {
        const cached = assetCache.get(ref);
        if (!cached.ok) bad(`资源 ${pathOf(ref)}`, cached.detail);
        continue;
      }
      try {
        const r = await get(ref);
        const entry = r.status === 200
          ? { ok: true, body: await r.text(), gz: 0 }
          : { ok: false, detail: `HTTP ${r.status}` };
        if (entry.ok) entry.body = '';
        assetCache.set(ref, entry);
        if (!entry.ok) bad(`资源 ${pathOf(ref)}`, entry.detail);
      } catch (e) {
        assetCache.set(ref, { ok: false, detail: e.message });
        bad(`资源 ${pathOf(ref)}`, e.message);
      }
    }
  }

  if (pageBad === 0) {
    ok('页面健康', `${checked} 页全部 200 + 标题 + canonical`);
  }
  return { locs, assetCache };
}

/* ------------------------------------------------- 2. 首页体积预算 */
async function checkBudget(locs, assetCache) {
  if (LOCAL) { ok('首页体积预算', '本地是源文件（未构建），跳过'); return; }
  const home = locs.find((l) => /\/$/.test(l) || /index\.html$/.test(l)) || BASE;
  let html;
  try {
    html = await (await get(home)).text();
  } catch (e) { bad('首页体积预算', '拿不到首页：' + e.message); return; }

  const refs = [...new Set([...html.matchAll(/(?:href|src)="(assets\/[^"]+\.(?:css|js))"/g)].map((m) => abs(m[1])))];
  let gz = 0;
  const counted = [];
  for (const ref of refs) {
    try {
      const res = await get(ref);
      if (res.status !== 200) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const g = gzipSync(buf).length;
      gz += g;
      counted.push(`${pathOf(ref)} ${(g / 1024).toFixed(1)}K`);
    } catch { /* 单个资源失败已在页面检查里报过 */ }
  }
  const kb = gz / 1024;
  if (kb > BUDGET_KB) bad('首页体积预算', `${kb.toFixed(1)}KB > ${BUDGET_KB}KB（${counted.join('、')}）`);
  else ok('首页体积预算', `${kb.toFixed(1)}KB ≤ ${BUDGET_KB}KB（${refs.length} 个资源）`);
}

/* ---------------------------------------------------------------- 3. robots */
async function checkRobots() {
  try {
    const res = await get(BASE + 'robots.txt');
    if (res.status === 200) ok('robots.txt', '200');
    else bad('robots.txt', `HTTP ${res.status}`);
  } catch (e) { bad('robots.txt', e.message); }
}

/* ---------------------------------------------------------------- 4. 404 */
async function check404() {
  try {
    const res = await get(BASE + `__monitor_404_${Date.now()}.html`);
    const body = await res.text();
    if (res.status !== 404) { bad('自定义 404', `期望 404，实际 ${res.status}`); return; }
    if (LOCAL) { ok('自定义 404', '404（本地预览不校验文案）'); return; }
    if (body.includes('页面不存在')) ok('自定义 404', '404 + 自定义文案');
    else bad('自定义 404', '状态 404 但内容不是自定义 404 页');
  } catch (e) { bad('自定义 404', e.message); }
}

/* ------------------------------------------------------------ 5. 表单通道 */
async function readFormEndpoint() {
  try {
    const js = await (await get(BASE + 'assets/js/config.js')).text();
    const m = js.match(/endpoint:\s*'([^']+)'/);
    return m ? m[1] : '';
  } catch { return ''; }
}

async function checkForm() {
  if (LOCAL) { ok('表单通道', '本地模式跳过（需要公网）'); return; }
  try {
    const res = await get('https://formsubmit.co/');
    if (res.status >= 400) bad('表单通道探活', `formsubmit.co HTTP ${res.status}`);
    else ok('表单通道探活', `formsubmit.co HTTP ${res.status}`);
  } catch (e) { bad('表单通道探活', e.message); }

  if (!DEEP) { ok('表单测试投递', '本次跳过（每天 1 次）'); return; }

  const endpoint = await readFormEndpoint();
  if (!endpoint) { bad('表单测试投递', 'config.js 里没找到 form.endpoint'); return; }
  try {
    const res = await get(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _subject: '【健康检查】官网表单通道自动探测',
        _captcha: 'false',
        _template: 'table',
        来源: '自动巡检',
        说明: '这是一封自动健康检查邮件，无需处理。若连续收到，说明巡检在正常运行。',
        页面: '/monitor',
        时间: new Date().toISOString()
      })
    });
    if (res.status >= 400) bad('表单测试投递', `HTTP ${res.status}`);
    else ok('表单测试投递', `HTTP ${res.status}（应有一封测试邮件）`);
  } catch (e) { bad('表单测试投递', e.message); }
}

/* ------------------------------------------------------- GitHub issue 报告 */
const ISSUE_TITLE = '[monitor] 官网巡检失败';

async function gh(path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'matata-monitor/1.0',
      ...(init.headers || {})
    }
  });
}

async function findOpenIssue() {
  const res = await gh(`/repos/${REPO}/issues?state=open&labels=monitor&per_page=20`);
  if (!res.ok) return null;
  const list = await res.json();
  return list.find((i) => !i.pull_request && String(i.title || '').startsWith(ISSUE_TITLE)) || null;
}

function reportBody(heading) {
  const lines = [`${heading}`, ''];
  lines.push(`- 时间：${new Date().toISOString()}`);
  lines.push(`- 站点：${BASE}`);
  if (RUN_URL) lines.push(`- 运行记录：${RUN_URL}`);
  lines.push('', '| 检查项 | 结果 | 说明 |', '|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${String(r.detail || '').replace(/\|/g, '\\|').slice(0, 200)} |`);
  }
  lines.push('', '> 这条 issue 由 `.github/workflows/monitor.yml` 自动维护：有故障时开单/追加，恢复后自动关闭。');
  return lines.join('\n');
}

async function notifyIssue() {
  if (LOCAL || !TOKEN || !REPO) {
    note('跳过 issue 报告（本地模式或没有 GITHUB_TOKEN）');
    return;
  }
  try {
    const open = await findOpenIssue();
    if (failed > 0) {
      const body = reportBody(`自动巡检发现 **${failed} 项失败**。`);
      if (open) {
        await gh(`/repos/${REPO}/issues/${open.number}/comments`, {
          method: 'POST', body: JSON.stringify({ body: '再次失败。\n\n' + body })
        });
        note(`已在 issue #${open.number} 追加评论`);
      } else {
        const res = await gh(`/repos/${REPO}/issues`, {
          method: 'POST',
          body: JSON.stringify({ title: `${ISSUE_TITLE}（${failed} 项）`, body, labels: ['monitor'] })
        });
        note(res.ok ? `已开 issue #${(await res.json()).number}` : `开 issue 失败：HTTP ${res.status}`);
      }
    } else if (open) {
      await gh(`/repos/${REPO}/issues/${open.number}/comments`, {
        method: 'POST', body: JSON.stringify({ body: `✅ 已恢复（${new Date().toISOString()}）。\n\n${RUN_URL || ''}` })
      });
      await gh(`/repos/${REPO}/issues/${open.number}`, {
        method: 'PATCH', body: JSON.stringify({ state: 'closed' })
      });
      note(`已关闭 issue #${open.number}`);
    }
  } catch (e) {
    note('issue 报告失败：' + e.message);
  }
}

/* ------------------------------------------------------------- 摘要与主流程 */
async function writeSummary() {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  const lines = [
    `## 官网巡检：${failed === 0 ? '✅ 全部通过' : `❌ ${failed} 项失败`}`,
    '',
    `站点：${BASE}　模式：${DEEP ? '深检（含测试投递）' : '常规'}${LOCAL ? '　本地' : ''}`,
    '',
    '| 检查项 | 结果 | 说明 |', '|---|---|---|'
  ];
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${String(r.detail || '').replace(/\|/g, '\\|').slice(0, 200)} |`);
  }
  try { await (await import('node:fs/promises')).appendFile(path, lines.join('\n') + '\n'); } catch {}
}

async function main() {
  note(`巡检目标：${BASE}　模式：${DEEP ? 'deep' : 'normal'}${LOCAL ? ' / local' : ''}`);
  const pageInfo = await checkPages();
  if (pageInfo && pageInfo.locs && pageInfo.locs.length) {
    await checkBudget(pageInfo.locs, pageInfo.assetCache || new Map());
  }
  await checkRobots();
  await check404();
  await checkForm();

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  await notifyIssue();
  await writeSummary();

  if (failed) {
    console.log(`\n巡检未通过：${failed} 项失败 / 共 ${results.length} 项`);
    process.exit(1);
  }
  console.log(`\n巡检通过：${results.length} 项全部通过`);
}

main().catch((e) => {
  console.log(`::error title=巡检脚本异常::${e && e.message}`);
  process.exit(2);
});
