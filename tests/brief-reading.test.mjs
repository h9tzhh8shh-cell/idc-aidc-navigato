import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with { type:'json' };
import { availableIssues } from '../src/domain/discovery.js';
import { WEEKLY_SECTIONS } from '../src/domain/weekly.js';
import { briefReading, briefSummaryText, briefReadingMarkdown, mergeReadingItems } from '../src/domain/brief-reading.js';

const weekly = availableIssues(data.discovery.issues, 'weekly', '2026-10-15')[0];
const daily = availableIssues(data.discovery.issues, 'daily', '2026-10-15')[0];

test('reading summary extracts existing sentences and preserves fact, viewpoint and analysis labels', () => {
  const model = briefReading(weekly, data);
  assert.equal(model.summary.length, 3);
  assert.deepEqual(model.summary.map(group => group.label), ['发生了什么', '为什么值得关注', '下一步查什么']);
  for (const group of model.summary) for (const item of group.items) {
    const text = item.fields[0].text;
    assert.ok(weekly.sections.some(section => section.items.some(original => Object.values(original).some(value => typeof value === 'string' && value.startsWith(text)))));
    assert.ok(item.reportIds.every(id => model.references.some(ref => ref.id === id)));
  }
  assert.equal(model.summary[0].items[0].fields[0].label, '来源观点');
  assert.equal(model.summary[1].items[0].fields[0].label, '研究判断');
  assert.deepEqual(model.sections.map(section => section.id), WEEKLY_SECTIONS.map(([id]) => id));
});

test('summary copies include report period, generation time and every used original source URL', () => {
  for (const issue of [weekly, daily]) {
    const model = briefReading(issue, data), text = briefSummaryText(model);
    assert.ok(text.includes(issue.periodStart));
    assert.ok(text.includes(issue.periodEnd));
    assert.ok(text.includes(model.generatedAt));
    const used = new Set(model.summary.flatMap(group => group.items.flatMap(item => item.reportIds)));
    for (const ref of model.references.filter(ref => used.has(ref.id))) {
      assert.ok(text.includes(ref.url));
      assert.ok(text.includes(ref.publisher));
      assert.ok(text.includes(ref.publishedAt));
    }
  }
});

test('exactly repeated arguments merge their source evidence, while different views remain separate', () => {
  const a = { title:'甲', reportIds:['a'], fields:[{ key:'fact', label:'发生了什么', text:'项目已投运。' }] };
  const b = { title:'乙', reportIds:['b'], fields:[{ key:'fact', label:'发生了什么', text:'项目已投运。' }] };
  const c = { title:'丙', reportIds:['c'], fields:[{ key:'viewpoint', label:'来源观点', text:'项目已投运。' }] };
  const d = { ...a, reportIds:['d'], fields:[...a.fields, { key:'analysis', label:'研究判断', text:'留意起租进度。' }] };
  const merged = mergeReadingItems([a, b, c, d]);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged[0].reportIds, ['a', 'b']);
  assert.deepEqual(a.reportIds, ['a']);
  assert.equal(merged[1].fields[0].key, 'viewpoint');
  assert.equal(merged[2].fields.length, 2);
});

test('weekly snapshot evidence and all eight sections remain intact in reading and export', () => {
  const copy = structuredClone(data);
  copy.reports.find(report => report.id === weekly.reportIds[0]).summary = 'later modified';
  const model = briefReading(weekly, copy), markdown = briefReadingMarkdown(model);
  assert.deepEqual(model.references, weekly.references);
  for (const [index, [, label]] of WEEKLY_SECTIONS.entries()) assert.ok(markdown.includes(`## ${index + 1}. ${label}`));
  for (const section of weekly.sections) for (const item of section.items) {
    for (const field of ['fact', 'viewpoint', 'analysis', 'businessImpact', 'action']) if (item[field]) assert.ok(markdown.includes(item[field]));
  }
  for (const ref of weekly.references) {
    assert.ok(markdown.includes(ref.url));
    for (const link of ref.relatedLinks || []) assert.ok(markdown.includes(link.url));
  }
  assert.doesNotMatch(markdown, /历史周报|历史期次|管理层关注重点/);
});

test('daily follows saved research judgments and exports every selected article', () => {
  const copy = structuredClone(data);
  copy.reports.find(report => report.id === daily.reportIds[0]).intelligence.overview = 'New unsaved conclusion';
  const model = briefReading(daily, copy), markdown = briefReadingMarkdown(model);
  assert.doesNotMatch(markdown, /New unsaved conclusion/);
  for (const id of daily.reportIds) {
    const report = data.reports.find(report => report.id === id);
    assert.ok(markdown.includes(report.title));
    assert.ok(markdown.includes(report.summary));
    assert.ok(markdown.includes(report.originalUrl || report.url));
  }
  assert.ok(model.sections.some(section => section.id === 'follow-up'));
});

test('core section removes only whole fields already repeated in the top summary, retaining titles and sources', () => {
  const model = briefReading(weekly, data), core = model.sections.find(section => section.id === 'summary');
  const original = weekly.sections.find(section => section.id === 'summary');
  const excerpts = model.summary.flatMap(group => group.items.flatMap(item => item.fields));
  assert.equal(core.summaryLink, true);
  assert.equal(core.intro, original.intro);
  assert.equal(core.items.length, original.items.length);
  for (const [index, item] of core.items.entries()) {
    assert.equal(item.title, original.items[index].title);
    assert.deepEqual(item.reportIds, original.items[index].reportIds);
    assert.ok(item.fields.every(field => !excerpts.some(excerpt => excerpt.key === field.key && excerpt.text === field.text)));
    assert.ok(item.fields.some(field => field.key === 'businessImpact'));
  }
  const markdown = briefReadingMarkdown(model);
  assert.ok(markdown.includes('[核心事实与重要性见阅读摘要](#阅读摘要)'));
  assert.equal(markdown.split(original.items[0].significance).length - 1, 1);
});

test('core deduplication keeps a longer paragraph and same words with a different evidence type', () => {
  const changed = structuredClone(weekly);
  changed.sections[0].items = [{ title:'保留完整论点', reportIds:[weekly.reportIds[0]],
    fact:'项目投运。仍需跟踪客户起租。', significance:'投运改变供给。',
    analysis:'项目投运。', businessImpact:'持续跟踪回款。' }];
  const model = briefReading(changed, data), item = model.sections[0].items[0];
  assert.equal(model.summary[0].items[0].fields[0].text, '项目投运。');
  assert.ok(item.fields.some(field => field.key === 'fact' && field.text === '项目投运。仍需跟踪客户起租。'));
  assert.ok(item.fields.some(field => field.key === 'analysis' && field.text === '项目投运。'));
  assert.ok(!item.fields.some(field => field.key === 'significance'));
  assert.ok(item.fields.some(field => field.key === 'businessImpact'));
});

test('an item with all fields summarized still retains its heading and source evidence', () => {
  const changed = structuredClone(weekly);
  changed.sections[0].items = [{ title:'投运情况', reportIds:[weekly.reportIds[0]], fact:'项目已投运。', significance:'供给增加。' }];
  const model = briefReading(changed, data), item = model.sections[0].items[0];
  assert.deepEqual(item.fields, []);
  assert.equal(item.title, '投运情况');
  assert.deepEqual(item.reportIds, [weekly.reportIds[0]]);
  assert.ok(briefReadingMarkdown(model).includes('### 投运情况'));
});
