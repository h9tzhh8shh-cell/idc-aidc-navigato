import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconArrowLeft, IconArrowRight, IconChevronRight, IconGripHorizontal, IconBuildingFactory2, IconUsers, IconArrowsExchange, IconCpu, IconBuildingBank, IconShieldCheck, IconDatabase, IconChartBar } from '@tabler/icons-react';
import { OutLink, SourceLogo } from './components.jsx';
import { FinancialChange } from './financial-components.jsx';
import { amount } from './domain/financial.js';
import { trackedCompanies } from './domain/company-research.js';
import { companyRange, companyDashboardActions, companyFinancialAt, companyHighlights, companyMediaRange, companyMediaReports, dashboardTypes } from './domain/company-dashboard.js';
import './company-dashboard.css';

const eventIcons = { project: IconBuildingFactory2, contract: IconUsers, acquisition: IconArrowsExchange, technology: IconCpu, capital: IconBuildingBank, risk: IconShieldCheck };
const securityName = company => company.securities.map(s => ['SZSE','深交所'].includes(s.exchange) ? `${s.code}.SZ` : ['SSE','上交所'].includes(s.exchange) ? `${s.code}.SH` : `${s.exchange}:${s.code}`).join(' / ');

function ActionList({ actions }) {
  return <ol className="company-action-list">{actions.map((action, index) => <li key={action.id} data-action-id={action.id} data-type={action.type}>
    <span className="company-action-number" aria-hidden="true">{index + 1}</span>
    <div><h4><OutLink href={action.url}>{action.title}</OutLink></h4><time dateTime={action.date}>{action.date}</time></div>
    <p>{action.summary}</p>
    <OutLink className="company-action-source" href={action.url}>原文</OutLink>
  </li>)}</ol>;
}

function TimelineCard({ action }) {
  const Icon = eventIcons[action.type];
  const [popup, setPopup] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function open(event, delay = 400) {
    clearTimeout(timer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(330, window.innerWidth - 32);
    const position = { width, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), top: Math.max(16, Math.min(rect.top, window.innerHeight - 380)) };
    timer.current = setTimeout(() => setPopup(position), delay);
  }
  function close() { clearTimeout(timer.current); setPopup(null); }
  return <li className="company-timeline-item" data-type={action.type} data-event-id={action.id}>
    <a className="company-timeline-card" href={action.url} target="_blank" rel="noopener noreferrer" aria-label={`${action.date} ${action.title}，访问原文`} aria-describedby={popup ? `company-tooltip-${action.id}` : undefined} onMouseEnter={open} onMouseLeave={close} onFocus={event => open(event,0)} onBlur={close} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <div className="company-timeline-title"><Icon size={23} aria-hidden="true"/><h4>{action.title}</h4></div>
      <time dateTime={action.date}>{action.date}</time><p>{action.summary}</p>
      <span className="company-timeline-source">{dashboardTypes[action.type]}<IconArrowRight size={15} aria-hidden="true"/></span>
    </a>
    {popup && createPortal(<div id={`company-tooltip-${action.id}`} className="company-timeline-popover" data-type={action.type} role="tooltip" style={popup}><strong>{action.title}</strong><p>{action.summary}</p>
      {action.nodes.length > 1 && <ol>{action.nodes.map(node => <li key={node.id}><time>{node.occurredAt}</time> {node.title}</li>)}</ol>}
      <small>来源：{action.publisher}</small>
    </div>, document.body)}
    <span className="company-timeline-stem" aria-hidden="true"/><span className="company-timeline-dot" aria-hidden="true"/>
    <span className="company-timeline-month">{Number(action.date.slice(5, 7))}月{Number(action.date.slice(8, 10))}日</span>
  </li>;
}

function MediaReports({ reports, companyId, height, onHeight, expanded }) {
  const viewport = useRef(null);
  const drag = useRef(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setMeasuredHeight(Math.round(entry.contentRect.height)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { viewport.current?.scrollTo({ top: 0 }); }, [companyId]);
  function resize(value) { onHeight(Math.max(80, Math.min(1200, value))); }
  function beginResize(event) {
    if (event.button !== 0) return;
    drag.current = { y: event.clientY, height: viewport.current.getBoundingClientRect().height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function endResize() { drag.current = null; }
  function resizeByKey(event) {
    const current = viewport.current.getBoundingClientRect().height;
    const next = { ArrowDown: current + 40, ArrowUp: current - 40, Home: 80, End: 1200 }[event.key];
    if (next !== undefined) { event.preventDefault(); resize(next); }
  }
  return <>
    <div id="company-media-window" className="company-media-window" ref={viewport} tabIndex={0} role="region" aria-label="相关媒体报道列表" style={{ height: expanded ? undefined : height ?? undefined, maxHeight: expanded ? 'none' : height ?? 340 }}>
      {reports.length ? <ol className="company-media-list">{reports.map(report => <li key={report.id} data-report-id={report.id}>
        <time dateTime={report.publishedAt}>{report.publishedAt}</time>
        <div className="company-media-content"><h4><OutLink href={report.originalUrl || report.url}>{report.title}</OutLink></h4><p>{report.summary}</p>
          <div className="company-media-meta"><span>{report.originalPublisher}</span><span className="company-media-kind">{report.authorship?.type === 'repost' ? '转载' : report.judgmentTypes.includes('opinion') ? '解读' : '报道'}</span></div>
        </div><OutLink className="company-media-source" href={report.originalUrl || report.url}>阅读原文</OutLink>
      </li>)}</ol> : <p className="company-dashboard-empty">近三个月暂无已收录媒体报道。</p>}
    </div>
    {reports.length > 0 && <div className="company-media-resize" role="separator" tabIndex={0} aria-label="调整媒体报道窗口高度" aria-controls="company-media-window" aria-orientation="horizontal" aria-valuemin={80} aria-valuemax={Math.max(1200, measuredHeight)} aria-valuenow={measuredHeight} onPointerDown={beginResize} onPointerMove={event => { if (drag.current) resize(drag.current.height + event.clientY - drag.current.y); }} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} onKeyDown={resizeByKey}>
      <IconGripHorizontal size={19} aria-hidden="true"/><span>拖动调整高度</span>
    </div>}
  </>;
}

export function CompanyDashboard({ data, sources, companyId, eventId, rangeKey = '2026', eventType = '', companyTab = 'timeline', onCompany, onRange, onEventType, onTab, onBack }) {
  const [showAll, setShowAll] = useState(false);
  const [mediaHeight, setMediaHeight] = useState(null);
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const title = useRef(null);
  const track = useRef(null);
  const company = data.companies.find(company => company.id === companyId);
  const companies = trackedCompanies(data);
  const range = companyRange(rangeKey);
  const mediaRange = companyMediaRange();
  const mediaReports = companyMediaReports(data, companyId, mediaRange);
  const readingMedia = companyTab === 'media';
  const actions = companyDashboardActions(data, companyId, range, eventType);
  const history = companyDashboardActions(data, companyId, { start: '2025-01-01', end: '2025-12-31' }, eventType);
  const highlights = showAll ? actions : companyHighlights(actions);
  const financial = companyFinancialAt(data, companyId, range.end);
  const source = sources.find(source => source.sourceType === 'company' && source.companyIds?.includes(companyId));
  const website = company?.discoveryProfile?.website || source?.entryUrl;
  useEffect(() => { setShowAll(false); track.current?.scrollTo({ left: 0 }); }, [companyId, rangeKey, eventType]);
  useEffect(() => { title.current?.focus(); }, [companyId]);
  useEffect(() => { setMediaHeight(null); setMediaExpanded(false); }, [companyId]);
  function changeTabByKey(event, index) {
    const next = { ArrowRight: 1 - index, ArrowLeft: 1 - index, Home: 0, End: 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); onTab(next ? 'media' : 'timeline'); event.currentTarget.parentElement.children[next].focus(); }
  }
  if (!company) return <section className="empty-state"><h2>未找到该公司</h2><button className="button secondary" onClick={onBack}>返回检索</button></section>;
  if (eventId && !data.events.some(event => event.id === eventId && event.companyIds.includes(companyId))) return <section className="empty-state"><h2>未找到该公司的事项</h2><button className="button secondary" onClick={onBack}>返回检索</button></section>;
  return <section className="company-dashboard" id="results" tabIndex={-1} aria-label="同行公司看板">
    <div className="company-dashboard-controls">
      {companies.some(item => item.id === companyId) ? <label><span>公司选择</span><select aria-label="公司选择" value={companyId} onChange={e => onCompany(e.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}{securityName(company) && `（${securityName(company)}）`}</option>)}</select></label> : <span className="company-detail-name">{company.name}</span>}
      <label><span>时间范围</span><select aria-label="时间范围" value={rangeKey} onChange={e => onRange(e.target.value)}>
        <option value="2026">2026-01-01 至今</option><option value="90">近90天</option><option value="30">近30天</option><option value="2026-h1">2026年上半年</option>
      </select></label>
      <button className="text-link company-dashboard-back" onClick={onBack}><IconArrowLeft size={16} aria-hidden="true"/>返回检索</button>
    </div>
    <div className="company-dashboard-overview">
      <div className="company-dashboard-identity">{source && <SourceLogo source={source} large/>}<div><h2 ref={title} tabIndex={-1}>{company.name}<small>{securityName(company)}</small></h2><p>{company.discoveryProfile?.businessIdentity || company.legalName}</p>{website && <OutLink className="text-link" href={website}>公司官网</OutLink>}</div></div>
      <div className="company-dashboard-financial" aria-label="公司财务">
        {['revenue', 'profit'].map((key, index) => { const metric = financial?.financial[key]; const formatted = metric && amount(metric).match(/^([-\d,.]+)(.+)$/); const Icon = index ? IconChartBar : IconDatabase; return <article className={`company-metric company-metric-${key}`} key={key} data-financial-id={financial?.id}>
          <div className="company-metric-heading"><Icon size={22} aria-hidden="true"/><h3>{index ? '净利润' : '营业收入'}</h3>{financial && <OutLink className="company-metric-source" href={financial.financial.evidence.url}>财报</OutLink>}</div>
          {metric ? <><strong className="company-metric-value"><span>{formatted[1]}</span><small>{formatted[2]}</small></strong><div className="company-metric-change"><span>同比</span><FinancialChange metric={metric}/></div><p>{financial.financial.period.label}{index && metric.label.includes('归属') ? ' · 归母' : ''}</p></> : <p className="company-metric-empty">暂无财报</p>}
        </article>; })}
      </div>
    </div>
    <section className="company-timeline-section" aria-label="公司重大动作与媒体报道">
      <div className="company-research-heading">
        <div className="company-research-tabs" role="tablist" aria-label="公司研究内容">{[['timeline', '重大动作时间线'], ['media', '相关媒体报道']].map(([id, label], index) => <button key={id} id={`company-tab-${id}`} role="tab" aria-selected={companyTab === id} aria-controls={`company-panel-${id}`} tabIndex={companyTab === id ? 0 : -1} onClick={() => onTab(id)} onKeyDown={event => changeTabByKey(event, index)}>{label}</button>)}</div>
        <span className="company-range-label">{readingMedia ? `近三个月 · ${mediaRange.start} — ${mediaRange.end}` : `${range.start} — ${range.end}`}</span>
        {readingMedia ? mediaReports.length > 4 && <button className="text-link company-panel-expand" onClick={() => { setMediaHeight(null); setMediaExpanded(!mediaExpanded); }} aria-expanded={mediaExpanded} aria-controls="company-media-window">{mediaExpanded ? '收起' : '查看全部'}<IconArrowRight size={15} aria-hidden="true"/></button> : actions.length > 8 && <button className="text-link company-panel-expand" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>{showAll ? '收起' : `查看全部 ${actions.length} 项`}<IconArrowRight size={15} aria-hidden="true"/></button>}
      </div>
      {readingMedia ? <div role="tabpanel" id="company-panel-media" aria-labelledby="company-tab-media"><MediaReports reports={mediaReports} companyId={companyId} height={mediaHeight} expanded={mediaExpanded} onHeight={value => { setMediaHeight(value); setMediaExpanded(false); }}/></div> : <div role="tabpanel" id="company-panel-timeline" aria-labelledby="company-tab-timeline">
      <div className="company-event-filters" role="group" aria-label="事件类型">{[['', '全部'], ...Object.entries(dashboardTypes)].map(([id, label]) => <button key={id} aria-pressed={eventType === id} onClick={() => onEventType(id)}>{label}</button>)}</div>
      {highlights.length ? <div className="company-timeline-scroll" ref={track} tabIndex={0} aria-label="横向重大动作时间线"><ol className="company-timeline" style={{ '--event-count': highlights.length }}>{highlights.map(action => <TimelineCard key={action.id} action={action}/>)}</ol></div> : <p className="company-dashboard-empty">当前范围暂无重大动作。</p>}
      </div>}
    </section>
    <details className="company-history" key={`${companyId}-${eventType}`}><summary><IconChevronRight size={18} aria-hidden="true"/>2025年关键动作<span>{history.length} 项</span></summary>{history.length ? <ActionList actions={history}/> : <p className="company-dashboard-empty">暂无已收录关键动作。</p>}</details>
  </section>;
}
