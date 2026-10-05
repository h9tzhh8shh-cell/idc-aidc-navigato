# IDC/AIDC 与算力租赁数据导航

最初改编自 Homer v26.08.3，2026-10-05 接入 React 来源检索工作台，包含 6 个研究分类、26 个来源与 25 条动态/报告/方法资料。新增东南亚六国专题，收录 11 个追踪来源和首批 9 条资料，支持国家筛选、项目阶段说明及订阅入口。支持关键词检索、研究方向/地区/信息类型/频率/获取条件组合筛选、来源详情和可分享的检索链接。原始 6 个分类保留在资料数据中，界面按 5 个研究方向组织检索。资料由人工维护；没有自动采集、后台、数据库、账号或价格历史图表。

线上访问：[IDC/AIDC 与算力租赁数据导航](https://idc-aidc-navigator.pages.dev/)。源码已托管在 GitHub，通过 Cloudflare Pages 构建发布；本地预览方式见下文。资料内容仍需人工核查和维护。

项目仓库：[h9tzhh8shh-cell/idc-aidc-navigato](https://github.com/h9tzhh8shh-cell/idc-aidc-navigato)。公开源码保留 Homer 组件和许可证，排除了本站未使用的上游 `dummy-data/` 模拟接口数据；本地上游副本不受影响。

## 立即预览

当前验收预览入口：<http://127.0.0.1:5050/>。仅当本机预览进程仍运行时有效。

若进程已停止，在项目目录双击 `start-preview.cmd`，或执行：

```powershell
node scripts/serve.mjs dist 5050
```

保持终端运行后在浏览器打开上述地址；按 Ctrl+C 停止。这个预览方式只需要已安装 Node.js，不需要重新安装依赖。端口已被本项目占用时直接访问现有入口，不重复启动。改用其他端口：`node scripts/serve.mjs dist 5051`。

**不能双击 `dist/index.html` 预览。** 资料通过 HTTP 加载。

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
- `src/domain/catalog.js`：保留的原始资料校验和分类规则。
- `docs/ui-asset-sources.json`：来源标识图片的出处。
- `dist/`：生产静态产物；可以独立部署。
- `docs/资料维护说明.md`：字段规则和完整操作说明。
- `docs/来源核查记录.md`：首批来源、报告和 39 条 URL 检查记录。
- `docs/验收记录.md`：实际执行结果及限制。
- `docs/UPSTREAM.md`：固定上游提交、真实复用模块与改动范围。

静态部署包保留 `dist/`、本地预览脚本、许可证和说明。将 **dist 目录内全部内容** 上传到任意普通静态 HTTP 服务的站点目录即可，勿只上传 index.html。本站部署在站点根目录；来源标识使用 `/assets/` 路径。无需服务端函数、数据库、登录密钥或构建时环境变量。

服务器应让 `index.html`、`assets/catalog.json` 和 `sw.js` 每次重新验证（建议 `Cache-Control: no-cache`）；带哈希的 resources 文件可长期缓存。本站不注册离线 Service Worker；保留自注销 sw.js 以迁移开发期间的 Homer 缓存，不再预缓存人工资料。

Cloudflare Pages 使用 `main` 生产分支，构建命令为 `pnpm validate && pnpm test && pnpm build`，输出目录为 `dist`，Node.js 版本为 24，pnpm 版本为 11.9.0。`public/_headers` 随构建复制到输出目录，控制首页和资料的缓存。连接 GitHub 后，每次向 `main` 推送会触发构建；构建成功后更新网站，失败时保留上一个成功版本。该流程仅发布已提交的内容，不会自动抓取行业资料。

GitHub Integration 工作流也会运行数据校验、测试及构建。上游 Docker Hub 和 Homer Release 工作流已限制为仅在上游仓库执行，避免在本项目误发布上游镜像或安装包。

维护推荐始终改 `public/assets/catalog.json`，检查后重新构建；不要只改 dist。所有静态文件公开可下载，勿写入账号、订阅凭证或未获授权的付费全文。资料中只保存自行概括的说明及公开原文链接。

## 一个完整维护示例

以下是首批已核查的 GDS 来源和关联报告（文档快照）。不是让你把已有 ID 再追加一遍；新增来源时按同一结构填写新事实和唯一 ID，修改现有来源时定位其 ID 更新。

1. 分类在 `categories` 维护 `id/name/question/icon`。例如运营分类使用稳定 ID `operating-demand`；改展示名无需改 ID。新增分类后，在来源的 `categoryIds` 关联它，第一项决定“全部来源”中的归组位置。当前检索方向的映射在 `src/catalog.js` 中维护。
2. 将下面来源对象放入 `sources`，将报告对象放入 `reports`；`report.sourceId` 必须等于来源 ID。同一来源跨两个分类只保存一条。
3. 发布日期是原文发布时间；`dataPeriod` 是资料描述的统计期；`verifiedAt` 仅在实际成功读取后更新。失败尝试更新 `lastCheckAttemptAt`、状态和说明，保留旧成功日或 null。`maintainedAt` 只表示目录维护批次。
4. 运行 `pnpm validate`、`pnpm test`、`pnpm build`，然后 HTTP 预览。更详细的状态和字段枚举见 [资料维护说明](docs/资料维护说明.md)。

来源：

```json
{
  "id": "gds-quarterly",
  "name": "万国数据季度业绩",
  "organization": "万国数据（GDS Holdings Limited）",
  "sourceType": "company",
  "categoryIds": [
    "operating-demand",
    "capacity-construction"
  ],
  "purpose": "跟踪公司运营面积、签约与收入，观察项目交付如何转为实际利用。",
  "questions": [
    "投运与使用面积增长是否匹配？",
    "签约、利用率和收入怎样变化？"
  ],
  "metrics": [
    "投运面积（平方米）",
    "已使用面积（平方米）",
    "签约及预签约面积",
    "面积利用率",
    "净收入",
    "调整后 EBITDA"
  ],
  "aliases": [
    "GDS",
    "万国数据",
    "上架率",
    "利用率",
    "utilization"
  ],
  "tags": [
    "公司披露",
    "容量",
    "需求兑现"
  ],
  "regions": [
    "中国"
  ],
  "frequency": "quarterly",
  "frequencyNote": "按季度披露财务和期末运营指标；业绩会材料随季度更新。",
  "access": "free",
  "accessNote": "投资者关系网站公开提供业绩公告、演示文稿和会议文字稿。",
  "entryUrl": "https://investors.gds-services.com/financial-information/quarterly-results",
  "entryType": "栏目",
  "methodologyUrl": "https://investors.gds-services.com/system/files-encrypted/nasdaq_kms/assets/2026/08/13/7-36-49/GDS%202Q26%20Earnings%20Release_0813%201200.pdf",
  "caveats": [
    "利用率按已使用面积除以投运面积计算；上架率仅为检索别名，不能直接等同机柜上架率或 GPU 利用率。",
    "签约及预签约面积不等于已经开始计费的使用面积。",
    "不能与 VNET 的 MW 或机柜分母直接横向比较；调整后 EBITDA 属非 GAAP 指标。"
  ],
  "featured": true,
  "verifiedAt": "2026-10-04",
  "verificationStatus": "verified",
  "verificationNote": "已读取季度栏目及从栏目进入的 2026 年第二季度业绩 PDF，核对发布日期与利用率定义。",
  "lastCheckAttemptAt": "2026-10-04"
}
```

报告：

```json
{
  "id": "gds-2026-q2",
  "sourceId": "gds-quarterly",
  "title": "GDS Holdings Limited Reports Second Quarter 2026 Results",
  "url": "https://investors.gds-services.com/system/files-encrypted/nasdaq_kms/assets/2026/08/13/7-36-49/GDS%202Q26%20Earnings%20Release_0813%201200.pdf",
  "kind": "report",
  "publishedAt": "2026-08-13",
  "dataPeriod": "2026 年第二季度；运营指标截至 2026-06-30",
  "summary": "公司季度财务及运营披露，包含投运、签约和使用面积及利用率定义。",
  "verifiedAt": "2026-10-04",
  "verificationStatus": "verified",
  "verificationNote": "从官方季度栏目进入 PDF；正文第 2 页载明发布日期、所属季度及利用率定义。"
}
```

## 资料限制

12 个来源已核查原文，SMM 周报与 Mysteel 为部分核查，信通院栏目暂不可达；16 条资料中 11 条已读原文、5 条部分核查。部分核查不等于死链，搜索摘要也不视为原文。未知发布日期保留 null；列表是人工样本，不宣称全网最新。请结合各条来源的口径和获取说明使用。

## 许可证

保留 Homer 的 Apache-2.0 LICENSE 与本次 NOTICE；依赖的许可证副本见 public/licenses，构建后也随静态文件交付。原上游 README 保存在 docs/HOMER_README.md。
