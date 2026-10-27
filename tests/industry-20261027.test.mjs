import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {companyDashboardActions,companyFinancialAt} from '../src/domain/company-dashboard.js';

test('V amendment stays in the original contract and only appears from its disclosure day',()=>{
 const at=end=>companyDashboardActions(data,'xingyun',{start:'2026-01-01',end}).find(x=>x.id==='xingyun-v-server-rental');
 assert.doesNotMatch(at('2026-10-26').summary,/88.48/);
 assert.match(at('2026-10-27').summary,/88.48亿元/);
 assert.match(at('2026-10-27').summary,/最终客户已起租/);
 assert.match(at('2026-10-27').summary,/不再以固定批次数量/);
 assert.equal(data.events.filter(x=>x.id==='xingyun-v-server-rental').length,1);
});

test('Sharetronic prior-quarter billing and subsidiary funding remain distinct from the new 374.90 contract',()=>{
 const byId=id=>data.events.find(x=>x.id===id);
 const contract=byId('sharetronic-cloud-services-20261019');
 assert.ok(!contract.milestones.some(x=>x.primaryEvidenceReportId==='sharetronic-2026-q3'));
 assert.match(byId('sharetronic-compute-operations-2026').currentSummary,/前三季度/);
 const funding=byId('sharetronic-zhisuan-policy-capital-2026');
 assert.equal(funding.milestones.length,1);
 assert.match(funding.currentSummary,/借款用于该增资/);
 assert.match(funding.currentSummary,/尚需股东会审议/);
 assert.doesNotMatch(funding.currentSummary,/66亿元/);
 const f=companyFinancialAt(data,'sharetronic','2026-10-27').financial;
 assert.equal(f.period.type,'nine-months');assert.equal(f.period.end,'2026-09-30');
 assert.equal(f.revenue.value,19609733237.12);assert.equal(f.revenue.priorValue,8330610619.94);
 assert.equal(f.profit.value,3062354411.58);assert.equal(f.profit.priorValue,697934207.53);
});

test('October 27 daily includes overseas midnight results; weekly keeps the prior full week',()=>{
 const daily=data.discovery.issues.find(x=>x.id==='daily-2026-10-27-discovery-20261027');
 assert.ok(daily.reportIds.includes('celestica-q3-results-20261026'));
 assert.equal(daily.reportIds.length,8);
 const weekly=data.discovery.issues.filter(x=>x.kind==='weekly'&&x.generatedAt.startsWith('2026-10-27')).at(-1);
 assert.equal(weekly.periodStart,'2026-10-19');assert.equal(weekly.periodEnd,'2026-10-25');
 assert.ok(weekly.reportIds.includes('stt-neysa-noida-gpu-hosting-20261021'));
 assert.ok(weekly.reportIds.includes('nebius-live-spot-pricing-20261021'));
 assert.ok(!weekly.reportIds.includes('sharetronic-zhisuan-capital-20261027'));
});
