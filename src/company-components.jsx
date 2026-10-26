import { companyGroups, companyReports, companyEvents, companyActions, eventTimeline, milestoneReport, evidenceUrl } from './catalog.js';
import { eventTypeLabels } from './domain/catalog.js';
import { OutLink } from './components.jsx';
import { CompanyFinancial } from './financial-components.jsx';
import { companyCoverage } from './domain/company-research.js';
import './company-research.css';

function CompanyCoverage({ coverage, matchedCount, compact = false }) {
  return <section className={`company-coverage${compact ? ' company-coverage--compact' : ''}`} aria-label="公司研究覆盖情况">
    {!compact && <h3>已收录资料</h3>}
    {coverage.verifiedEventCount > 0 && <p className="company-coverage-status">已收录事项 {coverage.verifiedEventCount} 项</p>}
    <p>{coverage.scope} · 已收录资料 {coverage.reportCount} 条{coverage.financialCount > 0 && ` · 含 ${coverage.financialCount} 份财务披露`}{matchedCount !== coverage.reportCount && ` · 当前检索匹配 ${matchedCount} 条`}</p>
    {!compact && coverage.firstPublishedAt && <p>已收录资料发布时间：{coverage.firstPublishedAt}{coverage.lastPublishedAt !== coverage.firstPublishedAt && ` 至 ${coverage.lastPublishedAt}`}</p>}
  </section>;
}

export function CompanyBrowser({ data, sources, filters, onCompany }) {
  const groups = companyGroups(data, filters);
  const scopedEvents = company => companyEvents(data,company.id,filters);
  const groupContent = group => <div className="company-group">{group.items.map(company => {
    const docs=companyReports(data,sources,company.id,filters),events=scopedEvents(company),actions=companyActions(data,company.id,filters);
    const financialDocs=companyReports(data,sources,company.id,{scope:filters.scope,regions:filters.regions,showReference:filters.showReference});
    const coverage=companyCoverage({company,reports:financialDocs,events,filters,allReports:data.reports});
    return <article className="company-row" key={company.id} data-company-id={company.id}><div><h3><button className="source-title" onClick={e=>onCompany(company.id,e)}>{company.name}</button></h3><p>{company.securities.map(s=>`${s.exchange}:${s.code}`).join(' / ') || company.legalName}</p><CompanyCoverage coverage={coverage} matchedCount={docs.length} compact />{financialDocs.some(report=>report.financial) && <CompanyFinancial data={{...data,reports:financialDocs}} companyId={company.id} compact />}{(actions.length > 0 || events.length > 0) && <h4>重要动作</h4>}{actions[0] && <><p className="company-latest">{actions[0].importantAction}</p><p className="event-date">{actions[0].publishedAt} · <OutLink href={actions[0].url} className="text-link">公告原文</OutLink></p></>}{events[0] && <p className="company-latest">{events[0].currentSummary}</p>}</div><button className="button secondary" onClick={e=>onCompany(company.id,e)} aria-label={`查看${company.name}公司全景`}>公司全景</button></article>;
  })}</div>;
  return <section aria-label="按公司浏览"><div className="results-heading" id="results" tabIndex={-1}><h2>按公司浏览</h2><span className="muted">{groups[0].items.length} 家核心 · {groups[1].items.length} 家运营商 · {groups[2].items.length} 家参考</span></div>{!groups.some(group=>group.items.length) && <p className="company-empty">当前地区暂无已收录的公司资料或事项。</p>}{groups.filter(group=>group.items.length).map(group=>group.id==='reference'?<details className="company-reference" key={group.id} open={Boolean(filters.q?.trim()) || group.items.some(company=>filters.companies?.includes(company.id)) || undefined}><summary>{group.name}（{group.items.length}）</summary>{["domestic","overseas","cross","pending"].map(scope=>{const items=group.items.filter(c=>(c.researchScope||"pending")===scope);return items.length?<section key={scope}><h4>{{domestic:"国内参考",overseas:"海外参考",cross:"跨地区参考",pending:"其他参考"}[scope]}</h4>{groupContent({...group,items})}</section>:null;})}</details>:<section key={group.id}><h3 className="region-group-title">{group.name}</h3>{groupContent(group)}</section>)}</section>;
}

export function EventCard({ event, data, expanded, onEvent }) {
  const latest=event.milestones.find(node=>node.id===event.latestVerifiedMilestoneId),evidence=milestoneReport(latest,data);
  return <article className="event-card" data-event-id={event.id}><div className="report-topline"><span>{eventTypeLabels[event.type]}{event.regions.length > 0 && ` · ${event.regions.join(' / ')}`}</span></div><h3><button className="source-title" onClick={()=>onEvent(event.id)}>{event.title}</button></h3><p className="event-current" data-current-summary={event.id}>{event.currentSummary}</p>{evidence && <p className="event-date">{evidence.publishedAt && `最新披露日：${evidence.publishedAt} · `}<OutLink href={evidenceUrl(evidence)} className="text-link">依据原文</OutLink></p>}<details open={expanded || undefined} className="event-evidence"><summary>进展与依据（{event.milestones.length}）</summary><p>参与方：{event.participants.map(p=>`${data.companies.find(c=>c.id===p.companyId)?.name || p.name}（${p.role}）`).join('；')}</p><ol className="event-timeline">{eventTimeline(event,data).map(node=>{const primary=milestoneReport(node,data);return <li key={node.id}><h4>{node.title}</h4>{(primary?.publishedAt || node.occurredAt) && <p>{primary?.publishedAt && `原披露日 ${primary.publishedAt}`}{node.occurredAt && `${primary?.publishedAt ? ' · ' : ''}事项发生日 ${node.occurredAt}`}</p>}<p>{node.summary}</p>{node.evidenceRefs.map(ref=>{const report=data.reports.find(r=>r.id===ref.reportId);return <p key={`${ref.reportId}-${ref.locator}`}><OutLink href={ref.role.includes("第三方") ? report.url : evidenceUrl(report)} className="text-link">{report.title}</OutLink><span> · {ref.role} · {ref.locator}</span></p>;})}</li>;})}</ol>{event.relatedEventIds.map(id=><p key={id}>相关但独立的事项：<button className="text-link" onClick={()=>onEvent(id)}>{data.events.find(e=>e.id===id)?.title}</button></p>)}</details>{!expanded && <button className="text-link event-open" onClick={()=>onEvent(event.id)}>打开事项独立链接</button>}</article>;
}
