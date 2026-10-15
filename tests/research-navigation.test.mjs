import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type: 'json' };
import { normalizeFilters, writeQuery, readQuery, decorateSources, filterReports, filterSources, companyGroups } from '../src/catalog.js';

const ids = items => items.map(item => item.id);
const companyIds = (fixture, filters) => companyGroups(fixture, filters).flatMap(group => ids(group.items));
const source = { id: 'fixture-source', name: '行业报道', organization: '测试媒体', purpose: '', aliases: [],
  questions: [], metrics: [], tags: [], regions: ['中国'], categoryIds: ['industry'], access: 'free', frequency: 'daily', visibility: 'active', companyIds: [] };
const report = (id, overrides = {}) => ({ id, sourceId: source.id, title: '项目建设', summary: '液冷项目建设',
  publishedAt: '2026-10-14', regions: ['中国'], primaryCategoryId: 'industry', access: 'free', kind: 'news',
  visibility: 'active', companyIds: ['range'], ...overrides });
const fixture = reports => ({ companies: data.companies, sources: [source], reports, events: [] });

test('domestic liquid-cooling seven-day search survives source, article and discovery URLs', () => {
  const filters = normalizeFilters({ q: '液冷', scope: 'domestic', dateWindow: '7', asOf: '2026-10-15', sort: 'published' });
  for (const view of ['sources', 'reports']) {
    for (const discovery of [undefined, 'articles', 'companies']) {
      const navigation = discovery ? { discovery } : {};
      const restored = readQuery(writeQuery(filters, view, null, navigation));
      assert.deepEqual(restored.filters, filters);
      assert.equal(restored.notice, undefined);
      assert.equal(restored.navigation?.discovery, discovery);
    }
  }
});

test('return query retains original keyword, region, fixed dates and article sorting', () => {
  const original = normalizeFilters({ q: '液冷', scope: 'domestic', regions: ['中国'], dateWindow: '7', asOf: '2026-10-15', sort: 'published' });
  const returnQuery = writeQuery(original, 'sources', null, { discovery: 'articles' });
  const navigation = { discovery: 'articles', report: 'fixture-report', returnQuery };
  const restored = readQuery(writeQuery(original, 'sources', null, navigation));
  assert.deepEqual(restored.navigation, navigation);
  assert.deepEqual(readQuery(restored.navigation.returnQuery).filters, original);
});

test('article and issue detail IDs initialize navigation without another route field and reject unsafe input', () => {
  for (const key of ['report', 'issue']) {
    assert.equal(readQuery(`?${key}=valid-record`).navigation[key], 'valid-record');
    assert.equal(readQuery(`?${key}=${'a'.repeat(180)}`).navigation[key], 'a'.repeat(180));
    for (const value of ['<script>', 'a/b', 'a'.repeat(181)]) {
      assert.equal(readQuery(`?${key}=${encodeURIComponent(value)}`).navigation[key], 'invalid-record');
      assert.equal(new URLSearchParams(writeQuery({}, 'sources', null, { [key]: value })).has(key), false);
    }
  }
});

test('invalid and future date windows keep explicit feedback on source and discovery routes', () => {
  for (const extra of ['', '&discover=articles']) {
    for (const date of ['2026-02-30', '2099-01-01', 'invalid']) {
      const restored = readQuery(`?q=液冷&dateWindow=7&asOf=${date}${extra}`);
      assert.equal(restored.filters.dateWindow, 'all');
      assert.equal(restored.filters.q, '液冷');
      assert.match(restored.notice, /日期条件无效/);
    }
  }
});

test('original publication sorting ignores keyword relevance and check time, with unknown dates last', () => {
  const reports = [report('old', { title: '液冷', publishedAt: '2026-10-01', verifiedAt: '2026-10-15' }),
    report('unknown', { title: '液冷', publishedAt: null }), report('new', { publishedAt: '2026-10-14', verifiedAt: '2026-10-14' })];
  const sources = decorateSources(fixture(reports));
  assert.deepEqual(ids(filterReports(reports, sources, { q: '液冷', sort: 'published' })), ['new', 'old', 'unknown']);
  assert.equal(normalizeFilters({ sort: 'published' }).sort, 'published');
});

test('dates are retained as article conditions without excluding matching source identities', () => {
  const reports = [report('old', { publishedAt: '2026-09-01' })];
  const sources = decorateSources(fixture(reports));
  const filters = readQuery('?q=液冷&scope=domestic&dateWindow=7&asOf=2026-10-15').filters;
  assert.deepEqual(ids(filterSources(sources, filters)), [source.id]);
  assert.deepEqual(filterReports(reports, sources, filters), []);
});

test('company results use confirmed identity or one matching linked report, retaining region and selection', () => {
  const d = fixture([report('range-news'), report('similar-title', { companyIds: ['hec'], title: '润泽相关行业背景', summary: '厂房扩建' })]);
  assert.deepEqual(companyIds(d, { scope: 'domestic', q: '300442' }), ['range']);
  assert.deepEqual(companyIds(d, { scope: 'domestic', q: '液冷' }), ['range']);
  assert.deepEqual(companyIds(d, { scope: 'sea', q: '润泽' }), []);
  assert.deepEqual(companyIds(d, { scope: 'domestic', q: '液冷', companies: ['hec'] }), []);
  assert.deepEqual(companyIds(d, { scope: 'domestic', q: 'not-found' }), []);
  assert.deepEqual(companyIds(d, { scope: 'domestic', q: '润泽' }).sort(), ['hec', 'range']);
  assert.deepEqual(ids(filterReports(d.reports, decorateSources(d), { companies: ['range'] })), ['range-news']);
});

test('full confirmed English company names can find explicitly linked media articles', () => {
  const d = fixture([report('gds-news', { companyIds: ['gds'] })]);
  assert.deepEqual(ids(filterReports(d.reports, decorateSources(d), { q: 'GDS Holdings Limited' })), ['gds-news']);
  assert.deepEqual(companyIds(d, { q: 'GDS Holdings Limited' }), ['gds']);
});
