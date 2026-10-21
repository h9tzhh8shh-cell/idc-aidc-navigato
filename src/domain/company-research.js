import { isVerifiedMilestone, reviewResultLabels } from './catalog.js';

export function companyRegistry(data) {
  return data.companies || [];
}

export function trackedCompanies(data) {
  return ['sinnet', 'xingyun', 'vnet', 'sharetronic', 'gds', 'hec', 'aofei', 'athub', 'hongjing', 'range']
    .map(id => companyRegistry(data).find(company => company.id === id)).filter(Boolean);
}

export function companySearchTerms(company) {
  return [...new Set([
    company.name, company.legalName, ...(company.aliases || []),
    ...(company.securities || []).flatMap(security => typeof security === 'string'
      ? [security] : [security.code, `${security.exchange}:${security.code}`]),
  ].filter(Boolean))];
}

export function companyMatchesQuery(company, query = '') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const names = companySearchTerms(company).map(name => name.toLocaleLowerCase());
  return terms.every(term => names.some(name => /^[a-z0-9.:_-]+$/i.test(term)
    ? name === term || name.split(/\s+/u).includes(term) : name.includes(term)));
}

export function companyCoverage({ company, reports = [], events = [], filters = {}, allReports = reports }) {
  // Identity links come only from reviewed companyIds, never a similar title or name.
  const linkedReports = reports.filter(report => report.companyIds?.includes(company.id));
  const linkedEvents = events.filter(event => event.companyIds?.includes(company.id));
  const verifiedEvents = linkedEvents.filter(event => event.milestones?.some(node =>
    node.id === event.latestVerifiedMilestoneId && isVerifiedMilestone(node, allReports)));
  const reportDates = linkedReports.map(report => report.publishedAt).filter(Boolean).sort();
  const verifiedDates = linkedReports.map(report => report.verifiedAt).filter(Boolean).sort();
  const reviewed = company.disclosureReview;
  const eventReviews = linkedEvents.map(event => event.review?.lastAttemptAt).filter(Boolean).sort();
  const hasArticles = linkedReports.some(report => !report.financial);
  const state = verifiedEvents.length ? 'verified' : linkedEvents.length ? 'pending'
    : linkedReports.length ? 'unorganized' : 'empty';
  const status = {
    verified: `已有核实事项 ${verifiedEvents.length} 项`,
    pending: '事项已整理，尚待核实',
    unorganized: hasArticles ? '已有报道，事项尚未整理' : '已有财务资料，事项尚未整理',
    empty: '当前范围暂无相关资料',
  }[state];
  const scope = { domestic: '国内（中国内地及香港）', sea: '东南亚六国', overseas: '其他海外', all: '全部地区' }[filters.scope || 'all'];
  return {
    state, status, reportCount: linkedReports.length,
    financialCount: linkedReports.filter(report => report.financial).length,
    verifiedEventCount: verifiedEvents.length,
    scope: filters.regions?.length ? `${scope} · ${filters.regions.join('、')}` : scope,
    firstPublishedAt: reportDates[0] || null, lastPublishedAt: reportDates.at(-1) || null,
    lastVerifiedAt: verifiedDates.at(-1) || null,
    lastEventReviewAt: eventReviews.at(-1) || null,
    disclosureReview: reviewed?.lastAttemptAt ? {
      date: reviewed.lastAttemptAt,
      status: reviewResultLabels[reviewed.result] || '已记录核查',
      channels: [...new Set((reviewed.checks || []).map(check => check.channel).filter(Boolean))],
    } : null,
  };
}
