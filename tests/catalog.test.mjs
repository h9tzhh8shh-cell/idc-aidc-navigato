import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SEA_REGIONS,
  filterSeaReports,
  filterSeaSources,
  filterSources,
  frequencyLabels,
  groupSources,
  kindLabels,
  sortReports,
  sourceTypeLabels,
  validateCatalog,
} from "../src/domain/catalog.js";

const categories = [
  {
    id: "rental-prices",
    name: "租赁价格",
    question: "租金如何？",
    icon: "fa-coins",
  },
  {
    id: "activity-demand",
    name: "运行活动",
    question: "用电如何？",
    icon: "fa-bolt",
  },
];
function source(overrides = {}) {
  return {
    id: "sample-rental",
    name: "SMM 算力行情",
    organization: "示例机构",
    sourceType: "commercial",
    categoryIds: ["rental-prices"],
    purpose: "查询卡型价格",
    questions: ["H100 租金如何？"],
    metrics: ["挂牌价格"],
    aliases: ["GPU 租赁", "算力租赁"],
    tags: ["租赁"],
    regions: ["中国"],
    frequency: "daily",
    frequencyNote: "工作日发布",
    access: "mixed",
    accessNote: "摘要公开，明细收费",
    entryUrl: "https://example.com/prices",
    methodologyUrl: null,
    caveats: ["挂牌价不等于成交价"],
    featured: true,
    verifiedAt: "2026-10-04",
    verificationStatus: "verified",
    verificationNote: "已读取栏目",
    lastCheckAttemptAt: "2026-10-04",
    ...overrides,
  };
}
function report(overrides = {}) {
  return {
    id: "sample-report",
    sourceId: "sample-rental",
    title: "价格口径说明",
    url: "https://example.com/methodology",
    kind: "methodology",
    publishedAt: "2026-09-02",
    dataPeriod: null,
    summary: "说明报价范围与单位",
    verifiedAt: "2026-10-04",
    verificationStatus: "verified",
    verificationNote: "已读取原文",
    ...overrides,
  };
}
function catalog(overrides = {}) {
  return {
    schemaVersion: 1,
    title: "测试目录",
    maintainedAt: "2026-10-04",
    categories,
    sources: [source()],
    reports: [report()],
    ...overrides,
  };
}

test("所有筛选维度共同生效，不把相同关键词的异地或异频来源混入", () => {
  const sources = [
    source({
      id: "china-monthly",
      categoryIds: ["activity-demand"],
      frequency: "monthly",
      access: "free",
    }),
    source({
      id: "china-daily",
      categoryIds: ["activity-demand"],
      access: "free",
    }),
    source({
      id: "global-monthly",
      categoryIds: ["activity-demand"],
      regions: ["全球"],
      frequency: "monthly",
      access: "free",
    }),
    source({
      id: "paid-monthly",
      categoryIds: ["activity-demand"],
      frequency: "monthly",
      access: "paid",
    }),
    source({ id: "other-category", frequency: "monthly", access: "free" }),
  ];
  assert.deepEqual(
    filterSources(sources, {
      query: "SMM",
      category: "activity-demand",
      region: "中国",
      frequency: "monthly",
      access: "free",
    }).map((item) => item.id),
    ["china-monthly"],
  );
  assert.equal(filterSources(sources, {}).length, 5);
  assert.equal(filterSources(sources, { query: "不存在的指标" }).length, 0);
});

test("搜索忽略首尾空格和英文大小写，使用已录入别名并覆盖口径说明", () => {
  const sources = [source()];
  assert.equal(filterSources(sources, { query: "  smm  " }).length, 1);
  assert.equal(filterSources(sources, { query: "  gpu   租赁 " }).length, 1);
  assert.equal(filterSources(sources, { query: "h100" }).length, 1);
  assert.equal(
    filterSources(sources, { query: "挂牌价不等于成交价" }).length,
    1,
  );
  assert.equal(filterSources(sources, { query: "工作日" }).length, 1);
  assert.equal(filterSources(sources, { query: "中国" }).length, 1);
  assert.equal(filterSources(sources, { query: "GPU 利用率" }).length, 0);
});

test("同维度多选为 OR，来源的年度频率不被报告所属期替换", () => {
  const sources = [
    source({ frequency: "annual" }),
    source({ id: "monthly", frequency: "monthly" }),
  ];
  assert.equal(
    filterSources(sources, { frequency: ["annual", "monthly"], region: "中国" })
      .length,
    2,
  );
  assert.deepEqual(
    filterSources(sources, { frequency: "monthly" }).map((item) => item.id),
    ["monthly"],
  );
});

test("跨分类来源在总览只展示一次，选中其次级分类后仍可找到", () => {
  const crossCategory = source({
    categoryIds: ["rental-prices", "activity-demand"],
  });
  const sources = [
    crossCategory,
    source({ id: "power", categoryIds: ["activity-demand"] }),
  ];
  const all = groupSources(sources, categories);
  assert.deepEqual(
    all.flatMap((group) => group.items.map((item) => item.id)),
    ["sample-rental", "power"],
  );
  const selected = groupSources(sources, categories, "activity-demand");
  assert.equal(selected.length, 1);
  assert.deepEqual(
    selected[0].items.map((item) => item.id),
    ["sample-rental", "power"],
  );
  assert.equal(groupSources(sources, categories, "missing-category").length, 0);
});

test("报告按发布日期倒序、未知日期末置，不修改数据原数组", () => {
  const reports = [
    report({ id: "unknown", publishedAt: null }),
    report({ id: "old", publishedAt: "2025-12-31" }),
    report({ id: "new", publishedAt: "2026-10-01" }),
    report({ id: "unknown-two", publishedAt: null }),
  ];
  assert.deepEqual(
    sortReports(reports).map((item) => item.id),
    ["new", "old", "unknown", "unknown-two"],
  );
  assert.deepEqual(
    reports.map((item) => item.id),
    ["unknown", "old", "new", "unknown-two"],
  );
});

test("东南亚来源只收录专题标签，国家筛选按来源覆盖范围生效", () => {
  const sources = [
    source({
      id: "regional",
      tags: ["东南亚专题"],
      regions: ["新加坡", "马来西亚"],
    }),
    source({ id: "untagged", regions: ["马来西亚"] }),
    source({
      id: "thailand",
      tags: ["东南亚专题"],
      regions: ["泰国"],
    }),
  ];
  assert.deepEqual(
    filterSeaSources(sources).map((item) => item.id),
    ["regional", "thailand"],
  );
  assert.deepEqual(
    filterSeaSources(sources, "马来西亚").map((item) => item.id),
    ["regional"],
  );
  assert.deepEqual(filterSeaSources(sources, "越南"), []);
});

test("东南亚动态按文章国家筛选，不继承跨国来源覆盖范围，未知日期后置", () => {
  const sources = [
    source({
      id: "regional",
      tags: ["东南亚专题"],
      regions: [...SEA_REGIONS],
    }),
    source({ id: "untagged", regions: ["马来西亚"] }),
  ];
  const reports = [
    report({
      id: "unknown-date",
      sourceId: "regional",
      regions: ["马来西亚"],
      publishedAt: null,
    }),
    report({
      id: "singapore",
      sourceId: "regional",
      regions: ["新加坡"],
      publishedAt: "2026-10-02",
    }),
    report({ id: "legacy-no-regions", sourceId: "regional" }),
    report({ id: "outside-sea", sourceId: "regional", regions: ["美国"] }),
    report({
      id: "malaysia",
      sourceId: "regional",
      regions: ["马来西亚"],
      publishedAt: "2026-10-01",
    }),
    report({ id: "untracked", sourceId: "untagged", regions: ["马来西亚"] }),
  ];
  assert.deepEqual(
    filterSeaReports(reports, sources).map((item) => item.id),
    ["singapore", "malaysia", "unknown-date"],
  );
  assert.deepEqual(
    filterSeaReports(reports, sources, "马来西亚").map((item) => item.id),
    ["malaysia", "unknown-date"],
  );
  assert.deepEqual(filterSeaReports(reports, sources, "越南"), []);
  assert.equal(reports[0].id, "unknown-date");
});

test("版本 1 兼容旧记录，支持媒体、半年频率、订阅说明和带国家阶段的新闻", () => {
  assert.deepEqual(validateCatalog(catalog()), []);
  assert.deepEqual(SEA_REGIONS, [
    "新加坡",
    "马来西亚",
    "泰国",
    "印尼",
    "越南",
    "菲律宾",
  ]);
  assert.ok(Object.isFrozen(SEA_REGIONS));
  assert.equal(frequencyLabels.semiannual, "半年");
  assert.equal(kindLabels.news, "新闻动态");
  assert.equal(sourceTypeLabels.media, "行业媒体");
  for (const subscriptionUrl of [null, "https://example.com/subscribe"]) {
    assert.deepEqual(
      validateCatalog(
        catalog({
          sources: [
            source({
              sourceType: "media",
              frequency: "semiannual",
              subscriptionUrl,
              trackingNote: "建议每周查看",
              subscriptionNote: "提供公开邮件订阅入口",
            }),
          ],
          reports: [
            report({ kind: "news", regions: ["越南"], stage: "可研阶段" }),
          ],
        }),
      ),
      [],
    );
  }
});

test("新闻缺少国家或阶段不能通过校验，新增可选字段仍约束类型与链接", () => {
  for (const overrides of [
    {},
    { regions: [] },
    { regions: "越南" },
    { regions: ["越南", "越南"] },
  ]) {
    const errors = validateCatalog(
      catalog({
        reports: [report({ kind: "news", stage: "可研", ...overrides })],
      }),
    );
    assert.ok(errors.some((error) => error.includes("regions")));
  }
  for (const stage of [undefined, "", null, 42]) {
    const errors = validateCatalog(
      catalog({
        reports: [report({ kind: "news", regions: ["越南"], stage })],
      }),
    );
    assert.ok(errors.some((error) => error.includes("stage")));
  }
  const errors = validateCatalog(
    catalog({
      sources: [
        source({
          subscriptionUrl: "http://example.com/subscribe",
          trackingNote: [],
          subscriptionNote: null,
        }),
      ],
      reports: [report({ regions: "越南", stage: 42 })],
    }),
  );
  for (const field of [
    "subscriptionUrl",
    "trackingNote",
    "subscriptionNote",
    "regions",
    "stage",
  ])
    assert.ok(
      errors.some((error) => error.includes(field)),
      field,
    );
  assert.ok(
    validateCatalog(
      catalog({ sources: [source({ subscriptionUrl: "" })] }),
    ).some((error) => error.includes("subscriptionUrl")),
  );
});

test("允许未知发布日期与历史成功日期，不把失败尝试写成成功核查", () => {
  assert.deepEqual(
    validateCatalog(
      catalog({
        sources: [
          source({
            verificationStatus: "unreachable",
            verifiedAt: "2026-09-01",
            verificationNote: "本次网络受限",
          }),
        ],
        reports: [report({ publishedAt: null })],
      }),
    ),
    [],
  );
  assert.deepEqual(
    validateCatalog(
      catalog({
        sources: [
          source({
            verificationStatus: "partial",
            verifiedAt: null,
            verificationNote: "仅见搜索摘要，正文未读取",
          }),
        ],
      }),
    ),
    [],
  );
});

test("拒绝并不存在的日历日期、未来日期和混淆的核查时间", () => {
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-1-01",
    "2026-10-05",
  ]) {
    const errors = validateCatalog(
      catalog({ reports: [report({ publishedAt: date })] }),
      { today: "2026-10-04" },
    );
    assert.ok(
      errors.some((error) => error.includes("publishedAt")),
      date,
    );
  }
  assert.ok(
    validateCatalog(
      catalog({ sources: [source({ lastCheckAttemptAt: "2026-10-01" })] }),
    ).some((error) => error.includes("lastCheckAttemptAt")),
  );
  assert.ok(
    validateCatalog(
      catalog({
        sources: [
          source({
            verificationStatus: "unverified",
            verificationNote: "未核查",
          }),
        ],
      }),
    ).some((error) => error.includes("必须为 null")),
  );
  assert.ok(
    validateCatalog(catalog({ reports: [report({ verifiedAt: null })] })).some(
      (error) => error.includes("成功核查日期"),
    ),
  );
});

test("拒绝重复 ID、孤立报告和无效分类引用", () => {
  const errors = validateCatalog(
    catalog({
      sources: [source(), source({ categoryIds: ["missing"] })],
      reports: [report({ sourceId: "does-not-exist" })],
    }),
  );
  assert.ok(errors.some((error) => error.includes("重复 ID")));
  assert.ok(errors.some((error) => error.includes("未知分类")));
  assert.ok(errors.some((error) => error.includes("未知来源")));
});

test("拒绝缺字段、未知枚举和非 HTTPS 入口", () => {
  const incomplete = source({
    entryUrl: "javascript:alert(1)",
    frequency: "sometimes",
    featured: "yes",
  });
  delete incomplete.metrics;
  const errors = validateCatalog(catalog({ sources: [incomplete] }));
  for (const field of ["metrics", "entryUrl", "frequency", "featured"]) {
    assert.ok(
      errors.some((error) => error.includes(field)),
      field,
    );
  }
  assert.ok(
    validateCatalog(
      catalog({ reports: [report({ url: "http://example.com/report" })] }),
    ).some((error) => error.includes("HTTPS")),
  );
  assert.ok(
    validateCatalog(catalog({ categories: null })).some((error) =>
      error.includes("必须为数组"),
    ),
  );
});

test("正式资料保持验收关键词、来源关联、唯一计数与未知发布日期后置", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../public/assets/catalog.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(validateCatalog(data), []);
  const rentalIds = [
    "smm-rental",
    "smm-weekly",
    "mysteel-computing",
    "ornn-gpu",
    "semianalysis-gpu",
  ];
  for (const query of ["H100", "GPU租赁", "算力租赁"]) {
    const matches = new Set(
      filterSources(data.sources, { query }).map((item) => item.id),
    );
    for (const id of rentalIds)
      assert.ok(matches.has(id), `${query} 应找到 ${id}`);
  }
  const smmIds = new Set(
    filterSources(data.sources, { query: "  smm  " }).map((item) => item.id),
  );
  for (const id of ["smm-rental", "smm-weekly"]) assert.ok(smmIds.has(id));
  const operatingIds = new Set(
    filterSources(data.sources, { query: "上架率" }).map((item) => item.id),
  );
  for (const id of ["gds-quarterly", "vnet-quarterly"])
    assert.ok(operatingIds.has(id));
  const monthlyChinaIds = new Set(
    filterSources(data.sources, { region: "中国", frequency: "monthly" }).map(
      (item) => item.id,
    ),
  );
  assert.ok(monthlyChinaIds.has("nea-electricity"));
  const displayedIds = groupSources(data.sources, data.categories).flatMap(
    (group) => group.items.map((item) => item.id),
  );
  assert.equal(displayedIds.length, data.sources.length);
  assert.equal(new Set(displayedIds).size, data.sources.length);
  const originalSourceIds = [
    ...rentalIds,
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
  for (const id of originalSourceIds) {
    assert.ok(
      data.sources.some((item) => item.id === id),
      `保留原来源 ${id}`,
    );
    assert.ok(
      data.reports.some((item) => item.sourceId === id),
      `保留原来源的报告 ${id}`,
    );
  }
  const sorted = sortReports(data.reports);
  const unknownIndex = sorted.findIndex((item) => item.publishedAt === null);
  if (unknownIndex >= 0)
    assert.ok(
      sorted.slice(unknownIndex).every((item) => item.publishedAt === null),
    );
  const dates = sorted
    .filter((item) => item.publishedAt !== null)
    .map((item) => item.publishedAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
});
