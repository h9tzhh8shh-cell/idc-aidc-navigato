import test from 'node:test';
import assert from 'node:assert/strict';
import data from './fixtures/v1-baseline-catalog.json' with {type:'json'};
import prior from './fixtures/phase4-rc3-catalog.json' with {type:'json'};
import {decorateSources,getSourcePreviewSelection,getSourcePreview,getSourceReports} from '../src/catalog.js';
import {mergeBatch,applyBatchFile} from '../scripts/reviewed-batch.mjs';
import batch from '../docs/batches/media-fold-20261012.json' with {type:'json'};
import weekBatch from '../docs/batches/media-week7-20261012.json' with {type:'json'};
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const today='2026-10-12',sources=decorateSources(data),template=data.reports.find(r=>r.id==='wmedia-sarawak-framework-20261009');
const fixture=dates=>({...sources.find(s=>s.id===template.sourceId),relatedReports:dates.map((publishedAt,i)=>({...template,id:'fold-'+String(i).padStart(2,'0'),publishedAt,regions:['中国']}))});
const select=(dates,filters={})=>getSourcePreviewSelection(fixture(dates),filters,today);

test('M01: five qualified seven-day articles stop widening and produce one cover plus four distinct extras',()=>{
 const s=select(['2026-10-12','2026-10-11','2026-10-10','2026-10-09','2026-10-08','2026-10-01']);
 assert.equal(s.days,7);assert.equal(s.reports.length,5);assert.equal(s.report,s.reports[0]);assert.equal(new Set(s.reports.map(r=>r.id)).size,5);
});
test('M02: fewer than five widens to 15 then 30; only the latest five enter the view',()=>{
 assert.equal(select(['2026-10-12','2026-10-05','2026-10-04','2026-10-03','2026-09-28','2026-09-23']).days,15);
 const s=select(['2026-10-12','2026-10-05','2026-10-04','2026-10-03','2026-09-23','2026-09-13']);
 assert.equal(s.days,30);assert.equal(s.reports.length,5);assert.equal(s.reports.at(-1).publishedAt,'2026-09-23');
});
test('M03: one, fewer than five and zero are honest 30-day results without invented records',()=>{
 assert.equal(select(['2026-10-12']).reports.length,1);assert.equal(select(['2026-10-12']).days,30);
 assert.equal(select(['2026-10-12','2026-09-13']).reports.length,2);
 assert.deepEqual(select(['2026-09-12',null,'2026-10-13']),{report:null,reports:[],days:30});
});
test('M04: scope and keyword matching happen before counts; unrelated recent articles do not block fallback',()=>{
 const f=fixture(['2026-10-12','2026-10-11','2026-10-10','2026-10-09','2026-10-08','2026-09-23']);
 for(const r of f.relatedReports.slice(0,5)){r.regions=['马来西亚'];r.title='境外项目';}f.relatedReports[5].title='国内供电';
 const s=getSourcePreviewSelection(f,{scope:'domestic',q:'国内供电'},today);
 assert.equal(s.days,30);assert.deepEqual(s.reports.map(r=>r.id),['fold-05']);
 assert.equal(getSourcePreviewSelection(f,{scope:'sea'},today).days,7);
});
test('M05: title-only, unavailable, unverified and sponsored leads cannot fill five slots',()=>{
 const f=fixture(Array(6).fill(today));
 f.relatedReports[0].contentScope='title';f.relatedReports[1].contentScope='unavailable';
 f.relatedReports[2].verificationStatus='unverified';f.relatedReports[3].authorship={type:'sponsored',author:'fixture'};
 f.relatedReports[4].contentScope='abstract';f.relatedReports[4].verificationStatus='partial';
 const s=getSourcePreviewSelection(f,{},today);assert.deepEqual(s.reports.map(r=>r.id),['fold-04','fold-05']);assert.equal(s.days,30);
});
test('M06: same-day order is stable by ID and independent of insertion and verification order',()=>{
 const f=fixture(Array(6).fill(today));f.relatedReports.reverse();
 assert.deepEqual(getSourcePreviewSelection(f,{sort:'verified'},today).reports.map(r=>r.id),['fold-00','fold-01','fold-02','fold-03','fold-04']);
});
test('M07: a new article displaces the oldest view row while all old articles remain in source history',()=>{
 const f=fixture(['2026-10-11','2026-10-10','2026-10-09','2026-10-08','2026-10-07']);
 const before=getSourcePreviewSelection(f,{},today);f.relatedReports.push({...template,id:'fold-new',publishedAt:today,regions:['中国']});
 const after=getSourcePreviewSelection(f,{},today);assert.equal(after.report.id,'fold-new');assert.ok(!after.reports.some(r=>r.id===before.reports.at(-1).id));
 assert.equal(getSourceReports(f).length,6);
});
test('M08: 30-day expiry affects the view rather than stored source history',()=>{
 const f=fixture(['2026-09-13']);assert.equal(getSourcePreviewSelection(f,{},today).reports.length,1);
 assert.equal(getSourcePreviewSelection(f,{},'2026-10-13').reports.length,0);assert.equal(getSourceReports(f).length,1);
});
test('M09: real w.media includes five stories across 30 days and never repeats the cover',()=>{
 const s=getSourcePreviewSelection(decorateSources(prior).find(s=>s.id==='wmedia-sea'),{},today);
 assert.equal(s.days,30);assert.equal(s.reports.length,5);assert.equal(s.report.id,s.reports[0].id);
 assert.ok(s.reports.every(r=>r.summary&&r.summary!==r.title));
});
test('M10: government and financial source previews retain their existing behavior and API',()=>{
 const f={...fixture(['2026-04-30']),sourceType:'government'};const s=getSourcePreviewSelection(f,{},today);
 assert.equal(s.days,null);assert.equal(s.report.publishedAt,'2026-04-30');assert.deepEqual(s.reports,[s.report]);assert.equal(getSourcePreview(f,{},today),s.report);
});
test('M11: archive, duplicate and reference visibility cannot leak into the qualified media list',()=>{
 const f=fixture(Array(3).fill(today));f.relatedReports[0].visibility='archived';f.relatedReports[1].duplicateOf='fold-00';f.relatedReports[2].visibility='reference';
 assert.equal(getSourcePreviewSelection(f,{},today).reports.length,0);assert.equal(getSourcePreviewSelection(f,{showReference:true},today).reports.length,1);
});
test('M12: 7 and 15 day inclusive boundaries count toward five; document filters remain respected',()=>{
 assert.equal(select(['2026-10-12','2026-10-11','2026-10-10','2026-10-09','2026-10-06']).days,7);
 assert.equal(select(['2026-10-12','2026-10-11','2026-10-10','2026-10-05','2026-09-28']).days,15);
 assert.equal(select(Array(5).fill(today),{types:['disclosure']}).reports.length,0);
});
test('M13: unknown dates interleaved by ID cannot disturb chronological cover selection',()=>{
 const f=fixture(['2026-10-10',null,'2026-10-12','2026-10-09','2026-10-11']);
 const s=getSourcePreviewSelection(f,{},today);assert.deepEqual(s.reports.map(r=>r.publishedAt),['2026-10-12','2026-10-11','2026-10-10','2026-10-09']);
});
test('M14: actual reviewed media batch reproduces the candidate and both real inputs replay unchanged',()=>{
 const merged=mergeBatch(prior,batch);assert.deepEqual(merged,data);
 assert.deepEqual(mergeBatch(data,batch),data);assert.deepEqual(mergeBatch(data,weekBatch),data);
});
test('M15: all 85 historical reports, four earlier batches and business dictionaries remain intact',()=>{
 assert.equal(data.reports.length,104);assert.deepEqual(data.reports.slice(0,85),prior.reports);
 assert.deepEqual(data.changeBatches.slice(0,4),prior.changeBatches);
 for(const key of Object.keys(prior).filter(k=>!['sources','reports','changeBatches'].includes(k)))assert.deepEqual(data[key],prior[key],key);
});
test('M16: real-file replay, conflicting input, invalid date and duplicate URL preserve exact bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'media-fold-')),file=join(dir,'catalog.json');
 try{
  const original=JSON.stringify(data,null,2)+'\n';await writeFile(file,original);
  for(const input of [batch,weekBatch])assert.deepEqual(await applyBatchFile(file,input),{changed:false});
  const conflict=structuredClone(batch);conflict.changeBatch.summary+=' changed';
  const invalid={reports:[{...batch.reports[0],id:'invalid-date',url:'https://example.test/date',publishedAt:'2026-02-30'}]};
  const duplicate={reports:[{...batch.reports[0],id:'duplicate-new-id'}]};
  for(const input of [conflict,invalid,duplicate]){
   await assert.rejects(applyBatchFile(file,input));assert.equal(await readFile(file,'utf8'),original);
   assert.deepEqual(await readdir(dir),['catalog.json']);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('M17: all nine real media sources retain latest qualified covers and at most five unique summaries',()=>{
 const media=sources.filter(s=>s.sourceType==='media');assert.equal(media.length,9);
 for(const source of media){
  const selected=getSourcePreviewSelection(source,{scope:'all'},today);
  assert.ok(selected.reports.length>0&&selected.reports.length<=5);assert.equal(selected.report,selected.reports[0]);
  assert.equal(new Set(selected.reports.map(r=>r.id)).size,selected.reports.length);
  assert.ok(selected.reports.every(r=>r.summary?.trim()&&r.publishedAt>= '2026-09-13'&&r.publishedAt<=today));
  assert.ok(selected.reports.slice(1).every((r,i)=>r.publishedAt<=selected.reports[i].publishedAt));
 }
});
