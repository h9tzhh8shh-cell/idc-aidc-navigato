import { useEffect, useRef, useState } from 'react';
import { IconStarFilled, IconBuildingSkyscraper, IconNews, IconCalendar, IconChartBar, IconChevronRight, IconX } from '@tabler/icons-react';
import { OutLink, Highlight, trapDialogFocus } from './components.jsx';
import { TOPICS, filterReports } from './catalog.js';
import { latestFinancial, amount } from './domain/financial.js';
import { beijingTimestamp, previousCompleteWeek, availableIssues, discoveryBatch, recentDiscoveries, industryDiscoveryReports, generateIssue, saveIssue, issueTitle, validateDiscovery } from './domain/discovery.js';
import { WEEKLY_FORMAT, WEEKLY_SECTIONS, WEEKLY_FIELDS } from './domain/weekly.js';
import './discovery.css';

const storageKey = 'navigator-local-briefs-v1';
const timeText = value => value?.replace('T', ' ').replace('+08:00', '（北京时间）');
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
export function DiscoveryHighlights({ data, mode, onReport }) {
  const batch = discoveryBatch(data);
  const recent = recentDiscoveries(data).reports;
  const reports = (mode === 'articles' ? industryDiscoveryReports(data, recent) : recent).filter(report => batch?.highlightReportIds.includes(report.id));
  return reports.length ? <aside className="discovery-highlights" aria-label="本次重点情报"><strong>本次重点情报</strong>{reports.map(report => <button className="text-link" key={report.id} onClick={event => onReport(report, event)}>{report.title}</button>)}</aside> : null;
}
function FinancialCell({ data, company, metric }) {
  const { report } = latestFinancial(data, company.id);
  const value = report?.financial?.[metric];
  return <div className="discovery-financial"><span className="mobile-column-label">{metric === 'revenue' ? '营业收入' : '净利润'}</span>{value ? <><strong>{amount(value)}</strong><p>{report.financial.period.label}</p><small>{value.label} · {value.attribution}</small><OutLink href={report.financial.evidence.url} className="text-link">财务出处</OutLink></> : <strong>—</strong>}</div>;
}
function TextIdentity({ name }) { return <span className="discovery-wordmark" aria-label={`${name}文字标识`}>{name}</span>; }
export function DiscoveryWorkspace({ data, sources, filters, navigation, onNavigate, onBack, onCompany, onReport, issues, onIssues }) {
  const mode = navigation.discovery;
  if (['daily', 'weekly'].includes(mode)) return <BriefReader data={data} kind={mode} navigation={navigation} onNavigate={onNavigate} issues={issues} onIssues={onIssues} onReport={onReport} />;
  const recent = recentDiscoveries(data);
  const feed = mode === 'articles' ? industryDiscoveryReports(data, recent.reports) : recent.reports;
  const matchingIds = new Set(filterReports(feed, sources, { ...filters, dateWindow: 'all', asOf: null }).map(report => report.id));
  const reports = feed.filter(report => matchingIds.has(report.id));
  const companies = recent.companies.filter(company => reports.some(report => report.companyIds.includes(company.id)));
  return <section className="discovery-workspace" id="results" tabIndex={-1}>
    <div className="discovery-heading"><div><h2>{mode === 'companies' ? '企业发现' : '行业报道'} <span>{mode === 'companies' ? companies.length : reports.length}</span></h2></div><div className="discovery-toolbar"><button className="button secondary" onClick={onBack}>返回全部来源</button></div></div>
    {!(mode === 'companies' ? companies : reports).length ? <div className="discovery-empty"><p>当前条件暂无结果，可调整地区或查看全部来源。</p></div> : mode === 'companies' ? <div className="discovery-company-list">
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
function BriefReader({ data, kind, navigation, onNavigate, issues, onIssues, onReport }) {
  const available = availableIssues(issues, kind);
  const issue = navigation.issue ? issues.find(item => item.kind === kind && item.id === navigation.issue) : available[0];
  const cutoff = discoveryBatch(data)?.cutoffAt;
  const [date, setDate] = useState(beijingTimestamp().slice(0, 10));
  const [notice, setNotice] = useState('');
  useEffect(() => setNotice(''), [kind]);
  const week = previousCompleteWeek(date || beijingTimestamp().slice(0, 10));
  function generate() {
    try {
      const candidate = generateIssue(data, { kind, date, generatedAt: beijingTimestamp() });
      const next = saveIssue(issues, candidate), saved = next.find(item => item.id === candidate.id);
      let message = next === issues ? '已打开这期报告。' : '报告已生成。';
      try { localStorage.setItem(storageKey, JSON.stringify(next.filter(item => !data.discovery.issues.some(seed => seed.id === item.id)))); }
      catch { message = '报告已生成，浏览器保存失败。'; }
      onIssues(next); onNavigate({ issue: saved.id }); setNotice(message);
    } catch (error) { setNotice(error.message); }
  }
  const reports = (issue?.reportIds || []).map(id => data.reports.find(report => report.id === id)).filter(Boolean);
  const analysis = reports.filter(report => report.intelligence).map(report => ({ reportId: report.id, ...report.intelligence }));
  return <section className="brief-workspace" id="results" tabIndex={-1}>
    <div className="discovery-heading"><h2>{kind === 'daily' ? '每日快报' : '行业周报'}</h2></div>
    <details className="brief-generate"><summary>生成报告</summary><div><label>{kind === 'daily' ? '日报日期' : '更新日期'}<input aria-label="报告所属日期" type="date" value={date} onChange={event => setDate(event.target.value)} max={kind === 'weekly' ? beijingTimestamp().slice(0, 10) : cutoff?.slice(0, 10)} /></label><button className="button primary" onClick={generate}>从已收录资料生成</button></div>{kind === 'weekly' && <p className="brief-period">周报范围：{week.start} — {week.end}</p>}</details>
    {notice && <p className="brief-notice" role="status">{notice}</p>}
    {!issue ? <p className="discovery-empty">暂无报告，可生成新一期。</p> : <article className="brief-paper">
      <header><h2>{issueTitle(issue)}</h2>{kind === 'weekly' && <p>统计周期：{issue.periodStart} 00:00 — {issue.periodEnd} 23:59（北京时间）</p>}<p>{reports.length} {issue.format === WEEKLY_FORMAT ? '项来源资料' : '条动态'} · 生成于 {timeText(issue.generatedAt)}</p></header>
      {issue.format === WEEKLY_FORMAT ? <WeeklyContent issue={issue} /> : <>
      {kind === 'weekly' && analysis.length > 0 && <section><h3>行业概览</h3>{analysis.slice(0, 3).map(item => <p key={item.reportId}>{item.overview || data.reports.find(report => report.id === item.reportId)?.summary}</p>)}</section>}
      <section><h3>{kind === 'daily' ? '重点新闻' : '重点变化'}</h3>{reports.map((report, index) => <div className="brief-news" key={report.id}><h4>{index + 1}. {report.title}</h4><p>{report.summary}</p><p className="discovery-date">{report.publishedAt} · {report.originalPublisher}</p><div className="brief-links"><OutLink href={report.url} className="text-link">阅读原文</OutLink><button className="text-link" onClick={event => onReport(report, event)}>查看详情</button></div></div>)}</section>
      {kind === 'weekly' && analysis.some(item => item.followup) && <section><h3>后续关注事项</h3>{analysis.filter(item => item.followup).slice(0, 3).map(item => <p key={item.followupId} data-followup-id={item.followupId}>{item.followup}</p>)}</section>}
      </>}
    </article>}
  </section>;
}
function WeeklyContent({ issue }) {
  return <div className="weekly-research">{issue.sections.map((section, index) => <section key={section.id} data-weekly-section={section.id}>
    <h3>{index + 1}. {WEEKLY_SECTIONS[index][1]}</h3>
    {section.intro && <p>{section.intro}</p>}
    {!section.items.length && <p>{section.emptyText}</p>}
    {section.items.map((item, itemIndex) => <div className="brief-news" key={itemIndex}>
      <h4>{item.title}</h4>
      {WEEKLY_FIELDS.map(([key, label]) => item[key] && <p key={key}><strong>{label}：</strong>{item[key]}</p>)}
      <div className="brief-links">{item.reportIds.map(id => { const ref = issue.references.find(ref => ref.id === id); return <OutLink key={id} href={ref.url} className="text-link">{ref.publisher} · {ref.publishedAt}</OutLink>; })}</div>
    </div>)}
    {section.id === 'follow-up' && <div className="weekly-sources"><h4>本周重要信息来源</h4><ol>{issue.references.map(ref => <li key={ref.id}><span>{ref.publishedAt} · {ref.publisher}</span><OutLink href={ref.url} className="text-link">{ref.title}</OutLink>{ref.relatedLinks.map(link => <OutLink key={link.url} href={link.url} className="text-link">{link.publishedAt} {link.publisher} · {link.role}</OutLink>)}</li>)}</ol></div>}
  </section>)}</div>;
}
export function DiscoveryReportDetail({ report, data, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const source = data.sources.find(item => item.id === report.sourceId);
  return <dialog ref={dialog} className="discovery-detail" onKeyDown={trapDialogFocus} onCancel={onClose} aria-labelledby="discovery-detail-title"><div className="discovery-detail-top"><h2 id="discovery-detail-title">报道详情</h2><button className="icon-button" aria-label="关闭报道详情" onClick={onClose}><IconX size={22} /></button></div><div className="discovery-detail-body"><h3>{report.title}</h3>{report.originalTitle && report.originalTitle !== report.title && <p>{report.originalTitle}</p>}<p>{report.summary}</p><dl><dt>发布来源</dt><dd>{report.originalPublisher || source?.organization}</dd><dt>发布日期</dt><dd>{report.publishedAt}</dd>{report.companyIds.length > 0 && <><dt>关联企业</dt><dd>{report.companyIds.map(id => data.companies.find(company => company.id === id)?.name).join('、')}</dd></>}</dl><OutLink href={report.url} className="button primary">访问原文</OutLink></div></dialog>;
}
