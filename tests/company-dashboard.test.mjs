import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type: 'json' };
import { companyRange, companyDashboardActions, companyHighlights, companyFinancialAt, companyMediaRange, companyMediaReports } from '../src/domain/company-dashboard.js';
import { readQuery, writeQuery, normalizeFilters } from '../src/catalog.js';

const range = companyRange('2026','2026-10-19');
test('company time ranges use inclusive calendar dates and a fixed 2026 default', () => {
  assert.deepEqual(range,{start:'2026-01-01',end:'2026-10-19'});
  assert.deepEqual(companyRange('30','2026-10-19'),{start:'2026-09-20',end:'2026-10-19'});
  assert.deepEqual(companyRange('90','2026-10-19'),{start:'2026-07-22',end:'2026-10-19'});
  assert.deepEqual(companyRange('2026-h1','2026-10-19'),{start:'2026-01-01',end:'2026-06-30'});
  assert.deepEqual(companyRange('30','2026-01-10'),{start:'2025-12-12',end:'2026-01-10'});
});
test('Sinnet uses actual board day and groups release and launch into one event', () => {
  const actions=companyDashboardActions(data,'sinnet',range);
  assert.equal(actions.length,7);
  assert.equal(actions.find(a=>a.id==='sinnet-luchen-token-cooperation-2026').date,'2026-10-16');
  assert.equal(actions.find(a=>a.id==='sinnet-horinger-expansion').date,'2026-09-24');
  const sme=actions.find(a=>a.id==='sinnet-cloud-panacea-sme');
  assert.deepEqual(sme.nodes.map(n=>n.occurredAt),['2026-07-20','2026-09-21']);
  assert.equal(sme.date,'2026-09-21');
  assert.equal(companyDashboardActions(data,'sinnet',{start:'2026-07-01',end:'2026-07-31'}).find(a=>a.id===sme.id).title,'发布中小企业智能体平台');
  assert.equal(companyDashboardActions(data,'sinnet',range,'project').length,1);
  assert.deepEqual(companyDashboardActions(data,'sinnet',{start:'2025-01-01',end:'2025-12-31'}).map(a=>a.date),['2025-12-09']);
});
test('unknown dates, future nodes, unverified sources and lookalike companies cannot enter timeline', () => {
  const fixture=structuredClone(data);
  const event=fixture.events.find(e=>e.id==='sinnet-horinger-expansion');
  const original=structuredClone(event.milestones[0]);
  for(const date of [null,'2026-10-20']) {
    event.milestones[0].occurredAt=date;
    assert.ok(!companyDashboardActions(fixture,'sinnet',range).some(a=>a.id===event.id));
  }
  event.milestones[0]=original;
  event.milestones[0].verificationLevel='lead';
  assert.ok(!companyDashboardActions(fixture,'sinnet',range).some(a=>a.id===event.id));
  event.milestones[0]=original;
  assert.equal(companyDashboardActions(fixture,'sinnet-lookalike',range).length,0);
});

test('Sharetronic material cloud-service contract links the article and official disclosure to one timeline action', () => {
  const official=data.reports.find(r=>r.id==='sharetronic-cloud-contract-20261019');
  const media=data.reports.find(r=>r.id==='cls-sharetronic-cloud-20261020');
  assert.equal(official.eventId,'sharetronic-cloud-services-20261019');
  assert.equal(media.eventId,official.eventId);
  const actions=companyDashboardActions(data,'sharetronic',range,'contract');
  const action=actions.find(item=>item.id===official.eventId);
  assert.ok(action);
  assert.equal(action.date,'2026-10-19');
  assert.match(action.title,/披露.*374\.90亿元/);
  assert.equal(action.url,official.url);
  assert.equal(action.nodes.length,1);
  assert.equal(action.nodes[0].primaryEvidenceReportId,official.id);
  assert.ok(companyHighlights(actions).some(item=>item.id===action.id));
  assert.ok(!companyDashboardActions(data,'sharetronic',{start:'2026-01-01',end:'2026-10-18'}).some(item=>item.id===action.id));
});
test('historical cutoff never leaks a later financial disclosure', () => {
  assert.equal(companyFinancialAt(data,'sinnet','2026-10-19').id,'sinnet-2026-h1');
  assert.equal(companyFinancialAt(data,'sinnet','2026-06-30').id,'sinnet-2026-q1');
  assert.equal(companyFinancialAt(data,'sinnet','2026-01-01'),undefined);
});
test('highlights select eight important independent actions, sort by date, and never pad', () => {
  const actions=Array.from({length:10},(_,i)=>({id:String(i),priority:i,date:`2026-01-${String(10-i).padStart(2,'0')}`}));
  const result=companyHighlights(actions);
  assert.equal(result.length,8);
  assert.ok(result.every(a=>a.priority>=2));
  assert.deepEqual(result.map(a=>a.date),result.map(a=>a.date).sort());
  assert.equal(companyHighlights(actions.slice(0,2)).length,2);
  assert.equal(actions.length,10);
});
test('company, time and event filters roundtrip while original research conditions remain intact', () => {
  const filters=normalizeFilters({q:'液冷',scope:'domestic',dateWindow:'7',sort:'published'});
  const nav={company:'sinnet',companyRange:'30',eventType:'project',returnQuery:writeQuery(filters,'reports')};
  const restored=readQuery(writeQuery(filters,'reports',null,nav));
  assert.deepEqual(restored.navigation,nav);
  assert.deepEqual(restored.filters,filters);
  assert.deepEqual(readQuery(restored.navigation.returnQuery).filters,filters);
  assert.equal(readQuery('?company=sinnet&companyRange=invalid').navigation.companyRange,undefined);
});

test('media uses three calendar months, clamping month ends and spanning years', () => {
  assert.deepEqual(companyMediaRange('2026-10-19'), { start:'2026-07-19', end:'2026-10-19' });
  assert.deepEqual(companyMediaRange('2026-05-31'), { start:'2026-02-28', end:'2026-05-31' });
  assert.deepEqual(companyMediaRange('2024-05-31'), { start:'2024-02-29', end:'2024-05-31' });
  assert.deepEqual(companyMediaRange('2026-01-01'), { start:'2025-10-01', end:'2026-01-01' });
});

test('media follows the selected company time range within the three-month window', () => {
  const today='2026-10-19';
  const selected=key=>companyMediaRange(today,companyRange(key,today));
  assert.deepEqual(selected('2026'),{start:'2026-07-19',end:today});
  assert.deepEqual(selected('90'),{start:'2026-07-22',end:today});
  assert.deepEqual(selected('30'),{start:'2026-09-20',end:today});
  assert.equal(selected('2026-h1'),null);
  const all=companyMediaReports(data,'sinnet',selected('2026'));
  const recent=companyMediaReports(data,'sinnet',selected('30'));
  assert.ok(all.some(report=>report.publishedAt < '2026-09-20'));
  assert.ok(recent.length > 0 && recent.length < all.length);
  assert.ok(recent.every(report=>report.publishedAt >= '2026-09-20' && report.publishedAt <= today));
  assert.deepEqual(companyMediaReports(data,'sinnet',selected('2026-h1')),[]);
  assert.deepEqual(companyMediaRange('2026-01-10',companyRange('2026','2026-01-10')),{start:'2026-01-01',end:'2026-01-10'});
});

test('media includes older-than-21-day independent coverage, excludes unverified, unrelated and duplicate records', () => {
  const item = { id:'media', sourceId:'press', companyIds:['sinnet'], kind:'news', visibility:'active',
    publishedAt:'2026-08-01', verifiedAt:'2026-10-19', verificationStatus:'verified', contentScope:'full', url:'https://news.example/article' };
  const records = [
    item, { ...item, id:'newest', publishedAt:'2026-10-19', url:'https://news.example/new' },
    { ...item, id:'boundary', publishedAt:'2026-07-19', url:'https://news.example/boundary' },
    { ...item, id:'before', publishedAt:'2026-07-18' }, { ...item, id:'future', publishedAt:'2026-10-20' },
    { ...item, id:'unknown', publishedAt:null }, { ...item, id:'wrong-company', companyIds:['sinnet-similar'] },
    { ...item, id:'company-release', sourceId:'company' }, { ...item, id:'disclosure', kind:'disclosure' },
    { ...item, id:'snippet', contentScope:'search-snippet' }, { ...item, id:'unverified', verificationStatus:'unverified' },
    { ...item, id:'archived', visibility:'archived' }, { ...item, id:'duplicate', duplicateOf:'media' },
    { ...item, id:'same-link', url:'https://news.example/article?utm_source=share#section' },
  ];
  const fixture = { reports:records, sources:[{id:'press',sourceType:'media'},{id:'company',sourceType:'company'}] };
  assert.deepEqual(companyMediaReports(fixture,'sinnet',companyMediaRange('2026-10-19')).map(r=>r.id), ['newest','media','boundary']);
  assert.equal(fixture.reports[0].id,'media');
});

test('media tab survives company research URL and browser-history state restoration', () => {
  const filters = normalizeFilters({ q:'液冷',scope:'domestic' });
  const navigation = { company:'sinnet', companyTab:'media', companyRange:'30', eventType:'project' };
  assert.deepEqual(readQuery(writeQuery(filters,'sources',null,navigation)).navigation,navigation);
  assert.equal(readQuery('?company=sinnet&companyTab=invalid').navigation.companyTab,undefined);
});
