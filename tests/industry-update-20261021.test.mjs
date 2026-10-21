import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {latestFinancial,changeText} from '../src/domain/financial.js';
import {companyDashboardActions} from '../src/domain/company-dashboard.js';
import {availableIssues} from '../src/domain/discovery.js';

test('October 21 financial update uses nine-month originals and preserves H1 records',()=>{
  const capital=latestFinancial(data,'capitalonline').report;
  assert.equal(capital.id,'capitalonline-2026-q3');
  assert.equal(capital.financial.period.type,'nine-months');
  assert.equal(capital.financial.period.start,'2026-01-01');
  assert.equal(capital.financial.period.end,'2026-09-30');
  assert.equal(capital.financial.revenue.value,955541575.54);
  assert.equal(capital.financial.revenue.priorValue,926437818.44);
  assert.equal(capital.financial.profit.value,8796193.13);
  assert.equal(capital.financial.profit.priorValue,-99412954.64);
  assert.equal(changeText(capital.financial.profit),'扭亏为盈');
  assert.equal(data.reports.find(r=>r.id==='capitalonline-2026-h1').financial.profit.value,-32185014.98);
  const mobile=latestFinancial(data,'china-mobile').report.financial;
  assert.equal(mobile.period.type,'nine-months');
  assert.equal(mobile.revenue.unit,'亿元');
  assert.equal(mobile.revenue.value,7803);
  assert.equal(mobile.profit.value,1062);
  assert.equal(mobile.profit.change.percent,-7.9);
});

test('verified existing company stories reach timelines without adding a false Sharetronic fulfillment node',()=>{
  const range={start:'2026-01-01',end:'2026-10-21'};
  const xingyun=companyDashboardActions(data,'xingyun',range,'contract').find(e=>e.id==='xingyun-vb-compute-services');
  assert.ok(xingyun);assert.equal(xingyun.date,'2026-10-12');
  assert.match(xingyun.summary,/40个算力单元/);
  assert.equal(xingyun.url,'https://static.cninfo.com.cn/finalpage/2026-10-12/1225601982.PDF');
  const vnet=companyDashboardActions(data,'vnet',range,'project').find(e=>e.id==='vnet-zhongwei-aidc-2026');
  assert.ok(vnet);assert.equal(vnet.date,'2026-10-11');
  const event=data.events.find(e=>e.id==='sharetronic-cloud-services-20261019');
  assert.equal(event.milestones.length,1);
  assert.equal(event.latestVerifiedMilestoneId,'contract-disclosed');
  assert.ok(event.milestones[0].evidenceRefs.some(ref=>ref.reportId==='sharetronic-contract-legal-20261019'));
});

test('October 21 daily and refreshed previous-week issue keep their own dates and sources',()=>{
  const daily=availableIssues(data.discovery.issues,'daily','2026-10-21')[0];
  assert.equal(daily.date,'2026-10-21');assert.equal(daily.reportIds.length,6);
  assert.ok(daily.reportIds.includes('capitalonline-2026-q3'));
  const weekly=availableIssues(data.discovery.issues,'weekly','2026-10-21')[0];
  assert.equal(weekly.periodStart,'2026-10-12');assert.equal(weekly.periodEnd,'2026-10-18');
  assert.equal(weekly.sections.length,8);
  assert.ok(weekly.reportIds.includes('wmedia-airtrunk-johor-sale-20261016'));
  assert.ok(weekly.reportIds.includes('xingyun-vb-revised-disclosure-20261012'));
  assert.ok(!weekly.reportIds.includes('sharetronic-cloud-contract-20261019'));
});
