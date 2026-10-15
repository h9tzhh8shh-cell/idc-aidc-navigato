import test from 'node:test';
import assert from 'node:assert/strict';
import data from './fixtures/discovery-reviewed.mjs';
import review from '../data-candidates/weekly-strategy-20261014.json' with {type:'json'};
import {generateIssue,weeklyCandidates,availableIssues,saveIssue,validateDiscovery,issueTitle} from '../src/domain/discovery.js';
import {WEEKLY_SECTIONS,weeklyRegions,validateWeeklyReview,weeklyMarkdown} from '../src/domain/weekly.js';
import {mergeWeeklyReview} from '../scripts/weekly-update.mjs';
const range={periodStart:review.periodStart,periodEnd:review.periodEnd,cutoffDay:'2026-10-14'};
const candidates=weeklyCandidates(data,range);
const issue=availableIssues(data.discovery.issues,'weekly','2026-10-14')[0];

test('W01 weekly considers every region, research and price data without the old top-five weights',()=>{
  assert.equal(candidates.length,18);
  assert.ok(candidates.some(r=>r.kind==='data-release'));
  assert.ok(candidates.some(r=>r.kind==='report'));
  const changed=structuredClone(data);
  changed.reports.forEach((r,index)=>r.intelligence={importance:index*1000});
  assert.deepEqual(weeklyCandidates(changed,range).map(r=>r.id),candidates.map(r=>r.id));
  const selected=candidates.filter(r=>issue.reportIds.includes(r.id));
  for(const region of ['domestic','sea','global'])assert.ok(selected.some(r=>weeklyRegions(r).includes(region)));
  assert.equal(selected.length,13);
});
test('W02 weekly publication dates use Beijing dates at both week boundaries',()=>{
  const report=candidates[0];
  const d={...data,reports:[{...report,id:'sunday-utc',publishedAt:'2026-10-04',publishedAtBeijing:'2026-10-05'},
    {...report,id:'next-monday',publishedAt:'2026-10-11',publishedAtBeijing:'2026-10-12',url:'https://example.test/later',originalUrl:null}]};
  assert.deepEqual(weeklyCandidates(d,range).map(r=>r.id),['sunday-utc']);
});
test('W03 same-event reporting has one candidate and primary disclosure wins',()=>{
  const r=candidates.find(r=>r.kind==='news');
  const d={...data,reports:[{...r,eventId:'same'},{...r,id:'official',kind:'disclosure',eventId:'same',url:'https://example.test/official'}]};
  assert.deepEqual(weeklyCandidates(d,range).map(r=>r.id),['official']);
});
test('W04 reviews account for all candidates and cannot silently omit a region',()=>{
  assert.deepEqual(validateWeeklyReview(review,candidates,{complete:true}),[]);
  const d=structuredClone(review);d.decisions.pop();assert.ok(validateWeeklyReview(d,candidates,{complete:true}).length);
  const mainland={...candidates[0],id:'hk-only',regions:['中国香港'],url:'https://example.test/hk',originalUrl:null};
  const foreign=candidates.map(r=>({...r,regions:['新加坡']}));
  const augmented=[...foreign,mainland],omitted={...review,decisions:[...review.decisions,{reportId:'hk-only',selected:false,reason:'待比较'}]};
  assert.ok(validateWeeklyReview(omitted,augmented,{complete:true}).some(e=>e.includes('domestic')));
});
test('W05 all eight sections persist; empty sections state absence; missing analysis and sources fail',()=>{
  assert.deepEqual(issue.sections.map(s=>s.id),WEEKLY_SECTIONS.map(([id])=>id));
  for(const modify of [d=>d.sections.pop(),d=>d.sections[0].items[0].reportIds=['missing'],d=>delete d.sections[1].items[0].businessImpact,d=>delete d.sections[5].items[0].background,d=>delete d.sections[7].items[0].action]){
    const d=structuredClone(review);modify(d);assert.ok(validateWeeklyReview(d,candidates).length);
  }
  const empty=structuredClone(review);empty.sections[4]={id:'technology',items:[],emptyText:'本周暂无可靠新增信息。'};
  assert.deepEqual(validateWeeklyReview(empty,candidates),[]);
  delete empty.sections[4].emptyText;assert.ok(validateWeeklyReview(empty,candidates).length);
  const short=structuredClone(review);short.sections[0].items=short.sections[0].items.slice(0,2);
  assert.ok(validateWeeklyReview(short,candidates).some(e=>e.includes('条数')));
  short.sections[0].shortfallReason='本期仅选出两项独立核心变化，其余资料作为正文支撑。';
  assert.deepEqual(validateWeeklyReview(short,candidates),[]);
});
test('W06 the new format is the default, and a new version retains earlier weekly issues',()=>{
  const next=generateIssue(data,{kind:'weekly',date:'2026-10-14',generatedAt:'2026-10-14T23:59:00+08:00'});
  assert.equal(next.format,'strategy-v1');assert.notEqual(next.id,issue.id);
  const saved=saveIssue(data.discovery.issues,next);assert.equal(saved.length,data.discovery.issues.length+1);
  assert.deepEqual(saved.slice(0,-1),data.discovery.issues);assert.equal(saveIssue(saved,next),saved);
  assert.deepEqual(mergeWeeklyReview(data,review),data);
});
test('W07 saved research text and sources remain a snapshot after catalog text changes',()=>{
  const d=structuredClone(data);d.reports.find(r=>r.id===issue.reportIds[0]).summary='later changed';
  assert.equal(weeklyMarkdown(d.discovery.issues.at(-1),issueTitle(issue)),weeklyMarkdown(issue,issueTitle(issue)));
  assert.deepEqual(validateDiscovery(d),[]);
  d.discovery.issues.at(-1).periodStart='2026-10-06';assert.ok(validateDiscovery(d).length);
});
test('W08 export uses the same eight sections, evidence links, metrics and clean reading copy',()=>{
  const md=weeklyMarkdown(issue,issueTitle(issue));
  for(const [index,[,title]] of WEEKLY_SECTIONS.entries())assert.ok(md.includes(`## ${index+1}. ${title}`));
  for(const ref of issue.references)assert.ok(md.includes(ref.url));
  assert.match(md,/美元\/GPU小时/);assert.match(md,/2026年9月20日/);assert.match(md,/统计周期：2026-10-05 00:00 — 2026-10-11 23:59/);
  assert.doesNotMatch(md,/管理层关注重点|未补齐建议篇幅|零条不代表|产品发布.*性能与实际交付/);
});
test('W09 historical dates do not receive another week’s research text',()=>{
  assert.throws(()=>generateIssue(data,{kind:'weekly',date:'2026-10-05',generatedAt:review.generatedAt}),/该周尚未整理/);
  assert.throws(()=>generateIssue(data,{kind:'weekly',date:'2026-10-05',generatedAt:review.generatedAt,weeklyReview:review}),/统计周期不一致/);
});
test('W10 Sunday reuses the same complete week; the next Monday requires the next week’s material',()=>{
  const sunday=generateIssue(data,{kind:'weekly',date:'2026-10-18',generatedAt:'2026-10-18T12:00:00+08:00'});
  assert.equal(sunday.periodStart,'2026-10-05');assert.equal(sunday.periodEnd,'2026-10-11');
  assert.deepEqual(sunday.reportIds,issue.reportIds);
  assert.deepEqual(validateDiscovery({...data,discovery:{...data.discovery,issues:[sunday]}}),[]);
  assert.throws(()=>generateIssue(data,{kind:'weekly',date:'2026-10-19',generatedAt:'2026-10-19T12:00:00+08:00'}),/覆盖该完整周/);
});
test('W11 price observations on different dates survive deduplication for weekly comparisons',()=>{
  const price=candidates.find(r=>r.kind==='data-release');
  const d={...data,reports:[price,{...price,id:'next-price-date',publishedAt:'2026-10-08'}]};
  assert.equal(weeklyCandidates(d,range).length,2);
});
