import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import data from '../public/assets/catalog.json' with {type:'json'};
import baseline from './fixtures/pre-phase4-catalog.json' with {type:'json'};
import phase4 from './fixtures/phase4-rc1-catalog.json' with {type:'json'};
import batch from '../docs/batches/phase4-content-20261012.json' with {type:'json'};
import {validateCatalog,isVerifiedMilestone} from '../src/domain/catalog.js';
import {validateFinancial,amount,changeText,latestFinancial} from '../src/domain/financial.js';
import {mergeBatch,applyBatchFile} from '../scripts/reviewed-batch.mjs';
import {decorateSources,filterSources,filterReports,getSourcePreview,relatedReports,companyReports,companyEvents,companyActions,normalizeFilters,readQuery,writeQuery,evidenceUrl} from '../src/catalog.js';
const sources=decorateSources(data), copy=()=>structuredClone(data), r=id=>data.reports.find(r=>r.id===id);
const financial=()=>structuredClone(r('sinnet-2026-h1'));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('F02–F05: archived macro product absent from all active/reference surfaces, identities preserved',()=>{
 for(const showReference of [false,true]){
  const filters={scope:'all',showReference,q:'国家能源局'};
  assert.ok(!filterSources(sources,filters).some(s=>s.id==='nea-electricity'));
  assert.ok(!filterReports(data.reports,sources,filters).some(s=>s.id==='nea-2026-08-electricity'));
  assert.equal(getSourcePreview(sources.find(s=>s.id==='nea-electricity'),filters),null);
  assert.ok(!relatedReports(data,sources,{...filters,topics:['industry'],subcategory:'power-resources'}).some(r=>r.sourceId==='nea-electricity'));
 }
 for(const id of ['nea-2026-08-electricity','smm-weekly-public-commentary-104134387']){
  const before=baseline.reports.find(r=>r.id===id),after=r(id);
  for(const key of ['id','url','publishedAt','verifiedAt','verificationNote'])assert.deepEqual(after[key],before[key]);
  assert.equal(after.visibility,'archived');
 }
 assert.equal(data.sources.find(s=>s.id==='smm-rental').visibility,'active');
 assert.ok(r('nda-capacity-20260430').visibility==='active');
});
test('F05: same ID replay ignored, renamed or different-source excluded products rejected',()=>{
 assert.equal(mergeBatch(data,{reports:[{id:'nea-2026-08-electricity',visibility:'active'}]}).reports.find(r=>r.id==='nea-2026-08-electricity').visibility,'archived');
 for(const id of ['nea-2026-08-electricity','smm-weekly-public-commentary-104134387']){
  const product={...r(id),id:'fixture-renamed',sourceId:'nda-capacity',visibility:'active',url:'https://example.com/new-url',originalUrl:r(id).url};
  assert.throws(()=>mergeBatch(data,{reports:[product]}),/Excluded/);
  const d=copy();d.reports.push(product);assert.ok(validateCatalog(d).some(e=>e.includes('排除产品')));
 }
});
test('F04: concrete NEA power policy remains admissible',()=>{
 const d=copy();d.reports.push({...r('nda-compute-network-20260912'),id:'fixture-power-policy',title:'数据中心绿电直连政策',summary:'隔离夹具：具体接电与绿电直连审批，不是宏观用电统计。',originalPublisher:'国家能源局',url:'https://www.nea.gov.cn/fixture-power-policy',originalUrl:null});
 assert.deepEqual(validateCatalog(d),[]);
});
test('F06–F10/F17–F18: concrete NDA additions, all five media and six core companies have financial evidence',()=>{
 assert.equal(data.reports.filter(r=>r.id.startsWith('nda-')&&r.publishedAt>='2026-09-01').length,3);
 for(const sourceId of ['nbd-industry','cls-industry','jiemian-industry','thepaper-industry','36kr-industry']){
  const originalIds=new Set(data.changeBatches.find(b=>b.batchId==='phase4-content-20261012').changes.filter(c=>c.objectType==='report'&&c.kinds.includes('new-record')).map(c=>c.objectId));
  const reports=data.reports.filter(r=>r.sourceId===sourceId&&originalIds.has(r.id));assert.ok(reports.length);
  assert.ok(reports.every(r=>r.publishedAt>='2026-09-13'&&r.publishedAt<='2026-10-12'&&r.authorship&&r.contentScope==='full'));
 }
 assert.equal(r('36kr-ixin-supernode-20261012').authorship.type,'brief');
 assert.equal(r('nbd-oulu-power-20260924').authorship.type,'brief');
 assert.equal(r('cls-compute-utilization-20260913').authorship.type,'journalist');
 assert.equal(new Set(data.reports.filter(r=>r.financial?.status==='verified'&&data.companies.find(c=>c.id===r.financial.companyId)?.role==='core').map(r=>r.financial.companyId)).size,6);
 for(const c of data.companies.filter(c=>c.role==='core'))assert.ok(latestFinancial(data,c.id).report);
});
test('F11–F13: original financial rows, foreign attribution and arithmetic are exact',()=>{
 const v=r('vnet-2026-q2').financial,g=r('gds-2026-h1').financial;
 assert.equal(v.profit.value,-135597);assert.equal(v.profit.priorValue,-11914);assert.match(v.profit.label,/VNET Group/);
 assert.equal(g.profit.value,3483916);assert.equal(g.profit.priorValue,690721);assert.match(g.profit.label,/GDS Holdings Limited/);
 assert.equal(g.revenue.value,6455049);assert.equal(g.revenue.change.basis,'calculated');
 assert.equal(r('sharetronic-2026-h1').financial.revenue.value,12522564910.65);
 assert.equal(amount(g.revenue),'64.55亿元人民币');assert.equal(amount(v.profit),'-1.36亿元人民币');
 for(const report of data.reports.filter(r=>r.financial))assert.deepEqual(validateFinancial(report.financial,report,'2026-10-12'),[]);
});
for(const [label,current,prior,expected]of [['正增长',120,100,'增长20.00%'],['负增长',80,100,'下降20.00%'],['零基数',10,0,'上年同期为零'],['亏损扩大',-20,-10,'亏损扩大'],['亏损收窄',-5,-10,'亏损收窄'],['扭亏',20,-10,'扭亏为盈'],['转亏',-10,20,'由盈转亏']])test('F14 '+label,()=>{
 const x=financial(),m=x.financial.profit;m.value=current;m.priorValue=prior;m.change={basis:prior<=0||current<0?'amount':'calculated',percent:prior<=0||current<0?null:(current-prior)/prior*100,note:'隔离测试：同口径计算'};
 assert.deepEqual(validateFinancial(x.financial,x,'2026-10-12'),[]);assert.ok(changeText(m).includes(expected));
 if(prior<=0||current<0){m.change.percent=100;assert.ok(validateFinancial(x.financial,x,'2026-10-12').length);}
});
for(const [label,mutate]of [
 ['未知字段',f=>f.revenue.fake=1],['错误期间',f=>f.period.type='quarter'],['错误同比',f=>f.profit.change.percent=1],['不同上期',f=>f.period.priorStart='2025-04-01'],['错误币种',f=>f.profit.currency='BTC'],['缺失值',f=>f.profit.value=null],['未知单位',f=>f.revenue.unit='台'],['未来期间',f=>f.period.end='2099-01-01'],['预测替代实际',f=>f.statementBasis='forecast'],['虚假定位',f=>f.evidence.url='https://example.com/not-linked'],['无效类型',f=>f.period.type='invalid']
])test('F11/F12 拒绝 '+label,()=>{const x=financial();mutate(x.financial);assert.ok(validateFinancial(x.financial,x,'2026-10-12').length);});
test('F07/F16: report period selection ignores news windows and historical record-added time',()=>{
 const original=latestFinancial(data,'sinnet').report;
 for(const dateWindow of ['7','30']){
  assert.equal(latestFinancial(data,'sinnet').report,original);
  assert.ok(!companyReports(data,sources,'sinnet',{scope:'domestic',dateWindow,asOf:'2026-10-12',types:['news']}).some(r=>r.financial));
  assert.deepEqual(companyEvents(data,'hec',{scope:'domestic',dateWindow,asOf:'2026-10-12',types:['news']}),companyEvents(data,'hec',{scope:'domestic'}));
  assert.deepEqual(companyActions(data,'hec',{scope:'domestic',dateWindow,asOf:'2026-10-12',types:['news']}),companyActions(data,'hec',{scope:'domestic'}));
 }
 const d=copy(),older=financial();older.id='fixture-old-today';older.publishedAt='2026-10-12';older.financial.period={label:'2025年上半年',start:'2025-01-01',end:'2025-06-30',type:'half-year',priorStart:'2024-01-01',priorEnd:'2024-06-30'};d.reports.push(older);
 assert.equal(latestFinancial(d,'sinnet').report.id,original.id);
 const pending=financial();pending.id='fixture-pending';pending.financial={companyId:'sinnet',status:'pending',statementBasis:'actual-results',period:{label:'2026年前三季度',start:'2026-01-01',end:'2026-09-30',type:'nine-months'},evidence:pending.financial.evidence,limitations:'隔离夹具：正文未取得'};pending.publishedAt='2026-10-12';d.reports.push(pending);
 assert.equal(latestFinancial(d,'sinnet').pending.length,1);assert.equal(latestFinancial(d,'sinnet').report.id,original.id);
});
test('F16/F20: ordinary source preview obeys topic and type; source description does not pollute articles',()=>{
 const s=sources.find(s=>s.id==='sinnet-disclosures');const preview=getSourcePreview(s,{scope:'domestic',types:['news']});assert.equal(preview.kind,'news');assert.equal(preview.financial,undefined);
 assert.equal(getSourcePreview({...s,relatedReports:s.relatedReports.filter(r=>r.financial)},{scope:'domestic',types:['news']}),null);
 const bad={...r('36kr-ixin-supernode-20261012'),title:'不相关消费资讯',summary:'测试：消费手机',tags:[]};
 assert.equal(filterReports([bad],sources,{scope:'all',q:'液冷'}).length,0);
 assert.equal(data.reports.filter(r=>r.kind==='broker-report'&&r.visibility==='active').length,0);
});
test('F21–F24: overseas is explicit, global/unknown not inverse-China; dual-region counted once',()=>{
 const report={...r('thepaper-intel-infrastructure-20260916'),id:'fixture-region'};
 for(const [regions,domestic,overseas]of [[['中国'],1,0],[['美国'],0,1],[['中国','马来西亚'],1,1],[['全球'],0,0],[['亚太'],0,0],[[],0,0]]){
  const x={...report,regions};assert.equal(filterReports([x,x],sources,{scope:'domestic'}).length,domestic);assert.equal(filterReports([x,x],sources,{scope:'overseas'}).length,overseas);
 }
 assert.ok(filterReports(data.reports,sources,{scope:'overseas',regions:['美国']}).some(r=>r.id==='thepaper-intel-infrastructure-20260916'));
 const f=normalizeFilters({scope:'overseas',dateWindow:'30',asOf:'2026-10-12',q:'英特尔'});assert.deepEqual(readQuery(writeQuery(f,'reports')).filters,f);
 assert.equal(normalizeFilters({scope:'overseas',regions:['美国']},'southeast-reports').scope,'sea');
 const domesticAbroad={...report,companyIds:['sinnet'],regions:['马来西亚']};
 assert.equal(filterReports([domesticAbroad],sources,{scope:'overseas',companies:['sinnet']}).length,1);
 assert.equal(filterReports([domesticAbroad],sources,{scope:'domestic',companies:['sinnet']}).length,0);
 const foreignDomestic={...report,companyIds:['intel'],regions:['中国']};
 assert.equal(filterReports([foreignDomestic],sources,{scope:'domestic',companies:['intel']}).length,1);
 assert.equal(data.companies.filter(c=>c.role==='core').length,6);assert.equal(data.companies.find(c=>c.id==='intel').role,'reference');
 assert.equal(r('sinnet-2026-h1-summary').publishedAt,null);
});
test('F25/F26: official supplementation upgrades existing node without another identity',()=>{
 const a=baseline.events.find(e=>e.id==='hec-chindata-listed-reorganization'),b=data.events.find(e=>e.id===a.id);
 assert.equal(b.milestones.length,a.milestones.length);assert.equal(b.latestVerifiedMilestoneId,'antitrust-mirror-read');
 assert.ok(isVerifiedMilestone(b.milestones.find(n=>n.id===b.latestVerifiedMilestoneId),data.reports));
 assert.equal(r('hec-antitrust-mirror-20261001').url,baseline.reports.find(r=>r.id==='hec-antitrust-mirror-20261001').url);
 assert.equal(evidenceUrl(r('hec-antitrust-mirror-20261001')),'https://static.cninfo.com.cn/finalpage/2026-10-01/1225591558.PDF');
 assert.equal(evidenceUrl(baseline.reports.find(r=>r.id==='hec-antitrust-mirror-20261001')),r('hec-antitrust-mirror-20261001').url);
 assert.match(b.currentSummary,/须经上交所审核及证监会同意注册/);assert.equal(r('hec-reorganization-newer-attachment-pending').visibility,'reference');
 const node=b.milestones[0];assert.throws(()=>mergeBatch(data,{events:[{event:{id:b.id},nodes:[{...node,id:'fixture-duplicate-media-node'}]}]}),/Same evidence/);
});
test('F27–F29: actual reviewed batch replay gives identical catalog and ledger',()=>{
 assert.deepEqual(mergeBatch(baseline,batch),phase4);assert.deepEqual(mergeBatch(data,batch),data);
 for(const before of baseline.reports){const after=r(before.id);for(const field of ['sourceId','url','originalUrl','publishedAt','originalPublisher'])assert.deepEqual(after[field],before[field],before.id+' '+field);}
 assert.deepEqual(data.changeBatches.slice(0,2),baseline.changeBatches);
 const ledger=data.changeBatches.find(b=>b.batchId===batch.changeBatch.batchId);
 assert.ok(Date.parse(ledger.recordedAt)<=Date.now(),'batch timestamp must be actual, not a future placeholder');
 assert.ok(ledger.changes.some(c=>c.kinds.includes('archive')));assert.ok(ledger.changes.some(c=>c.kinds.includes('financial')));
 assert.ok(ledger.changes.find(c=>c.objectId==='gds-2026-h1').kinds.includes('historical'));
});
test('F28: real destination bytes unchanged on invalid fields/date/D01, no success or temp file; replay is byte-idempotent',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'idc-p4-')),file=path.join(dir,'catalog.json');await writeFile(file,JSON.stringify(data,null,2)+'\n');const before=hash(await readFile(file));
 const f=structuredClone(r('sinnet-2026-h1').financial);f.revenue.fake=1;
 const event=data.events[0],node=event.milestones[0];
 for(const bad of [{reports:[{id:'sinnet-2026-h1',financial:f}]},{reports:[{...financial(),id:'fixture-invalid-date',url:'https://example.com/invalid',publishedAt:'2026-02-30'}]},{events:[{event:{id:event.id},nodes:[{...node,id:'fixture-duplicate'}]}]},{reports:[{id:'sinnet-2026-h1',financial:null}]}]){
  await assert.rejects(applyBatchFile(file,bad));assert.equal(hash(await readFile(file)),before);assert.deepEqual(await readdir(dir),['catalog.json']);
 }
 assert.deepEqual(await applyBatchFile(file,batch),{changed:false});assert.equal(hash(await readFile(file)),before);
 await writeFile(file,JSON.stringify(baseline));assert.deepEqual(await applyBatchFile(file,batch),{changed:true});assert.deepEqual(JSON.parse(await readFile(file)),phase4);
});
