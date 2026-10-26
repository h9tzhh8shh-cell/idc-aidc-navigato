import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {companyDashboardActions,companyFinancialAt} from '../src/domain/company-dashboard.js';

test('Q3 financials retain cumulative periods and the restated GloryView comparison',()=>{
  const f=companyFinancialAt(data,'hongjing','2026-10-26').financial;
  assert.equal(f.period.type,'nine-months');assert.equal(f.period.end,'2026-09-30');
  assert.equal(f.revenue.value,2872051702.60);assert.equal(f.revenue.priorValue,1021460726.78);
  assert.equal(f.revenue.change.percent,181.17);assert.equal(f.profit.value,311723294.68);
  assert.equal(companyFinancialAt(data,'hongjing','2026-10-25').financial.period.type,'half-year');
  const athub=companyFinancialAt(data,'athub','2026-10-26').financial;
  assert.equal(athub.revenue.value,1212228711.41);assert.equal(athub.profit.value,120731048.87);
  assert.equal(athub.revenue.change.percent,-2.31);assert.equal(athub.profit.change.percent,0.73);
});

test('later rental progress appears in the existing contract without rewriting the earlier timeline',()=>{
  const at=end=>companyDashboardActions(data,'xingyun',{start:'2026-01-01',end});
  assert.equal(at('2026-10-23').find(a=>a.id==='xingyun-sa-compute-procurement').date,'2026-10-12');
  const sa=at('2026-10-26').find(a=>a.id==='xingyun-sa-compute-procurement');
  assert.equal(sa.date,'2026-10-25');assert.match(sa.summary,/约60%/);
  assert.ok(!/75套.*全部交付/.test(sa.summary));
  const vb=at('2026-10-26').find(a=>a.id==='xingyun-vb-compute-services');
  assert.match(vb.summary,/前两批.*起租/);
  assert.equal(data.events.filter(e=>e.id==='sharetronic-cloud-services-20261019').length,1);
});

test('Monday advances the weekly period while keeping today-only disclosures in the daily',()=>{
  const daily=data.discovery.issues.find(i=>i.id==='daily-2026-10-26-discovery-20261026');
  assert.equal(daily.reportIds.length,7);
  assert.ok(daily.reportIds.includes('hongjing-2026-q3'));
  const weekly=data.discovery.issues.find(i=>i.kind==='weekly'&&i.generatedAt.startsWith('2026-10-26'));
  assert.equal(weekly.periodStart,'2026-10-19');assert.equal(weekly.periodEnd,'2026-10-25');
  assert.equal(weekly.sections.length,8);
  assert.ok(weekly.reportIds.includes('athub-2026-q3'));
  assert.ok(!weekly.reportIds.includes('hongjing-2026-q3'));
  assert.ok(weekly.reportIds.includes('csrc-securities-transfer-penalties-20261019'));
});
