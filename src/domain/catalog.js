/** Source frequencies and report periods are maintained independently. */
export const frequencyLabels = Object.freeze({
  daily: "日度",
  weekly: "周度",
  monthly: "月度",
  quarterly: "季度",
  semiannual: "半年",
  annual: "年度",
  irregular: "不定期",
  unknown: "待核查",
});

export const accessLabels = Object.freeze({
  free: "免费公开",
  registration: "需注册",
  mixed: "公开与受限并存",
  paid: "付费",
  unknown: "待核查",
});

export const statusLabels = Object.freeze({
  verified: "已核查",
  partial: "部分核查",
  unverified: "未核查",
  unreachable: "暂不可达",
});

export const kindLabels = Object.freeze({
  news: "新闻报道",
  report: "机构研究报告",
  "broker-report": "券商研报",
  disclosure: "公司披露",
  policy: "政策文件",
  regulation: "监管文件",
  "data-release": "数据发布",
  methodology: "方法说明",
});

export const contentScopeLabels = Object.freeze({
  full: "全文", abstract: "原站公开摘要", partial: "部分正文",
  title: "标题/目录", "search-snippet": "搜索摘要", unavailable: "未取得",
});
export const judgmentLabels = Object.freeze({ fact: "事实陈述", opinion: "研究观点", forecast: "预测" });
export const visibilityLabels = Object.freeze({ active: "正式资料", reference: "补充参考", archived: "已归档" });
export const eventTypeLabels = Object.freeze({ acquisition: '并购 / 重大投资', capital: '融资 / 资产交易', contract: '重大合同 / 业务合作', risk: '重要风险 / 监管事项' });
export const evidenceLevelLabels = Object.freeze({ 'official-body': '官方披露正文已核', 'disclosure-paper': '指定披露报刊所载公告已读', 'third-party-mirror': '第三方镜像已读，指定披露同件待核', media: '媒体转述', lead: '仅目录 / 检索线索', pending: '待核' });
export const changeKindLabels = Object.freeze({ 'new-record': '新收录', historical: '历史补录', 'event-node': '事项新节点', revision: '信息修订', evidence: '证据补核' });
export const reviewResultLabels = Object.freeze({ progress: '发现已核进展', 'no-new': '限定范围未确认新增', partial: '核查部分完成', blocked: '核查受阻', 'not-checked': '尚未专项核查', conflict: '证据冲突待核' });

export function isVerifiedMilestone(milestone, reports) {
  const primary = reports.find(report => report.id === milestone?.primaryEvidenceReportId);
  return Boolean(milestone?.isProgress && ['official-body', 'disclosure-paper'].includes(milestone.verificationLevel) &&
    milestone.evidenceRefs?.some(ref => ref.reportId === primary?.id) && primary?.verifiedAt && primary.publishedAt &&
    ['full', 'partial', 'abstract'].includes(primary.contentScope) && !primary.duplicateOf && primary.visibility !== 'archived');
}

export const sourceTypeLabels = Object.freeze({
  exchange: "证券交易所",
  government: "政府机构",
  company: "公司披露",
  research: "研究机构",
  commercial: "商业数据机构",
  media: "行业媒体",
});

export const SEA_REGIONS = Object.freeze([
  "新加坡",
  "马来西亚",
  "泰国",
  "印尼",
  "越南",
  "菲律宾",
]);

const searchableFields = [
  "name",
  "organization",
  "purpose",
  "questions",
  "metrics",
  "aliases",
  "tags",
  "regions",
  "caveats",
  "frequencyNote",
];

function matchesDimension(actual, selected) {
  const choices = (Array.isArray(selected) ? selected : [selected]).filter(
    Boolean,
  );
  if (!choices.length) return true;
  const values = Array.isArray(actual) ? actual : [actual];
  return choices.some((choice) => values.includes(choice));
}

export function filterSources(
  sources,
  { query = "", category = "", region = "", frequency = "", access = "" } = {},
) {
  const terms = String(query)
    .trim()
    .toLocaleLowerCase("en-US")
    .split(/\s+/u)
    .filter(Boolean);
  return sources.filter((source) => {
    if (source.visibility === "archived" || source.visibility === "reference" || source.duplicateOf) return false;
    if (
      !matchesDimension(source.categoryIds, category) ||
      !matchesDimension(source.regions, region) ||
      !matchesDimension(source.frequency, frequency) ||
      !matchesDimension(source.access, access)
    )
      return false;
    const text = searchableFields
      .flatMap((key) => source[key] ?? [])
      .join(" ")
      .toLocaleLowerCase("en-US");
    return terms.every((term) => text.includes(term));
  });
}

/** Unknown publication dates remain last; equal dates preserve input order. */
export function sortReports(reports) {
  return [...reports].sort((a, b) => {
    if (!a.publishedAt) return b.publishedAt ? 1 : 0;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

export function filterSeaSources(sources, region = "") {
  return sources.filter(
    (source) =>
      source.visibility !== "archived" && source.visibility !== "reference" &&
      (source.tags.includes("东南亚专题") || source.relatedReports?.some(report => report.visibility === "active" && !report.duplicateOf && report.regions?.some(country => SEA_REGIONS.includes(country)))) &&
      (!region || source.regions.includes(region)),
  );
}

/** Articles use their own coverage, never their publisher's country footprint. */
export function filterSeaReports(reports, sources, region = "") {
  const sourceIds = new Set(sources.map(source => source.id));
  return sortReports(
    reports.filter(
      (report) =>
        sourceIds.has(report.sourceId) &&
        report.visibility !== "archived" && report.visibility !== "reference" && !report.duplicateOf &&
        report.regions?.some((country) => SEA_REGIONS.includes(country)) &&
        (!region || report.regions.includes(region)),
    ),
  );
}

/** The all-category view owns each source only in its first declared category. */
export function groupSources(sources, categories, category = "") {
  const seen = new Set();
  const uniqueSources = sources.filter((source) => {
    if (source.visibility === "archived" || source.visibility === "reference" || source.duplicateOf) return false;
    if (seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
  return categories
    .filter((item) => !category || item.id === category)
    .map((item) => ({
      ...item,
      items: uniqueSources.filter((source) =>
        category
          ? source.categoryIds.includes(category)
          : source.categoryIds[0] === item.id,
      ),
    }))
    .filter((group) => group.items.length > 0);
}

const sourceFields = [
  "id",
  "name",
  "organization",
  "sourceType",
  "categoryIds",
  "purpose",
  "questions",
  "metrics",
  "aliases",
  "tags",
  "regions",
  "frequency",
  "frequencyNote",
  "access",
  "accessNote",
  "entryUrl",
  "methodologyUrl",
  "caveats",
  "featured",
  "verifiedAt",
  "verificationStatus",
  "verificationNote",
  "visibility",
];
const reportFields = [
  "id",
  "sourceId",
  "title",
  "url",
  "kind",
  "publishedAt",
  "dataPeriod",
  "summary",
  "verifiedAt",
  "verificationStatus",
  "verificationNote",
  "primaryCategoryId", "regions", "access", "contentScope", "judgmentTypes",
  "originalPublisher", "originalUrl", "companyIds", "visibility",
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

/** Validate maintained facts only, without fetching URLs or inventing missing values. */
export function validateCatalog(
  catalog,
  {
    today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    }),
  } = {},
) {
  const errors = [];
  if (!isObject(catalog)) return ["catalog: 必须为对象"];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const required = (record, fields, path) => {
    for (const field of fields) {
      if (!Object.hasOwn(record, field)) fail(`${path}.${field}`, "缺少字段");
    }
  };
  const string = (value, path, { empty = false } = {}) => {
    if (typeof value !== "string" || (!empty && !value.trim()))
      fail(path, "必须为有效文本");
  };
  const strings = (value, path, { empty = false } = {}) => {
    if (!Array.isArray(value)) return fail(path, "必须为文本数组");
    if (!empty && value.length === 0) fail(path, "至少一项");
    value.forEach((item, index) => string(item, `${path}[${index}]`));
    if (new Set(value).size !== value.length) fail(path, "含重复项");
  };
  const enumValue = (value, labels, path) => {
    if (!Object.hasOwn(labels, value)) fail(path, `无效枚举 ${String(value)}`);
  };
  const date = (value, path, { nullable = true, future = false } = {}) => {
    if (value === null && nullable) return;
    if (!isDate(value)) fail(path, "必须为有效 YYYY-MM-DD 日期或允许的 null");
    else if (!future && value > today) fail(path, `不得晚于核查基准日 ${today}`);
  };
  const url = (value, path, { nullable = false } = {}) => {
    if (nullable && (value === null || value === "")) return;
    try {
      const parsed = new URL(value);
      if (
        typeof value !== "string" ||
        parsed.protocol !== "https:" ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) {
        fail(path, "必须为完整 HTTPS 地址，且不得包含凭证");
      }
    } catch {
      fail(path, "必须为完整 HTTPS 地址");
    }
  };
  const identities = (records, path) => {
    const ids = new Set();
    records.forEach((record, index) => {
      if (!isObject(record)) return fail(`${path}[${index}]`, "必须为对象");
      if (
        typeof record.id !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.id)
      ) {
        fail(`${path}[${index}].id`, "必须为稳定的小写字母、数字和连字符 ID");
      }
      if (ids.has(record.id))
        fail(`${path}[${index}].id`, `重复 ID ${record.id}`);
      ids.add(record.id);
    });
    return ids;
  };
  const verification = (record, path, { noteRequired = true } = {}) => {
    enumValue(
      record.verificationStatus,
      statusLabels,
      `${path}.verificationStatus`,
    );
    date(record.verifiedAt, `${path}.verifiedAt`);
    string(record.verificationNote, `${path}.verificationNote`, {
      empty: !noteRequired || record.verificationStatus === "verified",
    });
    if (
      record.verificationStatus === "verified" &&
      !isDate(record.verifiedAt)
    ) {
      fail(`${path}.verifiedAt`, "已核查记录必须有最近成功核查日期");
    }
    if (
      record.verificationStatus === "unverified" &&
      record.verifiedAt !== null
    ) {
      fail(`${path}.verifiedAt`, "未核查记录的成功核查日期必须为 null");
    }
    if (Object.hasOwn(record, "lastCheckAttemptAt")) {
      date(record.lastCheckAttemptAt, `${path}.lastCheckAttemptAt`);
      if (
        isDate(record.verifiedAt) &&
        isDate(record.lastCheckAttemptAt) &&
        record.lastCheckAttemptAt < record.verifiedAt
      ) {
        fail(`${path}.lastCheckAttemptAt`, "最近尝试日期不得早于成功核查日期");
      }
    }
    for (const key of ["verifiedAt", "lastCheckAttemptAt"]) {
      if (
        isDate(record[key]) &&
        isDate(catalog.maintainedAt) &&
        record[key] > catalog.maintainedAt
      ) {
        fail(`${path}.${key}`, "不得晚于资料维护日期 maintainedAt");
      }
    }
  };

  required(
    catalog,
    [
      "schemaVersion",
      "title",
      "maintainedAt",
      "categories",
      "sources",
      "reports",
    ],
    "catalog",
  );
  if (catalog.schemaVersion !== 2) fail("schemaVersion", "当前仅支持版本 2");
  string(catalog.title, "title");
  date(catalog.maintainedAt, "maintainedAt", { nullable: false });
  for (const key of ["categories", "sources", "reports", "companies"]) {
    if (!Array.isArray(catalog[key])) fail(key, "必须为数组");
  }
  const categories = Array.isArray(catalog.categories)
    ? catalog.categories
    : [];
  const sources = Array.isArray(catalog.sources) ? catalog.sources : [];
  const reports = Array.isArray(catalog.reports) ? catalog.reports : [];
  const companies = Array.isArray(catalog.companies) ? catalog.companies : [];
  if (!categories.length) fail("categories", "至少一个分类");
  if (!sources.length) fail("sources", "至少一个来源");
  const categoryIds = identities(categories, "categories");
  const sourceIds = identities(sources, "sources");
  const reportIds = identities(reports, "reports");
  const companyIds = identities(companies, "companies");
  const subcategories = Array.isArray(catalog.subcategories) ? catalog.subcategories : [];
  if (catalog.subcategories !== undefined && !Array.isArray(catalog.subcategories)) fail('subcategories', '必须为数组');
  const subcategoryIds = identities(subcategories, 'subcategories');
  const subcategoryById = new Map(subcategories.filter(isObject).map(item => [item.id, item]));
  subcategories.forEach((item, index) => {
    if (!isObject(item)) return;
    const path = `subcategories[${index}]`;
    string(item.name, `${path}.name`);
    if (!categoryIds.has(item.parentCategoryId) || item.parentCategoryId === 'listed-companies') fail(`${path}.parentCategoryId`, '必须为前四类的合法父类');
    if (!Number.isInteger(item.order) || item.order < 0) fail(`${path}.order`, '必须为非负整数');
    if (subcategories.some((other, n) => n !== index && other.parentCategoryId === item.parentCategoryId && other.order === item.order)) fail(`${path}.order`, '父类内排序重复');
  });
  const visibility = (record, path) => {
    enumValue(record.visibility, visibilityLabels, `${path}.visibility`);
    if (record.visibility !== "active") string(record.visibilityReason, `${path}.visibilityReason`);
  };
  const companyReferences = (record, path) => {
    strings(record.companyIds, `${path}.companyIds`, { empty: true });
    for (const id of Array.isArray(record.companyIds) ? record.companyIds : []) {
      if (!companyIds.has(id)) fail(`${path}.companyIds`, `未知主体 ${id}`);
    }
  };
  companies.forEach((company, index) => {
    if (!isObject(company)) return;
    const path = `companies[${index}]`;
    required(company, ["name", "legalName", "aliases", "securities", "role", "identityNote", "identityUrls"], path);
    for (const key of ["name", "legalName", "identityNote"]) string(company[key], `${path}.${key}`);
    strings(company.aliases, `${path}.aliases`, { empty: true });
    strings(company.identityUrls, `${path}.identityUrls`);
    for (const link of Array.isArray(company.identityUrls) ? company.identityUrls : []) url(link, `${path}.identityUrls`);
    enumValue(company.role, { core: 1, operator: 1, reference: 1 }, `${path}.role`);
    if (!Array.isArray(company.securities)) fail(`${path}.securities`, "必须为数组");
    for (const security of Array.isArray(company.securities) ? company.securities : []) {
      if (!isObject(security)) { fail(`${path}.securities`, "必须为证券标识对象"); continue; }
      string(security.exchange, `${path}.securities.exchange`);
      string(security.code, `${path}.securities.code`);
    }
  });

  categories.forEach((category, index) => {
    if (!isObject(category)) return;
    const path = `categories[${index}]`;
    required(category, ["id", "name", "question", "icon"], path);
    for (const key of ["name", "question", "icon"])
      string(category[key], `${path}.${key}`);
  });
  sources.forEach((source, index) => {
    if (!isObject(source)) return;
    const path = `sources[${index}]`;
    required(source, sourceFields, path);
    for (const key of [
      "name",
      "organization",
      "purpose",
      "frequencyNote",
      "accessNote",
    ])
      string(source[key], `${path}.${key}`);
    for (const key of ["categoryIds", "questions", "metrics", "regions"])
      strings(source[key], `${path}.${key}`);
    for (const key of ["aliases", "tags", "caveats"])
      strings(source[key], `${path}.${key}`, { empty: true });
    for (const categoryId of Array.isArray(source.categoryIds)
      ? source.categoryIds
      : []) {
      if (!categoryIds.has(categoryId))
        fail(`${path}.categoryIds`, `未知分类 ${categoryId}`);
    }
    enumValue(source.sourceType, sourceTypeLabels, `${path}.sourceType`);
    enumValue(source.frequency, frequencyLabels, `${path}.frequency`);
    enumValue(source.access, accessLabels, `${path}.access`);
    url(source.entryUrl, `${path}.entryUrl`);
    url(source.methodologyUrl, `${path}.methodologyUrl`, { nullable: true });
    if (
      Object.hasOwn(source, "subscriptionUrl") &&
      source.subscriptionUrl !== null
    )
      url(source.subscriptionUrl, `${path}.subscriptionUrl`);
    for (const key of ["trackingNote", "subscriptionNote"])
      if (Object.hasOwn(source, key)) string(source[key], `${path}.${key}`);
    if (typeof source.featured !== "boolean")
      fail(`${path}.featured`, "必须为布尔值");
    verification(source, path);
    visibility(source, path);
    if (Object.hasOwn(source, "companyIds")) companyReferences(source, path);
    if (source.subcategoryIds !== undefined) {
      strings(source.subcategoryIds, `${path}.subcategoryIds`, { empty: true });
      for (const id of Array.isArray(source.subcategoryIds) ? source.subcategoryIds : []) {
        if (!subcategoryIds.has(id) || !source.categoryIds?.includes(subcategoryById.get(id)?.parentCategoryId)) fail(`${path}.subcategoryIds`, '子方向须存在且属于来源覆盖父类');
      }
    }
  });
  reports.forEach((report, index) => {
    if (!isObject(report)) return;
    const path = `reports[${index}]`;
    required(report, reportFields, path);
    for (const key of ["title", "summary", "sourceId"])
      string(report[key], `${path}.${key}`);
    if (!sourceIds.has(report.sourceId))
      fail(`${path}.sourceId`, `未知来源 ${String(report.sourceId)}`);
    url(report.url, `${path}.url`);
    enumValue(report.kind, kindLabels, `${path}.kind`);
    if (!categoryIds.has(report.primaryCategoryId)) fail(`${path}.primaryCategoryId`, "未知主分类");
    if (report.primarySubcategoryId != null && (!subcategoryIds.has(report.primarySubcategoryId) || subcategoryById.get(report.primarySubcategoryId)?.parentCategoryId !== report.primaryCategoryId)) fail(`${path}.primarySubcategoryId`, '子方向须存在且匹配原主类');
    if (report.relatedSubcategoryIds !== undefined) {
      strings(report.relatedSubcategoryIds,`${path}.relatedSubcategoryIds`,{empty:true});
      for (const id of report.relatedSubcategoryIds || []) if (!subcategoryIds.has(id) || id === report.primarySubcategoryId || subcategoryById.get(id)?.parentCategoryId !== report.primaryCategoryId) fail(`${path}.relatedSubcategoryIds`,'关联子方向须为同主类内其他合法方向');
      if (report.relatedSubcategoryIds?.length) string(report.relatedSubcategoryNote,`${path}.relatedSubcategoryNote`);
    }
    strings(report.regions, `${path}.regions`, { empty: true });
    if (!report.regions?.length) string(report.regionNote, `${path}.regionNote`);
    if (Object.hasOwn(report, "stage") && report.stage !== null)
      string(report.stage, `${path}.stage`);
    enumValue(report.access, accessLabels, `${path}.access`);
    enumValue(report.contentScope, contentScopeLabels, `${path}.contentScope`);
    strings(report.judgmentTypes, `${path}.judgmentTypes`);
    for (const judgment of Array.isArray(report.judgmentTypes) ? report.judgmentTypes : []) enumValue(judgment, judgmentLabels, `${path}.judgmentTypes`);
    string(report.originalPublisher, `${path}.originalPublisher`);
    url(report.originalUrl, `${path}.originalUrl`, { nullable: true });
    companyReferences(report, path);
    visibility(report, path);
    if (report.visibility === "active" && ["title", "search-snippet", "unavailable"].includes(report.contentScope)) fail(`${path}.contentScope`, "仅线索不能作为正式资料");
    for (const key of ["effectiveAt", "deadlineAt"]) if (Object.hasOwn(report, key)) date(report[key], `${path}.${key}`, { future: true });
    for (const key of ["eventId", "eventType", "documentStatus", "jurisdiction"]) if (Object.hasOwn(report, key) && report[key] !== null) string(report[key], `${path}.${key}`);
    if (report.effectiveAt > today && ["effective", "已生效", "生效"].includes(report.documentStatus)) fail(`${path}.documentStatus`, "未来生效文件不能标为已生效");
    if (report.duplicateOf !== undefined && report.duplicateOf !== null) {
      if (!reportIds.has(report.duplicateOf) || report.duplicateOf === report.id) fail(`${path}.duplicateOf`, "重复指向须存在且不能自指");
    }
    if (report.relatedLinks !== undefined) {
      if (!Array.isArray(report.relatedLinks)) fail(`${path}.relatedLinks`, "必须为数组");
      const seen = new Set();
      for (const link of Array.isArray(report.relatedLinks) ? report.relatedLinks : []) {
        if (!isObject(link)) { fail(`${path}.relatedLinks`, "必须为对象"); continue; }
        url(link.url, `${path}.relatedLinks.url`);
        string(link.publisher, `${path}.relatedLinks.publisher`);
        string(link.role, `${path}.relatedLinks.role`);
        if (link.publishedAt !== undefined) date(link.publishedAt, `${path}.relatedLinks.publishedAt`);
        if (seen.has(link.url)) fail(`${path}.relatedLinks`, "含重复链接");
        seen.add(link.url);
      }
    }
    date(report.publishedAt, `${path}.publishedAt`);
    if (report.dataPeriod !== null)
      string(report.dataPeriod, `${path}.dataPeriod`);
    verification(report, path, { noteRequired: false });
    if (
      isDate(report.publishedAt) &&
      isDate(report.verifiedAt) &&
      report.publishedAt > report.verifiedAt
    ) {
      fail(`${path}.publishedAt`, "发布日期不得晚于这份报告的成功核查日期");
    }
  });
  for (const [collection, records] of [["sources", sources], ["reports", reports]]) {
    const recordsById = new Map(records.filter(isObject).map(record => [record.id, record]));
    for (const record of records.filter(isObject)) {
      if (record.duplicateOf != null && !recordsById.has(record.duplicateOf)) fail(`${collection}.${record.id}.duplicateOf`, "重复指向须存在");
      const seen = new Set([record.id]);
      let current = record;
      while (current?.duplicateOf && recordsById.has(current.duplicateOf)) {
        if (seen.has(current.duplicateOf)) { fail(`${collection}.${record.id}.duplicateOf`, "重复关联成环"); break; }
        seen.add(current.duplicateOf);
        current = recordsById.get(current.duplicateOf);
      }
    }
  }
  if (catalog.labelMaps?.kind && JSON.stringify(catalog.labelMaps.kind) !== JSON.stringify(kindLabels)) fail("labelMaps.kind", "必须与类型枚举一致");
  if (catalog.events !== undefined && !Array.isArray(catalog.events)) fail('events', '必须为数组');
  function validateReview(review, path) {
    if (!isObject(review)) { fail(`${path}`, '必须记录核查范围'); return; }
    date(review.lastAttemptAt, `${path}.lastAttemptAt`);
    enumValue(review.result, reviewResultLabels, `${path}.result`);
    string(review.note, `${path}.note`);
    if (!Array.isArray(review.checks)) fail(`${path}.checks`, '必须为数组');
    const checks = Array.isArray(review.checks) ? review.checks : [];
    identities(checks, `${path}.checks`);
    checks.forEach((check, n) => {
      const cp = `${path}.checks[${n}]`;
      if (!isObject(check)) return;
      for (const key of ['channel','note']) string(check[key], `${cp}.${key}`);
      url(check.url, `${cp}.url`); date(check.attemptedAt, `${cp}.attemptedAt`, { nullable: false });
      enumValue(check.result, reviewResultLabels, `${cp}.result`);
      for (const key of ['checkedFrom','checkedThrough']) date(check[key], `${cp}.${key}`);
      if (Boolean(check.checkedFrom) !== Boolean(check.checkedThrough) || check.checkedFrom > check.checkedThrough || check.checkedThrough > check.attemptedAt) fail(cp, '成功覆盖区间无效');
      if (['blocked','not-checked'].includes(check.result) && (check.checkedFrom || check.checkedThrough)) fail(cp, '受阻尝试不能声称完成区间');
      if (check.result === 'no-new' && !check.checkedThrough) fail(cp, '未确认新增须限定已完成区间');
      if (!review.lastAttemptAt || check.attemptedAt > review.lastAttemptAt) fail(cp, '尝试不得晚于本事件最近尝试');
    });
    if (review.result === 'no-new' && !checks.some(c => c.result === 'no-new' && c.checkedThrough)) fail(path, '未确认新增必须有实际完成的渠道区间');
  }
  for (const company of companies.filter(isObject)) if (company.disclosureReview !== undefined) validateReview(company.disclosureReview, 'companies.' + company.id + '.disclosureReview');
  const events = Array.isArray(catalog.events) ? catalog.events : [];
  const eventIds = identities(events, 'events');
  const reportById = new Map(reports.filter(isObject).map(report => [report.id, report]));
  events.forEach((event, index) => {
    if (!isObject(event)) return;
    const path = `events[${index}]`;
    for (const key of ['title', 'currentSummary']) string(event[key], `${path}.${key}`);
    enumValue(event.type, eventTypeLabels, `${path}.type`);
    companyReferences(event, path); visibility(event, path);
    strings(event.regions, `${path}.regions`, { empty: true });
    if (!event.regions?.length) string(event.regionNote, `${path}.regionNote`);
    if (!Number.isFinite(event.priority)) fail(`${path}.priority`, '必须为数字');
    strings(event.uncertainties, `${path}.uncertainties`, { empty: true });
    strings(event.relatedEventIds, `${path}.relatedEventIds`, { empty: true });
    for (const id of Array.isArray(event.relatedEventIds) ? event.relatedEventIds : []) if (!eventIds.has(id) || id === event.id) fail(`${path}.relatedEventIds`, '关联事件须存在且不能自指');
    if (!Array.isArray(event.participants)) fail(`${path}.participants`, '必须为数组');
    for (const participant of Array.isArray(event.participants) ? event.participants : []) {
      if (!isObject(participant)) { fail(`${path}.participants`, '必须为对象'); continue; }
      string(participant.role, `${path}.participants.role`);
      if (participant.companyId) {
        if (!companyIds.has(participant.companyId) || !event.companyIds?.includes(participant.companyId)) fail(`${path}.participants.companyId`, '参与方必须是本事件关联主体');
      } else string(participant.name, `${path}.participants.name`);
    }
    for (const id of Array.isArray(event.companyIds) ? event.companyIds : []) if (!(Array.isArray(event.participants) && event.participants.some(p => p?.companyId === id))) fail(`${path}.participants`, '关联公司缺少角色');
    if (!Array.isArray(event.milestones)) fail(`${path}.milestones`, '必须为数组');
    const milestones = Array.isArray(event.milestones) ? event.milestones : [];
    const milestoneIds = identities(milestones, `${path}.milestones`);
    const primaryEvidenceOwners = new Map();
    milestones.forEach((node, n) => {
      if (!isObject(node)) return;
      const np = `${path}.milestones[${n}]`;
      if (node.primaryEvidenceReportId) {
        if (primaryEvidenceOwners.has(node.primaryEvidenceReportId) && primaryEvidenceOwners.get(node.primaryEvidenceReportId) !== node.id) fail(`${np}.primaryEvidenceReportId`, '同一事项 ' + event.id + ' 的不同节点含重复主证据 ' + node.primaryEvidenceReportId);
        primaryEvidenceOwners.set(node.primaryEvidenceReportId, node.id);
      }
      string(node.title, `${np}.title`); string(node.summary, `${np}.summary`);
      date(node.occurredAt, `${np}.occurredAt`);
      enumValue(node.verificationLevel, evidenceLevelLabels, `${np}.verificationLevel`);
      if (typeof node.isProgress !== 'boolean') fail(`${np}.isProgress`, '必须为布尔值');
      if (!Array.isArray(node.evidenceRefs) || !node.evidenceRefs.length) fail(`${np}.evidenceRefs`, '须有证据引用');
      const refs = Array.isArray(node.evidenceRefs) ? node.evidenceRefs : [];
      const identitiesSeen = new Set();
      for (const ref of refs) {
        if (!isObject(ref)) { fail(`${np}.evidenceRefs`, '须为对象'); continue; }
        if (!reportIds.has(ref.reportId)) fail(`${np}.evidenceRefs`, '未知资料');
        string(ref.locator, `${np}.evidenceRefs.locator`); string(ref.role, `${np}.evidenceRefs.role`);
        const key = `${ref.reportId}|${ref.locator}`;
        if (identitiesSeen.has(key)) fail(`${np}.evidenceRefs`, '重复证据引用');
        identitiesSeen.add(key);
      }
      if (!refs.some(ref => ref.reportId === node.primaryEvidenceReportId) || !reportIds.has(node.primaryEvidenceReportId)) fail(`${np}.primaryEvidenceReportId`, '主证据必须在节点引用集合中');
      if (['official-body', 'disclosure-paper'].includes(node.verificationLevel)) {
        const primary = reportById.get(node.primaryEvidenceReportId);
        if (sources.find(source => source.id === primary?.sourceId)?.sourceType === 'media') fail(`${np}.verificationLevel`, '媒体转述不能作为官方已核节点');
        if (!primary?.verifiedAt || !['full','partial','abstract'].includes(primary?.contentScope)) fail(`${np}.verificationLevel`, '已核节点不能仅据标题、未读原文或无成功证据');
      }
    });
    strings(event.basisMilestoneIds, `${path}.basisMilestoneIds`, { empty: true });
    for (const id of Array.isArray(event.basisMilestoneIds) ? event.basisMilestoneIds : []) if (!milestoneIds.has(id) || !isVerifiedMilestone(milestones.find(m => m.id === id), reports)) fail(`${path}.basisMilestoneIds`, '当前结论依据必须是本事件有效已核进展');
    if (event.latestVerifiedMilestoneId !== null && (!milestoneIds.has(event.latestVerifiedMilestoneId) || !isVerifiedMilestone(milestones.find(m => m.id === event.latestVerifiedMilestoneId), reports))) fail(`${path}.latestVerifiedMilestoneId`, '须引用本事件有效已核进展或为 null');
    if (event.latestVerifiedMilestoneId && !event.basisMilestoneIds?.includes(event.latestVerifiedMilestoneId)) fail(`${path}.basisMilestoneIds`, '当前结论须包含最新已核依据');
    if (!event.basisMilestoneIds?.length && !event.uncertainties?.length) fail(`${path}.uncertainties`, '无已核依据时必须明确待核限制');
    validateReview(event.review, `${path}.review`);
  });
  // Old schema-2 catalogs without an event layer retain their legacy grouping keys.
  if (catalog.events !== undefined) for (const report of reports) if (report.eventId && !eventIds.has(report.eventId)) fail(`reports.${report.id}.eventId`, '未知事件引用');
  if (catalog.changeBatches !== undefined && !Array.isArray(catalog.changeBatches)) fail('changeBatches','必须为数组');
  const batches = Array.isArray(catalog.changeBatches) ? catalog.changeBatches : [];
  const batchIds = new Set();
  for (const batch of batches) {
    const path = `changeBatches.${batch?.batchId}`;
    if (!isObject(batch)) { fail(path,'必须为对象'); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batch.batchId || '') || batchIds.has(batch.batchId)) fail(path,'批次ID无效或重复');
    if (batch.previousBatchId && !batchIds.has(batch.previousBatchId)) fail(path,'前序批次须存在且在前');
    batchIds.add(batch.batchId);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(batch.recordedAt || '') || !Number.isFinite(Date.parse(batch.recordedAt))) fail(path,'须为北京时间时间戳');
    date(batch.recordedAt?.slice(0,10),`${path}.recordedAt`,{nullable:false});
    date(batch.periodStart,`${path}.periodStart`,{nullable:false});
    if (batch.periodStart > batch.recordedAt?.slice(0,10) || batch.recordedAt?.slice(0,10)>catalog.maintainedAt) fail(path,'批次日期范围无效');
    for (const key of ['scope','summary']) string(batch[key],`${path}.${key}`);
    if (!/^[a-f0-9]{64}$/.test(batch.inputHash || '')) fail(path,'缺少已核输入指纹');
    if (!Array.isArray(batch.changes) || !Array.isArray(batch.checks)) { fail(path,'变化与检查须为数组'); continue; }
    if (!batch.changes.length && !batch.checks.length) fail(path,'不得记录空批次');
    const changeIds = new Set();
    for (const change of batch.changes) {
      if (!isObject(change)) { fail(path,'变化须为对象'); continue; }
      const ids = {report:reportIds,event:eventIds,source:sourceIds}[change.objectType];
      if (!ids?.has(change.objectId) || changeIds.has(`${change.objectType}:${change.objectId}`)) fail(path,'变化对象无效或重复');
      changeIds.add(`${change.objectType}:${change.objectId}`);
      strings(change.kinds,`${path}.kinds`);string(change.note,`${path}.note`);
      for (const kind of change.kinds || []) enumValue(kind,changeKindLabels,`${path}.kind`);
      for (const key of ['beforeRefs','afterRefs']) { strings(change[key],`${path}.${key}`,{empty:true});for (const id of change[key] || []) if (!reportIds.has(id)) fail(path,'未知新旧依据'); }
      if (change.kinds?.includes('event-node') && (change.objectType !== 'event' || !events.find(e=>e.id===change.objectId)?.milestones.some(n=>change.afterRefs?.includes(n.primaryEvidenceReportId)&&isVerifiedMilestone(n,reports)))) fail(path,'事项新节点须有已核证据');
    }
    validateReview({lastAttemptAt:batch.recordedAt?.slice(0,10),result:'partial',note:batch.scope,checks:batch.checks},`${path}.review`);
  }
  return errors;
}
