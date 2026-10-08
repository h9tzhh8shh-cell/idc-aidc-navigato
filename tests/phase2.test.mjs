import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type: 'json' };
import { validateCatalog } from '../src/domain/catalog.js';
import { decorateSources, filterSources, filterReports, normalizeFilters, subcategoryNotice, subcategoryCounts, readQuery, writeQuery, companyGroups, companyReports, companyEvents, eventTimeline } from '../src/catalog.js';
const sources = decorateSources(data);
const clone = () => structuredClone(data);
const ids = records => records.map(record => record.id);
test('B01/B02: compatible schema 2, 13 unique children, no company-name subcategory', () => {
  assert.equal(data.schemaVersion,2);
  assert.equal(data.subcategories.length,13);
  assert.equal(new Set(ids(data.subcategories)).size,13);
  assert.deepEqual(['industry','rental-prices','policy-planning','regulation'].map(id=>data.subcategories.filter(s=>s.parentCategoryId===id).length),[4,3,3,3]);
  assert.deepEqual(validateCatalog(data),[]);
});
test('B02: reject foreign parent, unknown subcategory, duplicate child and bad source coverage', () => {
  for (const mutate of [
    d=>{d.reports[0].primarySubcategoryId='power-resources';},
    d=>{d.reports[0].primarySubcategoryId='not-real';},
    d=>{d.subcategories.push({...d.subcategories[0]});},
    d=>{d.sources[0].subcategoryIds=['power-resources'];},
  ]) { const d=clone();mutate(d);assert.ok(validateCatalog(d).length); }
  const d=clone();d.reports[0].primarySubcategoryId=null;assert.deepEqual(validateCatalog(d),[]);
});
test('B03/B04/B27: single child, multiple parent clearing, visible notice and old mapping', () => {
  const filters={topics:['industry'],subcategory:'power-resources',regions:['马来西亚']};
  assert.equal(normalizeFilters(filters).subcategory,'power-resources');
  const multi={...filters,topics:['industry','regulation']};
  assert.equal(normalizeFilters(multi).subcategory,null);
  assert.match(subcategoryNotice(multi),/已清除/);
  assert.deepEqual(normalizeFilters(multi).regions,['马来西亚']);
  for(const q of ['?subcategory=power-resources','?topics=regulation&subcategory=power-resources','?topics=industry&subcategory=bad']) {
    assert.equal(readQuery(q).filters.subcategory,null);assert.match(readQuery(q).notice,/已清除/);
  }
  assert.deepEqual(readQuery('?topics=policy').filters.topics,['policy-planning','regulation']);
});
test('B05/B06: child counts keep other filters; zero selection remains recoverable', () => {
  const f={topics:['industry'],subcategory:'power-resources',scope:'sea',regions:['马来西亚']};
  const counts=subcategoryCounts(data,sources,f,true);
  assert.equal(counts['power-resources'],filterReports(data.reports,sources,f).length);
  assert.equal(subcategoryCounts(data,sources,{...f,q:'no-fixture-match-ever'},true)['power-resources'],0);
  assert.equal(normalizeFilters({...f,q:'no-fixture-match-ever'}).subcategory,'power-resources');
  assert.equal(normalizeFilters({...f,subcategory:null}).scope,'sea');
});
test('B07/B08: never stitch different articles; source-only coverage cannot satisfy document kind', () => {
  const source={...data.sources[0],id:'fixture-source',categoryIds:['industry'],subcategoryIds:['power-resources'],regions:['中国'],companyIds:[]};
  const base={...data.reports.find(r=>r.visibility==='active'),sourceId:source.id,primaryCategoryId:'industry',visibility:'active'};
  const reports=[{...base,id:'fixture-cn',primarySubcategoryId:'power-resources',regions:['中国'],companyIds:['hec'],kind:'news'},
    {...base,id:'fixture-my',primarySubcategoryId:'project-delivery',regions:['马来西亚'],companyIds:['vnet'],kind:'disclosure'}];
  const ss=decorateSources({sources:[source],reports,companies:data.companies});
  const f={topics:['industry'],subcategory:'power-resources',regions:['马来西亚'],companies:['vnet']};
  assert.equal(filterReports(reports,ss,f).length,0);assert.equal(filterSources(ss,f).length,0);
  const empty=decorateSources({sources:[source],reports:[],companies:data.companies});
  assert.equal(filterSources(empty,{topics:['industry'],subcategory:'power-resources'}).length,1);
  assert.equal(filterSources(empty,{topics:['industry'],subcategory:'power-resources',types:['news']}).length,0);
});
test('B09/B10: stable company groups and explicit cross-topic panorama', () => {
  const groups=companyGroups(data);
  assert.deepEqual(ids(groups[0].items),['sinnet','xingyun','vnet','sharetronic','gds','hec']);
  assert.equal(groups[1].items.length,3);assert.equal(groups[2].items.length,7);
  assert.equal(new Set(groups.flatMap(g=>ids(g.items))).size,16);
  const normal=filterReports(data.reports,sources,{topics:['listed-companies'],companies:['hec']});
  assert.ok(normal.every(r=>r.primaryCategoryId==='listed-companies'));
  assert.ok(companyReports(data,sources,'hec',{topics:['listed-companies']}).some(r=>r.primaryCategoryId==='industry'));
});
test('B12/B20: linked companies share one event and article filters never alter its current state', () => {
  const d=clone(),e=d.events.find(e=>e.id==='vnet-strategic-investment-2026');
  e.companyIds.push('hec');e.participants.push({companyId:'hec',role:'仅测试夹具参与方'});
  const a=companyEvents(d,'vnet',{scope:'all'}).find(x=>x.id===e.id);
  const b=companyEvents(d,'hec',{scope:'all',types:['news'],access:['paid'],q:'old',frequency:['annual']}).find(x=>x.id===e.id);
  assert.equal(a,b);assert.equal(a.currentSummary,b.currentSummary);
  assert.equal(new Set([a,b].map(x=>x.id)).size,1);
});
test('B18/B19: timeline uses original disclosure dates, not maintenance or success dates', () => {
  const d=clone(),e=d.events.find(e=>e.id==='vnet-strategic-investment-2026');
  const old={...d.reports.find(r=>r.id==='vnet-strategic-investment-close-20260921'),id:'fixture-old',publishedAt:'2025-01-01',verifiedAt:'2026-10-08'};
  d.reports.push(old);e.milestones.push({...e.milestones[0],id:'old-added-today',primaryEvidenceReportId:old.id,evidenceRefs:[{reportId:old.id,locator:'test',role:'history'}]});
  assert.notEqual(eventTimeline(e,d)[0].id,'old-added-today');
});
test('B26: unknown references, self-links, invalid basis and weak latest evidence are rejected', () => {
  for(const mutate of [
    e=>{e.companyIds=['unknown'];},e=>{e.relatedEventIds=[e.id];},e=>{e.relatedEventIds=['missing'];},
    e=>{e.milestones[0].primaryEvidenceReportId='missing';},e=>{e.milestones[0].evidenceRefs[0].reportId='missing';},
    e=>{e.latestVerifiedMilestoneId='missing';},e=>{e.basisMilestoneIds=['missing'];},
    e=>{e.milestones[0].verificationLevel='lead';},e=>{e.milestones[0].isProgress=false;},
    e=>{e.milestones[0].occurredAt='2099-01-01';},e=>{e.milestones.push({...e.milestones[0]});},
  ]){const d=clone();mutate(d.events[0]);assert.ok(validateCatalog(d).length);}
});
test('B21: failed channel cannot claim coverage; no-new requires a checked interval', () => {
  const d=clone(),e=d.events[0];
  const check={id:'fixture-check',channel:'fixture',url:'https://example.com',attemptedAt:'2026-10-08',result:'blocked',checkedFrom:'2026-09-01',checkedThrough:'2026-10-08',note:'fixture'};
  e.review={lastAttemptAt:'2026-10-08',result:'blocked',note:'fixture',checks:[check]};
  assert.ok(validateCatalog(d).some(x=>x.includes('受阻尝试')));
  check.checkedFrom=null;check.checkedThrough=null;assert.deepEqual(validateCatalog(d),[]);
  check.result='no-new';assert.ok(validateCatalog(d).some(x=>x.includes('限定已完成区间')));
});
test('B27: company/event links roundtrip without losing the prior filters', () => {
  const f=normalizeFilters({scope:'sea',regions:['马来西亚'],topics:['industry'],subcategory:'power-resources',q:'供电'});
  const nav={company:'hec',event:'hec-reorganization',listedMode:'sources'};
  const restored=readQuery(writeQuery(f,'reports',null,nav));
  assert.deepEqual(restored.filters,f);assert.deepEqual(restored.navigation,nav);
  assert.equal(readQuery('?company=%3Cscript%3E').navigation.company,'invalid-record');
});
