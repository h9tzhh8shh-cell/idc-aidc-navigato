// Local, reviewed information only. Generation never fetches or invents news.
import { WEEKLY_FORMAT, weeklyDay, eventKey, validateWeeklyReview, weeklyReferences } from './weekly.js';
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(value) && day(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const unique = values => new Set(values).size === values.length;
export function beijingTimestamp(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 19) + '+08:00';
}
export function weekRange(date) {
  if (!day(date)) throw new Error('日期无效');
  const dateMs = Date.parse(date), offset = (new Date(dateMs).getUTCDay() + 6) % 7;
  const from = dateMs - offset * 86400000;
  return { start: new Date(from).toISOString().slice(0, 10), end: new Date(from + 6 * 86400000).toISOString().slice(0, 10) };
}
export function previousCompleteWeek(date = beijingTimestamp().slice(0, 10)) {
  const monday = weekRange(date).start;
  return weekRange(new Date(Date.parse(monday) - 86400000).toISOString().slice(0, 10));
}
export function availableIssues(issues, kind, asOf = beijingTimestamp().slice(0, 10)) {
  const end = kind === 'weekly' ? previousCompleteWeek(asOf).end : asOf;
  return issues.filter(issue => issue.kind === kind && !issue.partial && issue.periodEnd <= end)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.generatedAt.localeCompare(a.generatedAt));
}
export function qualifiedReport(report, cutoffDay) {
  return Boolean(report && report.visibility === 'active' && !report.duplicateOf && report.verificationStatus === 'verified' &&
    ['full', 'partial', 'abstract'].includes(report.contentScope) && report.displayRestriction !== 'bibliographic-link-only' &&
    day(report.publishedAt) && report.publishedAt <= cutoffDay && day(report.verifiedAt) && report.verifiedAt <= cutoffDay);
}
export function discoveryEligibleReport(data, report, cutoffDay) {
  const type = data.sources.find(source => source.id === report?.sourceId)?.sourceType;
  return qualifiedReport(report, cutoffDay) && (type === 'media' && report.kind === 'news' ||
    type === 'company' && ['news', 'disclosure'].includes(report.kind));
}
export function discoveryBatch(data, id) {
  return id ? discoveryBatches(data).find(batch => batch.batchId === id) : data.discovery?.batches.at(-1);
}
export function discoveryBatches(data) {
  return (data.changeBatches || []).map(batch => data.discovery?.batches.find(item => item.batchId === batch.batchId) || {
    batchId: batch.batchId, cutoffAt: batch.recordedAt, companyIds: [], companyIdentityNotTracked: true,
    reportIds: batch.changes.filter(change => change.objectType === 'report' && change.kinds.some(kind => ['new-record','historical'].includes(kind)))
      .map(change => change.objectId).filter(id => { const report = data.reports.find(item => item.id === id); return report?.kind === 'news' && qualifiedReport(report, batch.recordedAt.slice(0, 10)) && data.sources.find(source => source.id === report.sourceId)?.sourceType === 'media'; }),
    highlightReportIds: [], note: '历史批次未记录企业首次发现快照，不能回填为零家新企业。报道从当时新收录记录及现有核查状态读取，书目导航和待核条目不纳入。',
  });
}
export function discoveryReports(data, batch) {
  return (batch?.reportIds || []).map(id => data.reports.find(report => report.id === id)).filter(report => qualifiedReport(report, batch.cutoffAt.slice(0, 10)));
}
export function recentDiscoveries(data, asOf = beijingTimestamp().slice(0, 10)) {
  const start = new Date(Date.parse(asOf) - 20 * 86400000).toISOString().slice(0, 10);
  const batches = discoveryBatches(data).filter(batch => batch.cutoffAt.slice(0, 10) <= asOf).sort((a, b) => a.cutoffAt.localeCompare(b.cutoffAt));
  const latest = batches.filter(batch => !batch.companyIdentityNotTracked).at(-1) || batches.at(-1);
  function collect(key, records) {
    const first = new Map();
    for (const batch of batches) for (const id of batch[key]) {
      if (!first.has(id)) first.set(id, { discoveredAt: batch.cutoffAt, isNew: batch.batchId === latest.batchId });
    }
    return records.filter(record => first.has(record.id) && first.get(record.id).discoveredAt.slice(0, 10) >= start)
      .map(record => ({ ...record, ...first.get(record.id) }))
      .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.discoveredAt.localeCompare(a.discoveredAt) || (b.publishedAt || '').localeCompare(a.publishedAt || '') || a.id.localeCompare(b.id));
  }
  return { companies: collect('companyIds', data.companies), reports: collect('reportIds', data.reports.filter(report => qualifiedReport(report, asOf))) };
}
export function industryDiscoveryReports(data, reports) {
  const fixedSources = new Set(data.discovery.fixedMediaSourceIds);
  return reports.filter(report => report.kind === 'news' && !fixedSources.has(report.sourceId) &&
    data.sources.find(source => source.id === report.sourceId)?.sourceType === 'media');
}
export function weeklyCandidates(data, { periodStart, periodEnd, cutoffDay }) {
  const seen = new Set();
  return data.reports.filter(report => qualifiedReport(report, cutoffDay) &&
    ['news', 'disclosure', 'policy', 'regulation', 'report', 'data-release'].includes(report.kind) &&
    weeklyDay(report) >= periodStart && weeklyDay(report) <= periodEnd)
    .sort((a, b) => Number(['disclosure', 'policy', 'regulation'].includes(b.kind)) - Number(['disclosure', 'policy', 'regulation'].includes(a.kind)) || weeklyDay(b).localeCompare(weeklyDay(a)) || a.id.localeCompare(b.id))
    .filter(report => { const key = eventKey(report); if (seen.has(key)) return false; seen.add(key); return true; });
}
function weeklyBackgroundCandidates(data, periodStart, cutoffDay) {
  return data.reports.filter(report => qualifiedReport(report, cutoffDay) &&
    ['policy', 'regulation'].includes(report.kind) && weeklyDay(report) < periodStart);
}
export function generateIssue(data, { kind, date = beijingTimestamp().slice(0, 10), batchId, generatedAt = beijingTimestamp(), weekPolicy = 'previous-complete', weeklyFormat = weekPolicy === 'containing' ? 'legacy' : WEEKLY_FORMAT, weeklyReview }) {
  const batch = discoveryBatch(data, batchId);
  if (!batch || !['daily', 'weekly'].includes(kind) || !day(date) || !timestamp(generatedAt)) throw new Error('报告类型、日期或更新批次无效');
  const cutoffDay = batch.cutoffAt.slice(0, 10);
  const strategyWeekly = kind === 'weekly' && weeklyFormat === WEEKLY_FORMAT;
  if ((!strategyWeekly && date > cutoffDay) || generatedAt < batch.cutoffAt) throw new Error('报告日期不能晚于本批资料截止日，生成时间不能早于核查');
  const week = kind === 'weekly' && weekPolicy === 'previous-complete' ? previousCompleteWeek(date) : weekRange(date);
  const periodStart = kind === 'daily' ? date : week.start;
  const periodEnd = kind === 'daily' ? date : (week.end < cutoffDay ? week.end : cutoffDay);
  if (strategyWeekly) {
    if (week.end > cutoffDay) throw new Error('资料尚未覆盖该完整周，请先更新周报资料。');
    if (date > generatedAt.slice(0, 10)) throw new Error('更新日期不能晚于生成日期');
    const candidates = weeklyCandidates(data, { periodStart, periodEnd, cutoffDay });
    const review = weeklyReview || data.discovery.issues.filter(issue => issue.format === WEEKLY_FORMAT && issue.periodStart === periodStart && issue.periodEnd === periodEnd)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
    if (!review) throw new Error('该周尚未整理研究内容，请先完成八个板块的周报整理。');
    if (review.periodStart !== periodStart || review.periodEnd !== periodEnd) throw new Error('研究内容与周报统计周期不一致');
    const errors = validateWeeklyReview(review, candidates, { complete: true,
      backgroundCandidates: weeklyBackgroundCandidates(data, periodStart, cutoffDay) });
    if (errors.length) throw new Error(errors.join('\n'));
    const issue = {
      id: `weekly-${periodStart}-${WEEKLY_FORMAT}-${generatedAt.replace(/[^0-9]/g, '')}`,
      kind, format: WEEKLY_FORMAT, date: periodEnd, batchId: batch.batchId, periodStart, periodEnd, weekEnd: week.end,
      partial: false, weekPolicy: 'previous-complete', requestedDate: date, generatedAt, cutoffAt: batch.cutoffAt,
      reportIds: [...review.reportIds], analysis: [], sections: structuredClone(review.sections),
      ...(review.backgroundReportIds?.length ? { backgroundReportIds: [...review.backgroundReportIds] } : {}),
      decisions: structuredClone(review.decisions), coverageNotes: { ...review.coverageNotes },
    };
    issue.references = weeklyReferences(issue, data);
    return issue;
  }
  const candidates = data.reports.filter(report => qualifiedReport(report, cutoffDay) &&
    ['news', 'disclosure', 'policy', 'regulation'].includes(report.kind) &&
    report.publishedAt >= periodStart && report.publishedAt <= periodEnd &&
    // An unknown source timezone must not become a supposedly exact Beijing daily date.
    (kind !== 'daily' || !report.dailyDateUncertain));
  const seen = new Set();
  const reports = candidates.sort((a, b) => (b.intelligence?.importance || 0) - (a.intelligence?.importance || 0) || b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
    .filter(report => { const key = report.eventId || report.originalUrl || report.url; if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, kind === 'daily' ? 8 : 5);
  if (!reports.length) throw new Error('该日期范围暂无合格资料，未生成空白报告；最近一期保持不变。');
  return {
    id: `${kind}-${kind === 'daily' ? date : periodStart}-${batch.batchId}`,
    kind, date: kind === 'daily' ? date : periodEnd, batchId: batch.batchId,
    periodStart, periodEnd, weekEnd: kind === 'weekly' ? week.end : null,
    partial: kind === 'weekly' && periodEnd < week.end,
    ...(kind === 'weekly' && weekPolicy === 'previous-complete' ? { weekPolicy, requestedDate: date } : {}),
    generatedAt, cutoffAt: batch.cutoffAt, reportIds: reports.map(report => report.id),
    // Keep reviewed analysis with the issue, while facts remain canonical report references.
    analysis: reports.filter(report => report.intelligence).map(report => ({ reportId: report.id, ...report.intelligence })),
  };
}
export function saveIssue(issues, issue) {
  // Replaying an identical issue ID keeps the saved version.
  return issues.some(previous => previous.id === issue.id) ? issues : [...issues, issue];
}
export function issueTitle(issue) {
  if (issue.kind === 'daily') return `${issue.date} 每日快报`;
  if (issue.format === WEEKLY_FORMAT) return `${issue.periodStart} — ${issue.periodEnd} IDC/AIDC及算力租赁行业周报`;
  return issue.partial ? `本周截至 ${issue.periodEnd} · 行业周报` : `${issue.periodStart} — ${issue.periodEnd} 行业周报`;
}
export function validateDiscovery(data) {
  const discovery = data.discovery;
  if (discovery === undefined) return [];
  const errors = [], fail = message => errors.push(`discovery: ${message}`);
  if (!discovery || !Array.isArray(discovery.batches) || !Array.isArray(discovery.issues) || !Array.isArray(discovery.baselineCompanyIds) || !Array.isArray(discovery.fixedMediaSourceIds)) return ['discovery: 结构无效'];
  const seenCompanies = new Set(discovery.baselineCompanyIds), seenBatches = new Set(), seenReports = new Set();
  if (!unique(discovery.baselineCompanyIds) || !unique(discovery.fixedMediaSourceIds)) fail('基线身份重复');
  if (discovery.fixedMediaSourceIds.length !== 9 || discovery.fixedMediaSourceIds.some(id => data.sources.find(s => s.id === id)?.sourceType !== 'media')) fail('固定九家媒体身份无效');
  for (const batch of discovery.batches) {
    if (!batch || !data.changeBatches?.some(b => b.batchId === batch.batchId) || seenBatches.has(batch.batchId)) { fail('更新批次不存在或重复'); continue; }
    seenBatches.add(batch.batchId);
    if (!timestamp(batch.cutoffAt) || batch.cutoffAt.slice(0, 10) > data.maintainedAt) { fail('资料截止时间无效'); continue; }
    if (!['companyIds', 'reportIds', 'highlightReportIds'].every(key => Array.isArray(batch[key]) && unique(batch[key]))) { fail('发现引用无效或重复'); continue; }
    for (const id of batch.companyIds) {
      const company = data.companies.find(c => c.id === id);
      // An originally discovered reference may later join the user-confirmed tracked roster.
      if (!company || !['reference', 'core'].includes(company.role) || seenCompanies.has(id)) fail(`非首次参考企业 ${id}`);
      if (!company?.discoveryProfile?.website?.startsWith('https://') || !company?.discoveryProfile?.businessIdentity || !company?.discoveryProfile?.financialNote) fail(`企业展示依据不完整 ${id}`);
      seenCompanies.add(id);
    }
    for (const id of batch.reportIds) {
      const report = data.reports.find(r => r.id === id);
      if (!discoveryEligibleReport(data, report, batch.cutoffAt.slice(0, 10))) fail(`不合格发现资料 ${id}`);
      if (seenReports.has(id)) fail(`历史报道重复计新 ${id}`);
      seenReports.add(id);
      const change = data.changeBatches.find(b => b.batchId === batch.batchId)?.changes.find(c => c.objectType === 'report' && c.objectId === id);
      if (!change || !change.kinds.some(k => ['new-record', 'historical'].includes(k))) fail(`报道不属于本批首次收录 ${id}`);
    }
    if (batch.highlightReportIds.length > 3 || batch.highlightReportIds.some(id => !batch.reportIds.includes(id))) fail('重点情报应引用本批资料，最多三条');
    if (batch.companyIds.some(id => !batch.reportIds.some(rid => data.reports.find(r => r.id === rid)?.companyIds.includes(id)))) fail('新企业缺少本批重大动作依据');
  }
  const issueIds = new Set();
  for (const issue of discovery.issues) {
    if (!issue || issueIds.has(issue.id)) { fail('报告ID重复或无效'); continue; }
    issueIds.add(issue.id);
    try {
      if (issue.format === WEEKLY_FORMAT) {
        const period = previousCompleteWeek(issue.requestedDate), batch = discoveryBatch(data, issue.batchId);
        if (issue.kind !== 'weekly' || issue.partial || issue.periodStart !== period.start || issue.periodEnd !== period.end || issue.date !== period.end || issue.weekEnd !== period.end || !timestamp(issue.generatedAt) || issue.generatedAt < batch?.cutoffAt || issue.cutoffAt !== batch?.cutoffAt || issue.periodEnd > batch?.cutoffAt.slice(0, 10) || issue.requestedDate > issue.generatedAt.slice(0, 10)) fail(`战略周报周期或时间无效 ${issue.id}`);
        const candidates = weeklyCandidates(data, { periodStart: issue.periodStart, periodEnd: issue.periodEnd, cutoffDay: issue.cutoffAt.slice(0, 10) });
        errors.push(...validateWeeklyReview(issue, candidates, { backgroundCandidates: weeklyBackgroundCandidates(data, issue.periodStart, issue.cutoffAt.slice(0, 10)) }).map(message => `discovery: ${message}`));
        const referenceIds = [...issue.reportIds, ...(issue.backgroundReportIds || [])];
        if (!Array.isArray(issue.references) || issue.references.length !== referenceIds.length || referenceIds.some(id => !issue.references.some(ref => ref.id === id && /^https:\/\//.test(ref.url) && (ref.context === 'background') === Boolean(issue.backgroundReportIds?.includes(id))))) fail(`战略周报来源快照无效 ${issue.id}`);
        continue;
      }
      // Later additions may outrank older choices; validate the saved selection, never rerank its history.
      const snapshot = { ...data, reports: data.reports.filter(report => issue.reportIds?.includes(report.id)) };
      const expected = generateIssue(snapshot, { kind: issue.kind, date: issue.requestedDate || issue.date, batchId: issue.batchId, generatedAt: issue.generatedAt, weekPolicy: issue.weekPolicy || 'containing', weeklyFormat: 'legacy' });
      for (const key of ['id', 'periodStart', 'periodEnd', 'weekEnd', 'partial', 'cutoffAt']) if (issue[key] !== expected[key]) fail(`报告日期或批次不一致 ${issue.id}.${key}`);
      if (!Array.isArray(issue.reportIds) || !issue.reportIds.length || !unique(issue.reportIds) || issue.reportIds.some(id => !expected.reportIds.includes(id))) fail(`报告引用日期或资料资格不符 ${issue.id}`);
      if (!Array.isArray(issue.analysis) || issue.analysis.some(item => !issue.reportIds?.includes(item.reportId) || !item.followupId || !item.followup)) fail(`报告跟踪事项引用无效 ${issue.id}`);
    } catch (error) { fail(`${issue.id}: ${error.message}`); }
  }
  return errors;
}
