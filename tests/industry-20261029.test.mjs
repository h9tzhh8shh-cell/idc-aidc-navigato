import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {companyDashboardActions} from '../src/domain/company-dashboard.js';

test('October 29 financial and project updates keep cumulative periods and contract stages separate',()=>{
 const financial=data.reports.find(r=>r.id==='sinnet-2026-q3').financial;
 assert.equal(financial.period.type,'nine-months');
 assert.equal(financial.period.end,'2026-09-30');
 assert.equal(financial.revenue.value,5077324502.48);
 assert.equal(financial.profit.value,60999942.18);
 assert.equal(financial.profit.priorValue,143611579.33);
 assert.equal(financial.revenue.change.percent,-7.33);
 assert.equal(financial.profit.change.percent,-57.52);
 const actions=end=>companyDashboardActions(data,'sinnet',{start:'2026-01-01',end});
 assert.equal(actions('2026-10-28').find(a=>a.id==='sinnet-horinger-expansion').date,'2026-09-24');
 assert.equal(actions('2026-10-29').find(a=>a.id==='sinnet-horinger-expansion').date,'2026-10-29');
 const contract=data.events.find(e=>e.id==='sharetronic-cloud-services-20261019');
 assert.deepEqual(contract.milestones.map(n=>n.id),['contract-disclosed']);
 assert.ok(contract.milestones[0].evidenceRefs.some(ref=>ref.reportId==='sharetronic-ir-20261028'));
 for(const id of ['sharetronic-compute-financing-model-2026','sharetronic-tokenshare-platform-2026']){
  const event=data.events.find(e=>e.id===id);
  assert.ok(event);assert.ok(event.milestones.some(n=>n.primaryEvidenceReportId==='sharetronic-ir-20261028'));
 }
});

test('October 29 daily includes current Beijing price data while weekly keeps the completed week',()=>{
 const daily=data.discovery.issues.find(i=>i.id==='daily-2026-10-29-discovery-20261029');
 assert.equal(daily.reportIds.length,6);
 assert.ok(daily.reportIds.includes('ornn-daily-settlement-20261028'));
 assert.ok(daily.reportIds.includes('microsoft-fy2027-q1-cloud-20261028'));
 assert.ok(daily.reportIds.includes('sinnet-2026-q3'));
 assert.ok(!daily.reportIds.includes('meta-q3-capex-outlook-20261021'));
 const weekly=data.discovery.issues.filter(i=>i.kind==='weekly'&&i.generatedAt.startsWith('2026-10-29')).at(-1);
 assert.equal(weekly.periodStart,'2026-10-19');assert.equal(weekly.periodEnd,'2026-10-25');
 assert.equal(weekly.sections.length,8);
 assert.ok(weekly.reportIds.includes('meta-q3-capex-outlook-20261021'));
 assert.ok(weekly.reportIds.includes('eeo-compute-rental-price-hedging-20261020'));
 assert.ok(!weekly.reportIds.includes('beijing-energy-dc-green-power-20261028'));
});
