import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {generateIssue} from '../src/domain/discovery.js';

test('daily brief accepts verified GPU price releases on their Beijing publication day',()=>{
 const fixture=structuredClone(data);
 const price=structuredClone(data.reports.find(r=>r.id==='ornn-daily-settlement-20261027'));
 Object.assign(price,{id:'price-fixture',publishedAt:'2026-10-28',publishedAtBeijing:'2026-10-29',dailyDateUncertain:false});
 fixture.reports=[price];
 fixture.discovery.batches=[{batchId:'price-day-fixture',cutoffAt:'2026-10-29T09:30:00+08:00'}];
 fixture.changeBatches=[{batchId:'price-day-fixture'}];
 const request={kind:'daily',date:'2026-10-29',batchId:'price-day-fixture',generatedAt:'2026-10-29T09:30:00+08:00'};
 assert.deepEqual(generateIssue(fixture,request).reportIds,['price-fixture']);
 price.dailyDateUncertain=true;
 assert.throws(()=>generateIssue(fixture,request),/暂无合格资料/);
 price.dailyDateUncertain=false;price.publishedAtBeijing='2026-10-28';
 assert.throws(()=>generateIssue(fixture,request),/暂无合格资料/);
});
