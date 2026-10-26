import { beijingToday, dateRange, batchChanges, SUBCATEGORIES, TOPICS } from './catalog.js';
import { changeKindLabels } from './domain/catalog.js';
import { OutLink, ReportRow } from './components.jsx';

export function DateControls({ filters, onChange, company = false }) {
  const range = dateRange(filters.dateWindow,filters.asOf);
  return <section className="date-controls" aria-label="资料原文时间">
    {company && <p className="time-caption">资料原文时间 · 不改变上方业绩及事项当前状态</p>}
    <div className="topic-tabs" role="group" aria-label="原文时间窗口">{[['all','全部时间'],['7','近7天'],['30','近30天'],['unknown','日期未知']].map(([id,label])=><button key={id} aria-pressed={(filters.dateWindow || 'all')===id} onClick={()=>onChange({dateWindow:id,asOf:['7','30'].includes(id)?beijingToday():null})}>{label}</button>)}</div>
    {range && <p className="time-caption">{range.from} — {range.through}（北京时间）{filters.asOf !== beijingToday() && <> · <button className="text-link" onClick={()=>onChange({asOf:beijingToday()})}>更新到今天</button></>}</p>}
  </section>;
}

export function BatchView({ data, sources, filters, onChange, onEvent }) {
  const batches = [...(data.changeBatches || [])].reverse();
  const batch = batches.find(b=>b.batchId===filters.batchId) || (!filters.batchId ? batches[0] : null);
  if (!batch) return <section className="empty-state" id="results"><h3>{filters.batchId?'更新批次不存在':'尚无已记录的更新批次'}</h3>{filters.batchId && <button className="text-link" onClick={()=>onChange({batchId:null})}>查看最近批次</button>}</section>;
  const changes = batchChanges(data,sources,batch,filters);
  const docs = changes.filter(c=>c.objectType==='report'), events = changes.filter(c=>c.objectType==='event'), sourceChanges = changes.filter(c=>c.objectType==='source');
  return <section className="batch-view" id="results" aria-label="按更新批次">
    <div className="batch-heading"><h2>本批变化</h2><label>更新批次 <select aria-label="更新批次" value={batch.batchId} onChange={e=>onChange({batchId:e.target.value})}>{batches.map(b=><option key={b.batchId} value={b.batchId}>{b.recordedAt.slice(0,16).replace('T',' ')} · {b.batchId}</option>)}</select></label></div>
    <p className="time-caption">{batch.recordedAt.replace('T',' ').replace('+08:00',' 北京时间')} · 当前筛选 {docs.length} 篇资料变化 / {events.length} 项事项变化{sourceChanges.length > 0 && ` / ${sourceChanges.length} 个来源更新`}</p>
    {!changes.length && <p className="company-empty">当前范围暂无匹配变化。</p>}
    {changes.map(change=>{const item=change.objectType==='report'?data.reports.find(r=>r.id===change.objectId):change.objectType==='event'?data.events.find(e=>e.id===change.objectId):data.sources.find(s=>s.id===change.objectId);return <article className="batch-change" key={change.objectType+change.objectId}>
      <p className="change-kind">{change.kinds.map(k=>changeKindLabels[k]).join(' · ')}</p><h3>{item?.title || item?.name}</h3>{change.objectType==='report' && <p className="report-summary">{item.summary}</p>}
      {change.objectType==='report' ? <><p className="time-caption">原文：{item.publishedAt || '日期未知'}</p><OutLink href={item.url} className="text-link">访问原文</OutLink><details className="report-note"><summary>资料与依据</summary><ReportRow report={item} source={sources.find(s=>s.id===item.sourceId)} filters={filters} /></details></> : change.objectType==='event' ? <><p>{item.currentSummary}</p><button className="text-link" onClick={()=>onEvent(item.id)}>查看事项当前进展</button></> : <OutLink href={item.entryUrl} className="text-link">访问来源</OutLink>}
    </article>;})}
  </section>;
}

export function RelatedReports({ reports, onRelax }) {
  if (!reports.length) return null;
  return <section className="related-results" aria-label="另有相关资料"><h3>另有相关资料</h3><p className="time-caption">{reports.length} 篇资料</p>{reports.map(report=><article key={report.id}><OutLink href={report.url} className="text-link">{report.title}</OutLink><p>{report.publishedAt || '日期未知'} · {TOPICS.find(t=>t.id===report.primaryCategoryId)?.label} / {SUBCATEGORIES.find(s=>s.id===report.primarySubcategoryId)?.name}</p></article>)}<button className="text-link" onClick={onRelax}>放宽子方向，保留其他筛选</button></section>;
}
