import test from 'node:test';
import assert from 'node:assert/strict';
import before from './fixtures/industry-reviewed.mjs';
import financial from '../data-candidates/financial-peers-20261015.json' with {type:'json'};
import batch from '../data-candidates/regulation-reviewed-20261015.json' with {type:'json'};
import review from '../data-candidates/weekly-regulation-20261015.json' with {type:'json'};
import {mergeBatch} from '../scripts/reviewed-batch.mjs';
import {mergeWeeklyReview} from '../scripts/weekly-update.mjs';
import {briefReading,briefReadingMarkdown} from '../src/domain/brief-reading.js';

test('regulatory update preserves existing industry material and stores prior rules separately',()=>{
  const baseline=mergeBatch(before,financial), imported=mergeBatch(baseline,batch), updated=mergeWeeklyReview(imported,review);
  assert.deepEqual(mergeBatch(updated,batch),updated);
  assert.deepEqual(mergeWeeklyReview(updated,review),updated);
  for(const key of ['reports','companies','events'])assert.deepEqual(imported[key].slice(0,baseline[key].length),baseline[key]);
  assert.deepEqual(updated.discovery.issues.slice(0,-1),baseline.discovery.issues);
  const issue=updated.discovery.issues.at(-1), previous=baseline.discovery.issues.filter(x=>x.kind==='weekly').at(-1);
  assert.ok(previous.reportIds.every(id=>issue.reportIds.includes(id)));
  assert.equal(issue.periodStart,'2026-10-05');assert.equal(issue.periodEnd,'2026-10-11');
  for(const ref of issue.references){
    assert.ok(ref.url.startsWith('https://'));
    if(ref.context==='background')assert.ok(ref.publishedAt<issue.periodStart);
    else assert.ok(ref.publishedAt>=issue.periodStart && ref.publishedAt<=issue.periodEnd);
  }
  const md=briefReadingMarkdown(briefReading(issue,updated));
  assert.match(md,/7月16日生效/);assert.match(md,/拟同意/);assert.match(md,/若四名现任董事/);
  assert.match(md,/现行条款背景｜新加坡/);assert.match(md,/交易所处罚案例/);
  assert.doesNotMatch(md,/管理层关注重点|未补齐建议篇幅|零条不代表/);
});
