import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import baseline from './fixtures/v1-baseline-catalog.json' with {type:'json'};
import input from '../data-candidates/discovery-v1-20261014.json' with {type:'json'};
import {mergeDiscoveryBatch,applyDiscoveryFile} from '../scripts/discovery-update.mjs';
import {validateCatalog} from '../src/domain/catalog.js';
import {beijingTimestamp,weekRange,qualifiedReport,discoveryBatch,discoveryBatches,discoveryReports,generateIssue,saveIssue,validateDiscovery} from '../src/domain/discovery.js';
import {readQuery,writeQuery,filterReports,decorateSources,getSourcePreviewSelection} from '../src/catalog.js';

const data=mergeDiscoveryBatch(baseline,input);
const batch=discoveryBatch(data),sources=decorateSources(data),time=input.discovery.generatedAt;
const issue=(kind,date,d=data)=>generateIssue(d,{kind,date,generatedAt:time,weekPolicy:'containing'});
test('V01 reviewed input reproduces the canonical candidate and replays unchanged',()=>{
 assert.deepEqual(mergeDiscoveryBatch(baseline,input),data);
 assert.deepEqual(mergeDiscoveryBatch(data,input),data);
 assert.deepEqual(validateCatalog(data),[]);
});
test('V02 preserves every existing company, source, report, event, financial record and batch',()=>{
 for(const key of ['companies','sources','reports','events','changeBatches'])assert.deepEqual(data[key].slice(0,baseline[key].length),baseline[key],key);
 assert.deepEqual(data.companies.filter(c=>c.role==='core'),baseline.companies.filter(c=>c.role==='core'));
 assert.equal(data.companies.filter(c=>c.role==='core').length,6);
});
test('V03 exact real-file replay and rejected conflicting batch preserve bytes and leave no pending file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'discovery-')),file=join(dir,'catalog.json'),bytes=JSON.stringify(data,null,2)+'\n';
 try {await writeFile(file,bytes);assert.deepEqual(await applyDiscoveryFile(file,input),{changed:false});
  const changed=structuredClone(input);changed.discovery.note+=' altered';await assert.rejects(applyDiscoveryFile(file,changed));
  assert.equal(await readFile(file,'utf8'),bytes);assert.deepEqual(await readdir(dir),['catalog.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('V04 true new identities are two reference companies, never the media sources or the Beijing instrument company',()=>{
 assert.deepEqual(batch.companyIds,['infinigence-ai','konst-group']);assert.equal(batch.reportIds.length,3);
 for(const id of batch.companyIds){const c=data.companies.find(c=>c.id===id);assert.equal(c.role,'reference');assert.ok(!baseline.companies.some(c=>c.id===id));assert.deepEqual(c.securities,[]);assert.match(c.discoveryProfile.financialNote,/未见|未获得/);assert.ok(!data.reports.some(r=>r.companyIds.includes(id)&&r.financial));}
 assert.match(data.companies.find(c=>c.id==='konst-group').identityNote,/300445/);
});
test('V05 global discovery counts stay stable while domestic article results narrow',()=>{
 const all=discoveryReports(data,batch);assert.equal(all.length,3);
 assert.equal(filterReports(all,sources,{scope:'domestic'}).length,1);assert.equal(batch.reportIds.length,3);
 assert.equal(filterReports(all,sources,{scope:'all',q:'does-not-exist'}).length,0);
});
test('V06 nine fixed media retain identical fold selection; open media are separate',()=>{
 assert.equal(data.discovery.fixedMediaSourceIds.length,9);const old=decorateSources(baseline);
 for(const id of data.discovery.fixedMediaSourceIds)assert.deepEqual(getSourcePreviewSelection(sources.find(s=>s.id===id),{scope:'all'},'2026-10-14'),getSourcePreviewSelection(old.find(s=>s.id===id),{scope:'all'},'2026-10-14'));
 assert.ok(discoveryReports(data,batch).every(r=>!data.discovery.fixedMediaSourceIds.includes(r.sourceId)));
});
test('V07 legacy batches expose article history but do not claim zero first-discovered companies',()=>{
 const historical=discoveryBatches(data).find(b=>b.batchId!==batch.batchId);assert.equal(historical.companyIdentityNotTracked,true);assert.ok(historical.note.includes('不能回填为零'));
});
test('V08 prior companies, media masquerading as companies and repeated report IDs are rejected',()=>{
 for(const id of ['hec','china-securities-journal']){const d=structuredClone(data);d.discovery.batches[0].companyIds.push(id);assert.ok(validateDiscovery(d).length);}
 const d=structuredClone(data);d.discovery.batches[0].reportIds.push(batch.reportIds[0]);assert.ok(validateDiscovery(d).length);
});
test('V09 a repost with another URL but the same original cannot enter as another article',()=>{
 const altered=structuredClone(input);altered.reports[1].originalUrl=altered.reports[0].url;
 assert.throws(()=>mergeDiscoveryBatch(baseline,altered),/同一原文/);
});
test('V10 future, unknown, unverified, archived, bibliography-only and duplicated material never qualifies',()=>{
 const r=data.reports.find(r=>r.id===batch.reportIds[0]);assert.equal(qualifiedReport(r,'2026-10-14'),true);
 for(const change of [{publishedAt:null},{publishedAt:'2026-10-15'},{publishedAt:'2026-02-30'},{verificationStatus:'pending'},{verifiedAt:'2026-10-15'},{visibility:'archived'},{displayRestriction:'bibliographic-link-only'},{duplicateOf:'other'}])assert.equal(qualifiedReport({...r,...change},'2026-10-14'),false);
});
test('V11 Beijing date conversion and Monday-Sunday weeks survive year boundaries',()=>{
 assert.equal(beijingTimestamp(new Date('2026-10-13T16:01:02Z')),'2026-10-14T00:01:02+08:00');
 assert.deepEqual(weekRange('2027-01-01'),{start:'2026-12-28',end:'2027-01-03'});assert.throws(()=>weekRange('2026-02-30'));
});
test('V12 current weekly report is explicitly partial; prior week is complete',()=>{
 const current=issue('weekly','2026-10-14');assert.equal(current.periodStart,'2026-10-12');assert.equal(current.periodEnd,'2026-10-14');assert.equal(current.weekEnd,'2026-10-18');assert.equal(current.partial,true);
 const previous=issue('weekly','2026-10-11');assert.equal(previous.periodStart,'2026-10-05');assert.equal(previous.periodEnd,'2026-10-11');assert.equal(previous.partial,false);
});
test('V13 daily is exact publication date and excludes ambiguous source timezone',()=>{
 const daily=issue('daily','2026-10-13');assert.equal(daily.reportIds.length,2);assert.ok(daily.reportIds.every(id=>data.reports.find(r=>r.id===id).publishedAt==='2026-10-13'));
 assert.ok(!daily.reportIds.includes('open-oregon-permit-20261013'));assert.ok(issue('weekly','2026-10-14').reportIds.includes('open-oregon-permit-20261013'));
});
test('V14 no usable current-day news means no new issue and no overwritten latest issue',()=>{
 const before=JSON.stringify(data.discovery.issues);assert.throws(()=>issue('daily','2026-10-14'),/暂无合格资料/);assert.equal(JSON.stringify(data.discovery.issues),before);
 assert.throws(()=>issue('daily','2026-10-15'),/不能晚于/);
});
test('V15 past-day generation keeps historical date, actual generated time and stable ID',()=>{
 const a=issue('daily','2026-10-08'),b=generateIssue(data,{kind:'daily',date:'2026-10-08',generatedAt:'2026-10-14T18:00:00+08:00'});
 assert.equal(a.date,'2026-10-08');assert.equal(a.generatedAt,time);assert.equal(a.id,b.id);const saved=[a];assert.equal(saveIssue(saved,b),saved);assert.equal(saved[0].generatedAt,time);
});
test('V16 duplicate event evidence produces one brief item and analysis cites canonical report IDs',()=>{
 const d=structuredClone(data),r=d.reports.find(r=>r.id==='open-cs-infini-20261013');r.eventId='same-event';d.reports.push({...r,id:'second-evidence',url:'https://example.test/evidence'});
 const result=issue('daily','2026-10-13',d);assert.equal(result.reportIds.filter(id=>['open-cs-infini-20261013','second-evidence'].includes(id)).length,1);
 assert.ok(result.analysis.every(a=>result.reportIds.includes(a.reportId)&&a.impact&&a.uncertainty&&a.followupId));
});
test('V17 issue date tampering, empty issue, orphan analysis and pre-check generation are rejected',()=>{
 for(const modify of [d=>d.discovery.issues[0].periodStart='2026-10-01',d=>d.discovery.issues[0].reportIds=[],d=>d.discovery.issues[0].analysis[0].reportId='missing',d=>d.discovery.issues[0].generatedAt='2026-10-01T10:00:00+08:00']){const d=structuredClone(data);modify(d);assert.ok(validateDiscovery(d).length);}
});
test('V18 discovery, issue, filters and return location survive URL reload; obsolete batch links open the continuous list',()=>{
 const filters={scope:'all',q:'无问',topics:['supply-demand']};
 for(const discovery of ['companies','articles','daily','weekly']){const navigation={discovery,issue:data.discovery.issues[0].id,returnQuery:'scope=domestic'};const restored=readQuery(writeQuery(filters,'sources',null,navigation));assert.deepEqual(restored.navigation,navigation);assert.equal(restored.filters.q,'无问');assert.equal(readQuery(restored.navigation.returnQuery).filters.scope,'domestic');}
 assert.deepEqual(readQuery('?discover=articles&discoveryBatch=phase3-research-20261009').navigation,{discovery:'articles'});
 assert.equal(readQuery('?discover=bad&scope=all').navigation.discovery,undefined);
});
test('V19 a known legal identity cannot be counted again under a new company ID',()=>{
 const changed=structuredClone(input);changed.companies[0].legalName=baseline.companies[0].legalName;
 assert.throws(()=>mergeDiscoveryBatch(baseline,changed),/企业已存在/);
});
test('V20 later higher-priority material does not invalidate a saved historical selection',()=>{
 const d=structuredClone(data),old=d.discovery.issues.find(i=>i.kind==='weekly'&&i.date==='2026-10-14');
 const addition=structuredClone(d.reports.find(r=>r.id===old.reportIds[0]));addition.id='later-reviewed-article';addition.url='https://example.test/later';addition.intelligence.importance=1000;d.reports.push(addition);
 assert.ok(issue('weekly','2026-10-14',d).reportIds.includes(addition.id));assert.deepEqual(validateDiscovery(d),[]);
 const snapshot={...d,reports:d.reports.filter(r=>old.reportIds.includes(r.id))};assert.deepEqual(generateIssue(snapshot,{kind:old.kind,date:old.date,batchId:old.batchId,generatedAt:old.generatedAt,weekPolicy:'containing'}),old);
});
