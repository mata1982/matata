# 玛塔塔科技官网（静态站）

纯静态站点，无需构建、无需 Node、无需数据库。
上传后即可访问，任何静态托管都能跑（GitHub Pages / Cloudflare Pages / 阿里云 OSS / Nginx）。

## 一键发布

在项目根目录双击 **`publish.cmd`**，或在 PowerShell 执行：

```powershell
powershell -File publish.ps1
# 带说明： powershell -File publish.ps1 "更新了报价页价格"
```

它会依次完成：

1. 把 `site/` 同步到 `github-repo/`（镜像，自动删除已删掉的文件）
2. `git add` + `git commit`（附时间或你给的说明）
3. `git push` 到 GitHub

约 1 分钟后线上生效：<https://mata1982.github.io/matata/>

> 若推送失败，多半是凭据过期——打开 GitHub Desktop 重新登录一次即可。

## 目录说明

- `*.html` 页面（首页、6 个行业页、3 篇观点文章、服务承诺、2 个门户原型等）
- `news.html` **行业资讯聚合页** —— 由 `tools/build_news.py` 生成，**不要手改**（下次生成会覆盖）
- `assets/css` 样式。**层叠顺序很重要**，`redesign.css` 必须最后加载（它是设计系统的最终层）
- `assets/js` 脚本
  - `config.js` 联系方式、备案号、表单地址、统计 ID 都集中在这里
  - `demo-scenes.js` 解决方案页的场景演示
  - `hero-field.js` 首屏的"封闭场"粒子
  - `news.js` 资讯页的行业筛选（同步 `?cat=` 参数）
- `assets/img` 图片与分享图
- `downloads` 可下载的 PDF
- `sitemap.xml` / `robots.txt` SEO

## 行业资讯页（自动聚合）

数据在 `tools/news.json`，页面由脚本生成：

```powershell
# 改完 news.json 后重新生成（同时自动同步首页「行业动态」区块 + 导航 / 页脚 / sitemap）
python tools\build_news.py

# 接 DeepSeek Search API 自动抓取（需要 key）
$env:DEEPSEEK_API_KEY = "sk-xxxxxxxx"
python tools\fetch_news.py        # 抓取 → 写 news.json → 自动重新生成页面
```

- 脚本是**幂等**的：已接入过的导航/页脚不会重复插入
- 某方向抓不到结果时会**保留该方向旧数据**，不会把页面清空
- Search 为只读请求，不会修改目标站点；计费 5 元 / 1000 次成功请求，失败不计费
- 首页区块用 `<!-- news:start -->` / `<!-- news:end -->` 标记，**标记之间的内容会被脚本覆盖**

## 上线前还需要填的东西

编辑 `assets/js/config.js`：

| 字段 | 说明 |
| --- | --- |
| `icp` | ICP 备案号，备案下来后填；为空时页脚自动隐藏 |
| `form.endpoint` | 表单接收地址（金数据 / 腾讯问卷）；为空时提交走降级提示 |
| `analytics` | 统计平台与站点 ID；为空时不加载 |

这三项留空不会露出"待确认"字样，对应内容会整块隐藏。

## 本地预览

双击 `../preview.cmd`（在项目根目录）会起本地服务并打开浏览器，
比直接双击 `index.html` 更接近真实效果（相对路径、字体、脚本都正常）。

## 部署到新环境

1. **GitHub Pages**：仓库 Settings → Pages → Source 选 `main` / `/ (root)`
2. **自定义域名**：仓库根目录建 `CNAME` 文件（内容为正式域名，**待备案与证书就绪后再填**；在此之前 canonical、sitemap、robots 统一用 `https://mata1982.github.io/matata/`），
   并在 DNS 添加 `CNAME` 记录指向 `用户名.github.io`
3. **Nginx**：把本目录内容放到站点根目录，`try_files $uri $uri/ =404;`
