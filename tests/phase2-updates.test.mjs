import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {mergeBatch} from '../scripts/reviewed-batch.mjs';
import {validateCatalog} from '../src/domain/catalog.js';
import {eventTimeline,readQuery,writeQuery,companyEvents} from '../src/catalog.js';
const copy=()=>structuredClone(data);
const id='hec-chindata-listed-reorganization';
const get=d=>d.events.find(e=>e.id===id);
function fixture() {
 const report={...data.reports.find(r=>r.id==='hec-reorganization-reply-20260923'),id:'fixture-only-new-progress',url:'https://example.com/fixture-new',originalUrl:'https://example.com/fixture-new',title:'【隔离测试】节点与资料同批更新',publishedAt:'2026-10-08',summary:'【隔离测试】此为流程验收，绝非真实公司交易进展。',verificationNote:'隔离夹具模拟证据，不是线上核验。'};
 const node={...get(data).milestones[1],id:'fixture-progress',primaryEvidenceReportId:report.id,evidenceRefs:[{reportId:report.id,locator:'隔离测试',role:'主证据'}],summary:report.summary};
 return {report,node,batch:{reports:[report],events:[{event:{id},nodes:[node],current:{reason:'progress',currentSummary:report.summary,latestVerifiedMilestoneId:node.id,basisMilestoneIds:[node.id]}}]}};
}
test('B13-17: actual HEC events distinct, pending newer clue never current; VNET original ID/date',()=>{
 const a=data.events.find(e=>e.id==='hec-chindata-platform-acquisition'),b=get(data);
 assert.match(a.currentSummary,/交割完成/);assert.match(b.currentSummary,/待核/);assert.notEqual(a.latestVerifiedMilestoneId,b.latestVerifiedMilestoneId);
 assert.equal(b.latestVerifiedMilestoneId,'reply-and-revision');assert.equal(data.reports.find(r=>r.id==='hec-reorganization-newer-attachment-pending').publishedAt,null);
 assert.ok(b.uncertainties.some(n=>n.includes('反垄断')));assert.ok(b.uncertainties.some(n=>n.includes('配套募资')));
 const r=data.reports.find(r=>r.id==='vnet-strategic-investment-close-20260921');assert.equal(r.publishedAt,'2026-09-21');assert.match(r.summary,/原股东股份转让/);
});
test('B21/B26: six companies have bounded channel checks; malformed and false no-new rejected',()=>{
 assert.equal(data.companies.filter(c=>c.disclosureReview).length,6);
 for(const mutate of [d=>{get(d).companyIds='hec';},d=>{get(d).participants={};},d=>{get(d).basisMilestoneIds='oops';},d=>{get(d).review.result='no-new';},d=>{d.companies.find(c=>c.id==='hec').disclosureReview.checks[0].checkedThrough='2099-01-01';}]) {const d=copy();mutate(d);assert.ok(validateCatalog(d).length);}
});
test('B23/B30: explicit new progress is atomic and same reviewed batch is byte-idempotent',()=>{
 const {batch}=fixture(),next=mergeBatch(data,batch);
 assert.equal(next.reports.length,data.reports.length+1);assert.equal(get(next).milestones.length,get(data).milestones.length+1);
 assert.deepEqual(mergeBatch(next,batch),next);assert.deepEqual(data,copy());
});
test('B19/B25: old text correction and historical addition keep current and original dates',()=>{
 const f=fixture(),next=mergeBatch(data,f.batch),old=next.reports.find(r=>r.id==='hec-reorganization-plan-20260307');
 const revised=mergeBatch(next,{reports:[{id:old.id,summary:old.summary+' 【隔离测试修订】'}]});
 assert.equal(get(revised).latestVerifiedMilestoneId,f.node.id);assert.equal(revised.reports.find(r=>r.id===old.id).publishedAt,old.publishedAt);
 const historic={...f.report,id:'fixture-historic',url:'https://example.com/historic',originalUrl:'https://example.com/historic',publishedAt:'2025-01-01'};
 const node={...f.node,id:'fixture-historical-node',primaryEvidenceReportId:historic.id,evidenceRefs:[{reportId:historic.id,locator:'历史补录',role:'主证据'}]};
 const result=mergeBatch(revised,{reports:[historic],events:[{event:{id},nodes:[node]}]});
 assert.equal(get(result).latestVerifiedMilestoneId,f.node.id);assert.notEqual(eventTimeline(get(result),result)[0].id,node.id);
 assert.throws(()=>mergeBatch(result,{reports:[{id:old.id,publishedAt:'2026-10-08'}]}),/Historical/);
});
test('B21/B22: completed limited check survives later blocked/partial/conflict attempts',()=>{
 const base=copy();const original=get(base);
 const check={id:'fixture-complete',channel:'隔离测试单渠道',url:'https://example.com/list',attemptedAt:'2026-10-08',result:'no-new',checkedFrom:'2026-10-07',checkedThrough:'2026-10-08',note:'虚拟测试区间，非真实外部检查'};
 let next=mergeBatch(base,{events:[{event:{id},review:{lastAttemptAt:'2026-10-08',result:'no-new',note:check.note,checks:[check]}}]});
 for(const result of ['blocked','partial','conflict']) next=mergeBatch(next,{events:[{event:{id},review:{lastAttemptAt:'2026-10-08',result,note:'测试'+result,checks:[{...check,id:'fixture-'+result,result,checkedFrom:null,checkedThrough:null}]}}]});
 assert.equal(get(next).currentSummary,original.currentSummary);assert.deepEqual(get(next).milestones,original.milestones);assert.deepEqual(next.reports,base.reports);assert.equal(get(next).review.checks.find(c=>c.id===check.id).checkedThrough,'2026-10-08');
 assert.throws(()=>mergeBatch(next,{events:[{event:{id},review:{lastAttemptAt:'2026-10-08',result:'blocked',note:'失败',checks:[]},current:{reason:'progress',currentSummary:'错误覆盖'}}]}),/cannot replace/);
});
test('B24: duplicate evidence cannot create progress; reviewed same-URL versions permitted',()=>{
 const f=fixture(),next=mergeBatch(data,f.batch);
 assert.throws(()=>mergeBatch(next,{events:[{event:{id},nodes:[{...f.node,id:'duplicate-node'}]}]}),/another business node/);
 assert.throws(()=>mergeBatch(next,{reports:[{...f.report,id:'duplicate-report'}]}),/original ID/);
 next.reports.find(r=>r.id===f.report.id).documentVersion='v1';
 const r={...f.report,id:'fixture-version-2',documentVersion:'v2'};
 const result=mergeBatch(next,{reports:[r]});assert.ok(result.reports.some(x=>x.id===r.id));
 const repost={...f.report,id:'fixture-repost',url:'https://example.com/repost',originalUrl:'https://example.com/repost',duplicateOf:f.report.id};
 const bad={...f.node,id:'fixture-repost-node',primaryEvidenceReportId:repost.id,evidenceRefs:[{reportId:repost.id,locator:'转载',role:'主证据'}]};
 assert.throws(()=>mergeBatch(next,{reports:[repost],events:[{event:{id},nodes:[bad],current:{reason:'progress',currentSummary:'不能升级',latestVerifiedMilestoneId:bad.id,basisMilestoneIds:[bad.id]}}]}));
});
test('B25: reviewed withdrawal is a valid new node, with old evidence retained',()=>{
 const f=fixture(),next=mergeBatch(data,f.batch);
 const r={...f.report,id:'fixture-withdrawn',url:'https://example.com/withdrawn',originalUrl:'https://example.com/withdrawn',summary:'【隔离测试】交易已撤回，不是真实事实。'};
 const node={...f.node,id:'fixture-withdrawn-node',title:'撤回',summary:r.summary,primaryEvidenceReportId:r.id,evidenceRefs:[{reportId:r.id,locator:'测试撤回公告',role:'主证据'}]};
 const result=mergeBatch(next,{reports:[r],events:[{event:{id},nodes:[node],current:{reason:'withdrawal',currentSummary:r.summary,latestVerifiedMilestoneId:node.id,basisMilestoneIds:[node.id]}}]});
 assert.equal(get(result).latestVerifiedMilestoneId,node.id);assert.ok(get(result).milestones.some(n=>n.id===f.node.id));
});
test('B23/B31: archive cannot be reactivated; same event cannot gain a new ID',()=>{
 const archive=data.reports.find(r=>r.visibility==='archived');
 const next=mergeBatch(data,{reports:[{id:archive.id,visibility:'active'}]});assert.equal(next.reports.find(r=>r.id===archive.id).visibility,'archived');
 assert.throws(()=>mergeBatch(data,{events:[{event:{...get(data),id:'duplicate-event'}}]}),/original ID/);
});
test('B27/B28: return filters and event type survive sharing; event obeys actual country coverage',()=>{
 const nav={company:'hec',event:id,eventType:'acquisition',returnQuery:'topics=industry&subcategory=power-resources&scope=domestic'};
 const state=readQuery(writeQuery({topics:['listed-companies'],scope:'sea',types:['news']},'reports',null,nav));
 assert.deepEqual(state.navigation,nav);assert.equal(companyEvents(data,'hec',state.filters).length,0);
 assert.equal(readQuery(state.navigation.returnQuery).filters.subcategory,'power-resources');
});
