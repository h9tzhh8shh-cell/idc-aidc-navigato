import { amount, changeText, latestFinancial } from './domain/financial.js';
import './financial.css';
export function FinancialChange({metric}) {
  const percent=metric.change.percent;
  if(percent===null)return <span className="financial-change-description">{changeText(metric)}</span>;
  const direction=percent>0?'up':percent<0?'down':'flat';
  const text=`${Math.abs(percent).toFixed(2)}%`;
  const label=percent===0?'同比持平':`同比${percent>0?'增长':'下降'}${text}`;
  return <span className={`financial-change financial-change-${direction}`} role="img" aria-label={label} title={label}><span aria-hidden="true">{direction==='up'?'↑':direction==='down'?'↓':'→'}</span>{text}</span>;
}
export function FinancialAmounts({metric}) {
  return <div className="financial-amounts">
    <div className="financial-current"><span>本期</span><strong>{amount(metric)}</strong></div>
    <FinancialChange metric={metric} />
    <div className="financial-prior"><span>上年同期</span><span>{amount(metric,metric.priorValue)}</span></div>
  </div>;
}
export function FinancialPreview({report,compact=false}) {
  const f=report?.financial;if(!f)return null;
  if(f.status==='pending')return <p className="reading-limit">{f.period.label} · <a className="text-link" href={f.evidence.url} target="_blank" rel="noopener noreferrer">查看业绩原文 ↗</a></p>;
  return <div className="financial-preview" data-financial-id={report.id}>
    <p><strong>{f.period.label}</strong></p>
    <p>披露日期：{report.publishedAt}</p>
    <p className="financial-period">本期 {f.period.start} — {f.period.end}；上年同期 {f.period.priorStart} — {f.period.priorEnd}。</p>
    {[f.revenue,f.profit].map(m=><div className="financial-metric" key={m.label}><p className="financial-metric-label">{m.label}</p><FinancialAmounts metric={m} /><p className="financial-attribution">{m.attribution}</p></div>)}
    {f.operatingChange&&<p>{f.operatingChange}</p>}
    <a className="text-link" href={f.evidence.url} target="_blank" rel="noopener noreferrer">查看业绩原文 ↗</a>
    <details className="report-note"><summary>查看财务依据与口径</summary><p>{f.evidence.locator}</p><p>本期 {f.period.start} 至 {f.period.end}；对比 {f.period.priorStart} 至 {f.period.priorEnd}。</p>{[f.revenue,f.profit].map(m=><p key={m.label}>{m.label}：本期原值 {m.value.toLocaleString('en-US',{maximumFractionDigits:8})}，上年同期 {m.priorValue.toLocaleString('en-US',{maximumFractionDigits:8})}；{m.currency} / {m.unit}；{m.attribution}。</p>)}</details>
  </div>;
}
export function CompanyFinancial({data,companyId,compact=false}) {
  const {report,pending}=latestFinancial(data,companyId);
  return <section className="company-financial" aria-label="公司业绩"><h4>最新财报</h4>{pending.map(r=><FinancialPreview key={r.id} report={r}/>)}{report && <FinancialPreview report={report} compact={compact}/>}</section>;
}
