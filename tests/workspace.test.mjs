import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TOPICS, INFO_TYPES, decorateSources, matchesRegion, filterSources, getMatchReason,
  filterReports, readQuery, writeQuery, normalizeFilters, isVisible, getSourcePreview,
  getSourceReports, getSeaReports, getSeaSources, groupReportsByRegion,
} from '../src/catalog.js';
import { kindLabels } from '../src/domain/catalog.js';

const data = JSON.parse(readFileSync(new URL('../public/assets/catalog.json', import.meta.url), 'utf8'));
const sources = decorateSources(data);
const ids = items => items.map(item => item.id);

// These examples are test fixtures only and never enter the maintained catalog.
function source(overrides = {}) {
  return {
    id: 'fixture-source', name: '示例研究入口', organization: '示例机构',
    categoryIds: ['industry'], regions: ['中国'], access: 'mixed', frequency: 'daily',
    purpose: '用于行为测试', aliases: [], metrics: [], questions: [], tags: [],
    visibility: 'active', companyIds: [], ...overrides,
  };
}
function report(overrides = {}) {
  return {
    id: 'fixture-report', sourceId: 'fixture-source', title: '建设记录', summary: '拟建设项目，尚未投运。',
    primaryCategoryId: 'industry', regions: ['中国'], access: 'free', kind: 'news',
    judgmentTypes: ['fact'], contentScope: 'full', visibility: 'active', companyIds: [],
    publishedAt: '2026-10-01', verifiedAt: '2026-10-04', url: 'https://example.com/record', ...overrides,
  };
}
function fixture(reports = [report()], records = [source()], companies = []) {
  return decorateSources({ sources: records, reports, companies });
}

test('A01: topic labels come from the only maintained dictionary and kinds use domain labels', () => {
  assert.deepEqual(TOPICS, data.categories.map(item => ({ id: item.id, label: item.name })));
  assert.deepEqual(ids(TOPICS), ['industry', 'rental-prices', 'policy-planning', 'regulation', 'listed-companies']);
  assert.deepEqual(INFO_TYPES, Object.entries(kindLabels).map(([id, label]) => ({ id, label })));
});

test('decoration preserves original source fields, explicit categories and linked report identities', () => {
  assert.equal(sources.length, data.sources.length);
  for (const decorated of sources) {
    const { types, topicIds, searchText, relatedReports, companyLookup, ...original } = decorated;
    assert.deepEqual(original, data.sources.find(item => item.id === decorated.id));
    assert.deepEqual(relatedReports, data.reports.filter(item => item.sourceId === decorated.id));
    assert.deepEqual(topicIds, original.categoryIds);
    assert.equal(typeof searchText, 'string');
    assert.ok(Array.isArray(types));
    assert.equal(Object.keys(companyLookup).length, data.companies.length);
  }
});

test('regions include recorded descendants but never infer countries from global or APAC labels', () => {
  assert.equal(matchesRegion(['马来西亚'], ['亚太']), true);
  assert.equal(matchesRegion(['新加坡'], ['东南亚']), true);
  assert.equal(matchesRegion(['中国香港'], ['亚太']), true);
  assert.equal(matchesRegion(['亚太'], ['马来西亚']), false);
  assert.equal(matchesRegion(['全球'], ['中国']), false);
  assert.equal(matchesRegion(['中国'], ['北美']), false);
  assert.equal(matchesRegion(['中国'], ['北美', '中国']), true);
  assert.equal(matchesRegion(['马来西亚'], ['新加坡']), false);
  assert.deepEqual(readQuery('?regions=亚太&regions=中国&regions=东南亚&regions=马来西亚').filters.regions, ['亚太']);
});

test('A02: source wording and other documents cannot reclassify an article', () => {
  const vietnam = report({ regions: ['越南'], title: '越南可研', primaryCategoryId: 'industry' });
  const docs = [vietnam, report({ id: 'other', primaryCategoryId: 'regulation', title: '许可审批' })];
  const before = fixture(docs);
  const after = fixture(docs, [source({ purpose: '政策许可审批', categoryIds: ['regulation'] })]);
  for (const set of [before, after]) {
    assert.deepEqual(ids(filterReports(docs, set, { regions: ['越南'], topics: ['industry'] })), [vietnam.id]);
    assert.deepEqual(filterReports(docs, set, { regions: ['越南'], topics: ['regulation'] }), []);
  }
});

test('A03: migrated project, power, procedure and earnings records have one explicit correct category', () => {
  const expected = {
    'wmedia-stavian-feasibility-20261002': 'industry',
    'dayone-tnb-power-20260901': 'industry',
    'wmedia-thailand-draft-20260923': 'regulation',
    'erc-data-center-boi-clarification-20261005': 'regulation',
    'gds-2026-q2': 'listed-companies',
    'vnet-2026-q2': 'listed-companies',
  };
  for (const [id, category] of Object.entries(expected)) {
    assert.equal(data.reports.find(item => item.id === id)?.primaryCategoryId, category, id);
    assert.equal(data.reports.filter(item => item.id === id).length, 1);
  }
});

test('A04: renaming company sources cannot change disclosure and acquisition filtering', () => {
  const docs = [report({ primaryCategoryId: 'listed-companies', kind: 'disclosure', title: '拟收购公告' })];
  const filters = { topics: ['listed-companies'], types: ['disclosure'] };
  for (const name of ['季度财报', '公司动态']) {
    assert.deepEqual(ids(filterReports(docs, fixture(docs, [source({ name })]), filters)), ['fixture-report']);
  }
});

test('A05: unknown and broad article regions never inherit source countries, even in keyword search', () => {
  const docs = [report({ id: 'unknown', regions: [] }), report({ id: 'global', regions: ['全球'] }), report({ id: 'apac', regions: ['亚太'] })];
  const set = fixture(docs, [source({ regions: ['中国', '泰国'], aliases: ['泰国'] })]);
  assert.equal(filterReports(docs, set, { scope: 'domestic' }).length, 0);
  assert.equal(filterReports(docs, set, { regions: ['泰国'] }).length, 0);
  assert.equal(filterReports(docs, set, { q: '泰国' }).length, 0);
  assert.equal(filterReports(docs, set, { scope: 'all' }).length, 3);
});

test('A06: an untagged domestic publisher’s Malaysia article enters both SEA article and source results', () => {
  const docs = [report({ regions: ['马来西亚'] })];
  const set = fixture(docs);
  assert.deepEqual(ids(getSeaReports(docs, set)), ['fixture-report']);
  assert.deepEqual(ids(getSeaSources(set)), ['fixture-source']);
  assert.equal(getSeaReports(docs, set, { regions: ['泰国'] }).length, 0);
  assert.equal(getSeaSources(set, { regions: ['泰国'] }).length, 0);
});

test('A07: SEA views intersect country filters and recover to six countries on incompatible input', () => {
  const mixed = readQuery('?view=southeast-reports&scope=domestic&regions=中国&regions=泰国');
  assert.equal(mixed.filters.scope, 'sea');
  assert.deepEqual(mixed.filters.regions, ['泰国']);
  for (const region of ['中国', '中国香港', '全球', '火星']) {
    const state = readQuery(`?view=southeast&scope=domestic&regions=${region}`);
    assert.equal(state.filters.scope, 'sea');
    assert.deepEqual(state.filters.regions, []);
    const docs = [report(), report({ id: 'sea', regions: ['马来西亚'] })];
    assert.deepEqual(ids(getSeaReports(docs, fixture(docs), state.filters)), ['sea']);
  }
});

test('A08: bare or wholly invalid queries default to domestic; global labels do not count as domestic', () => {
  for (const query of ['', '?', '?unused=1', '?topics=unknown&regions=火星&scope=bad&view=bad&source=%3Cscript%3E']) {
    assert.equal(readQuery(query).filters.scope, 'domestic');
  }
  const docs = [report(), report({ id: 'hk', regions: ['中国香港'] }), report({ id: 'global', regions: ['全球'] })];
  assert.deepEqual(ids(filterReports(docs, fixture(docs), readQuery('').filters)), ['fixture-report', 'hk']);
  assert.equal(writeQuery(readQuery('').filters), '');
});

test('A09: explicit all scope survives URL restoration, clearing ordinary filters and view changes', () => {
  const filters = normalizeFilters({ scope: 'all', q: '研究', topics: ['industry'], showReference: true });
  for (const view of ['sources', 'reports']) {
    assert.deepEqual(readQuery(writeQuery(filters, view)).filters, filters);
  }
  const cleared = normalizeFilters({ scope: filters.scope });
  assert.equal(writeQuery(cleared), 'scope=all');
  assert.equal(readQuery(writeQuery(cleared)).filters.scope, 'all');
  const sea = normalizeFilters(filters, 'southeast');
  assert.equal(normalizeFilters(sea, 'reports').scope, 'sea');
});

test('A10: old topics map before cleaning and legacy queries/details preserve all-region semantics', () => {
  const restored = readQuery('?topics=infrastructure&topics=market&topics=rental&topics=financial&topics=policy');
  assert.deepEqual(restored.filters.topics, ['industry', 'rental-prices', 'listed-companies', 'policy-planning', 'regulation']);
  assert.equal(restored.filters.scope, 'all');
  for (const query of ['?q=H100', '?types=news', '?source=smm-weekly', '?view=reports', '?view=sources']) {
    assert.equal(readQuery(query).filters.scope, 'all', query);
  }
  assert.equal(readQuery('?source=smm-weekly').selectedId, 'smm-weekly');
  assert.equal(readQuery('?scope=domestic&q=H100').filters.scope, 'domestic');
});

test('explicit regions override conflicting ordinary scope and parent selections de-duplicate', () => {
  assert.equal(readQuery('?scope=domestic&regions=马来西亚').filters.scope, 'sea');
  assert.equal(readQuery('?scope=sea&regions=中国香港').filters.scope, 'domestic');
  assert.equal(readQuery('?scope=domestic&regions=中国&regions=马来西亚').filters.scope, 'all');
  assert.equal(readQuery('?scope=domestic&regions=亚太').filters.scope, 'all');
  assert.deepEqual(readQuery('?regions=北美&regions=北美&regions=火星').filters.regions, ['北美']);
});

test('URL state round-trips valid ordinary and SEA states while rejecting unsafe details and options', () => {
  const input = { q: 'H100 北美', topics: ['rental-prices'], regions: ['北美', '中国'], types: ['methodology'], access: ['free', 'mixed'], frequency: ['daily'], sort: 'verified', scope: 'all', showReference: true };
  for (const view of ['sources', 'reports', 'southeast', 'southeast-reports']) {
    assert.deepEqual(readQuery(writeQuery(input, view, 'smm-rental')), { filters: normalizeFilters(input, view), view, selectedId: 'smm-rental' });
  }
  const clean = readQuery('?access=admin&sort=bad&view=bad&source=%3Cscript%3E');
  assert.deepEqual(clean.filters.access, []);
  assert.equal(clean.filters.sort, 'relevance');
  assert.equal(clean.view, 'sources');
  assert.equal(clean.selectedId, null);
});

test('A11: mixed source cannot veto a free matching article’s topic, country or access', () => {
  const docs = [report({ title: '公开扩建资料', regions: ['泰国'], primaryCategoryId: 'regulation' })];
  const set = fixture(docs);
  const filters = { q: '公开扩建资料', topics: ['regulation'], regions: ['泰国'], access: ['free'] };
  assert.deepEqual(ids(filterReports(docs, set, filters)), ['fixture-report']);
  assert.deepEqual(ids(filterSources(set, filters)), ['fixture-source']);
  assert.equal(getSourcePreview(set[0], filters).id, 'fixture-report');
  assert.equal(filterSources(set, { ...filters, frequency: ['monthly'] }).length, 0);
});

test('A13: source preview fully matches current filters and ignores source coverage', () => {
  const docs = [
    report({ id: 'vietnam', title: '越南可研', regions: ['越南'], publishedAt: '2026-10-07' }),
    report({ id: 'thailand', title: '泰国草案', regions: ['泰国'], primaryCategoryId: 'regulation', publishedAt: '2026-09-23' }),
  ];
  const set = fixture(docs, [source({ regions: ['越南', '泰国'], categoryIds: ['industry', 'regulation'] })]);
  const filters = { regions: ['泰国'], topics: ['regulation'] };
  assert.equal(getSourcePreview(set[0], filters).id, 'thailand');
  assert.equal(getSourcePreview(set[0], { ...filters, q: '越南可研' }), null);
  assert.equal(getSourcePreview(set[0], { ...filters, types: ['report'] }), null);
  assert.equal(getSourcePreview(fixture([], [source()])[0]), null);
});

test('A14: source search cannot stitch words, topic or country from different articles', () => {
  const docs = [
    report({ id: 'thai', title: '独特项目', regions: ['泰国'] }),
    report({ id: 'rule', title: '特殊许可', regions: ['印尼'], primaryCategoryId: 'regulation' }),
  ];
  const set = fixture(docs);
  assert.equal(filterSources(set, { q: '独特项目', topics: ['regulation'], regions: ['泰国'] }).length, 0);
  assert.equal(filterSources(set, { q: '独特项目 特殊许可' }).length, 0);
  assert.equal(filterSources(set, { topics: ['regulation'], regions: ['泰国'] }).length, 0);
  assert.deepEqual(ids(filterSources(set, { q: '特殊许可 示例机构', regions: ['印尼'] })), ['fixture-source']);
});

test('type selection requires one matching visible article, not publisher identity or inferred source type', () => {
  const docs = [report({ regions: ['泰国'], kind: 'news' }), report({ id: 'method', kind: 'methodology' })];
  const set = fixture(docs, [source({ sourceType: 'government', methodologyUrl: 'https://example.com/method' })]);
  assert.equal(filterSources(set, { regions: ['泰国'], types: ['methodology'] }).length, 0);
  assert.equal(filterSources(fixture([], [source({ sourceType: 'media' })]), { types: ['news'] }).length, 0);
  assert.deepEqual(ids(filterReports(docs, set, { types: ['news'] })), ['fixture-report']);
  assert.equal(filterReports(docs, set, { types: ['disclosure'] }).length, 0);
});

test('source metadata may match with an honest empty preview when no article matches', () => {
  const set = fixture([], [source({ categoryIds: ['regulation'], regions: ['泰国'], access: 'free' })]);
  const filters = { topics: ['regulation'], regions: ['泰国'], access: ['free'] };
  assert.deepEqual(ids(filterSources(set, filters)), ['fixture-source']);
  assert.equal(getSourcePreview(set[0], filters), null);
});

test('search is case insensitive AND and dimensions are AND with OR inside each dimension', () => {
  const set = fixture([], [
    source({ name: 'H100', aliases: ['北美'], categoryIds: ['rental-prices'], access: 'free' }),
    source({ id: 'registered', name: 'H100', aliases: ['北美'], categoryIds: ['rental-prices'], access: 'registration' }),
    source({ id: 'monthly', name: 'H100', aliases: ['北美'], categoryIds: ['rental-prices'], access: 'free', frequency: 'monthly' }),
  ]);
  const filters = { q: '  h100   北美 ', topics: ['rental-prices'], regions: ['中国'], access: ['free', 'registration'], frequency: ['daily'] };
  assert.deepEqual(ids(filterSources(set, filters)), ['fixture-source', 'registered']);
  assert.equal(filterSources(set, { ...filters, q: 'H100 不存在的词' }).length, 0);
});

test('company IDs search verified issuer aliases and full codes without spreading another article’s subjects', () => {
  const companies = [{ id: 'fixture-company', name: '示例上市公司', legalName: '示例股份有限公司', aliases: ['历史名称'], securities: [{ exchange: 'SZSE', code: '300209' }] }];
  const docs = [report({ id: 'company-project', companyIds: ['fixture-company'] }), report({ id: 'unrelated', title: '其他文章' })];
  const set = fixture(docs, [source()], companies);
  for (const q of ['示例上市公司', '历史名称', '300209', 'szse:300209']) {
    assert.deepEqual(ids(filterReports(docs, set, { q })), ['company-project']);
    assert.deepEqual(ids(filterSources(set, { q })), ['fixture-source']);
  }
  assert.equal(filterReports(docs, set, { q: '209' }).length, 0);
  assert.equal(filterReports(docs, set, { q: '300209 其他文章' }).length, 0);
});

test('A15: previews use publication date, unknown dates last, stable ties and no list-sort or check-date override', () => {
  const docs = [
    report({ id: 'unknown', publishedAt: null }),
    report({ id: 'old', title: 'A old', publishedAt: '2025-01-01', verifiedAt: '2026-10-08' }),
    report({ id: 'new', title: 'Z new', publishedAt: '2026-10-01', verifiedAt: '2026-10-02' }),
    report({ id: 'same-day', publishedAt: '2026-10-01' }),
  ];
  const set = fixture(docs);
  for (const sort of ['relevance', 'name', 'verified']) {
    assert.equal(getSourcePreview(set[0], { sort }).id, 'new');
    assert.deepEqual(ids(getSourceReports(set[0], { sort })), ['new', 'same-day', 'old', 'unknown']);
  }
  assert.equal(docs[0].publishedAt, null);
  assert.equal(docs[1].publishedAt, '2025-01-01');
});

test('reports prioritize relevance then publication date while empty source queries preserve source order', () => {
  const docs = [
    report({ id: 'older', title: 'H100 旧报告', publishedAt: '2025-01-01' }),
    report({ id: 'unknown', title: 'H100 待确认日期', publishedAt: null }),
    report({ id: 'summary', title: '市场更新', summary: 'H100 的情况', publishedAt: '2026-10-01' }),
    report({ id: 'newer', title: 'H100 新报告', publishedAt: '2026-09-01' }),
  ];
  const set = fixture(docs, [source(), source({ id: 'second' })]);
  assert.deepEqual(ids(filterReports(docs, set, { q: 'H100' })), ['newer', 'older', 'unknown', 'summary']);
  assert.deepEqual(ids(filterReports(docs, set)), ['summary', 'newer', 'older', 'unknown']);
  assert.deepEqual(ids(filterSources(set)), ids(set));
});

test('A17: reference is opt-in; archives and confirmed duplicates never enter results or previews', () => {
  const docs = [report(), report({ id: 'reference', visibility: 'reference', publishedAt: '2026-10-02' }),
    report({ id: 'archived', visibility: 'archived', publishedAt: '2026-10-03' }),
    report({ id: 'duplicate', duplicateOf: 'fixture-report', publishedAt: '2026-10-04' })];
  const set = fixture(docs);
  assert.deepEqual(ids(filterReports(docs, set)), ['fixture-report']);
  assert.deepEqual(ids(filterReports(docs, set, { showReference: true })), ['reference', 'fixture-report']);
  assert.equal(getSourcePreview(set[0]).id, 'fixture-report');
  assert.equal(getSourcePreview(set[0], { showReference: true }).id, 'reference');
  assert.equal(isVisible({ visibility: 'archived' }, { showReference: true }), false);
  assert.equal(isVisible({ visibility: 'reference' }), false);
});

test('source and report visibility are independent and duplicate IDs are counted once', () => {
  const docs = [report()];
  for (const visibility of ['reference', 'archived']) {
    const set = fixture(docs, [source({ visibility })]);
    assert.equal(filterSources(set).length, 0);
    assert.deepEqual(ids(filterReports(docs, set)), ['fixture-report']);
  }
  const set = fixture(docs);
  assert.equal(filterSources([...set, ...set]).length, 1);
  assert.equal(filterReports([...docs, ...docs], set).length, 1);
});

test('A18/A19: different event stages and dated snapshots with the same URL remain separate', () => {
  const docs = [report({ id: 'planned', eventId: 'project', stage: '拟建设', publishedAt: '2026-09-01' }),
    report({ id: 'started', eventId: 'project', stage: '开工', publishedAt: '2026-10-01' })];
  assert.equal(filterReports(docs, fixture(docs)).length, 2);
  assert.deepEqual(ids(getSourceReports(fixture(docs)[0])), ['started', 'planned']);
});

test('policy and regulation region groups are exclusive, with Hong Kong domestic and cross-region once', () => {
  const docs = [report({ id: 'hk', regions: ['中国香港'] }), report({ id: 'sea', regions: ['泰国', '越南'] }),
    report({ id: 'cross', regions: ['中国', '马来西亚'] }), report({ id: 'unknown', regions: [] })];
  const groups = groupReportsByRegion([...docs, docs[2]]);
  assert.deepEqual(groups.map(group => [group.id, ids(group.items)]), [
    ['domestic', ['hk']], ['sea', ['sea']], ['other', ['cross', 'unknown']],
  ]);
});

test('match explanations use matching metadata or a matching article; verified sort keeps undated last', () => {
  const smm = sources.find(item => item.id === 'smm-rental');
  assert.deepEqual(getMatchReason(smm, 'H100'), { label: '别名匹配', text: 'H100' });
  assert.equal(getMatchReason(smm, 'not-a-match'), null);
  assert.equal(getMatchReason(smm, ''), null);
  const set = fixture([report({ title: '独特文章' })]);
  assert.deepEqual(getMatchReason(set[0], '独特文章'), { label: '资料匹配', text: '独特文章' });
  const sorted = filterSources(fixture([], [source({ id: 'unknown', verifiedAt: null }), source({ verifiedAt: '2026-10-04' })]), { sort: 'verified' });
  assert.deepEqual(ids(sorted), ['fixture-source', 'unknown']);
});

test('A20/A21: SMM spot source remains, weekly source and historic lead stay archived even with reference enabled', () => {
  assert.equal(data.sources.find(item => item.id === 'smm-rental').visibility, 'active');
  assert.equal(data.sources.find(item => item.id === 'smm-weekly').visibility, 'archived');
  assert.equal(data.reports.find(item => item.id === 'smm-weekly-public-commentary-104134387').visibility, 'archived');
  for (const showReference of [false, true]) {
    const displayed = filterSources(sources, { topics: ['rental-prices'], showReference });
    assert.ok(displayed.some(item => item.id === 'smm-rental'));
    assert.ok(!displayed.some(item => item.id === 'smm-weekly'));
    assert.ok(!filterReports(data.reports, sources, { showReference }).some(item => item.sourceId === 'smm-weekly'));
    assert.equal(getSourcePreview(sources.find(item => item.id === 'smm-weekly'), { showReference }), null);
  }
  assert.ok(data.reports.some(item => item.sourceId === 'smm-rental'));
  assert.equal(readQuery('?source=smm-weekly').selectedId, 'smm-weekly');
});
