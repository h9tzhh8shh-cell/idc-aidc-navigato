import { issueTitle } from './discovery.js';
import { WEEKLY_FORMAT, WEEKLY_SECTIONS, WEEKLY_FIELDS } from './weekly.js';

const normalized = value => String(value || '').trim().replace(/\s+/g, ' ');
const firstSentence = value => normalized(value).match(/^.*?[。！？](?:[”」])?|^.+$/)?.[0] || '';
const unique = values => [...new Set(values)];

// Only identical arguments are combined; different evidence types or analyses stay separate.
export function mergeReadingItems(items) {
  const result = [], seen = new Map();
  for (const item of items) {
    const key = JSON.stringify(item.fields.map(field => [field.key, normalized(field.text)]));
    const previous = key !== '[]' && seen.get(key);
    if (previous) previous.reportIds = unique([...previous.reportIds, ...item.reportIds]);
    else { const next = { ...item, reportIds: [...item.reportIds] }; result.push(next); if (key !== '[]') seen.set(key, next); }
  }
  return result;
}
function summaryItems(items, keys, label, limit = 3) {
  const summaries = items.flatMap(item => {
    const field = keys.map(key => item.fields.find(field => field.key === key)).find(Boolean);
    return field ? [{ title: item.title, fields: [{ key: field.key, label: label || (field.key === 'fact' ? '事实' : field.label), text: firstSentence(field.text) }], reportIds: item.reportIds }] : [];
  });
  return mergeReadingItems(summaries).slice(0, limit);
}
export function briefReading(issue, data) {
  const reports = issue.reportIds.map(id => data.reports.find(report => report.id === id)).filter(Boolean);
  const references = issue.format === WEEKLY_FORMAT ? issue.references : reports.map(report => ({
    id: report.id, title: report.title, publisher: report.originalPublisher, publishedAt: report.publishedAtBeijing || report.publishedAt,
    url: report.originalUrl || report.url, relatedLinks: report.relatedLinks || [],
  }));
  let sections;
  if (issue.format === WEEKLY_FORMAT) {
    sections = issue.sections.map(section => ({ ...section, label: WEEKLY_SECTIONS.find(([id]) => id === section.id)?.[1] || section.id,
      items: mergeReadingItems(section.items.map(item => ({ ...item, fields: WEEKLY_FIELDS.filter(([key]) => item[key]).map(([key, label]) => ({ key, label, text: item[key] })) }))),
    }));
  } else {
    const analysis = issue.analysis || reports.filter(report => report.intelligence).map(report => ({ reportId: report.id, ...report.intelligence }));
    sections = [{ id: 'news', label: issue.kind === 'daily' ? '重点新闻' : '重点变化', items: mergeReadingItems(reports.map(report => {
      const insight = analysis.find(item => item.reportId === report.id);
      return { title: report.title, reportIds: [report.id], report, fields: [
        { key: 'report-summary', label: '报道摘要', text: report.summary },
        ...(insight?.overview ? [{ key: 'analysis', label: '研究判断', text: insight.overview }] : []),
      ] };
    })) }];
    const followup = analysis.filter(item => item.followup).map(item => ({ title: reports.find(report => report.id === item.reportId)?.title || '跟踪事项',
      reportIds: [item.reportId], fields: [{ key: 'action', label: '建议与核实事项', text: item.followup }] }));
    if (followup.length) sections.push({ id: 'follow-up', label: issue.kind === 'daily' ? '下一步跟踪' : '后续关注事项', items: mergeReadingItems(followup) });
  }
  const core = sections.find(section => section.id === 'summary')?.items || sections[0]?.items || [];
  const followup = sections.find(section => section.id === 'follow-up')?.items || [];
  const coreLimit = issue.format === WEEKLY_FORMAT ? 5 : 3;
  const summary = [
    { id: 'what', label: '发生了什么', items: summaryItems(core, ['fact', 'viewpoint', 'report-summary'], null, coreLimit) },
    { id: 'why', label: '为什么值得关注', items: summaryItems(core, ['significance', 'analysis', 'businessImpact'], '研究判断', coreLimit) },
    { id: 'next', label: '下一步查什么', items: summaryItems(followup.length ? followup : core, ['action', 'businessImpact'], '跟踪建议') },
  ];
  if (issue.format === WEEKLY_FORMAT) {
    const summarizedFields = summary.flatMap(group => group.items.flatMap(item => item.fields));
    sections = sections.map(section => section.id !== 'summary' ? section : { ...section, summaryLink: true,
      items: section.items.map(item => ({ ...item, fields: item.fields.filter(field => !summarizedFields.some(excerpt => excerpt.key === field.key && excerpt.text === field.text)) })),
    });
  }
  return { title: issueTitle(issue), dateLabel: issue.kind === 'weekly'
    ? `统计周期：${issue.periodStart} 00:00 — ${issue.periodEnd} 23:59（北京时间）` : `报告日期：${issue.date}（北京时间）`,
  generatedAt: issue.generatedAt.replace('T', ' ').replace('+08:00', '（北京时间）'), summary, sections, references };
}
const sourceLine = ref => `${ref.publishedAt || '发布日期未标注'}｜${ref.publisher}｜${ref.title}\n${ref.url}`;
export function briefSummaryText(model) {
  const used = new Set(model.summary.flatMap(group => group.items.flatMap(item => item.reportIds)));
  const lines = [model.title, model.dateLabel, `生成时间：${model.generatedAt}`, ''];
  for (const group of model.summary) {
    lines.push(group.label);
    for (const item of group.items) lines.push(`- ${item.fields[0].label}：${item.fields[0].text}`);
    if (!group.items.length) lines.push('本期未整理此项。');
    lines.push('');
  }
  lines.push('摘要来源');
  for (const ref of model.references.filter(ref => used.has(ref.id))) {
    lines.push(sourceLine(ref));
    for (const link of ref.relatedLinks || []) lines.push(`${link.publishedAt || ''} ${link.publisher || ''}｜${link.role || ''}\n${link.url}`);
  }
  return lines.join('\n');
}
export function briefReadingMarkdown(model) {
  const refs = ids => ids.map(id => model.references.find(ref => ref.id === id)).filter(Boolean)
    .map(ref => `[${ref.publisher}｜${ref.publishedAt}](${ref.url})`).join('；');
  const lines = [`# ${model.title}`, '', model.dateLabel, '', `生成时间：${model.generatedAt}`, '', '## 阅读摘要', ''];
  for (const group of model.summary) {
    lines.push(`### ${group.label}`, '');
    for (const item of group.items) lines.push(`- **${item.fields[0].label}：**${item.fields[0].text} ${refs(item.reportIds)}`);
    if (!group.items.length) lines.push('本期未整理此项。');
    lines.push('');
  }
  for (const [index, section] of model.sections.entries()) {
    lines.push(`## ${index + 1}. ${section.label}`, '');
    if (section.summaryLink) lines.push('[核心事实与重要性见阅读摘要](#阅读摘要)', '');
    if (section.intro) lines.push(section.intro, '');
    if (!section.items.length) lines.push(section.emptyText || '本期暂无相关资料。', '');
    for (const item of section.items) {
      lines.push(`### ${item.title}`, '');
      for (const field of item.fields) lines.push(`**${field.label}：**${field.text}`, '');
      lines.push(refs(item.reportIds), '');
    }
  }
  lines.push('## 重要信息来源', '');
  for (const ref of model.references) {
    lines.push(`- ${ref.publishedAt}｜${ref.publisher}｜[${ref.title}](${ref.url})`);
    for (const link of ref.relatedLinks || []) lines.push(`  - ${link.publishedAt || ''} ${link.publisher || ''}｜[${link.role || '相关来源'}](${link.url})`);
  }
  return lines.join('\n') + '\n';
}
