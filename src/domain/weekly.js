export const WEEKLY_FORMAT = 'strategy-v1';
export const WEEKLY_SECTIONS = [
  ['summary', '本周核心摘要'], ['environment', '政策与行业环境'],
  ['companies', '同行企业与重大项目动态'], ['operations', '算力租赁市场与经营数据'],
  ['technology', '技术进展与上下游产业链'], ['deep-dive', '本周重点事件深度分析'],
  ['strategy', '战略判断与业务启示'], ['follow-up', '下周重点跟踪事项'],
];
export const WEEKLY_FIELDS = [
  ['background', '事件背景'], ['fact', '发生了什么'], ['viewpoint', '来源观点'],
  ['significance', '为什么重要'], ['businessImpact', '业务影响（研究判断）'],
  ['analysis', '研究判断'], ['action', '建议与核实事项'],
];
export const weeklyDay = report => report.publishedAtBeijing || report.publishedAt;
export const eventKey = report => report.eventId || `${report.originalUrl || report.url}|${report.documentVersion || (report.kind === 'data-release' ? weeklyDay(report) : '')}`;
export function weeklyRegions(report) {
  const regions = report.regions || [];
  return [
    regions.some(region => ['中国', '中国香港', '香港'].includes(region)) && 'domestic',
    regions.some(region => ['东南亚', '新加坡', '马来西亚', '泰国', '印尼', '越南', '菲律宾'].includes(region)) && 'sea',
    regions.some(region => !['中国', '中国香港', '香港', '东南亚', '新加坡', '马来西亚', '泰国', '印尼', '越南', '菲律宾'].includes(region)) && 'global',
  ].filter(Boolean);
}
export function validateWeeklyReview(review, candidates, { complete = false } = {}) {
  const errors = [], selected = new Set(review.reportIds || []), candidateIds = new Set(candidates.map(report => report.id));
  if (!selected.size || selected.size !== review.reportIds?.length || [...selected].some(id => !candidateIds.has(id))) errors.push('周报资料引用不属于本周合格候选');
  if (!Array.isArray(review.sections) || review.sections.length !== WEEKLY_SECTIONS.length) return [...errors, '周报须保留八个固定板块'];
  const used = new Set();
  WEEKLY_SECTIONS.forEach(([id], index) => {
    const section = review.sections[index];
    if (section?.id !== id || !Array.isArray(section.items)) { errors.push('周报板块顺序或结构无效'); return; }
    if (!section.items.length && !section.emptyText?.trim()) errors.push(`${id} 缺少无新增信息说明`);
    const range = { summary: [3, 5], 'deep-dive': [1, 3], 'follow-up': [3, 5] }[id];
    if (range && section.items.length && (section.items.length > range[1] || (section.items.length < range[0] && !section.shortfallReason?.trim()))) errors.push(`${id} 条数不符合约定，资料不足时须记录取舍原因`);
    for (const item of section.items) {
      if (!item.title?.trim() || !Array.isArray(item.reportIds) || !item.reportIds.length || item.reportIds.some(rid => !selected.has(rid))) errors.push(`${id} 缺少标题或有效来源`);
      for (const rid of item.reportIds || []) used.add(rid);
      if (['summary', 'environment', 'companies', 'operations', 'technology', 'deep-dive'].includes(id) &&
        (!(item.fact?.trim() || item.viewpoint?.trim()) || !item.significance?.trim() || !item.businessImpact?.trim())) errors.push(`${id} 缺少事件、意义或业务影响`);
      if (id === 'deep-dive' && (!item.background?.trim() || !item.analysis?.trim())) errors.push('深度分析缺少背景或趋势判断');
      if (['strategy', 'follow-up'].includes(id) && (!item.analysis?.trim() || !item.action?.trim())) errors.push(`${id} 缺少依据或具体跟踪建议`);
    }
  });
  if ([...selected].some(id => !used.has(id))) errors.push('入选资料未用于周报正文');
  const chosen = candidates.filter(report => selected.has(report.id));
  if (new Set(chosen.map(eventKey)).size !== chosen.length) errors.push('周报存在同一事件的重复资料');
  if (complete) {
    const decisions = review.decisions || [];
    if (decisions.length !== candidates.length || new Set(decisions.map(item => item.reportId)).size !== candidates.length ||
      decisions.some(item => !candidateIds.has(item.reportId) || !item.reason?.trim() || item.selected !== selected.has(item.reportId))) errors.push('须逐项记录本周全部候选的取舍理由');
    for (const region of ['domestic', 'sea', 'global']) {
      if (candidates.some(report => weeklyRegions(report).includes(region)) && !chosen.some(report => weeklyRegions(report).includes(region)) && !review.coverageNotes?.[region]?.trim()) errors.push(`周报遗漏地区 ${region}，须复核选稿或记录原因`);
    }
  }
  return errors;
}
export function weeklyReferences(issue, data) {
  return issue.reportIds.map(id => {
    const report = data.reports.find(item => item.id === id);
    return { id, title: report.title, publisher: report.originalPublisher, publishedAt: weeklyDay(report),
      url: report.originalUrl || report.url, relatedLinks: report.relatedLinks || [] };
  });
}
export function weeklyMarkdown(issue, title) {
  const lines = [`# ${title}`, '', `统计周期：${issue.periodStart} 00:00 — ${issue.periodEnd} 23:59（北京时间）`, '',
    `生成时间：${issue.generatedAt.replace('T', ' ')} · ${issue.reportIds.length} 项来源资料`, ''];
  issue.sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${WEEKLY_SECTIONS[index][1]}`, '');
    if (section.intro) lines.push(section.intro, '');
    if (!section.items.length) lines.push(section.emptyText, '');
    section.items.forEach(item => {
      lines.push(`### ${item.title}`, '');
      for (const [key, label] of WEEKLY_FIELDS) if (item[key]) lines.push(`**${label}：**${item[key]}`, '');
      lines.push(item.reportIds.map(id => { const ref = issue.references.find(ref => ref.id === id); return `[${ref.publisher}｜${ref.publishedAt}](${ref.url})`; }).join('；'), '');
    });
  });
  lines.push('### 本周重要信息来源', '');
  for (const ref of issue.references) {
    lines.push(`- ${ref.publishedAt}｜${ref.publisher}｜[${ref.title}](${ref.url})`);
    for (const link of ref.relatedLinks) lines.push(`  - ${link.publishedAt || ''} ${link.publisher}｜[${link.role}](${link.url})`);
  }
  return lines.join('\n') + '\n';
}
