import { useEffect, useRef } from 'react';
import { IconStarFilled, IconBuildingSkyscraper, IconNews, IconCalendar, IconChartBar, IconChevronRight, IconX } from '@tabler/icons-react';
import { OutLink, Highlight, trapDialogFocus } from './components.jsx';
import { TOPICS, filterReports } from './catalog.js';
import { latestFinancial } from './domain/financial.js';
import { FinancialAmounts } from './financial-components.jsx';
import { availableIssues, discoveryBatch, recentDiscoveries, industryDiscoveryReports, generateIssue, saveIssue, validateDiscovery } from './domain/discovery.js';
import { WEEKLY_FORMAT } from './domain/weekly.js';
import { BriefReader } from './brief-reader.jsx';
import { DateControls } from './update-components.jsx';
import './discovery.css';

const storageKey = 'navigator-local-briefs-v1';
export function readSavedIssues(data) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) return data.discovery?.issues || [];
    return saved.filter(issue => {
      try {
        if (issue.format === WEEKLY_FORMAT) return validateDiscovery({ ...data, discovery: { ...data.discovery, issues: [issue] } }).length === 0;
        const snapshot = { ...data, reports: data.reports.filter(report => issue.reportIds.includes(report.id)) }; const expected = generateIssue(snapshot, { kind: issue.kind, date: issue.requestedDate || issue.date, batchId: issue.batchId, generatedAt: issue.generatedAt, weekPolicy: issue.weekPolicy || 'containing', weeklyFormat: 'legacy' }); return ['id', 'periodStart', 'periodEnd', 'partial', 'cutoffAt'].every(key => expected[key] === issue[key]) && issue.reportIds.length > 0 && new Set(issue.reportIds).size === issue.reportIds.length && issue.reportIds.every(id => expected.reportIds.includes(id)); }
      catch { return false; }
    }).reduce(saveIssue, data.discovery?.issues || []);
  } catch { return data.discovery?.issues || []; }
}
export function DiscoveryBar({ data, mode, issues, onOpen }) {
  const batch = discoveryBatch(data);
  if (!batch) return null;
  const recent = recentDiscoveries(data);
  const latest = kind => availableIssues(issues, kind)[0];
  return <section className="discovery-strip" aria-label="近期发现">
    <div className="discovery-intro"><IconStarFilled size={30} /><div><h2>近期发现 <span>{batch.cutoffAt.slice(0, 10)}</span></h2><p>近21天收录，新增内容置顶</p></div></div>
    {[
      { id: 'companies', label: '新企业', value: recent.companies.length, icon: IconBuildingSkyscraper },
      { id: 'articles', label: '行业报道', value: industryDiscoveryReports(data, recent.reports).length, icon: IconNews },
      { id: 'daily', label: '每日快报', value: latest('daily') ? <>最近一期 <time>{latest('daily').date}</time><small>最近生成 {latest('daily').generatedAt.slice(0, 10)}</small></> : '尚未生成', icon: IconCalendar },
      { id: 'weekly', label: '周报', value: latest('weekly') ? <time>{latest('weekly').periodStart.slice(5)} — {latest('weekly').periodEnd.slice(5)}</time> : '尚未生成', icon: IconChartBar },
    ].map(({ id, label, value, icon: Icon }) => <button key={id} className={`discovery-entry entry-${id}`} aria-pressed={mode === id} onClick={() => onOpen(id)}><Icon size={29} /><span><strong>{label}</strong><span className="discovery-value">{value}</span></span><IconChevronRight size={19} /></button>)}
  </section>;
}
export function DiscoveryHighlights({ data, sources, filters, mode, onReport }) {
  const batch = discoveryBatch(data);
  const recent = recentDiscoveries(data).reports;
  const reports = filterReports(mode === 'articles' ? industryDiscoveryReports(data, recent) : recent, sources, filters).filter(report => batch?.highlightReportIds.includes(report.id));
  return reports.length ? <aside className="discovery-highlights" aria-label="本次重点情报"><strong>本次重点情报</strong>{reports.map(report => <button className="text-link" key={report.id} onClick={event => onReport(report, event)}>{report.title}</button>)}</aside> : null;
}
function FinancialCell({ data, company, metric }) {
  const { report } = latestFinancial(data, company.id);
  const value = report?.financial?.[metric];
  return <div className="discovery-financial"><span className="mobile-column-label">{metric === 'revenue' ? '营业收入' : '净利润'}</span>{value ? <><FinancialAmounts metric={value} /><p>{report.financial.period.label.split('｜').map(line => <span key={line}>{line}</span>)}</p><small>{value.label} · {value.attribution}</small><small>披露 {report.publishedAt}</small><OutLink href={report.financial.evidence.url} className="text-link">财报原文</OutLink></> : <strong>—</strong>}</div>;
}
function TextIdentity({ name }) { return <span className="discovery-wordmark" aria-label={`${name}文字标识`}>{name}</span>; }
export function DiscoveryWorkspace({ data, sources, filters, navigation, onNavigate, onBack, onCompany, onReport, issues, onIssues, onFilterChange }) {
  const mode = navigation.discovery;
  if (['daily', 'weekly'].includes(mode)) return <BriefReader data={data} kind={mode} navigation={navigation} onNavigate={onNavigate} issues={issues} onIssues={onIssues} onReport={onReport} onBack={onBack} />;
  const recent = recentDiscoveries(data);
  const feed = mode === 'articles' ? industryDiscoveryReports(data, recent.reports) : recent.reports;
  const matched = filterReports(feed, sources, filters);
  const matchingIds = new Set(matched.map(report => report.id));
  const reports = filters.sort === 'published' ? matched : feed.filter(report => matchingIds.has(report.id));
  const companies = recent.companies.filter(company => reports.some(report => report.companyIds.includes(company.id)));
  return <section className="discovery-workspace" id="results" tabIndex={-1}>
    <div className="discovery-heading"><div><h2>{mode === 'companies' ? '企业发现' : '行业报道'} <span>{mode === 'companies' ? companies.length : reports.length}</span></h2><p className="time-caption">近21天收录的{mode === 'companies' ? '企业及其资料' : '行业报道'} · 当前筛选在此范围内生效</p></div><div className="discovery-toolbar"><button className="button secondary" onClick={onBack}>返回原检索</button></div></div>
    <div className="discovery-search-controls"><DateControls filters={filters} onChange={onFilterChange} />{mode === 'articles' && <label className="sort-control">文章排序<select aria-label="行业报道排序" value={filters.sort === 'published' ? 'published' : 'relevance'} onChange={event => onFilterChange({ sort: event.target.value })}><option value="relevance">新增收录优先</option><option value="published">按原文发布时间从新到旧</option></select></label>}</div>
    {!(mode === 'companies' ? companies : reports).length ? <div className="discovery-empty"><p>{mode === 'articles' ? '当前报道范围暂无匹配资料，可切换“具体资料”搜索全部已收录文章。' : '当前条件暂无企业结果，可调整筛选或返回原检索。'}</p></div> : mode === 'companies' ? <div className="discovery-company-list">
      <div className="discovery-table-head company-grid"><span>企业名称与业务身份</span><span>营业收入</span><span>净利润</span><span>重大动作与简要概括</span><span>操作</span></div>
      {companies.map(company => <article className="discovery-company-row company-grid" key={company.id} data-company-id={company.id}>
        <div className="discovery-identity"><TextIdentity name={company.discoveryProfile.wordmark || company.name} /><div><h3>{company.name} {company.isNew && <span className="discovery-new" aria-label="本次新增">NEW</span>}</h3><span className="discovery-tag">参考企业</span><p>{company.discoveryProfile.businessIdentity}</p></div></div>
        <FinancialCell data={data} company={company} metric="revenue" /><FinancialCell data={data} company={company} metric="profit" />
        <div className="discovery-actions-copy">{reports.filter(report => report.companyIds.includes(company.id)).slice(0, 3).map(report => <div key={report.id}><button className="discovery-title" onClick={event => onReport(report, event)}>{report.title}</button><p className="discovery-date">原文 {report.publishedAt}</p><p>{report.summary}</p></div>)}</div>
        <div className="discovery-row-actions"><OutLink href={company.discoveryProfile.website} className="button secondary">访问官网</OutLink><button className="button primary" onClick={event => onCompany(company.id, event)}>查看详情</button></div>
      </article>)}
    </div> : <div className="discovery-article-list"><div className="discovery-table-head article-grid"><span>媒体来源</span><span>报道内容</span><span>地区与研究方向</span><span>操作</span></div>{reports.map(report => {
      const source = data.sources.find(item => item.id === report.sourceId);
      return <article className="discovery-article-row article-grid" key={report.id} data-report-id={report.id}>
        <div className="discovery-identity"><TextIdentity name={source.shortName || source.organization} /><div><h3>{source.organization}</h3><span className="discovery-tag">{source.mediaType || (source.tags.includes('财经媒体') ? '财经媒体' : '行业媒体')}</span><p>开放发现媒体</p></div></div>
        <div className="discovery-article-copy"><div className="discovery-title-line">{report.isNew && <span className="discovery-new" aria-label="本次新增">NEW</span>}<button className="discovery-title" onClick={event => onReport(report, event)}><Highlight text={report.title} query={filters.q} /></button></div><p className="discovery-date">{report.publishedAt} · {report.originalPublisher}</p><p>{report.summary}</p>{report.sourceNature && <span className="discovery-stage">{report.sourceNature}</span>}</div>
        <div className="discovery-tags">{report.regions.map(region => <span className="discovery-tag" key={region}>{region}</span>)}<span className="discovery-tag">{TOPICS.find(topic => topic.id === report.primaryCategoryId)?.label}</span></div>
        <div className="discovery-row-actions"><OutLink href={report.url} className="button secondary">访问原文</OutLink><button className="button primary" onClick={event => onReport(report, event)}>查看详情</button></div>
      </article>;
    })}</div>}
  </section>;
}
export function DiscoveryReportDetail({ report, data, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const source = data.sources.find(item => item.id === report.sourceId);
  return <dialog ref={dialog} className="discovery-detail" onKeyDown={trapDialogFocus} onCancel={onClose} aria-labelledby="discovery-detail-title"><div className="discovery-detail-top"><h2 id="discovery-detail-title">报道详情</h2><button className="icon-button" aria-label="关闭报道详情" onClick={onClose}><IconX size={22} /></button></div><div className="discovery-detail-body"><h3>{report.title}</h3>{report.originalTitle && report.originalTitle !== report.title && <p>{report.originalTitle}</p>}<p>{report.summary}</p><dl><dt>发布来源</dt><dd>{report.originalPublisher || source?.organization}</dd><dt>发布日期</dt><dd>{report.publishedAt}</dd>{report.companyIds.length > 0 && <><dt>关联企业</dt><dd>{report.companyIds.map(id => data.companies.find(company => company.id === id)?.name).join('、')}</dd></>}</dl><OutLink href={report.url} className="button primary">访问原文</OutLink></div></dialog>;
}
