import catalog from '../public/assets/catalog.json' with { type: 'json' };
import { kindLabels, SEA_REGIONS } from './domain/catalog.js';

export const DOMESTIC_REGIONS = ['中国', '中国香港'];
export const REGION_TREE = [
  { id: '全球', label: '全球' },
  { id: '北美', label: '北美' },
  { id: '欧洲', label: '欧洲' },
  { id: '亚太', label: '亚太', children: [
    ...DOMESTIC_REGIONS.map(id => ({ id, label: id })),
    { id: '东南亚', label: '东南亚', children: SEA_REGIONS.map(id => ({ id, label: id })) },
  ] },
  { id: '拉丁美洲', label: '拉丁美洲' },
];

// The maintained catalog owns the business categories; labels are never inferred.
export const TOPICS = catalog.categories.map(category => ({ id: category.id, label: category.name }));
export const INFO_TYPES = Object.entries(kindLabels).map(([id, label]) => ({ id, label }));
export const SUBCATEGORIES = catalog.subcategories || [];

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
  companies: (catalog.companies || []).map(company => company.id),
};
const oldTopics = {
  infrastructure: ['industry'], market: ['industry'], rental: ['rental-prices'],
  financial: ['listed-companies'], policy: ['policy-planning', 'regulation'],
};
const scopes = ['domestic', 'sea', 'all'];
const extraViews = ['reports', 'southeast', 'southeast-reports'];
const isSeaView = view => view === 'southeast' || view === 'southeast-reports';

export function normalizeFilters(filters = {}, view = 'sources') {
  const clean = {
    q: String(filters.q || '').trim(),
    sort: ['relevance', 'name', 'verified'].includes(filters.sort) ? filters.sort : 'relevance',
    scope: scopes.includes(filters.scope) ? filters.scope : 'all',
    showReference: filters.showReference === true,
  };
  for (const [key, values] of Object.entries(allowed)) {
    const selected = Array.isArray(filters[key]) ? filters[key] : [];
    const mapped = key === 'topics' ? selected.flatMap(value => oldTopics[value] || [value]) : selected;
    clean[key] = unique(mapped.filter(value => values.includes(value)));
  }
  clean.regions = clean.regions.filter(region => !clean.regions.some(parent => parent !== region && regionCoverage.get(parent)?.has(region)));
  clean.subcategory = clean.topics.length === 1 && SUBCATEGORIES.some(item => item.id === filters.subcategory && item.parentCategoryId === clean.topics[0]) ? filters.subcategory : null;
  if (isSeaView(view)) {
    const countries = SEA_REGIONS.filter(country => matchesRegion([country], clean.regions));
    clean.regions = !countries.length || countries.length === SEA_REGIONS.length ? [] : countries;
    clean.scope = 'sea';
  } else if (clean.regions.length) {
    clean.scope = clean.regions.every(region => DOMESTIC_REGIONS.includes(region)) ? 'domestic'
      : clean.regions.every(region => region === '东南亚' || SEA_REGIONS.includes(region)) ? 'sea' : 'all';
  }
  return clean;
}

export function isVisible(item, filters = {}) {
  return !item.duplicateOf && item.visibility !== 'archived' &&
    (item.visibility !== 'reference' || filters.showReference === true);
}

// A selected parent includes recorded descendants; a broad tag proves no country.
export function matchesRegion(recordedRegions = [], selectedRegions = []) {
  if (!selectedRegions.length) return true;
  return selectedRegions.some(selected => recordedRegions.some(region =>
    region === selected || regionCoverage.get(selected)?.has(region)
  ));
}

function matchesScope(regions = [], scope = 'all') {
  return scope === 'all' || regions.some(region => (scope === 'domestic' ? DOMESTIC_REGIONS : SEA_REGIONS).includes(region));
}
const matchesAny = (values = [], selected = []) => !selected.length || selected.some(value => values.includes(value));

function companyTerms(record, source) {
  return (record.companyIds || []).flatMap(id => {
    const company = source.companyLookup?.[id];
    if (!company) return [];
    return [company.name, company.legalName, ...(company.aliases || []), ...(company.securities || []).flatMap(security =>
      typeof security === 'string' ? [security] : [security.code, `${security.exchange}:${security.code}`]
    )].filter(Boolean);
  });
}

function matchesText(text, companyNames, terms) {
  const normalized = text.toLocaleLowerCase();
  return terms.every(term => normalized.includes(term) || companyNames.some(name => {
    const value = name.toLocaleLowerCase();
    return /^[a-z0-9.:_-]+$/i.test(term) ? value === term : value.includes(term);
  }));
}

function sourceText(source) {
  return textOf([source.name, source.purpose, source.organization, source.metrics || [], source.aliases || [], source.regions || [], source.questions || [], source.tags || []]);
}

function reportText(report, source) {
  return textOf([report.title, report.summary, report.dataPeriod, report.stage, report.regions || [], report.tags || [],
    report.originalPublisher, report.eventType, report.jurisdiction, source.name, source.organization]);
}

export function decorateSources(data) {
  const companyLookup = Object.fromEntries((data.companies || []).map(company => [company.id, company]));
  return data.sources.map(source => {
    const relatedReports = data.reports.filter(report => report.sourceId === source.id);
    return {
      ...source,
      types: unique(relatedReports.filter(report => isVisible(report)).map(report => report.kind)),
      topicIds: [...source.categoryIds],
      searchText: sourceText(source).toLocaleLowerCase(),
      relatedReports,
      companyLookup,
    };
  });
}

function matchesReport(report, source, filters) {
  return isVisible(report, filters) &&
    matchesAny([report.primaryCategoryId], filters.topics) &&
    (!filters.subcategory || report.primarySubcategoryId === filters.subcategory) &&
    matchesAny(report.companyIds, filters.companies) &&
    matchesScope(report.regions, filters.scope) && matchesRegion(report.regions, filters.regions) &&
    matchesAny([report.kind], filters.types) && matchesAny([report.access], filters.access) &&
    matchesAny([source.frequency], filters.frequency) &&
    matchesText(reportText(report, source), companyTerms(report, source), termsOf(filters.q));
}

function matchesSource(source, filters) {
  // A selected document type requires one complete article match, never inferred source types.
  return !filters.types.length && matchesAny(source.categoryIds, filters.topics) &&
    (!filters.subcategory || source.subcategoryIds?.includes(filters.subcategory)) &&
    matchesAny(source.companyIds, filters.companies) &&
    matchesScope(source.regions, filters.scope) && matchesRegion(source.regions, filters.regions) &&
    matchesAny([source.access], filters.access) && matchesAny([source.frequency], filters.frequency) &&
    matchesText(sourceText(source), companyTerms(source, source), termsOf(filters.q));
}

function relevance(item, terms) {
  const name = (item.name || item.title || '').toLocaleLowerCase();
  const purpose = (item.purpose || item.summary || '').toLocaleLowerCase();
  return terms.reduce((score, term) => score + (name.includes(term) ? 5 : 0) + (purpose.includes(term) ? 2 : 0), 0);
}

export function sortReportsByDate(reports) {
  return [...reports].sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
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
  const clean = normalizeFilters(filters);
  const seen = new Set();
  return sortItems(sources.filter(source => {
    if (seen.has(source.id) || !isVisible(source, clean)) return false;
    seen.add(source.id);
    return matchesSource(source, clean) || (source.relatedReports || []).some(report => matchesReport(report, source, clean));
  }), clean);
}

export function filterReports(reports, sources, filters = {}) {
  const clean = normalizeFilters(filters);
  const sourcesById = new Map(sources.map(source => [source.id, source]));
  const seen = new Set();
  return sortItems(reports.filter(report => {
    const source = sourcesById.get(report.sourceId);
    if (!source || seen.has(report.id) || !matchesReport(report, source, clean)) return false;
    seen.add(report.id);
    // Report visibility is independent of source visibility; explicit SMM archives live in data.
    return true;
  }), clean, true);
}

export function getSourceReports(source, filters = {}) {
  const clean = normalizeFilters(filters);
  return sortReportsByDate((source.relatedReports || []).filter(report => matchesReport(report, source, clean)));
}

export function getSourcePreview(source, filters = {}) {
  if (!isVisible(source, filters)) return null;
  return getSourceReports(source, filters)[0] || null;
}

export function getSeaSources(sources, filters = {}) {
  const clean = normalizeFilters(filters, 'southeast');
  const candidates = sources.filter(source => source.tags?.includes('东南亚专题') ||
    (source.relatedReports || []).some(report => matchesReport(report, source, clean)));
  return filterSources(candidates, clean);
}

export function getSeaReports(reports, sources, filters = {}) {
  return filterReports(reports, sources, normalizeFilters(filters, 'southeast-reports'));
}

export function groupReportsByRegion(reports) {
  const groups = [
    { id: 'domestic', label: '国内', items: [] },
    { id: 'sea', label: '东南亚', items: [] },
    { id: 'other', label: '其他 / 跨地区', items: [] },
  ];
  const seen = new Set();
  for (const report of reports) {
    if (seen.has(report.id)) continue;
    seen.add(report.id);
    const regions = report.regions || [];
    const group = regions.length && regions.every(region => DOMESTIC_REGIONS.includes(region)) ? 0
      : regions.length && regions.every(region => SEA_REGIONS.includes(region)) ? 1 : 2;
    groups[group].items.push(report);
  }
  return groups.filter(group => group.items.length);
}

export function getMatchReason(source, q, filters = {}) {
  const terms = termsOf(q);
  if (!terms.length) return null;
  const fields = [
    ['指标匹配', source.metrics], ['别名匹配', source.aliases], ['用途匹配', source.purpose],
    ['地区匹配', source.regions], ['机构匹配', source.organization], ['名称匹配', source.name],
    ['研究问题匹配', source.questions], ['标签匹配', source.tags], ['主体匹配', companyTerms(source, source)],
  ];
  for (const [label, value] of fields) {
    const matches = (Array.isArray(value) ? value : [value]).filter(item => item && terms.some(term => item.toLocaleLowerCase().includes(term)));
    if (matches.length) return { label, text: matches.join(' · ') };
  }
  const matching = getSourceReports(source, { ...filters, q })[0];
  return matching ? { label: '资料匹配', text: matching.title } : null;
}

export function getReportMatchReason(report, source, q) {
  const terms = termsOf(q);
  const visible = textOf([report.title, report.summary, report.dataPeriod, report.stage, report.regions || [], source.name]);
  if (!terms.length || includesAll(visible, terms)) return null;
  const companyNames = companyTerms(report, source);
  if (companyNames.some(name => terms.some(term => name.toLocaleLowerCase().includes(term)))) {
    return { label: '主体匹配', text: companyNames.join(' · ') };
  }
  return { label: '机构匹配', text: source.organization };
}

export function writeQuery(filters, view = 'sources', selectedId = null, navigation = {}) {
  const clean = normalizeFilters(filters, view);
  const params = new URLSearchParams();
  if (clean.q) params.set('q', clean.q);
  for (const key of Object.keys(allowed)) clean[key].forEach(value => params.append(key, value));
  if (clean.sort !== 'relevance') params.set('sort', clean.sort);
  if (extraViews.includes(view)) params.set('view', view);
  if (selectedId && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(selectedId)) params.set('source', selectedId);
  if (clean.showReference) params.set('showReference', '1');
  if (clean.subcategory) params.set('subcategory', clean.subcategory);
  for (const key of ['company', 'event']) if (navigation[key] && /^[a-z0-9][a-z0-9-]{0,100}$/.test(navigation[key])) params.set(key, navigation[key]);
  if (navigation.listedMode === 'sources') params.set('listedMode', 'sources');
  if (['acquisition','capital','contract','risk'].includes(navigation.eventType)) params.set('eventType',navigation.eventType);
  if (navigation.returnQuery && navigation.returnQuery.length < 4000) params.set('return',navigation.returnQuery);
  // Non-bare links carry scope explicitly; otherwise legacy-query parsing means all.
  if (clean.scope !== 'domestic' || params.size) params.set('scope', clean.scope);
  return params.toString();
}

export function readQuery(search = '') {
  const params = new URLSearchParams(search);
  const view = extraViews.includes(params.get('view')) ? params.get('view') : 'sources';
  const source = params.get('source');
  const selectedId = source && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(source) ? source : null;
  const filters = { q: params.get('q') || '', sort: params.get('sort'), showReference: params.get('showReference') === '1', subcategory: params.get('subcategory') };
  for (const key of Object.keys(allowed)) filters[key] = params.getAll(key);
  const clean = normalizeFilters(filters, view);
  const hasLegacyQuery = clean.q || Object.keys(allowed).some(key => clean[key].length) ||
    selectedId || extraViews.includes(params.get('view')) || params.get('view') === 'sources' ||
    ['name', 'verified'].includes(params.get('sort')) || clean.showReference;
  filters.scope = scopes.includes(params.get('scope')) ? params.get('scope') : hasLegacyQuery ? 'all' : 'domestic';
  const state = { filters: normalizeFilters(filters, view), view, selectedId };
  const notice = subcategoryNotice(filters, view);
  if (notice) state.notice = notice;
  if (params.has('company') || params.has('event') || params.has('listedMode') || params.has('return') || params.has('eventType')) {
    state.navigation = {};
    for (const key of ['company', 'event']) if (params.has(key)) state.navigation[key] = /^[a-z0-9][a-z0-9-]{0,100}$/.test(params.get(key)) ? params.get(key) : 'invalid-record';
    if (params.get('listedMode') === 'sources') state.navigation.listedMode = 'sources';
    if (['acquisition','capital','contract','risk'].includes(params.get('eventType'))) state.navigation.eventType=params.get('eventType');
    if (params.get('return') && params.get('return').length < 4000) state.navigation.returnQuery=params.get('return');
  }
  return state;
}

export function subcategoryNotice(filters, view = 'sources') {
  if (!filters.subcategory || normalizeFilters(filters, view).subcategory) return '';
  return normalizeFilters(filters, view).topics.length > 1
    ? '多方向联合检索暂不细分，已清除子方向。'
    : '子方向不属于当前单一研究方向或已失效，已清除；其他筛选条件保留。';
}

export function subcategoryCounts(data, sources, filters, reportsView = false) {
  return Object.fromEntries(SUBCATEGORIES.map(sub => {
    const scoped = { ...filters, topics: [sub.parentCategoryId], subcategory: sub.id };
    return [sub.id, (reportsView ? filterReports(data.reports, sources, scoped) : filterSources(sources, scoped)).length];
  }));
}

export function companyGroups(data) {
  const lookup = new Map(data.companies.map(company => [company.id, company]));
  return [
    { id: 'core', name: '核心公司', items: ['sinnet','xingyun','vnet','sharetronic','gds','hec'].map(id => lookup.get(id)).filter(Boolean) },
    { id: 'operator', name: '电信运营商', items: ['china-mobile','china-telecom','china-unicom-h'].map(id => lookup.get(id)).filter(Boolean) },
    { id: 'reference', name: '其他已收录主体', items: data.companies.filter(company => company.role === 'reference') },
  ];
}

export function milestoneReport(node, data) { return data.reports.find(report => report.id === node?.primaryEvidenceReportId); }
export function eventTimeline(event, data) {
  return [...event.milestones].sort((a,b) => (milestoneReport(b,data)?.publishedAt || '').localeCompare(milestoneReport(a,data)?.publishedAt || ''));
}
export function companyEvents(data, companyId, filters = {}) {
  const clean = normalizeFilters(filters);
  return (data.events || []).filter(event => isVisible(event, clean) && event.companyIds.includes(companyId) &&
    matchesScope(event.regions, clean.scope) && matchesRegion(event.regions, clean.regions) && (!filters.eventType || event.type === filters.eventType))
    .sort((a,b) => b.priority-a.priority || a.id.localeCompare(b.id));
}
export function companyReports(data, sources, companyId, filters = {}) {
  return filterReports(data.reports, sources, { ...filters, topics: [], subcategory: null, companies: [companyId] });
}
