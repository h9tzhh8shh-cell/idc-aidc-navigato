# 上游版本与实际复用

本项目从真实 Homer 仓库克隆并修改，并非从零制作同名页面。

- 上游：https://github.com/bastienwirtz/homer
- 固定版本：`v26.08.3`，GitHub 发布记录显示 2026-08-30。
- 完整提交：`daa017dfe1ea8d0875697aede091319b6134bb4b`，已通过本地 `git rev-parse HEAD` 复核。
- 发布记录：https://github.com/bastienwirtz/homer/releases/tag/v26.08.3
- 保持任务书指定版本，没有升级到滚动主分支。发布记录中的服务请求头修复和其他集成改动与本静态行业目录没有新增依赖关系。
- Apache-2.0：原始 `LICENSE` 完整保留；该提交没有上游 `NOTICE`，本地添加改动说明 `NOTICE`。
- 本次环境：Windows、Node.js v24.16.0、pnpm v11.19.0；上游 packageManager 字段仍保留其 pnpm 11.9.0 固定声明。环境提供的 pnpm 包装器实际运行 11.19.0；使用 `--frozen-lockfile` 安装，未升级依赖锁文件。

## 真实运行中的复用

| 文件或机制 | 复用情况 |
|---|---|
| `src/main.js` | 沿用 Vue 挂载入口、Generic 全局注册、DynamicStyle 注册；追加行业样式导入。 |
| `src/components/ServiceGroup.vue` | 原文件不改，实际用于六分类分组和 Bulma 响应式列布局。 |
| `src/components/GroupHeader.vue` | 原文件不改，实际渲染分类标题与图标。 |
| `src/components/Service.vue` | 原文件不改，按 `item.type` 动态加载新增 IndustrySource 卡片。 |
| `src/components/services/Generic.vue` | 原文件不改，通过 icon/content 插槽渲染来源标题、机构及原始栏目链接。详情按钮位于 Generic 链接之外，避免嵌套交互元素。 |
| `src/components/SearchInput.vue` | 延用搜索事件、URL 参数和 `/` 快捷键；新增中文标签与输入法保护，修正监听器解绑，在弹窗和其他表单输入中不劫持按键。 |
| `src/components/DarkMode.vue` | 延用浅色、深色、系统跟随和本地保存；将不可键盘操作的无 href 链接改成 button，中文化可访问名称。 |
| `src/assets/app.scss` 及 theme/base 文件 | 原文件不改，保留 Bulma、图标、基础样式与主题变量；新 `industry.css` 定向覆盖行业界面。 |
| `vite.config.js`、`pnpm-lock.yaml` | 延用 Vite/Vue 静态构建、资源目录和相对 base；锁文件不改。调整 manifest 标题；PWA 改为 selfDestroying，注销旧缓存以避免人工维护内容被旧构建覆盖。 |

## 改动范围

`src/App.vue` 改为行业视图入口；上游原根组件可从固定提交恢复。新增 `IndustryNavigator.vue`、`SourceDetails.vue`、`ReportEntry.vue`、`services/IndustrySource.vue`、`src/domain/catalog.js` 与 `src/assets/industry.css`。修改 `index.html` 的语言与页面信息，`package.json` 仅增加校验/测试命令和改版说明。

新增唯一资料入口 `public/assets/catalog.json`、数据校验脚本、风险测试、独立静态 HTTP 预览脚本和中文文档。其他上游服务组件、示例 YAML、Docker 文件和开发文档保留在源码中；本行业界面不启用它们，也不调用其运行监控 API。旧 YAML 示例不是本站资料维护入口。

## 构建说明

先验证上游根页面构建流程，再接入行业视图；最终生产构建通过。保留的上游 Generic/_error 动态加载会产生两条 `INEFFECTIVE_DYNAMIC_IMPORT` 提示，含义是相关组件同时静态导入，不能再分离成独立块；不影响构建与功能。未为消除无关提示而重写上游服务系统。

本地克隆目录保留 Git 元数据以便比较上游；源码 ZIP 不含 `.git`、`node_modules`、`work` 和 `dist`，另交付静态构建 ZIP。未创建远程仓库，未推送或线上发布。
