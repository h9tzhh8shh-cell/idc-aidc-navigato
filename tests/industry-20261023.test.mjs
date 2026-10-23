import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {latestFinancial,changeText} from '../src/domain/financial.js';
import {companyDashboardActions} from '../src/domain/company-dashboard.js';

test('October 23 core financials use cumulative Q3 originals and distinguish losses from a REIT comparison base',()=>{
  const expected={xingyun:[1175069390.58,269136125.22],hec:[14672183975.90,637750272.60],range:[5665584178.44,1802528508.85]};
  for(const [id,values] of Object.entries(expected)){
    const f=latestFinancial(data,id).report.financial;
    assert.equal(f.period.type,'nine-months');assert.equal(f.period.end,'2026-09-30');
    assert.deepEqual([f.revenue.value,f.profit.value],values,id);
    assert.ok(data.reports.some(r=>r.financial?.companyId===id&&r.financial.period.type==='half-year'));
  }
  assert.equal(changeText(latestFinancial(data,'xingyun').report.financial.profit),'扭亏为盈');
  assert.match(latestFinancial(data,'range').report.summary,/REIT/);
  assert.equal(latestFinancial(data,'china-telecom').report.publishedAt,'2026-10-22');
});
test('new delivery progress follows existing contracts while HEC aggregate receipts remain a separate company-level fact',()=>{
  const actions=companyDashboardActions(data,'xingyun',{start:'2026-01-01',end:'2026-10-23'});
  const ve=actions.find(a=>a.id==='xingyun-ve-compute-rental');
  assert.equal(ve.date,'2026-10-23');assert.match(ve.summary,/已完成交付并起租/);
  assert.equal(ve.nodes.length,2);
  const sa=actions.find(a=>a.id==='xingyun-sa-compute-procurement');
  assert.equal(sa.date,'2026-10-12');assert.match(sa.summary,/32套/);
  const aggregate=data.events.find(e=>e.id==='hec-ai-compute-fulfilment-2026');
  assert.match(aggregate.currentSummary,/117.62/);assert.match(aggregate.currentSummary,/196.53/);
  for(const id of ['hec-cloud-compute-client-a-2026','hec-cloud-compute-client-b-2026','hec-cloud-compute-client-c-2026']){
    assert.ok(aggregate.relatedEventIds.includes(id));
    assert.equal(data.events.find(e=>e.id===id).milestones.length,1);
  }
});
test('daily merges HEC same-event disclosures and weekly keeps its full week with the new issuer original',()=>{
  const daily=data.discovery.issues.find(i=>i.id==='daily-2026-10-23-discovery-20261023');
  assert.equal(daily.reportIds.length,6);
  assert.ok(daily.reportIds.includes('hec-2026-q3'));
  assert.ok(!daily.reportIds.includes('hec-ai-financing-guarantees-20261023'));
  for(const id of daily.reportIds)assert.equal(data.reports.find(r=>r.id===id).publishedAt,'2026-10-23');
  const weekly=data.discovery.issues.filter(i=>i.kind==='weekly').at(-1);
  assert.equal(weekly.periodStart,'2026-10-12');assert.equal(weekly.periodEnd,'2026-10-18');
  assert.ok(weekly.reportIds.includes('xingyun-xiaoshan-framework-20261012'));
  assert.ok(!weekly.reportIds.includes('media-xingyun-xiaoshan-20261016'));
});
