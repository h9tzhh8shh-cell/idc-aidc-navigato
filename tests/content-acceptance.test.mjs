import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type: 'json' };
import { decorateSources, filterReports, getSeaReports, getSourcePreview } from '../src/catalog.js';

const sources = decorateSources(data);
test('A22/A23: confirmed six core issuers and three operator brands retain legal identities', () => {
  assert.deepEqual(data.companies.filter(company => company.role === 'core').map(company => company.id).sort(), ['gds', 'hec', 'sharetronic', 'sinnet', 'vnet', 'xingyun']);
  for (const id of ['sinnet', 'xingyun', 'vnet', 'sharetronic', 'gds', 'hec', 'china-mobile', 'china-telecom', 'china-unicom-h']) {
    assert.ok(data.sources.some(source => source.companyIds?.includes(id)), id);
    assert.ok(data.reports.some(report => report.visibility === 'active' && report.companyIds.includes(id)), id);
  }
  const xingyun = data.companies.find(company => company.id === 'xingyun');
  assert.ok(xingyun.securities.some(security => security.code === '300209'));
  assert.ok(!xingyun.aliases.includes('行云集团'));
  const unicom = data.companies.find(company => company.id === 'china-unicom-h');
  assert.ok(!unicom.securities.some(security => security.code === '600050'));
});

test('A06/A15: actual domestic issuer Malaysia planning disclosure enters SEA with unknown first publication', () => {
  const report = data.reports.find(item => item.id === 'sinnet-2026-h1-summary');
  assert.equal(report.publishedAt, null);
  assert.equal(report.uploadedAt, '2026-09-01');
  assert.match(report.summary, /前期筹划/);
  const filters = { scope: 'sea', regions: ['马来西亚'], q: '光环新网' };
  assert.ok(getSeaReports(data.reports, sources, filters).some(item => item.id === report.id));
  assert.equal(getSourcePreview(sources.find(source => source.id === report.sourceId), filters).id, report.id);
});

test('A12/A24: broker gaps and unread evidence never count as admitted full reports', () => {
  assert.equal(data.reports.filter(report => report.kind === 'broker-report' && report.visibility === 'active').length, 0);
  assert.equal(data.sources.find(source => source.id === 'philippines-boi').visibility, 'reference');
  for (const id of ['stcn-industry', 'yicai-industry']) assert.ok(data.reports.some(report => report.sourceId === id && report.visibility === 'active' && report.originalUrl));
  assert.equal(data.reports.find(report => report.id === 'sharetronic-2026-h1-summary').contentScope, 'abstract');
  assert.equal(data.reports.find(report => report.id === 'china-unicom-h-2026-interim-release').contentScope, 'partial');
});

test('A15/A23: Hong Kong consultation remains a consultation, with its future deadline', () => {
  const report = data.reports.find(item => item.id === 'hkex-corporate-transactions-consultation-20260921');
  assert.equal(report.documentStatus, '征求意见');
  assert.equal(report.deadlineAt, '2026-11-30');
  assert.equal(report.effectiveAt, null);
  assert.deepEqual(report.regions, ['中国香港']);
  assert.ok(filterReports(data.reports, sources, { scope: 'domestic', topics: ['regulation'] }).some(item => item.id === report.id));
});
