import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../src/domain/catalog.js";

const filename = fileURLToPath(
  new URL("../public/assets/catalog.json", import.meta.url),
);
const initialCategoryIds = [
  "rental-prices",
  "capacity-construction",
  "operating-demand",
  "activity-demand",
  "servers-hardware",
  "market-technology",
];
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
    console.log(
      `资料校验通过：${catalog.categories.length} 个分类、${catalog.sources.length} 个来源、${catalog.reports.length} 篇报告。`,
    );
    const categoryIds = new Set(
      catalog.categories.map((category) => category.id),
    );
    const sourceIds = new Set(catalog.sources.map((source) => source.id));
    const missingCategories = initialCategoryIds.filter(
      (id) => !categoryIds.has(id),
    );
    const missingSources = initialSourceIds.filter((id) => !sourceIds.has(id));
    if (missingCategories.length || missingSources.length) {
      console.warn(
        `首批清单提醒：缺少分类 [${missingCategories.join(", ")}]；缺少来源 [${missingSources.join(", ")}]。删除或替换需在交付说明解释。`,
      );
    }
    const withoutReports = catalog.sources.filter(
      (source) =>
        !catalog.reports.some((report) => report.sourceId === source.id),
    );
    if (withoutReports.length)
      console.log(
        `暂未收录具体报告：${withoutReports.map((source) => source.name).join("、")}。`,
      );
    console.log(
      "本命令检查结构、关联、日期与 HTTPS 格式；不检查远端可达性，不代表链接已成功核查。",
    );
  }
} catch (error) {
  console.error(`无法读取资料文件 ${filename}：${error.message}`);
  process.exitCode = 1;
}
