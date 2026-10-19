import { isVerifiedMilestone } from './catalog.js';
import { latestFinancial } from './financial.js';

export const dashboardTypes = { project: '项目建设', contract: '客户合作', acquisition: '投资并购', technology: '技术升级', capital: '融资与资产', risk: '监管事项' };

export function companyRange(value = '2026', today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })) {
  if (value === '2026-h1') return { start: '2026-01-01', end: today < '2026-06-30' ? today : '2026-06-30' };
  const start = new Date(`${today}T00:00:00Z`);
  if (['30', '90'].includes(value)) start.setUTCDate(start.getUTCDate() - Number(value) + 1);
  return { start: ['30', '90'].includes(value) ? start.toISOString().slice(0, 10) : '2026-01-01', end: today };
}

export function companyDashboardActions(data, companyId, range, type = '') {
  return (data.events || []).filter(event => event.visibility === 'active' && event.companyIds.includes(companyId) && (!type || event.type === type)).flatMap(event => {
    // Dates come from evidence. Disclosure-only actions explicitly say 披露 in their titles.
    const nodes = event.milestones.filter(node => node.occurredAt && node.occurredAt >= range.start && node.occurredAt <= range.end && isVerifiedMilestone(node, data.reports))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
    const latest = nodes.at(-1);
    if (!latest) return [];
    const report = data.reports.find(report => report.id === latest.primaryEvidenceReportId);
    return [{ id: event.id, type: event.type, priority: event.priority, date: latest.occurredAt, title: latest.title, summary: latest.summary,
      url: report.originalUrl || report.url, publisher: report.originalPublisher || data.sources.find(source => source.id === report.sourceId)?.organization,
      nodes: nodes.map(node => ({ ...node, report: data.reports.find(report => report.id === node.primaryEvidenceReportId) })) }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function companyHighlights(actions, limit = 8) {
  return [...actions].sort((a, b) => b.priority - a.priority || b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, limit).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function companyFinancialAt(data, companyId, date) {
  return latestFinancial({ reports: data.reports.filter(report => report.publishedAt && report.publishedAt <= date && (!report.financial || report.financial.period.end <= date)) }, companyId).report;
}
