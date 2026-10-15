import test from 'node:test';
import assert from 'node:assert/strict';
import data from './fixtures/discovery-reviewed.mjs';
import {recentDiscoveries,industryDiscoveryReports} from '../src/domain/discovery.js';
import {decorateSources,filterReports} from '../src/catalog.js';

test('F01 continuous lists include previous discoveries and place only the latest additions first',()=>{
  const before=JSON.stringify(data), recent=recentDiscoveries(data,'2026-10-14');
  assert.equal(recent.companies.length,2);
  assert.ok(recent.companies.every(company=>!company.isNew));
  assert.ok(recent.reports.length>11);
  const latest=data.discovery.batches.at(-1);
  assert.deepEqual(new Set(recent.reports.slice(0,8).map(report=>report.id)),new Set(latest.reportIds));
  assert.ok(recent.reports.slice(0,8).every(report=>report.isNew));
  assert.ok(recent.reports.slice(8).every(report=>!report.isNew));
  assert.equal(new Set(recent.reports.map(report=>report.id)).size,recent.reports.length);
  assert.equal(JSON.stringify(data),before);
});

test('F02 newly added companies receive NEW and existing companies remain on the next update',()=>{
  const previous=structuredClone(data);
  previous.discovery.batches.pop(); previous.changeBatches.pop();
  assert.ok(recentDiscoveries(previous,'2026-10-14').companies.every(company=>company.isNew));
  assert.deepEqual(recentDiscoveries(previous,'2026-10-14').companies.map(company=>company.id),recentDiscoveries(data,'2026-10-14').companies.map(company=>company.id));
});

test('F03 day 21 is retained and day 22 expires automatically without a new update',()=>{
  const lastDay=recentDiscoveries(data,'2026-11-03'),expired=recentDiscoveries(data,'2026-11-04');
  assert.equal(lastDay.companies.length,2); assert.equal(lastDay.reports.length,11);
  assert.deepEqual(expired,{companies:[],reports:[]});
});

function fixture(){
  const batches=[
    {batchId:'old',cutoffAt:'2026-12-12T09:00:00+08:00',companyIds:['old-company'],reportIds:['old-report']},
    {batchId:'new',cutoffAt:'2027-01-01T09:00:00+08:00',companyIds:['new-company'],reportIds:['new-report']},
  ];
  return {companies:[{id:'old-company'},{id:'new-company'}],sources:[{id:'media',sourceType:'media'}],
    reports:['old','new'].map(id=>({id:id+'-report',sourceId:'media',kind:'news',publishedAt:'2026-11-01',verifiedAt:'2026-12-01',visibility:'active',verificationStatus:'verified',contentScope:'full'})),
    changeBatches:batches.map(batch=>({batchId:batch.batchId,recordedAt:batch.cutoffAt,changes:[]})),discovery:{batches}};
}

test('F04 first collection governs retention across years, even for an older original article',()=>{
  const sample=fixture(), recent=recentDiscoveries(sample,'2027-01-01');
  assert.deepEqual(recent.reports.map(report=>report.id),['new-report','old-report']);
  assert.deepEqual(recent.companies.map(company=>company.id),['new-company','old-company']);
  assert.deepEqual(recentDiscoveries(sample,'2027-01-02').reports.map(report=>report.id),['new-report']);
});

test('F05 a later repeat or correction cannot reset the first collection date or create NEW',()=>{
  const sample=fixture();sample.discovery.batches[1].reportIds.push('old-report');sample.discovery.batches[1].companyIds.push('old-company');
  const lastDay=recentDiscoveries(sample,'2027-01-01');
  assert.equal(lastDay.reports.find(report=>report.id==='old-report').isNew,false);
  assert.deepEqual(recentDiscoveries(sample,'2027-01-02').reports.map(report=>report.id),['new-report']);
  assert.deepEqual(recentDiscoveries(sample,'2027-01-02').companies.map(company=>company.id),['new-company']);
});

test('F06 region filtering preserves newest-first order while showing earlier matching reports',()=>{
  const recent=recentDiscoveries(data,'2026-10-14');
  const matches=new Set(filterReports(recent.reports,decorateSources(data),{scope:'domestic'}).map(report=>report.id));
  const visible=recent.reports.filter(report=>matches.has(report.id));
  assert.ok(visible.some(report=>report.isNew));assert.ok(visible.some(report=>!report.isNew));
  const firstOld=visible.findIndex(report=>!report.isNew);
  assert.ok(visible.slice(firstOld).every(report=>!report.isNew));
});

test('F07 industry articles exclude fixed media sources while retaining the research library',()=>{
  const before=JSON.stringify(data),recent=recentDiscoveries(data,'2026-10-15');
  const visible=industryDiscoveryReports(data,recent.reports);
  assert.deepEqual(visible.map(report=>report.id),['open-cs-infini-20261013','open-oregon-permit-20261013','open-konst-seriesb-20261008']);
  assert.ok(visible.every(report=>!data.discovery.fixedMediaSourceIds.includes(report.sourceId)));
  assert.equal(recent.reports.length,37);
  assert.equal(recent.companies.length,2);
  assert.equal(JSON.stringify(data),before);
});

test('F08 industry source exclusion composes with region filters and 21-day expiry',()=>{
  const visible=industryDiscoveryReports(data,recentDiscoveries(data,'2026-10-15').reports);
  assert.deepEqual(filterReports(visible,decorateSources(data),{scope:'domestic'}).map(report=>report.id),['open-cs-infini-20261013']);
  assert.equal(industryDiscoveryReports(data,recentDiscoveries(data,'2026-11-03').reports).length,3);
  assert.deepEqual(industryDiscoveryReports(data,recentDiscoveries(data,'2026-11-04').reports),[]);
});
