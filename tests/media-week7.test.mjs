import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import data from './fixtures/phase4-rc3-catalog.json' with {type:'json'};
import prior from './fixtures/phase4-rc1-catalog.json' with {type:'json'};
import batch from '../docs/batches/media-week7-20261012.json' with {type:'json'};
import logos from '../src/logos.json' with {type:'json'};
import assets from '../docs/ui-asset-sources.json' with {type:'json'};
import {decorateSources,getSourcePreview,getSourcePreviewSelection,getSourceReports,filterReports,dateRange} from '../src/catalog.js';
import {latestFinancial} from '../src/domain/financial.js';
import {applyBatchFile,mergeBatch} from '../scripts/reviewed-batch.mjs';
const today='2026-10-12', sources=decorateSources(data), hash=b=>createHash('sha256').update(b).digest('hex');
const template=data.reports.find(r=>r.id==='thepaper-gcc-aidc-20261009');
const fixture=(dates)=>({...sources.find(s=>s.id===template.sourceId),relatedReports:dates.map((publishedAt,i)=>({...template,id:'fixture-week7-'+i,publishedAt,regions:['中国']}))});

test('W01: latest seven-day material remains the cover; fewer than five widen to 30; future and unknown remain excluded',()=>{
 assert.deepEqual(dateRange('7',today),{from:'2026-10-06',through:today});
 assert.equal(getSourcePreview(fixture(['2026-10-05','2026-10-06']),{},today).publishedAt,'2026-10-06');
 assert.equal(getSourcePreview(fixture(['2026-10-12','2026-10-13',null]),{},today).publishedAt,today);
 assert.equal(getSourcePreviewSelection(fixture(['2026-10-05','2026-10-13',null]),{},today).days,30);
 assert.equal(getSourcePreview(fixture(['2026-10-13',null]),{},today),null);
});
test('W02: refreshing verification date cannot promote old news; source preview never goes beyond 30 days',()=>{
 const s=fixture(['2026-09-12']);s.relatedReports[0].verifiedAt=today;
 for(const dateWindow of ['all','30','7'])assert.equal(getSourcePreview(s,{dateWindow,asOf:today},today),null);
});
test('W03: fallback checks the current scope, topic, keyword and access, not unrelated recent stories',()=>{
 const s=fixture(['2026-10-05','2026-10-12']);s.relatedReports[0].title='国内旧闻';Object.assign(s.relatedReports[1],{title:'境外新闻',regions:['马来西亚']});
 assert.equal(getSourcePreviewSelection(s,{scope:'domestic'},today).days,30);
 assert.equal(getSourcePreview(s,{q:'国内旧闻'},today).title,'国内旧闻');
 assert.equal(getSourcePreview(s,{topics:['regulation']},today),null);
 assert.equal(getSourcePreview(s,{access:['paid']},today),null);
 assert.equal(getSourcePreview(s,{scope:'sea'},today).title,'境外新闻');
});
test('W04: CLS history remains accessible; current global story wins, while domestic fallback is explicitly 30 days',()=>{
 const s=sources.find(s=>s.id==='cls-industry'),id='cls-compute-utilization-20260913';
 assert.ok(getSourceReports(s).some(r=>r.id===id));
 assert.ok(filterReports(data.reports,sources,{dateWindow:'all'}).some(r=>r.id===id));
 assert.ok(!filterReports(data.reports,sources,{dateWindow:'7',asOf:today}).some(r=>r.id===id));
 assert.notEqual(getSourcePreview(s,{},today)?.id,id);
 const fallback=getSourcePreviewSelection(s,{scope:'domestic'},today);
 assert.equal(fallback.report.id,id);assert.equal(fallback.days,30);
});
test('W05: date roll follows publication days instead of collection time',()=>{
 const s=fixture(['2026-10-05','2026-10-06','2026-10-12']);
 assert.equal(getSourcePreview(s,{},'2026-10-11').publishedAt,'2026-10-06');
 assert.equal(getSourcePreview(fixture(['2026-10-05']),{},'2026-10-11').publishedAt,'2026-10-05');
 assert.equal(getSourcePreviewSelection(fixture(['2026-10-05']),{},'2026-10-11').days,30);
 assert.equal(getSourcePreviewSelection(fixture(['2026-10-05']),{},today).days,30);
});
test('W06: official source preview and six verified financial periods remain independent of media rule',()=>{
 const s={...fixture(['2026-04-30']),sourceType:'government'};
 assert.equal(getSourcePreview(s,{},today).publishedAt,'2026-04-30');
 for(const c of data.companies.filter(c=>c.role==='core'))assert.deepEqual(latestFinancial(data,c.id),latestFinancial(prior,c.id));
});
test('W07: week batch preserves every old report, company, event and previous batch byte-equivalent as JSON values',()=>{
 for(const r of prior.reports)assert.deepEqual(data.reports.find(x=>x.id===r.id),r);
 for(const key of ['companies','events','companyReviews','excludedProducts'])assert.deepEqual(data[key],prior[key]);
 assert.deepEqual(data.changeBatches.slice(0,-1),prior.changeBatches);
 assert.equal(data.reports.length-prior.reports.length,9);
});
test('W08: audited batch reproduces final catalog and same input replay does not alter ledger',()=>{
 assert.deepEqual(mergeBatch(prior,batch),data);assert.deepEqual(mergeBatch(data,batch),data);
 const newReports=data.reports.filter(r=>!prior.reports.some(p=>p.id===r.id));
 assert.ok(newReports.every(r=>r.publishedAt>='2026-10-06'&&r.publishedAt<=today&&r.contentScope==='full'&&r.authorship));
 assert.equal(new Set(data.reports.map(r=>r.url)).size,data.reports.length);
 assert.equal(newReports.filter(r=>r.kind==='broker-report').length,0);
});
test('W09: real file replay is byte-idempotent and conflicting batch input preserves destination with no temporary residue',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'idc-week7-')),file=path.join(dir,'catalog.json');
 await writeFile(file,JSON.stringify(prior,null,2)+'\n');assert.deepEqual(await applyBatchFile(file,batch),{changed:true});
 const before=hash(await readFile(file));assert.deepEqual(JSON.parse(await readFile(file)),data);
 assert.deepEqual(await applyBatchFile(file,batch),{changed:false});assert.equal(hash(await readFile(file)),before);
 const bad=structuredClone(batch);bad.reports[0].summary='fixture-conflicting-input';
 await assert.rejects(applyBatchFile(file,bad));assert.equal(hash(await readFile(file)),before);assert.deepEqual(await readdir(dir),['catalog.json']);
});
test('W10: all sources have local logos; five new files exactly match downloaded official assets',()=>{
 for(const s of data.sources)assert.ok(logos[s.id]&&existsSync(new URL('../public'+logos[s.id],import.meta.url)),s.id);
 for(const id of ['nbd-industry','cls-industry','jiemian-industry','thepaper-industry','36kr-industry']){
  const a=assets.sources[id];assert.equal(hash(readFileSync(new URL('../public'+logos[id],import.meta.url))),a.sha256);assert.ok(a.officialPage&&a.provenance.startsWith('Official'));
 }
});
test('W11: archived and reference visibility still apply inside seven-day window',()=>{
 const s=fixture([today]);s.relatedReports[0].visibility='reference';
 assert.equal(getSourcePreview(s,{},today),null);assert.ok(getSourcePreview(s,{showReference:true},today));
 s.visibility='archived';assert.equal(getSourcePreview(s,{showReference:true},today),null);
});
test('W12: 15-day and 30-day inclusive boundaries are exact, with no fallback beyond 30 days',()=>{
 assert.deepEqual(dateRange('15',today),{from:'2026-09-28',through:today});
 for(const date of ['2026-09-28','2026-09-27','2026-09-13']){
  const result=getSourcePreviewSelection(fixture([date]),{},today);assert.equal(result.report.publishedAt,date);assert.equal(result.days,30);assert.equal(result.reports.length,1);
 }
 assert.deepEqual(getSourcePreviewSelection(fixture(['2026-09-12']),{},today),{report:null,reports:[],days:30});
});
test('W13: five matching seven-day stories prevent widening even when older material has a later verification day',()=>{
 const s=fixture(['2026-09-28','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-09-13']);s.relatedReports[0].verifiedAt=today;
 for(const sort of ['relevance','name','verified']){
  const result=getSourcePreviewSelection(s,{sort},today);assert.equal(result.days,7);assert.equal(result.report.publishedAt,'2026-10-10');assert.equal(result.reports.length,5);assert.ok(result.reports.every(report=>report.publishedAt>='2026-10-06'));
 }
});
