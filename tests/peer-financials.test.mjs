import test from 'node:test';
import assert from 'node:assert/strict';
import before from './fixtures/industry-reviewed.mjs';
import current from '../public/assets/catalog.json' with {type:'json'};
import input from '../data-candidates/financial-peers-20261015.json' with {type:'json'};
import {mergeBatch} from '../scripts/reviewed-batch.mjs';
import {validateCatalog} from '../src/domain/catalog.js';
import {latestFinancial,amount,changeText} from '../src/domain/financial.js';
import {recentDiscoveries,industryDiscoveryReports,generateIssue} from '../src/domain/discovery.js';

test('PF01 reviewed financial import is reproducible and preserves previous records and reports',()=>{
  const imported=mergeBatch(before,input);
  assert.deepEqual(mergeBatch(imported,input),imported);
  for(const key of ['sources','reports'])for(const record of input[key]){
    const {lastCheckAttemptAt:currentCheck,...actual}=current[key].find(x=>x.id===record.id);
    const {lastCheckAttemptAt:importedCheck,...expected}=imported[key].find(x=>x.id===record.id);
    assert.deepEqual(actual,expected);assert.ok(currentCheck>=importedCheck);
  }
  assert.deepEqual(mergeBatch(current,input),current);
  assert.deepEqual(validateCatalog(current),[]);
  for(const key of ['companies','sources','reports','events','changeBatches'])assert.deepEqual(imported[key].slice(0,before[key].length),before[key],key);
  assert.deepEqual(imported.discovery,before.discovery);
});

test('PF02 all seven listed discoveries have actual H1 financials with dated original evidence',()=>{
  // Current/prior figures checked against the financial table pages, in RMB yuan.
  const expected={
    aofei:[1468814395.33,1147991587.70,196571835.59,87896925.76,'2026-08-01'],
    athub:[781608094.59,810505707.82,85883134.69,84958577.73,'2026-08-22'],
    capitalonline:[665166831.31,629058411.60,-32185014.98,-70959305.93,'2026-08-25'],
    hongxin:[3375792103.59,3493825718.76,123961305.68,53993082.70,'2026-08-21'],
    litong:[2101150261.85,1516253281.04,702413938.08,51079176.76,'2026-08-29'],
    nexwise:[343235883.72,315699094.26,-3261004.75,18728038.06,'2026-08-26'],
    range:[3745694047.05,2496223080.63,1203446677.80,882122065.03,'2026-08-28'],
  };
  for(const [id,values] of Object.entries(expected)){
    const report=current.reports.find(r=>r.id===`${id}-2026-h1`),f=report.financial;
    assert.deepEqual([f.revenue.value,f.revenue.priorValue,f.profit.value,f.profit.priorValue,report.publishedAt],values,id);
    assert.equal(f.statementBasis,'actual-results');assert.equal(f.period.type,'half-year');
    assert.equal(f.period.start,'2026-01-01');assert.equal(f.period.end,'2026-06-30');
    assert.equal(f.period.label,'2026年半年报｜1—6月累计');
    assert.equal(f.profit.attribution,'归属于上市公司股东');
    assert.equal(f.revenue.unit,'元');assert.equal(f.revenue.currency,'CNY');
    assert.match(f.evidence.locator,/PDF第\d+页/);
    assert.ok([report.url,report.originalUrl,...report.relatedLinks.map(l=>l.url)].includes(f.evidence.url));
    assert.equal(current.sources.find(s=>s.id===report.sourceId).sourceType,'company');
  }
});

test('PF03 losses remain negative and private companies are not assigned guessed financials',()=>{
  const capital=current.reports.find(r=>r.id==='capitalonline-2026-h1').financial.profit;
  const nexwise=latestFinancial(current,'nexwise').report.financial.profit;
  assert.equal(amount(capital),'-3,218.50万元人民币');assert.equal(changeText(capital),'亏损收窄');
  assert.equal(amount(nexwise),'-326.10万元人民币');assert.equal(changeText(nexwise),'由盈转亏');
  for(const metric of [capital,nexwise]){assert.equal(metric.change.basis,'amount');assert.equal(metric.change.percent,null);}
  for(const id of ['infinigence-ai','konst-group'])assert.equal(latestFinancial(current,id).report,undefined);
});

test('PF04 financial maintenance preserves NEW markers, discovery order and the daily selection',()=>{
  const previous=recentDiscoveries(before,'2026-10-15'),recent=recentDiscoveries(current,'2026-10-15');
  const discoveryIdentity=feed=>Object.fromEntries(['companies','reports'].map(key=>[key,feed[key].map(({id,discoveredAt,isNew})=>({id,discoveredAt,isNew}))]));
  assert.deepEqual(discoveryIdentity(recent),discoveryIdentity(previous));
  assert.equal(recent.companies.filter(c=>c.isNew).length,7);
  assert.equal(industryDiscoveryReports(current,recent.reports).filter(r=>r.isNew).length,8);
  const options={kind:'daily',date:'2026-10-15',generatedAt:'2026-10-15T10:12:13+08:00',batchId:'discovery-20261015'};
  assert.deepEqual(generateIssue(current,options),generateIssue(before,options));
});
