import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {companyDashboardActions} from '../src/domain/company-dashboard.js';

test('new financing actions use disclosure dates without creating customer delivery milestones',()=>{
 const actions=(id,end)=>companyDashboardActions(data,id,{start:'2026-01-01',end});
 assert.ok(!actions('xingyun','2026-10-27').some(a=>a.id==='xingyun-comprehensive-credit-2026'));
 const credit=actions('xingyun','2026-10-28').find(a=>a.id==='xingyun-comprehensive-credit-2026');
 assert.ok(credit);assert.match(credit.summary,/1亿元/);assert.match(credit.summary,/1.1亿元/);
 assert.match(credit.summary,/66.89亿元/);
 const repurchase=actions('vnet','2026-10-27').find(a=>a.id==='vnet-2027-convertible-notes-repurchase-20261027');
 assert.ok(repurchase);assert.match(repurchase.summary,/7,?530万美元/);
 const contract=data.events.find(e=>e.id==='sharetronic-cloud-services-20261019');
 assert.deepEqual(contract.milestones.map(n=>n.id),['contract-disclosed']);
});

test('October 28 brief uses Beijing release dates and the weekly excludes current-week news',()=>{
 const daily=data.discovery.issues.find(i=>i.id==='daily-2026-10-28-discovery-20261028');
 assert.equal(daily.reportIds.length,6);
 for(const id of ['oracle-oci-google-tpu-20261027','skhynix-q3-hbm-lta-20261028']){
  const report=data.reports.find(r=>r.id===id);
  assert.equal(report.publishedAt,'2026-10-27');assert.equal(report.publishedAtBeijing,'2026-10-28');
  assert.ok(daily.reportIds.includes(id));
 }
 const weekly=data.discovery.issues.filter(i=>i.kind==='weekly'&&i.generatedAt.startsWith('2026-10-28')).at(-1);
 assert.equal(weekly.periodStart,'2026-10-19');assert.equal(weekly.periodEnd,'2026-10-25');
 assert.equal(weekly.sections.length,8);
 assert.ok(weekly.reportIds.includes('nea-power-market-credit-draft-20261019'));
 assert.ok(!weekly.reportIds.includes('xingyun-credit-guarantee-20261028'));
});
