import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import { dateRange, beijingToday, matchesPublishedDate, normalizeFilters, readQuery, writeQuery, filterReports, decorateSources, companyEvents, companyReports, relatedReports, getReportMatchReason, batchChanges } from '../src/catalog.js';
import { validateCatalog, isVerifiedMilestone } from '../src/domain/catalog.js';
import { mergeBatch } from '../scripts/reviewed-batch.mjs';
const sources=decorateSources(data), frozen={dateWindow:'7',asOf:'2026-10-08'};
const check={id:'fixture-p3-check',channel:'隔离夹具',url:'https://example.com/check',attemptedAt:'2026-10-08',result:'blocked',checkedFrom:null,checkedThrough:null,note:'测试失败保护，不是真实核查。'};
const metadata={batchId:'fixture-phase3-batch',recordedAt:'2026-10-08T18:00:00+08:00',periodStart:'2026-10-08',scope:'隔离测试',summary:'非真实资讯'};
const copy=()=>structuredClone(data);
const fixture=()=>({...data.reports.find(r=>r.id==='vnet-catl-cooperation-20260818'),id:'fixture-p3-doc',eventId:null,url:'https://example.com/fixture-doc',originalUrl:'https://example.com/fixture-doc',publishedAt:'2026-10-08',summary:'隔离测试，非真实公司资讯。'});

test('source evidence remains discoverable in batches; failed check cannot erase successful date',()=>{
 const batch=data.changeBatches.find(b=>b.batchId==='phase3-research-20261009');
 assert.ok(batchChanges(data,sources,batch,{scope:'domestic',q:'SMM',dateWindow:'7',asOf:'2026-10-08'}).some(c=>c.objectType==='source'&&c.objectId==='smm-rental'));
 assert.ok(!batchChanges(data,sources,batch,{scope:'sea'}).some(c=>c.objectId==='smm-rental'));
 assert.throws(()=>mergeBatch(data,{sources:[{id:'smm-rental',verifiedAt:null}]}),/Keep successful source/);
 const snapshot=data.reports.find(r=>r.id==='smm-h100-observation-20261009');
 assert.equal(snapshot.publishedAt,null);
 assert.equal(matchesPublishedDate(snapshot,frozen),false);
 assert.match(snapshot.summary,/非实时成交价/);
});

test('C09: inclusive Beijing natural-day windows and month/year/leap boundaries',()=>{
 assert.deepEqual(dateRange('7','2026-10-08'),{from:'2026-10-02',through:'2026-10-08'});
 assert.deepEqual(dateRange('30','2026-10-08'),{from:'2026-09-09',through:'2026-10-08'});
 assert.equal(dateRange('7','2026-01-03').from,'2025-12-28');
 assert.equal(dateRange('7','2024-03-01').from,'2024-02-24');
 assert.equal(beijingToday(new Date('2026-10-08T16:01:00Z')),'2026-10-09');
 for(const [day,wanted] of [['2026-10-01',false],['2026-10-02',true],['2026-10-08',true],['2026-10-09',false]]) assert.equal(matchesPublishedDate({publishedAt:day,verifiedAt:'2026-10-08'},frozen,'2026-10-09'),wanted);
});
test('C10: unknown and future dates never enter dated results; reread is not republication',()=>{
 assert.equal(matchesPublishedDate({publishedAt:null},frozen),false);
 assert.equal(matchesPublishedDate({publishedAt:null},{dateWindow:'unknown'}),true);
 assert.equal(matchesPublishedDate({publishedAt:'2099-01-01'},{dateWindow:'all'}),false);
 assert.equal(matchesPublishedDate({publishedAt:'2026-08-18',verifiedAt:'2026-10-08'},frozen),false);
 assert.equal(matchesPublishedDate({publishedAt:'2026-02-30'},{dateWindow:'all'}),false);
});
test('C11/C31: fixed cutoff and batch identity survive rich URL and old URL retains semantics',()=>{
 const filters=normalizeFilters({...frozen,scope:'domestic',topics:['industry'],subcategory:'facility-technology',q:'液冷',access:['free'],readingMode:'batches',batchId:'phase3-reviewed-20261009'});
 const state=readQuery(writeQuery(filters,'reports'));
 assert.deepEqual(state.filters,filters);assert.equal(state.filters.asOf,'2026-10-08');
 assert.equal(readQuery('?q=IDC').filters.scope,'all');assert.equal(readQuery('?view=reports').filters.dateWindow,'all');
 assert.equal(readQuery('?view=reports&dateWindow=7&asOf=2026-02-30').filters.dateWindow,'all');
 assert.match(readQuery('?view=reports&dateWindow=7&asOf=2099-01-01').notice,/日期/);
 assert.equal(readQuery('?dateWindow=7&asOf=2026-10-08').filters.dateWindow,'all');
});
test('C12: document time does not filter or roll back company current events',()=>{
 const latest=companyEvents(data,'hec',{scope:'domestic'});
 assert.deepEqual(companyEvents(data,'hec',{scope:'domestic',...frozen}),latest);
 assert.equal(companyReports(data,sources,'hec',{scope:'domestic',...frozen}).length,0);
});
test('C06/C07/C17: historical CATL cooperation stays separate from shareholder transfer',()=>{
 const id='vnet-catl-cooperation-20260818',record=data.reports.find(r=>r.id===id);
 assert.equal(record.publishedAt,'2026-08-18');assert.match(record.summary,/具体项目.*后续/);
 for(const dateWindow of ['7','30']) assert.ok(!filterReports(data.reports,sources,{scope:'domestic',dateWindow,asOf:'2026-10-08'}).some(r=>r.id===id));
 const entry=data.changeBatches.find(b=>b.batchId==='phase3-reviewed-20261009').changes.find(c=>c.objectType==='report'&&c.objectId===id);
 assert.deepEqual(entry.kinds,['historical']);
 assert.match(data.reports.find(r=>r.id==='vnet-strategic-investment-close-20260921').summary,/原股东股份转让/);
});
test('C03–C05/C26: mirror is never an official current node and HEC identity survives',()=>{
 const event=data.events.find(e=>e.id==='hec-chindata-listed-reorganization');
 const node=event.milestones.find(n=>n.id==='antitrust-mirror-read');
 assert.equal(isVerifiedMilestone(node,data.reports),false);assert.equal(node.isProgress,false);
 assert.equal(event.latestVerifiedMilestoneId,'reply-and-revision');assert.match(event.currentSummary,/未确认证券审核、注册、登记、交割或配套募资完成/);
 assert.equal(data.reports.find(r=>r.id==='hec-2026-h1').publishedAt,'2026-08-18');
 assert.equal(data.reports.find(r=>r.id==='hec-reorganization-newer-attachment-pending').publishedAt,null);
});
test('C13/C14: new, historic and revision are generated from actual diff; exact replay idempotent',()=>{
 const r=fixture(),batch={reports:[r],changeBatch:metadata};
 const next=mergeBatch(data,batch);assert.equal(next.changeBatches.at(-1).changes[0].kinds[0],'new-record');
 assert.deepEqual(mergeBatch(next,batch),next);
 assert.throws(()=>mergeBatch(next,{...batch,changeBatch:{...metadata,summary:'different'}}),/conflicts/);
 const revision=mergeBatch(next,{reports:[{id:r.id,summary:r.summary+' 修订'}],changeBatch:{...metadata,batchId:'fixture-revision'}});
 assert.deepEqual(revision.changeBatches.at(-1).changes[0].kinds,['revision']);
 const historic=mergeBatch(data,{reports:[{...r,publishedAt:'2026-08-18'}],changeBatch:metadata});
 assert.deepEqual(historic.changeBatches.at(-1).changes[0].kinds,['historical']);
});
test('C15: invalid node aborts report, event, current and batch atomically',()=>{
 const before=JSON.stringify(data),r=fixture(),event=data.events.find(e=>e.id==='hec-chindata-listed-reorganization');
 assert.throws(()=>mergeBatch(data,{reports:[r],events:[{event:{id:event.id},nodes:[{...event.milestones[0],id:'fixture-invalid',primaryEvidenceReportId:'missing'}],current:{reason:'progress',currentSummary:'不能写入',latestVerifiedMilestoneId:'fixture-invalid',basisMilestoneIds:['fixture-invalid']}}],changeBatch:metadata}));
 assert.equal(JSON.stringify(data),before);
});
test('C16: blocked check records zero news and cannot replace a successful current state',()=>{
 const id='hec-chindata-listed-reorganization',event=data.events.find(e=>e.id===id);
 const batch={events:[{event:{id},review:{lastAttemptAt:'2026-10-08',result:'blocked',note:'测试',checks:[check]}}],changeBatch:metadata};
 const next=mergeBatch(data,batch),ledger=next.changeBatches.at(-1);
 assert.equal(ledger.changes.length,0);assert.equal(ledger.checks.length,1);assert.equal(next.events.find(e=>e.id===id).currentSummary,event.currentSummary);
 assert.throws(()=>mergeBatch(data,{...batch,events:[{...batch.events[0],current:{reason:'progress',currentSummary:'虚假成功'}}]}),/cannot replace/);
 assert.deepEqual(mergeBatch(data,{changeBatch:metadata}),data);
});
test('C13: batch view ignores inactive original-date window and keeps other filters',()=>{
 const batch=data.changeBatches.find(b=>b.batchId==='phase3-reviewed-20261009');
 const results=batchChanges(data,sources,batch,{scope:'domestic',...frozen,companies:['vnet']});
 assert.ok(results.some(c=>c.objectId==='vnet-catl-cooperation-20260818'));
 assert.ok(!results.some(c=>c.objectId.startsWith('hec')));
});
test('C18/C19/C29: liquid cooling finds existing bibliographic document without reclassification',()=>{
 const r=data.reports.find(r=>r.id==='yicai-aidc-power-delivery-20260921');
 assert.ok(filterReports(data.reports,sources,{scope:'domestic',q:'液冷'}).some(x=>x.id===r.id));
 assert.equal(getReportMatchReason(r,sources.find(s=>s.id===r.sourceId),'液冷').label,'主题标签匹配');
 assert.equal(r.primarySubcategoryId,'power-resources');assert.equal(r.displayRestriction,'bibliographic-link-only');
 const filters={scope:'domestic',topics:['industry'],subcategory:'facility-technology',q:'液冷'};
 assert.equal(filterReports(data.reports,sources,filters).length,0);
 assert.equal(relatedReports(data,sources,filters).length,1);
});
test('C20: related documents cannot cross date, permission, country, company or keyword bounds',()=>{
 const base={scope:'domestic',topics:['industry'],subcategory:'facility-technology',q:'液冷'};
 for (const extra of [{regions:['马来西亚']},{access:['paid']},frozen,{companies:['gds']},{q:'液冷 不存在词'}]) assert.equal(relatedReports(data,sources,{...base,...extra}).length,0);
});
test('C13/C15: malformed ledger, empty batch, fake references and invalid check ranges rejected',()=>{
 for(const mutate of [b=>b.recordedAt='2026-02-30T18:00:00+08:00',b=>b.changes=[],b=>b.changes[0].afterRefs=['missing'],b=>b.changes[0].kinds=['fake'],b=>b.checks=[{...check,result:'no-new'}]]) {
  const d=copy(),b=d.changeBatches[0];mutate(b);if(!b.changes.length)b.checks=[];assert.ok(validateCatalog(d).length);
 }
});
