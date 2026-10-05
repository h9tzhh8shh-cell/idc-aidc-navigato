import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorateSources, matchesRegion, filterSources, getMatchReason, filterReports, readQuery, writeQuery } from '../src/catalog.js';

const data = JSON.parse(readFileSync(new URL('../public/assets/catalog.json', import.meta.url), 'utf8'));
const sources = decorateSources(data);

test('decoration preserves every original source field and links only its own reports', () => {
  assert.equal(sources.length, data.sources.length);
  for (const source of sources) {
    const { types, topicIds, searchText, relatedReports, ...original } = source;
    assert.deepEqual(original, data.sources.find(item => item.id === source.id));
    assert.deepEqual(relatedReports, data.reports.filter(report => report.sourceId === source.id));
    assert.equal(typeof searchText, 'string');
    assert.ok(Array.isArray(types) && Array.isArray(topicIds));
  }
});

test('regions include recorded APAC descendants but never infer country coverage from a broad tag', () => {
  assert.equal(matchesRegion(['马来西亚'], ['亚太']), true);
  assert.equal(matchesRegion(['新加坡'], ['东南亚']), true);
  assert.equal(matchesRegion(['中国'], ['亚太']), true);
  assert.equal(matchesRegion(['亚太'], ['马来西亚']), false);
  assert.equal(matchesRegion(['全球'], ['中国']), false);
  assert.equal(matchesRegion(['中国'], ['北美']), false);
  assert.equal(matchesRegion(['中国'], ['北美', '中国']), true);
  assert.equal(matchesRegion(['马来西亚'], ['新加坡']), false);
  assert.ok(filterSources(sources, { regions: ['亚太'] }).some(source => source.id === 'cushman-apac-datacenter'));
});

test('rental coverage uses recorded regions, preserves all five sources, and parent/child URLs de-duplicate', () => {
  assert.deepEqual(filterSources(sources, { topics: ['rental'] }).map(s => s.id), ['smm-rental', 'smm-weekly', 'mysteel-computing', 'ornn-gpu', 'semianalysis-gpu']);
  assert.deepEqual(filterSources(sources, { topics: ['rental'], regions: ['亚太'] }).map(s => s.id), ['smm-rental', 'smm-weekly', 'mysteel-computing']);
  assert.deepEqual(filterSources(sources, { topics: ['rental'], regions: ['马来西亚'] }), []);
  assert.deepEqual(filterSources(sources, { topics: ['rental'], regions: ['全球'] }).map(s => s.id), ['ornn-gpu', 'semianalysis-gpu']);
  assert.equal(filterSources(sources, { topics: ['rental'], regions: ['亚太'], q: '数据中心' }).length, 0);
  assert.deepEqual(readQuery('?regions=亚太&regions=中国&regions=东南亚&regions=马来西亚&regions=马来西亚').filters.regions, ['亚太']);
});

test('multiword search is case insensitive AND across source fields', () => {
  const results = filterSources(sources, { q: 'h100 北美' });
  assert.deepEqual(results.map(source => source.id), ['mysteel-computing']);
  assert.equal(filterSources(sources, { q: 'H100 不存在的词' }).length, 0);
  assert.equal(filterSources(sources, { q: '  h100  北美  ' }).length, 1);
});

test('dimensions combine with AND while choices within a dimension combine with OR', () => {
  const results = filterSources(sources, { topics: ['rental'], regions: ['中国'], access: ['free', 'registration'], frequency: ['daily'] });
  assert.deepEqual(new Set(results.map(source => source.id)), new Set(['smm-rental', 'mysteel-computing']));
  assert.equal(filterSources(sources, { topics: ['financial'], access: ['registration'], q: 'H100' }).length, 0);
});

test('derived types and topics use source/report evidence without replacing original categories', () => {
  assert.ok(sources.find(source => source.id === 'wmedia-sea').types.includes('news'));
  assert.ok(sources.find(source => source.id === 'gds-quarterly').types.includes('disclosure'));
  assert.ok(sources.find(source => source.id === 'imda-datacenter-policy').topicIds.includes('policy'));
  assert.ok(!sources.find(source => source.id === 'cbre-datacenter').topicIds.includes('financial'));
  assert.ok(sources.find(source => source.id === 'smm-rental').types.includes('methodology'));
});

test('explicit report country never inherits the multi-country source coverage', () => {
  const singapore = filterReports(data.reports, sources, { regions: ['新加坡'] });
  assert.ok(!singapore.some(report => report.id === 'dcbyte-global-index-2026'));
  assert.ok(!singapore.some(report => report.id === 'wmedia-stavian-feasibility-20261002'));
  assert.ok(singapore.some(report => report.id === 'singtel-fy2027-q1-update'));
  assert.ok(filterReports(data.reports, sources, { regions: ['亚太'] }).some(report => report.id === 'dcbyte-global-index-2026'));
  assert.equal(filterReports(data.reports, sources, { q: '越南 Stavian', regions: ['新加坡'] }).length, 0);
});

test('report type filtering considers that report rather than every type available at its source', () => {
  const selected = filterReports(data.reports, sources, { types: ['disclosure'], topics: ['financial'], access: ['free'] });
  assert.ok(selected.length > 0);
  assert.ok(selected.every(report => ['gds-quarterly', 'vnet-quarterly', 'singtel-nxera-results'].includes(report.sourceId)));
  assert.equal(filterReports(data.reports, sources, { types: ['methodology'], q: 'H200长协' }).length, 0);
});

test('match explanations identify real matching metadata and verified sorting leaves undated sources last', () => {
  const smm = sources.find(source => source.id === 'smm-rental');
  assert.deepEqual(getMatchReason(smm, 'H100'), { label: '别名匹配', text: 'H100' });
  assert.equal(getMatchReason(smm, 'not-a-match'), null);
  assert.equal(getMatchReason(smm, ''), null);
  const sorted = filterSources(sources, { sort: 'verified' });
  const firstUndated = sorted.findIndex(source => !source.verifiedAt);
  assert.ok(firstUndated > 0);
  assert.ok(sorted.slice(firstUndated).every(source => !source.verifiedAt));
});

test('reports prioritize keyword relevance then publication date; empty queries use date without changing source order', () => {
  const reports = [
    { id: 'older', sourceId: 'smm-rental', kind: 'report', title: 'H100 旧报告', publishedAt: '2025-01-01' },
    { id: 'unknown', sourceId: 'smm-rental', kind: 'report', title: 'H100 待确认日期', publishedAt: null },
    { id: 'summary', sourceId: 'smm-rental', kind: 'report', title: '市场更新', summary: 'H100 的情况', publishedAt: '2026-10-01' },
    { id: 'newer', sourceId: 'smm-rental', kind: 'report', title: 'H100 新报告', publishedAt: '2026-09-01' },
  ];
  assert.deepEqual(filterReports(reports, sources, { q: 'H100' }).map(report => report.id), ['newer', 'older', 'unknown', 'summary']);
  assert.deepEqual(filterReports(reports, sources).map(report => report.id), ['summary', 'newer', 'older', 'unknown']);
  assert.deepEqual(filterSources(sources).map(source => source.id), sources.map(source => source.id));
});

test('URL state round-trips filters, view and detail while dropping invalid/duplicate options', () => {
  const filters = { q: 'H100 北美', topics: ['rental'], regions: ['北美', '中国'], types: ['methodology'], access: ['free', 'mixed'], frequency: ['daily'], sort: 'verified' };
  for (const view of ['sources', 'reports', 'southeast', 'southeast-reports']) {
    assert.deepEqual(readQuery(writeQuery(filters, view, 'smm-rental')), { filters, view, selectedId: 'smm-rental' });
  }
  const clean = readQuery('?topics=unknown&regions=北美&regions=北美&regions=火星&access=admin&sort=bad&view=bad&source=%3Cscript%3E');
  assert.deepEqual(clean.filters.regions, ['北美']);
  assert.deepEqual(clean.filters.topics, []);
  assert.deepEqual(clean.filters.access, []);
  assert.equal(clean.filters.sort, 'relevance');
  assert.equal(clean.view, 'sources');
  assert.equal(clean.selectedId, null);
  assert.equal(writeQuery(readQuery('').filters), '');
});
