import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {companyGroups,companyReports,decorateSources} from '../src/catalog.js';
const ids=(filters,d=data)=>companyGroups(d,filters).flatMap(g=>g.items.map(c=>c.id));
const sources=decorateSources(data);

test('R01: SEA company rows exclude domestic-only companies while retaining evidenced SEA activity',()=>{
 const groups=companyGroups(data,{scope:'sea'});
 assert.deepEqual(groups[0].items.map(c=>c.id),['sinnet','xingyun']);
 assert.equal(groups[1].items.length,0);
 assert.ok(ids({scope:'sea'}).includes('bdx'));
 assert.ok(!ids({scope:'sea'}).includes('vnet'));
});
test('R02: overseas uses content regions rather than exchange or company research label',()=>{
 const overseas=ids({scope:'overseas'});
 assert.ok(overseas.includes('sinnet'));assert.ok(overseas.includes('intel'));
 assert.ok(!overseas.includes('vnet'));assert.ok(!ids({scope:'sea'}).includes('intel'));
});
test('R03: a specific country and an explicit company selection both constrain company rows',()=>{
 assert.ok(ids({scope:'sea',regions:['马来西亚']}).includes('tnb'));
 assert.ok(ids({scope:'sea',regions:['马来西亚']}).includes('sinnet'));
 assert.ok(!ids({scope:'sea',regions:['马来西亚']}).includes('xingyun'));
 assert.deepEqual(ids({scope:'domestic',companies:['hec']}),['hec']);
 assert.deepEqual(ids({scope:'sea',companies:['hec']}),[]);
});
test('R04: all-region overview retains the complete dictionary; article dates and types do not remove company identity',()=>{
 assert.deepEqual([...ids({scope:'all'})].sort(),data.companies.map(company=>company.id).sort());
 assert.deepEqual(ids({scope:'sea',dateWindow:'7',types:['news'],q:'nonmatching'}),ids({scope:'sea'}));
});
test('R05: broad or unknown regions cannot imply overseas; archived and reference-only evidence obey visibility',()=>{
 const d=structuredClone(data);d.events=[];
 const r=structuredClone(d.reports.find(r=>r.companyIds.includes('hec')));r.companyIds=['hec'];d.reports=[r];
 for(const regions of [['全球'],['亚太'],[]]){r.regions=regions;assert.deepEqual(ids({scope:'overseas'},d),[]);assert.deepEqual(ids({scope:'sea'},d),[]);}
 r.regions=['马来西亚'];assert.deepEqual(ids({scope:'sea'},d),['hec']);
 r.visibility='archived';assert.deepEqual(ids({scope:'sea',showReference:true},d),[]);
 r.visibility='reference';assert.deepEqual(ids({scope:'sea'},d),[]);assert.deepEqual(ids({scope:'sea',showReference:true},d),['hec']);
});
test('R06: a visible event can retain a company even without a matching article; company IDs cannot be inferred',()=>{
 const d=structuredClone(data);d.reports=[];d.events=[{...d.events[0],regions:['马来西亚'],companyIds:['hec'],visibility:'active'}];
 assert.deepEqual(ids({scope:'sea'},d),['hec']);assert.deepEqual(ids({scope:'domestic'},d),[]);
});
test('R07: regional financial candidates exclude domestic overall results and keep financial periods independent of article filters',()=>{
 const f={scope:'sea',dateWindow:'7',types:['news']};
 const regional=companyReports(data,sources,'sinnet',{scope:f.scope,regions:f.regions,showReference:f.showReference});
 assert.ok(regional.length);assert.equal(regional.filter(r=>r.financial).length,0);
 const domestic=companyReports(data,sources,'sinnet',{scope:'domestic'});
 assert.ok(domestic.some(r=>r.financial?.status==='verified'));
});
