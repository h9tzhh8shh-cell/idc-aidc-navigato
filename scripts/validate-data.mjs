import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../src/domain/catalog.js";

const filename = fileURLToPath(
  new URL("../public/assets/catalog.json", import.meta.url),
);
const initialSourceIds = [
  "smm-rental",
  "smm-weekly",
  "mysteel-computing",
  "ornn-gpu",
  "semianalysis-gpu",
  "nda-capacity",
  "cbre-datacenter",
  "gds-quarterly",
  "vnet-quarterly",
  "nea-electricity",
  "synergy-cloud",
  "idc-server",
  "kz-market",
  "caict-computing",
  "nda-digital-china",
];

try {
  const catalog = JSON.parse(await readFile(filename, "utf8"));
  const errors = validateCatalog(catalog);
  if (errors.length) {
    console.error(
      `资料校验失败（${errors.length} 项）：\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exitCode = 1;
  } else {
    const activeSources = catalog.sources.filter(source => source.visibility === "active" && !source.duplicateOf);
    const activeReports = catalog.reports.filter(report => report.visibility === "active" && !report.duplicateOf);
    console.log(
      `资料校验通过：${catalog.categories.length} 个分类；活跃 ${activeSources.length} 个来源、${activeReports.length} 篇资料；含历史/参考共 ${catalog.sources.length} 个来源、${catalog.reports.length} 篇资料。`,
    );
    const sourceIds = new Set(catalog.sources.map((source) => source.id));
    const missingSources = initialSourceIds.filter((id) => !sourceIds.has(id));
    if (missingSources.length) {
      console.warn(
        `历史身份提醒：缺少来源 [${missingSources.join(", ")}]。归档来源也应保留稳定 ID；删除或替换需在交付说明解释。`,
      );
    }
    if (catalog.categories.length !== 5) console.warn("确认范围为五类；请核对 catalog.json 分类字典及迁移说明。");
    const withoutReports = activeSources.filter(
      (source) =>
        !activeReports.some((report) => report.sourceId === source.id),
    );
    if (withoutReports.length)
      console.log(
        `暂未收录正式资料的活跃来源：${withoutReports.map((source) => source.name).join("、")}。`,
      );
    console.log(
      "本命令检查结构、关联、日期与 HTTPS 格式；不检查远端可达性，不代表链接已成功核查。",
    );
    const byUrl = new Map();
    for (const report of catalog.reports) {
      const records = byUrl.get(report.url) || [];
      records.push(report);
      byUrl.set(report.url, records);
    }
    for (const [url, records] of byUrl) if (records.length > 1) {
      console.warn(`同址资料复核提示（不自动合并）：${records.map(record => `${record.id} [${record.kind}, ${record.publishedAt || "未知日期"}]`).join("；")}；${url}`);
    }
  }
} catch (error) {
  console.error(`无法读取资料文件 ${filename}：${error.message}`);
  process.exitCode = 1;
}
