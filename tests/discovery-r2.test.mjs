import test from 'node:test';
import assert from 'node:assert/strict';
import data from './fixtures/discovery-reviewed.mjs';
import baseline from './fixtures/v1-baseline-catalog.json' with {type:'json'};
import v1 from '../data-candidates/discovery-v1-20261014.json' with {type:'json'};
import revision from '../data-candidates/discovery-r2-20261014.json' with {type:'json'};
import weekly from '../data-candidates/weekly-strategy-20261014.json' with {type:'json'};
import {mergeWeeklyReview} from '../scripts/weekly-update.mjs';
import {mergeDiscoveryBatch} from '../scripts/discovery-update.mjs';
import {previousCompleteWeek,availableIssues,generateIssue,validateDiscovery} from '../src/domain/discovery.js';
import {validateCatalog} from '../src/domain/catalog.js';

test('R01 the reviewed correction reproduces current data and retains historical issues',()=>{
  const before=mergeDiscoveryBatch(baseline,v1),after=mergeDiscoveryBatch(before,revision);
  assert.deepEqual(mergeWeeklyReview(after,weekly),data);
  assert.deepEqual(mergeDiscoveryBatch(data,revision),data);
  assert.deepEqual(data.discovery.issues.slice(0,before.discovery.issues.length),before.discovery.issues);
  assert.deepEqual(data.companies,before.companies);
  assert.deepEqual(data.events,before.events);
  for(const report of before.reports){const next=data.reports.find(r=>r.id===report.id);for(const key of ['id','url','originalUrl','sourceId','publishedAt','financial','verificationNote'])assert.deepEqual(next[key],report[key],report.id+'.'+key);}
  assert.deepEqual(validateCatalog(data),[]);
});
test('R02 previous complete weeks handle Wednesday, Sunday, Monday, month and year boundaries',()=>{
  for(const [date,start,end] of [
    ['2026-10-14','2026-10-05','2026-10-11'],['2026-10-18','2026-10-05','2026-10-11'],
    ['2026-10-19','2026-10-12','2026-10-18'],['2026-11-01','2026-10-19','2026-10-25'],
    ['2026-11-02','2026-10-26','2026-11-01'],['2027-01-01','2026-12-21','2026-12-27'],
    ['2027-01-04','2026-12-28','2027-01-03']
  ])assert.deepEqual(previousCompleteWeek(date),{start,end});
  assert.throws(()=>previousCompleteWeek('2026-02-30'));
});
test('R03 generation defaults to the previous complete week; the partial historical issue never becomes latest',()=>{
  const issue=generateIssue(data,{kind:'weekly',date:'2026-10-14',generatedAt:weekly.generatedAt});
  assert.equal(issue.periodStart,'2026-10-05');assert.equal(issue.periodEnd,'2026-10-11');assert.equal(issue.partial,false);
  assert.equal(issue.requestedDate,'2026-10-14');
  const choices=availableIssues(data.discovery.issues,'weekly','2026-10-14');
  assert.equal(choices[0].id,issue.id);assert.ok(choices.every(i=>!i.partial));
  assert.equal(choices.filter(i=>i.periodStart==='2026-10-05').length,3);
});
test('R04 daily includes existing registered media and excludes yesterday; all articles remain in the directory',()=>{
  const issue=generateIssue(data,{kind:'daily',date:'2026-10-14',generatedAt:revision.discovery.generatedAt});
  assert.equal(issue.reportIds.length,7);
  assert.ok(issue.reportIds.every(id=>data.reports.find(r=>r.id===id).publishedAt==='2026-10-14'));
  assert.deepEqual(new Set(issue.reportIds.map(id=>data.reports.find(r=>r.id===id).sourceId)),new Set(['stcn-industry','cls-industry','wmedia-sea']));
  assert.ok(data.reports.some(r=>r.id==='wmedia-dayone-loan-20261013'));
  assert.ok(!issue.reportIds.includes('wmedia-dayone-loan-20261013'));
  const detached=structuredClone(data);detached.discovery.batches.at(-1).reportIds=[];
  assert.deepEqual(generateIssue(detached,{kind:'daily',date:'2026-10-14',generatedAt:revision.discovery.generatedAt}).reportIds,issue.reportIds);
});
test('R05 a repeated event is selected once and a daily brief is capped at eight',()=>{
  const d=structuredClone(data),original=d.reports.find(r=>r.id==='cls-microsoft-expansion-20261014');
  for(let i=0;i<4;i++)d.reports.push({...original,id:'additional-'+i,url:'https://example.test/'+i,originalUrl:'https://example.test/'+i});
  d.reports.push({...original,id:'syndicated-copy'});
  const issue=generateIssue(d,{kind:'daily',date:'2026-10-14',generatedAt:revision.discovery.generatedAt});
  assert.equal(issue.reportIds.length,8);assert.ok(!issue.reportIds.includes('syndicated-copy'));
});
test('R06 new analysis needs a linked follow-up, without a management or uncertainty section',()=>{
  assert.deepEqual(validateDiscovery(data),[]);
  const d=structuredClone(data);d.discovery.issues.find(i=>i.batchId===revision.changeBatch.batchId&&!i.format&&i.analysis.length).analysis[0].reportId='missing';assert.ok(validateDiscovery(d).length);
  for(const issue of data.discovery.issues.filter(i=>i.batchId===revision.changeBatch.batchId))for(const entry of issue.analysis){assert.equal(entry.impact,undefined);assert.equal(entry.uncertainty,undefined);}
});
