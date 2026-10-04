/** Catalog operations are source-level: report periods never affect filtering. */
export const frequencyLabels = Object.freeze({
  daily: "日度",
  weekly: "周度",
  monthly: "月度",
  quarterly: "季度",
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
  report: "研究报告",
  "data-release": "数据发布",
  methodology: "方法说明",
});

export const sourceTypeLabels = Object.freeze({
  government: "政府机构",
  company: "公司披露",
  research: "研究机构",
  commercial: "商业数据机构",
});

const searchableFields = [
  "name",
  "organization",
  "purpose",
  "questions",
  "metrics",
  "aliases",
  "tags",
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

/** The all-category view owns each source only in its first declared category. */
export function groupSources(sources, categories, category = "") {
  const seen = new Set();
  const uniqueSources = sources.filter((source) => {
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
  const date = (value, path, { nullable = true } = {}) => {
    if (value === null && nullable) return;
    if (!isDate(value)) fail(path, "必须为有效 YYYY-MM-DD 日期或允许的 null");
    else if (value > today) fail(path, `不得晚于核查基准日 ${today}`);
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
  if (catalog.schemaVersion !== 1) fail("schemaVersion", "当前仅支持版本 1");
  string(catalog.title, "title");
  date(catalog.maintainedAt, "maintainedAt", { nullable: false });
  for (const key of ["categories", "sources", "reports"]) {
    if (!Array.isArray(catalog[key])) fail(key, "必须为数组");
  }
  const categories = Array.isArray(catalog.categories)
    ? catalog.categories
    : [];
  const sources = Array.isArray(catalog.sources) ? catalog.sources : [];
  const reports = Array.isArray(catalog.reports) ? catalog.reports : [];
  if (!categories.length) fail("categories", "至少一个分类");
  if (!sources.length) fail("sources", "至少一个来源");
  const categoryIds = identities(categories, "categories");
  const sourceIds = identities(sources, "sources");
  identities(reports, "reports");

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
    if (typeof source.featured !== "boolean")
      fail(`${path}.featured`, "必须为布尔值");
    verification(source, path);
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
  return errors;
}
