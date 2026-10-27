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
- `assets/css` 样式。**层叠顺序很重要**，`redesign.css` 必须最后加载（它是设计系统的最终层）
- `assets/js` 脚本
  - `config.js` 联系方式、备案号、表单地址、统计 ID 都集中在这里
  - `demo-scenes.js` 解决方案页的场景演示
  - `hero-field.js` 首屏的"封闭场"粒子
- `assets/img` 图片与分享图
- `downloads` 可下载的 PDF
- `sitemap.xml` / `robots.txt` SEO

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
2. **自定义域名**：仓库根目录建 `CNAME` 文件（内容如 `www.matata.cn`），
   并在 DNS 添加 `CNAME` 记录指向 `用户名.github.io`
3. **Nginx**：把本目录内容放到站点根目录，`try_files $uri $uri/ =404;`
