// Export the same canonical reports used by the local reader.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { availableIssues, beijingTimestamp, issueTitle } from '../src/domain/discovery.js';
import { WEEKLY_FORMAT, weeklyMarkdown } from '../src/domain/weekly.js';

const output = process.argv[2];
if (!output) throw new Error('用法：node scripts/export-briefs.mjs 输出目录 [YYYY-MM-DD]');
const asOf = process.argv[3] || beijingTimestamp().slice(0, 10);
const data = JSON.parse(await readFile(new URL('../public/assets/catalog.json', import.meta.url), 'utf8'));
await mkdir(output, { recursive: true });
for (const kind of ['daily', 'weekly']) {
  const issue = availableIssues(data.discovery.issues, kind, asOf)[0];
  if (!issue) continue;
  if (issue.format === WEEKLY_FORMAT) {
    const filename = `行业周报-${issue.periodStart}至${issue.periodEnd}.md`;
    await writeFile(resolve(output, filename), weeklyMarkdown(issue, issueTitle(issue)), 'utf8');
    console.log(filename);
    continue;
  }
  const reports = issue.reportIds.map(id => data.reports.find(report => report.id === id));
  const analysis = reports.filter(report => report.intelligence).map(report => report.intelligence);
  const lines = ['# ' + issueTitle(issue), '', `${reports.length} 条动态 · 生成于 ${issue.generatedAt.replace('T', ' ').replace('+08:00', '（北京时间）')}`, ''];
  if (kind === 'weekly') lines.push('## 行业概览', '', ...analysis.slice(0, 3).flatMap(item => [item.overview, '']));
  lines.push(kind === 'daily' ? '## 重点新闻' : '## 重点变化', '');
  reports.forEach((report, i) => lines.push(`### ${i + 1}. ${report.title}`, '', report.summary, '', `${report.publishedAt} · ${report.originalPublisher} · [阅读原文](${report.url})`, ''));
  if (kind === 'weekly') lines.push('## 后续关注事项', '', ...analysis.filter(item => item.followup).slice(0, 3).map(item => '- ' + item.followup), '');
  const filename = kind === 'daily' ? `每日快报-${issue.date}.md` : `行业周报-${issue.periodStart}至${issue.periodEnd}.md`;
  await writeFile(resolve(output, filename), lines.join('\n'), 'utf8');
  console.log(filename);
}
