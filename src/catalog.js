export const REGION_TREE = [
  { id: '全球', label: '全球' },
  { id: '北美', label: '北美' },
  { id: '欧洲', label: '欧洲' },
  { id: '亚太', label: '亚太', children: [
    { id: '中国', label: '中国' },
    { id: '东南亚', label: '东南亚', children: ['新加坡', '马来西亚', '泰国', '印尼', '越南', '菲律宾'].map(id => ({ id, label: id })) },
  ] },
  { id: '拉丁美洲', label: '拉丁美洲' },
];

export const TOPICS = [
  { id: 'rental', label: '算力租赁与价格', categoryIds: ['rental-prices'] },
  { id: 'infrastructure', label: '数据中心与基础设施', categoryIds: ['capacity-construction', 'servers-hardware'] },
  { id: 'market', label: '行业供需与市场', categoryIds: ['operating-demand', 'activity-demand', 'market-technology'] },
  { id: 'policy', label: '政策与监管', categoryIds: ['capacity-construction', 'market-technology', 'activity-demand'] },
  { id: 'financial', label: '企业经营与财报', categoryIds: ['operating-demand', 'activity-demand', 'capacity-construction'] },
];

export const INFO_TYPES = [
  { id: 'news', label: '新闻动态' },
  { id: 'report', label: '研究报告' },
  { id: 'official', label: '官方公告' },
  { id: 'disclosure', label: '经营披露' },
  { id: 'data-release', label: '数据发布' },
  { id: 'methodology', label: '方法说明' },
];

const unique = values => [...new Set(values)];
const textOf = values => values.flat(Infinity).filter(Boolean).join(' ');
const termsOf = q => String(q || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
const includesAll = (text, terms) => terms.every(term => text.toLocaleLowerCase().includes(term));
const flattenRegions = nodes => nodes.flatMap(node => [node.id, ...flattenRegions(node.children || [])]);
const regionIds = flattenRegions(REGION_TREE);
const regionCoverage = new Map();
function indexRegions(nodes) {
  nodes.forEach(node => {
    regionCoverage.set(node.id, new Set(flattenRegions([node])));
    indexRegions(node.children || []);
  });
}
indexRegions(REGION_TREE);

const allowed = {
  topics: TOPICS.map(topic => topic.id),
  regions: regionIds,
  types: INFO_TYPES.map(type => type.id),
  access: ['free', 'registration', 'mixed', 'paid', 'unknown'],
  frequency: ['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'irregular', 'unknown'],
};

function cleanFilters(filters = {}) {
  const clean = { q: String(filters.q || '').trim(), sort: ['relevance', 'name', 'verified'].includes(filters.sort) ? filters.sort : 'relevance' };
  for (const [key, values] of Object.entries(allowed)) {
    clean[key] = unique((Array.isArray(filters[key]) ? filters[key] : []).filter(value => values.includes(value)));
  }
  clean.regions = clean.regions.filter(region => !clean.regions.some(parent => parent !== region && regionCoverage.get(parent)?.has(region)));
  return clean;
}

function sourceText(source) {
  return textOf([source.name, source.purpose, source.organization, source.metrics || [], source.aliases || [], source.regions || [], source.questions || [], source.tags || []]);
}

function isFinancial(source) {
  return source.sourceType === 'company' && /业绩|财报|财务|季度|经营|financial|results/i.test(textOf([source.name, source.purpose]));
}

function reportTypes(report, source) {
  const types = INFO_TYPES.some(type => type.id === report.kind) ? [report.kind] : [];
  if (report.kind === 'news' && ['government', 'company'].includes(source?.sourceType)) types.push('official');
  if (source && isFinancial(source) && report.kind === 'report') types.push('disclosure');
  return unique(types);
}

function sourceTypes(source, reports) {
  const types = reports.flatMap(report => reportTypes(report, source));
  if (source.sourceType === 'media') types.push('news');
  if (source.sourceType === 'research') types.push('report');
  if (source.sourceType === 'government') types.push('official');
  if (source.sourceType === 'company') types.push(isFinancial(source) ? 'disclosure' : 'official');
  if (source.methodologyUrl) types.push('methodology');
  return unique(types);
}

function sourceTopics(source, reports) {
  const researchText = textOf([sourceText(source), reports.map(report => [report.title, report.summary])]);
  return TOPICS.filter(topic => {
    if (!(source.categoryIds || []).some(category => topic.categoryIds.includes(category))) return false;
    if (topic.id === 'policy') return /政策|监管|许可|审批|批准|配额|法案|合规|可持续要求/.test(researchText);
    if (topic.id === 'financial') return isFinancial(source);
    return true;
  }).map(topic => topic.id);
}

export function decorateSources(data) {
  return data.sources.map(source => {
    const relatedReports = data.reports.filter(report => report.sourceId === source.id);
    return {
      ...source,
      types: sourceTypes(source, relatedReports),
      topicIds: sourceTopics(source, relatedReports),
      searchText: sourceText(source).toLocaleLowerCase(),
      relatedReports,
    };
  });
}

// Match recorded coverage, not the institution's location. A selected parent
// includes recorded descendants, but broad tags never prove country coverage.
export function matchesRegion(sourceRegions = [], selectedRegions = []) {
  if (!selectedRegions.length) return true;
  return selectedRegions.some(selected => sourceRegions.some(region =>
    region === selected || regionCoverage.get(selected)?.has(region)
  ));
}

const matchesAny = (values = [], selected = []) => !selected.length || selected.some(value => values.includes(value));
function matchesSourceDimensions(source, filters, includeRegions = true, includeTypes = true) {
  return matchesAny(source.topicIds, filters.topics) &&
    (!includeRegions || matchesRegion(source.regions, filters.regions)) &&
    (!includeTypes || matchesAny(source.types, filters.types)) &&
    matchesAny([source.access], filters.access) &&
    matchesAny([source.frequency], filters.frequency);
}

function relevance(item, terms) {
  const name = (item.name || item.title || '').toLocaleLowerCase();
  const purpose = (item.purpose || item.summary || '').toLocaleLowerCase();
  return terms.reduce((score, term) => score + (name.includes(term) ? 5 : 0) + (purpose.includes(term) ? 2 : 0), 0);
}

function sortItems(items, filters, byReportDate = false) {
  const terms = termsOf(filters.q);
  return [...items].sort((a, b) => {
    if (filters.sort === 'name') return (a.name || a.title).localeCompare(b.name || b.title, 'zh-CN');
    if (filters.sort === 'verified') return (b.verifiedAt || '').localeCompare(a.verifiedAt || '');
    return relevance(b, terms) - relevance(a, terms) ||
      (byReportDate ? (b.publishedAt || '').localeCompare(a.publishedAt || '') : 0);
  });
}

export function filterSources(sources, filters = {}) {
  const clean = cleanFilters(filters);
  const terms = termsOf(clean.q);
  return sortItems(sources.filter(source => includesAll(source.searchText || sourceText(source), terms) && matchesSourceDimensions(source, clean)), clean);
}

export function getMatchReason(source, q) {
  const terms = termsOf(q);
  if (!terms.length) return null;
  const fields = [
    ['指标匹配', source.metrics],
    ['别名匹配', source.aliases],
    ['用途匹配', source.purpose],
    ['地区匹配', source.regions],
    ['机构匹配', source.organization],
    ['名称匹配', source.name],
    ['研究问题匹配', source.questions],
    ['标签匹配', source.tags],
  ];
  for (const [label, value] of fields) {
    const matches = (Array.isArray(value) ? value : [value]).filter(item => item && terms.some(term => item.toLocaleLowerCase().includes(term)));
    if (matches.length) {
      const text = matches.join(' · ');
      return { label, text: text.length > 90 ? `${text.slice(0, 89)}…` : text };
    }
  }
  return null;
}

export function filterReports(reports, sources, filters = {}) {
  const clean = cleanFilters(filters);
  const terms = termsOf(clean.q);
  const sourcesById = new Map(sources.map(source => [source.id, source]));
  return sortItems(reports.filter(report => {
    const source = sourcesById.get(report.sourceId);
    if (!source) return false;
    const regions = report.regions?.length ? report.regions : source.regions;
    const searchText = textOf([report.title, report.summary, report.dataPeriod, report.stage, regions, source.name, source.organization]);
    return includesAll(searchText, terms) && matchesRegion(regions, clean.regions) &&
      matchesAny(reportTypes(report, source), clean.types) && matchesSourceDimensions(source, clean, false, false);
  }), clean, true);
}

export function getReportMatchReason(report, source, q) {
  const terms = termsOf(q);
  const visible = textOf([report.title, report.summary, report.dataPeriod, report.stage, report.regions?.length ? report.regions : source.regions, source.name]);
  if (!terms.length || includesAll(visible, terms)) return null;
  return { label: '机构匹配', text: source.organization };
}

const extraViews = ['reports', 'southeast', 'southeast-reports'];

export function writeQuery(filters, view = 'sources', selectedId = null) {
  const clean = cleanFilters(filters);
  const params = new URLSearchParams();
  if (clean.q) params.set('q', clean.q);
  for (const key of Object.keys(allowed)) clean[key].forEach(value => params.append(key, value));
  if (clean.sort !== 'relevance') params.set('sort', clean.sort);
  if (extraViews.includes(view)) params.set('view', view);
  if (selectedId && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(selectedId)) params.set('source', selectedId);
  return params.toString();
}

export function readQuery(search = '') {
  const params = new URLSearchParams(search);
  const filters = { q: params.get('q') || '', sort: params.get('sort') };
  for (const key of Object.keys(allowed)) filters[key] = params.getAll(key);
  const source = params.get('source');
  return {
    filters: cleanFilters(filters),
    view: extraViews.includes(params.get('view')) ? params.get('view') : 'sources',
    selectedId: source && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(source) ? source : null,
  };
}
