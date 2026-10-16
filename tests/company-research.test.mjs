import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type: 'json' };
import { companyRegistry, companySearchTerms, companyMatchesQuery, companyCoverage } from '../src/domain/company-research.js';

const range = data.companies.find(company => company.id === 'range');
const linkedReports = company => data.reports.filter(report => report.companyIds.includes(company.id));

test('company registry includes every confirmed company, including Runze and other reference companies', () => {
  assert.deepEqual(companyRegistry(data).map(company => company.id), data.companies.map(company => company.id));
  assert.ok(companyRegistry(data).includes(range));
  for (const query of ['润泽', range.name, range.legalName, '300442', '深交所:300442']) {
    assert.deepEqual(companyRegistry(data).filter(company => companyMatchesQuery(company, query)).map(company => company.id), ['range']);
  }
});

test('confirmed English aliases and legal names resolve to the same company', () => {
  const gds = data.companies.find(company => company.id === 'gds');
  for (const query of ['万国数据', 'GDS', 'gds holdings limited', 'NASDAQ:GDS', '9698']) {
    assert.ok(companyMatchesQuery(gds, query), query);
  }
  assert.ok(!companyMatchesQuery(range, 'range'));
  assert.ok(!companySearchTerms(range).includes('rangeidc.com'));
});

test('reference company with reports has unorganized status rather than zero events', () => {
  const reports = [{ companyIds: ['range'], publishedAt: '2026-10-14', verifiedAt: '2026-10-15' },
    { companyIds: ['range'], financial: {}, publishedAt: '2026-08-25', verifiedAt: '2026-10-14' }];
  const coverage = companyCoverage({ company: { ...range, disclosureReview: undefined }, reports, filters: { scope: 'domestic' } });
  assert.equal(coverage.state, 'unorganized');
  assert.equal(coverage.status, '已有报道，事项尚未整理');
  assert.equal(coverage.reportCount, 2);
  assert.equal(coverage.financialCount, 1);
  assert.equal(coverage.lastVerifiedAt, '2026-10-15');
  assert.equal(coverage.disclosureReview, null);
});

test('name resemblance never creates a report or event relationship', () => {
  const reports = [{ title: `${range.name}融资`, companyIds: ['unconfirmed-company'], verifiedAt: '2026-10-15' }];
  const events = [{ title: range.legalName, companyIds: ['other-company'], milestones: [] }];
  const coverage = companyCoverage({ company: range, reports, events });
  assert.equal(coverage.state, 'empty');
  assert.equal(coverage.reportCount, 0);
  assert.equal(coverage.lastVerifiedAt, null);
});

test('financial-only coverage is distinct from collected news and empty coverage', () => {
  const reports = linkedReports(range).filter(report => report.financial);
  assert.equal(companyCoverage({ company: range, reports }).status, '已有财务资料，事项尚未整理');
  assert.equal(companyCoverage({ company: range }).status, '当前范围暂无相关资料');
});

test('verified event requires its disclosed evidence, not just an assigned latest milestone id', () => {
  const company = data.companies.find(company => company.id === 'vnet');
  const events = data.events.filter(event => event.companyIds.includes(company.id));
  const verified = companyCoverage({ company, events, reports: linkedReports(company), allReports: data.reports });
  assert.equal(verified.state, 'verified');
  assert.ok(verified.verifiedEventCount > 0);
  const unverified = companyCoverage({ company, events, reports: [], allReports: [] });
  assert.equal(unverified.state, 'pending');
  assert.equal(unverified.status, '事项已整理，尚待核实');
});

test('coverage dates reflect stored evidence and preserve disclosure-check status', () => {
  const company = data.companies.find(company => company.id === 'gds');
  const coverage = companyCoverage({ company, reports: linkedReports(company), filters: { scope: 'sea', regions: ['新加坡'] } });
  assert.equal(coverage.scope, '东南亚六国 · 新加坡');
  assert.equal(coverage.disclosureReview.date, company.disclosureReview.lastAttemptAt);
  assert.equal(coverage.disclosureReview.status, '核查部分完成');
  assert.ok(coverage.disclosureReview.channels.includes('公司IR列表'));
  assert.ok(coverage.firstPublishedAt <= coverage.lastPublishedAt);
});
