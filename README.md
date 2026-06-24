<p align="center">
  <img src="public/assets/images/logo.png" alt="Earthquake" width="120" />
</p>

<h1 align="center">Earthquake</h1>

<p align="center">
  <strong>基于 Earth 二开的 Halo 主题</strong> · 轻量 · 有态度
</p>

<p align="center">
  <a href="https://fg.ink">在线预览</a> ·
  <a href="https://github.com/mufengyian/theme-earthquake/releases">Releases</a> ·
  <a href="https://github.com/mufengyian/theme-earthquake/issues">Issues</a>
</p>

---

## 预览

### 桌面端

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/desktop-dark-home.png" alt="暗色模式 - 首页" /></td>
    <td width="50%"><img src="docs/screenshots/desktop-light-home.png" alt="亮色模式 - 首页" /></td>
  </tr>
  <tr>
    <td align="center">暗色 · 首页列表</td>
    <td align="center">亮色 · 首页列表</td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/desktop-dark-post.png" alt="暗色模式 - 文章详情" /></td>
  </tr>
  <tr>
    <td colspan="2" align="center">暗色 · 文章详情（目录 + 代码高亮 + 侧栏）</td>
  </tr>
</table>

### 移动端

<table>
  <tr>
    <td width="33%"><img src="docs/screenshots/mobile-dark-home.png" /></td>
    <td width="33%"><img src="docs/screenshots/mobile-light-home.png" /></td>
    <td width="34%"><img src="docs/screenshots/mobile-light-post.png" /></td>
  </tr>
  <tr>
    <td align="center">暗色首页</td>
    <td align="center">亮色首页</td>
    <td align="center">文章详情</td>
  </tr>
  <tr>
    <td colspan="3"><img src="docs/screenshots/mobile-light-toc.png" /></td>
  </tr>
  <tr>
    <td colspan="3" align="center">可折叠文章目录</td>
  </tr>
  <tr>
    <td colspan="3"><img src="docs/screenshots/mobile-light-tags.png" /></td>
  </tr>
  <tr>
    <td colspan="3" align="center">标签云 + 评论</td>
  </tr>
</table>

## 特性

- 🎨 **明暗模式** — 支持访客手动切换，可选圆形扩散过渡动画
- 🌈 **OKLCH 单变量配色** — 30+ 主题预设，一键切换
- 🔤 **字体切换** — 系统 / Roboto / JetBrains Mono / MiSans / LXGW WenKai
- 📑 **原生文章目录** — 左侧 / 文内 / 双目录三种模式
- 🖼️ **图片预览器** — 灯箱、缩略图栏、EXIF 面板、原图打开
- 💎 **毛玻璃导航栏** — 滚动时模糊效果
- 📱 **移动端适配** — 响应式布局，触控友好

## 技术栈

Astro + Tailwind CSS 4 + Alpine.js

## 安装

从 [Releases](https://github.com/mufengyian/theme-earthquake/releases) 下载最新 ZIP，在 Halo Console **主题管理** 中上传启用。

**要求 Halo `>= 2.22.0`。**

## 推荐插件

均非必需，按需安装：

| 插件 | 用途 |
| --- | --- |
| [链接管理](https://www.halo.run/store/apps/app-hfbQg) | 友链页 |
| [图库管理](https://www.halo.run/store/apps/app-BmQJW) | 图库 / 照片详情 |
| [瞬间](https://www.halo.run/store/apps/app-SnwWD) | 瞬间列表和详情 |
| [Shiki 代码高亮](https://www.halo.run/store/apps/app-kzloktzn) | 代码块语法高亮 |

## 开发

```bash
git clone git@github.com:mufengyian/theme-earthquake.git
cd theme-earthquake
pnpm install
pnpm dev     # watch + rebuild
```

需要 Node.js `>= 22.13.0`、pnpm `11.8.0`。

| 命令 | 说明 |
| --- | --- |
| `pnpm run check` | 类型检查 + 静态构建 |
| `pnpm run build` | 构建 + 打包 |
| `pnpm run package` | 仅打包，产物在 dist/ |
| `pnpm run format` | Prettier 格式化 |

## 目录结构

```
src/
  assets/       样式、脚本、Alpine 数据
  components/   Astro 组件（SEO、导航、卡片等）
  layouts/      页面布局模板
pages/          路由页面
public/         静态资源（logo、封面等）
scripts/        构建辅助脚本
templates/      构建输出（勿手动修改）
dist/           打包产物
```

## 发布

1. 更新 `theme.yaml` 中的版本号
2. `pnpm run check` 确认通过
3. 推送到 main 分支，GitHub Actions 自动生成 Release

## 许可证

[GPL-3.0](./LICENSE)
