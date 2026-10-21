import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type: 'json' };
import input from '../data-candidates/tracked-peers-20261021.json' with { type: 'json' };
import { trackedCompanies, companyMatchesQuery } from '../src/domain/company-research.js';
import { companyDashboardActions, companyMediaRange, companyMediaReports, companyFinancialAt } from '../src/domain/company-dashboard.js';
import { validateCatalog } from '../src/domain/catalog.js';
import { mergeBatch } from '../scripts/reviewed-batch.mjs';

const added=['aofei','athub','hongjing','range'];
const range={start:'2026-01-01',end:'2026-10-21'};
test('explicit tracked roster includes the original six and exactly four user-selected peers',()=>{
  assert.deepEqual(trackedCompanies(data).map(c=>c.id),['sinnet','xingyun','vnet','sharetronic','gds','hec',...added]);
  assert.deepEqual(data.companies.filter(c=>c.role==='core').map(c=>c.id).sort(),trackedCompanies(data).map(c=>c.id).sort());
  assert.ok(!trackedCompanies(data).some(c=>['capitalonline','hongxin','nexwise'].includes(c.id)));
  const macro=data.companies.find(c=>c.id==='hongjing');
  for(const query of ['宏景科技','301396','GloryView'])assert.ok(companyMatchesQuery(macro,query));
  assert.ok(!companyMatchesQuery(data.companies.find(c=>c.id==='hongxin'),'宏景科技'));
});
test('promoting discovered companies preserves discovery history and replays the reviewed input unchanged',()=>{
  assert.deepEqual(validateCatalog(data),[]);
  for(const id of ['aofei','athub','range'])assert.ok(data.discovery.batches.some(b=>b.companyIds.includes(id)),id);
  assert.deepEqual(mergeBatch(data,input),data);
});
test('every added peer has original-source actions, financial values and current-window media',()=>{
  for(const id of added){
    const actions=companyDashboardActions(data,id,range);
    assert.ok(actions.length,id);
    for(const action of actions){
      assert.ok(action.url.startsWith('https://static.cninfo.com.cn/')||action.url.startsWith('https://www.athub.com/'),action.url);
      for(const node of action.nodes)assert.equal(node.report.evidenceLevel,'official-body');
    }
    const financial=companyFinancialAt(data,id,range.end);
    assert.ok(financial?.financial.revenue.value>0,id);
    assert.ok(financial.financial.profit.value>0,id);
    assert.ok(companyMediaReports(data,id,companyMediaRange(range.end,range)).length,id);
    assert.deepEqual(companyDashboardActions(data,id,range,'risk'),[]);
  }
});
test('fund registration, shareholder approval and JV incorporation stay within their original events and dates',()=>{
  const byId=id=>data.events.find(e=>e.id===id);
  assert.deepEqual(byId('range-shidai-shenyuan-ai-fund').milestones.map(n=>n.occurredAt),['2026-09-15','2026-10-09']);
  assert.deepEqual(byId('range-2026-aidc-credit-application').milestones.map(n=>n.occurredAt),['2026-09-14','2026-09-30']);
  assert.deepEqual(byId('hongjing-yuandong-jv').milestones.map(n=>n.occurredAt),['2026-07-14','2026-07-20']);
  assert.equal(companyDashboardActions(data,'range',{start:'2026-09-01',end:'2026-09-29'},'capital')[0].date,'2026-09-14');
  assert.equal(companyDashboardActions(data,'range',range,'capital')[0].date,'2026-09-30');
  assert.equal(companyDashboardActions(data,'athub',{start:'2026-01-01',end:'2026-06-30'}).length,1);
});
test('latest GloryView financials use 2026 H1 cumulative figures and the issuer original',()=>{
  const f=companyFinancialAt(data,'hongjing',range.end).financial;
  assert.equal(f.revenue.value,1843260974.24);assert.equal(f.revenue.priorValue,718807640.86);
  assert.equal(f.profit.value,137094320.29);assert.equal(f.profit.priorValue,60280419.24);
  assert.equal(f.revenue.change.percent,156.43);assert.equal(f.profit.change.percent,127.43);
  assert.equal(f.period.end,'2026-06-30');assert.equal(f.period.type,'half-year');
  assert.equal(companyFinancialAt(data,'hongjing','2026-08-28'),undefined);
});

test('Athub cluster uses the actual lighting date while its report retains publication date',()=>{
  const action=companyDashboardActions(data,'athub',range,'technology')[0];
  assert.equal(action.date,'2026-09-20');
  assert.equal(action.nodes[0].report.publishedAt,'2026-09-21');
});
