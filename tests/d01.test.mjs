import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import { mergeBatch } from '../scripts/reviewed-batch.mjs';
import { validateCatalog } from '../src/domain/catalog.js';

const eventId='hec-chindata-listed-reorganization';
const event=data.events.find(e=>e.id===eventId);
const report=id=>({...data.reports.find(r=>r.id==='vnet-catl-cooperation-20260818'),id,url:'https://example.com/'+id,originalUrl:'https://example.com/'+id,eventId:null,summary:'D01隔离测试资料，不是真实资讯。'});
const node=(id,primary)=>({id,title:'隔离节点',summary:'D01隔离测试节点',occurredAt:null,isProgress:true,verificationLevel:'official-body',primaryEvidenceReportId:primary,evidenceRefs:[{reportId:primary,locator:'隔离测试',role:'主证据'}]});
const input=(nodes,reports=[])=>({reports,events:[{event:{id:eventId},nodes}]});
const metadata=id=>({batchId:id,recordedAt:'2026-10-09T12:00:00+08:00',periodStart:'2026-10-09',scope:'D01隔离测试',summary:'测试，不是真实更新'});
const milestones=d=>d.events.find(e=>e.id===eventId).milestones;
const rejects=batch=>{const before=JSON.stringify(data);assert.throws(()=>mergeBatch(data,batch));assert.equal(JSON.stringify(data),before);};

test('D01-N01: same-batch distinct nodes with one new primary document are rejected',()=>{
 rejects(input([node('d01-one','d01-doc'),node('d01-two','d01-doc')],[report('d01-doc')]));
});
test('D01-N02: new node cannot reuse an existing primary within its event',()=>{
 rejects(input([{...event.milestones[0],id:'d01-copy'}]));
});
test('D01-N03: a later batch cannot create a second node using the earlier primary',()=>{
 const first=mergeBatch(data,{...input([node('d01-one','d01-doc')],[report('d01-doc')]),changeBatch:metadata('d01-first')});
 const before=JSON.stringify(first);
 assert.throws(()=>mergeBatch(first,{...input([node('d01-two','d01-doc')]),changeBatch:metadata('d01-second')}));
 assert.equal(JSON.stringify(first),before);
});
test('D01-N04: split entries in one batch cannot evade event-local uniqueness',()=>{
 rejects({reports:[report('d01-doc')],events:[{event:{id:eventId},nodes:[node('d01-one','d01-doc')]},{event:{id:eventId},nodes:[node('d01-two','d01-doc')]}]});
});
test('D01-N05: direct catalog validation rejects different IDs with the same primary',()=>{
 const copy=structuredClone(data);
 milestones(copy).push({...event.milestones[0],id:'d01-copy'});
 assert.ok(validateCatalog(copy).some(e=>e.includes('primaryEvidenceReportId')&&e.includes('重复主证据')));
});
test('D01-N06: missing primary evidence remains invalid',()=>{
 rejects(input([node('d01-missing','d01-missing-report')]));
});
test('D01-N07: a conflicting node ID cannot silently replace a historical fact',()=>{
 rejects(input([{...event.milestones[0],summary:'不应覆盖的测试内容'}]));
});
test('D01-P01: one new node with its own primary is accepted',()=>{
 const next=mergeBatch(data,input([node('d01-one','d01-doc')],[report('d01-doc')]));
 assert.equal(milestones(next).length,event.milestones.length+1);
 assert.deepEqual(validateCatalog(next),[]);
});
test('D01-P02: distinct primaries in the same event are accepted',()=>{
 const next=mergeBatch(data,input([node('d01-one','d01-a'),node('d01-two','d01-b')],[report('d01-a'),report('d01-b')]));
 assert.equal(milestones(next).length,event.milestones.length+2);
 assert.deepEqual(validateCatalog(next),[]);
});
test('D01-P03: different events can legitimately share a primary document',()=>{
 const next=mergeBatch(data,{reports:[report('d01-shared')],events:[{event:{id:eventId},nodes:[node('d01-hec','d01-shared')]},{event:{id:'vnet-catl-cooperation-20260818'},nodes:[node('d01-vnet','d01-shared')]}]});
 assert.deepEqual(validateCatalog(next),[]);
 assert.equal(next.events.filter(e=>e.milestones.some(n=>n.primaryEvidenceReportId==='d01-shared')).length,2);
});
test('D01-P04: identical node IDs and exact reviewed batches stay idempotent',()=>{
 const n=node('d01-one','d01-doc'),batch={...input([n,n],[report('d01-doc')]),changeBatch:metadata('d01-repeat')};
 const next=mergeBatch(data,batch);
 assert.equal(milestones(next).length,event.milestones.length+1);
 assert.deepEqual(mergeBatch(next,batch),next);
 assert.deepEqual(mergeBatch(next,input([n])),next);
});
test('D01-P05: existing nodeEvidence path adds evidence without adding a node',()=>{
 const ref={reportId:'d01-supplement',locator:'补证章节',role:'补充证据'};
 const batch={reports:[report(ref.reportId)],events:[{event:{id:eventId},nodeEvidence:[{id:event.milestones[0].id,evidenceRefs:[ref]}]}]};
 const next=mergeBatch(data,batch),updated=milestones(next)[0];
 assert.equal(milestones(next).length,event.milestones.length);
 assert.equal(updated.primaryEvidenceReportId,event.milestones[0].primaryEvidenceReportId);
 assert.equal(updated.evidenceRefs.length,event.milestones[0].evidenceRefs.length+1);
 assert.deepEqual(mergeBatch(next,batch),next);
 assert.equal(next.events.find(e=>e.id===eventId).currentSummary,event.currentSummary);
});
test('D01-P06: supplemental evidence may be shared and may be another node primary',()=>{
 const a=node('d01-one','d01-a'),b=node('d01-two','d01-b');
 a.evidenceRefs.push({reportId:'d01-b',locator:'交叉补证',role:'补充证据'});
 for(const n of [a,b])n.evidenceRefs.push({reportId:'d01-shared-supplement',locator:'同一附录',role:'补充证据'});
 const next=mergeBatch(data,input([a,b],['d01-a','d01-b','d01-shared-supplement'].map(report)));
 assert.deepEqual(validateCatalog(next),[]);
});
test('D01-P07: ordinary bounded review updates preserve current conclusions',()=>{
 const review={lastAttemptAt:'2026-10-09',result:'blocked',note:'D01隔离检查',checks:[{id:'d01-review',channel:'隔离测试',url:'https://example.com/d01-review',attemptedAt:'2026-10-09',result:'blocked',checkedFrom:null,checkedThrough:null,note:'非真实核查'}]};
 const next=mergeBatch(data,{events:[{event:{id:eventId},review}]});
 assert.equal(next.events.find(e=>e.id===eventId).currentSummary,event.currentSummary);
 assert.deepEqual(milestones(next),event.milestones);
});
test('D01-P08: the unchanged real catalog continues to validate',()=>{
 assert.deepEqual(validateCatalog(data),[]);
});
test('D01-E01: embedded milestones in a new event cannot bypass final validation',()=>{
 const n=node('d01-one','d01-doc');
 const newEvent={...structuredClone(event),id:'d01-new-event',title:'隔离新事项',relatedEventIds:[],milestones:[n,{...n,id:'d01-two'}],latestVerifiedMilestoneId:n.id,basisMilestoneIds:[n.id]};
 rejects({reports:[report('d01-doc')],events:[{event:newEvent}]});
});
test('D01-E02: empty primary IDs remain rejected by reference validation',()=>{
 const copy=structuredClone(data);
 milestones(copy)[0].primaryEvidenceReportId='';
 assert.ok(validateCatalog(copy).some(e=>e.includes('primaryEvidenceReportId')));
});

