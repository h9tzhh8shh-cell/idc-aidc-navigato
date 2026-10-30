import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {latestFinancial} from '../src/domain/financial.js';
import {companyDashboardActions} from '../src/domain/company-dashboard.js';

test('October 22 daily uses actual current-day publications while overseas backfills keep their dates',()=>{
  const daily=data.discovery.issues.find(i=>i.id==='daily-2026-10-22-discovery-20261022');
  assert.equal(daily.reportIds.length,4);
  for(const id of daily.reportIds)assert.equal(data.reports.find(r=>r.id===id).publishedAt,'2026-10-22');
  const overseas=data.reports.find(r=>r.id==='cls-neocloud-rental-pricing-view-20261021');
  assert.equal(overseas.publishedAt,'2026-10-21');
  assert.ok(!daily.reportIds.includes(overseas.id));
  const weekly=data.discovery.issues.find(i=>i.kind==='weekly'&&i.generatedAt.startsWith('2026-10-22'));
  assert.equal(weekly.periodStart,'2026-10-12');assert.equal(weekly.periodEnd,'2026-10-18');
});
test('financial updates retain original periods and signed loss comparisons',()=>{
  const hongxin=latestFinancial(data,'hongxin').report.financial;
  assert.equal(hongxin.period.type,'nine-months');
  assert.equal(hongxin.revenue.value,5500911392.75);
  assert.equal(hongxin.profit.value,216548137.81);
  const intel=data.reports.find(r=>r.id==='intel-2026-q2').financial;
  assert.equal(intel.period.basis,'13-weeks');assert.equal(intel.period.end,'2026-06-27');
  assert.equal(intel.profit.value,-11033);assert.equal(intel.profit.priorValue,-2918);
});
test('official financing actions reach the timeline without manufacturing Sharetronic execution progress',()=>{
  const range={start:'2026-01-01',end:'2026-10-22'};
  const actions=companyDashboardActions(data,'sinnet',range);
  for(const id of ['sinnet-kexin-server-finance-lease','sinnet-hengqin-data-center-financing']){
    const action=actions.find(a=>a.id===id);
    assert.equal(action.date,'2026-10-21');
    assert.match(action.url,/static\.cninfo\.com\.cn/);
  }
  const tracked=data.events.find(e=>e.id==='sharetronic-cloud-services-20261019');
  assert.equal(tracked.milestones.length,1);
  assert.equal(tracked.milestones[0].occurredAt,'2026-10-19');
  assert.ok(tracked.milestones[0].evidenceRefs.some(ref=>ref.reportId==='caiwen-sharetronic-delivery-revenue-20261021'));
});
