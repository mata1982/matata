# 玛塔塔科技官网（静态站）

## 这是什么
纯静态站点，无需构建、无需 Node、无需数据库。
上传后即可访问，任何静态托管都能跑。

## 本地预览
解压后双击 `index.html` 即可（部分功能如相对路径跳转在 file:// 下可能受限，
更接近真实效果的方式见项目根目录的 `preview.cmd`）。

## 部署到 GitHub Pages
1. 在 GitHub 新建仓库（Public），名字例如 `matata-site`
2. 把本目录**全部内容**上传到仓库根目录（不是上传外层文件夹）
3. Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`
4. 等 1–2 分钟，访问 `https://<用户名>.github.io/matata-site/`

## 绑定正式域名（www.matata.cn）
1. 在仓库根目录新建文件 `CNAME`，内容一行：`www.matata.cn`
2. 域名 DNS 添加记录：
   - `CNAME` 主机记录 `www` → 指向 `<用户名>.github.io`
   - 根域名 `matata.cn` 用 `A` 记录指向 GitHub Pages IP（或把根域 301 到 www）
3. 回到 Settings → Pages，勾选 `Enforce HTTPS`（证书自动签发，几分钟生效）

注意：`.cn` 域名在境外托管不需要 ICP 备案，但国内访问速度会不稳定。
正式上线建议仍用国内云主机（阿里云/华为云）+ 备案。

## 目录说明
- `index.html` 首页
- `*.html` 其余页面（含 6 个行业页、3 篇观点文章、2 个门户原型）
- `assets/css` 样式（按顺序叠加，`redesign.css` 必须是最后一个）
- `assets/js` 脚本
- `assets/img` 图片与分享图
- `downloads` 可下载的 PDF
- `sitemap.xml` / `robots.txt` SEO

## 上线前还需填写
编辑 `assets/js/config.js`：
- `icp`：ICP 备案号（备案下来后填）
- `form.endpoint`：表单接收地址（金数据/腾讯问卷）
- `analytics`：统计平台与站点 ID

这三项为空时，对应内容会自动隐藏，不会露出"待确认"字样。