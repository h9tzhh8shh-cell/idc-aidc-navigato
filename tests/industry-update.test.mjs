import test from 'node:test';
import assert from 'node:assert/strict';
import before from './fixtures/discovery-reviewed.mjs';
import current from '../public/assets/catalog.json' with {type:'json'};
import input from '../data-candidates/discovery-20261015.json' with {type:'json'};
import weekly from '../data-candidates/weekly-strategy-20261015.json' with {type:'json'};
import {mergeDiscoveryBatch} from '../scripts/discovery-update.mjs';
import {mergeWeeklyReview} from '../scripts/weekly-update.mjs';
import {validateCatalog} from '../src/domain/catalog.js';
import {discoveryEligibleReport,generateIssue,recentDiscoveries,industryDiscoveryReports,availableIssues} from '../src/domain/discovery.js';
import {decorateSources,filterReports} from '../src/catalog.js';

test('U01 reviewed October 15 import and weekly supplement reproduce the catalog and replay unchanged',()=>{
  const imported=mergeDiscoveryBatch(before,input),result=mergeWeeklyReview(imported,weekly);
  assert.deepEqual(result,current);
  assert.deepEqual(mergeDiscoveryBatch(current,input),current);
  assert.deepEqual(mergeWeeklyReview(current,weekly),current);
  assert.deepEqual(validateCatalog(current),[]);
  for(const key of ['companies','sources','reports','events','changeBatches'])assert.deepEqual(current[key].slice(0,before[key].length),before[key],key);
  assert.deepEqual(current.discovery.issues.slice(0,before.discovery.issues.length),before.discovery.issues);
});

test('U02 seven domestic peers appear above previous companies with NEW and official evidence',()=>{
  const recent=recentDiscoveries(current,'2026-10-15');
  assert.equal(recent.companies.length,9);
  assert.deepEqual(new Set(recent.companies.slice(0,7).map(c=>c.id)),new Set(input.companies.map(c=>c.id)));
  assert.ok(recent.companies.slice(0,7).every(c=>c.isNew&&c.researchScope==='domestic'));
  assert.ok(recent.companies.slice(7).every(c=>!c.isNew));
  const domestic=filterReports(recent.reports,decorateSources(current),{scope:'domestic'});
  for(const company of input.companies)assert.ok(domestic.some(r=>r.companyIds.includes(company.id)),company.name);
  for(const id of ['litong-operations-20261015','athub-ascend-supernode-20260921'])assert.ok(recent.reports.some(r=>r.id===id));
});

test('U03 official company evidence is eligible while research and unverified reports cannot manufacture discoveries',()=>{
  const official=current.reports.find(r=>r.id==='litong-operations-20261015');
  assert.ok(discoveryEligibleReport(current,official,'2026-10-15'));
  assert.ok(!discoveryEligibleReport(current,{...official,verificationStatus:'unverified'},'2026-10-15'));
  assert.ok(!discoveryEligibleReport(current,{...official,kind:'methodology'},'2026-10-15'));
  assert.ok(!discoveryEligibleReport(current,{...official,publishedAt:'2026-10-16'},'2026-10-15'));
  const restricted={...current,sources:current.sources.map(s=>s.id===official.sourceId?{...s,sourceType:'research'}:s)};
  assert.ok(!discoveryEligibleReport(restricted,official,'2026-10-15'));
});

test('U04 daily draws five current-day stories from the whole library, including previously enrolled media',()=>{
  const issue=generateIssue(current,{kind:'daily',date:'2026-10-15',generatedAt:input.discovery.generatedAt});
  assert.equal(issue.reportIds.length,5);
  const chosen=current.reports.filter(r=>issue.reportIds.includes(r.id));
  assert.ok(chosen.every(r=>r.publishedAt==='2026-10-15'&&!r.dailyDateUncertain));
  assert.ok(chosen.filter(r=>r.publishedTimestamp).every(r=>Date.parse(r.publishedTimestamp)<=Date.parse(issue.cutoffAt)));
  assert.equal(chosen.filter(r=>r.sourceId==='yicai-industry').length,2);
  assert.ok(chosen.some(r=>r.kind==='disclosure'));
  const detached=structuredClone(current);detached.discovery.batches.at(-1).reportIds=[];
  assert.deepEqual(generateIssue(detached,{kind:'daily',date:'2026-10-15',generatedAt:input.discovery.generatedAt}).reportIds,issue.reportIds);
});

test('U05 industry list covers domestic, Southeast Asian and other overseas media without fixed sources or company announcements',()=>{
  const visible=industryDiscoveryReports(current,recentDiscoveries(current,'2026-10-15').reports);
  assert.equal(visible.filter(r=>r.isNew).length,8);
  assert.equal(visible.length,11);
  for(const region of ['中国','美国','巴西','印尼'])assert.ok(visible.some(r=>r.regions.includes(region)),region);
  assert.ok(visible.every(r=>r.kind==='news'&&!current.discovery.fixedMediaSourceIds.includes(r.sourceId)&&current.sources.find(s=>s.id===r.sourceId).sourceType==='media'));
});

test('U06 21-day expiry still applies to new company evidence and media articles',()=>{
  const last=recentDiscoveries(current,'2026-11-04');
  assert.equal(last.companies.length,7);assert.equal(last.reports.length,17);
  assert.deepEqual(recentDiscoveries(current,'2026-11-05'),{companies:[],reports:[]});
});

test('U07 weekly stays October 5–11 and can be regenerated after the new historical company stories are reviewed',()=>{
  const issue=generateIssue(current,{kind:'weekly',date:'2026-10-15',generatedAt:weekly.generatedAt});
  assert.equal(issue.periodStart,'2026-10-05');assert.equal(issue.periodEnd,'2026-10-11');
  assert.equal(issue.sections.length,8);assert.equal(issue.reportIds.length,15);
  assert.ok(issue.reportIds.includes('stcn-capitalonline-huailai-20261011'));
  assert.ok(!issue.reportIds.includes('litong-operations-20261015'));
  assert.equal(availableIssues(current.discovery.issues,'weekly','2026-10-15')[0].id,issue.id);
  for(const old of before.discovery.issues)assert.deepEqual(current.discovery.issues.find(i=>i.id===old.id),old);
});
