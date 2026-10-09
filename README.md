# IDC/AIDC 与算力租赁数据导航

最初改编自 Homer v26.08.3，2026-10-05 接入 React 来源检索工作台。当前本地优化版本采用 schema 2 与统一五类：行业供需与动态、算力租赁与价格、政策与规划、监管与合规、同业上市公司动态。裸首页默认国内，可切换全部地区及东南亚六国；来源行直接显示符合当前条件的近期资料标题、发布日期和中文摘要。支持资料自身分类/地区/获取条件、公司主体检索、组合筛选、补充参考开关及旧检索链接兼容。资料由人工维护，没有自动采集、后台、数据库、账号或价格历史图表。

线上访问：[IDC/AIDC 与算力租赁数据导航](https://idc-aidc-navigator.pages.dev/)。源码已托管在 GitHub，通过 Cloudflare Pages 构建发布；本地预览方式见下文。资料内容仍需人工核查和维护。

项目仓库：[h9tzhh8shh-cell/idc-aidc-navigato](https://github.com/h9tzhh8shh-cell/idc-aidc-navigato)。公开源码保留 Homer 组件和许可证，排除了本站未使用的上游 `dummy-data/` 模拟接口数据；本地上游副本不受影响。

## 立即预览

当前验收预览入口：<http://127.0.0.1:5050/>。仅当本机预览进程仍运行时有效。

若进程已停止，在项目目录双击 `start-preview.cmd`，或执行：

```powershell
node scripts/serve.mjs dist 5050
```

保持终端运行后在浏览器打开上述地址；按 Ctrl+C 停止。这个预览方式只需要已安装 Node.js，不需要重新安装依赖。端口已被本项目占用时直接访问现有入口，不重复启动。改用其他端口：`node scripts/serve.mjs dist 5051`。

**不能双击 `dist/index.html` 预览。** 使用 HTTP 服务；资料在构建时静态导入，修改源 JSON 后须重新构建才能验收页面。

## 开发、检查与构建

建议 Node.js 24 LTS。实测环境是 Node.js v24.16.0、pnpm v11.19.0；保留 pnpm 11.9.0 packageManager 声明，锁文件已随 React 工作台更新。

```powershell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
pnpm validate
pnpm test
pnpm build
pnpm preview --host 127.0.0.1 --strictPort
```

以命令实际打印的开发地址为准；`pnpm preview` 默认为 5050。界面使用 React 19 和 Vite，构建结果仍是静态文件。当前完整克隆已有依赖，源码 ZIP 为减少体积不含 `node_modules`，解压后需先安装。

`pnpm validate` 检查必填字段、枚举、真实日历日期、唯一 ID、来源/报告关联及 HTTPS 格式。它不会自动确认网页可访问。`pnpm test` 覆盖组合筛选、同义词、跨分类去重、未知日期排序和数据关联。

## 文件与部署

- `public/assets/catalog.json`：**唯一需要手工维护的资料文件**。
- `src/App.jsx`、`src/components.jsx`、`src/styles.css`：正式站点的 React 检索工作台。
- `src/catalog.js`：组合筛选、文章地区、排序和检索链接状态。
- `src/domain/catalog.js`：schema 2 资料校验与共用枚举。
- `docs/ui-asset-sources.json`：来源标识图片的出处。
- `dist/`：生产静态产物；可以独立部署。
- `docs/资料维护说明.md`：字段规则和完整操作说明。
- `docs/来源核查记录.md`：逐批追加的来源、资料、准入与失败核查历史。
- `docs/按需更新指令.md`：用户主动触发时使用的资料更新模板；文件本身不构成发布授权。
- `docs/验收记录.md`：实际执行结果及限制。
- `docs/UPSTREAM.md`：固定上游提交、真实复用模块与改动范围。

静态部署包保留 `dist/`、本地预览脚本、许可证和说明。将 **dist 目录内全部内容** 上传到任意普通静态 HTTP 服务的站点目录即可，勿只上传 index.html。本站部署在站点根目录；来源标识使用 `/assets/` 路径。无需服务端函数、数据库、登录密钥或构建时环境变量。

服务器应让 `index.html`、`assets/catalog.json` 和 `sw.js` 每次重新验证（建议 `Cache-Control: no-cache`）；带哈希的 resources 文件可长期缓存。本站不注册离线 Service Worker；保留自注销 sw.js 以迁移开发期间的 Homer 缓存，不再预缓存人工资料。

Cloudflare Pages 使用 `main` 生产分支，构建命令为 `pnpm validate && pnpm test && pnpm build`，输出目录为 `dist`，Node.js 版本为 24，pnpm 版本为 11.9.0。`public/_headers` 随构建复制到输出目录，控制首页和资料的缓存。连接 GitHub 后，每次向 `main` 推送会触发构建；构建成功后更新网站，失败时保留上一个成功版本。该流程仅发布已提交的内容，不会自动抓取行业资料。

GitHub Integration 工作流也会运行数据校验、测试及构建。上游 Docker Hub 和 Homer Release 工作流已限制为仅在上游仓库执行，避免在本项目误发布上游镜像或安装包。

维护推荐始终改 `public/assets/catalog.json`，检查后重新构建；不要只改 dist。所有静态文件公开可下载，勿写入账号、订阅凭证或未获授权的付费全文。资料中只保存自行概括的说明及公开原文链接。

## 维护入口与范围

唯一编辑入口是 `public/assets/catalog.json`。字段、分类边界、日期、展示状态和去重规则见 [资料维护说明](docs/资料维护说明.md)，后续用户主动更新可使用 [按需更新指令](docs/按需更新指令.md)。

1. 按稳定 ID 修改或新增来源/资料。来源可覆盖多类，每篇资料只填一个主分类，独立填写地区、访问条件、取得范围和发布机构；不复制旧 GDS/VNET 季度材料。
2. 六家核心公司为光环新网、行云科技、世纪互联、协创数据、万国数据、东阳光；另有中国移动、中国电信、中国联通入口。主体、集团与上市代码分别核查，现有海外资料保留。
3. SMM 算力行情保留；订阅周报与未核历史周评归档，旧 ID 和核查历史保留，补充参考开关不会恢复归档产品。中金、国金及备用招商仅按实际验证准入，不把候选当已接入。
4. 追加核查记录，运行校验、测试、构建并检查 HTTP 页面。`src/catalog.js` 构建时导入 JSON，**只替换 `dist/assets/catalog.json` 不会更新已打包界面**。

本轮优化执行阶段 0—4；未经独立发布授权，不推送生产分支或部署。仓库描述的既有 Cloudflare 链路以及文档内未来更新模板，都不代替当前发布授权。

## 资料限制

人工目录是有限样本，不宣称全网最新。可读通知或报告介绍不等于已读附件或完整报告；部分核查与网络失败分别保留，未知发布日期为 null。媒体样例有原站版权限制时只提供必要书目信息及原文链接。未取得正文的线索默认作为补充参考，归档历史不进入活跃计数。实际新增、修订和未覆盖范围以 [来源核查记录](docs/来源核查记录.md) 最新批次为准。

## 许可证

保留 Homer 的 Apache-2.0 LICENSE 与本次 NOTICE；依赖的许可证副本见 public/licenses，构建后也随静态文件交付。原上游 README 保存在 docs/HOMER_README.md。


## 二期本地候选补充 · 2026-10-08

本轮仅实现并验收本地二期，不授权推送或部署。一级五类与 schemaVersion=2 保留；新增 13 子方向、固定公司入口、跨分类公司全景、事件节点和核查范围。目录仍为唯一维护入口 public/assets/catalog.json。当前 47 来源（45 正式）、54 资料（48 正式、5 参考、1 归档）、16 公司、7 事项。

普通来源/资料过滤保持严格主类；只选同业时默认按公司，来源/资料列表仍可切回。事件事实独立于新闻、免费等资料过滤。参照 docs/资料维护说明.md、docs/按需更新指令.md。东阳光后续重组较新附件待核；不要把前序平台交割当作上市公司后续重组交割。

新增 scripts/reviewed-batch.mjs 仅用于已人工核查 JSON 批次的本地合并与隔离验收，无联网、自动采集、定时任务或部署能力。新测试在 tests/phase2*.test.mjs；pnpm validate / pnpm test / pnpm build。
# 第三轮本地候选说明（2026-10-09）

动态页支持原文全部/近7天/近30天/日期未知，分享链接保留截至日；“按更新批次”独立查看历史补录、修订及证据补核。公司事项当前状态不受资料时间窗口影响。资料完整口径在可展开详情中，筛选解释集中在“筛选规则”。

本轮为本地候选，未推送或部署。依项目既有流程运行 `pnpm validate`、`pnpm test`、`pnpm build`，再以 `node scripts/serve.mjs dist 5057` 打开本机HTTP预览。正式发布仍须当次独立授权。人工更新的批次语义及失败保护见 [资料维护说明](docs/资料维护说明.md) 和 [按需更新指令](docs/按需更新指令.md)。
