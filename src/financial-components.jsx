import { amount, changeText, latestFinancial } from './domain/financial.js';
export function FinancialChange({metric}) {
  const percent=metric.change.percent ?? (metric.priorValue===0 ? null : (metric.value-metric.priorValue)/Math.abs(metric.priorValue)*100);
  const delta=percent ?? metric.value-metric.priorValue;
  const direction=delta>0?'up':delta<0?'down':'flat';
  const text=percent===null ? (delta===0?'持平':'上年同期为零') : `${Math.abs(percent).toFixed(2)}%`;
  const label=percent===null ? text : metric.change.percent===null ? `${changeText(metric)} ${text}；按两期差额除以上年同期绝对值计算` : percent===0 ? '同比持平' : `同比${percent>0?'增长':'下降'}${text}`;
  return <span className={`financial-change financial-change-${direction}`} role="img" aria-label={label} title={label}><span aria-hidden="true">{direction==='up'?'↑':direction==='down'?'↓':'→'}</span>{text}</span>;
}
export function FinancialPreview({report,compact=false}) {
  const f=report?.financial;if(!f)return null;
  if(f.status==='pending')return <p className="reading-limit">{f.period.label} 已披露，指标待核：{f.limitations}</p>;
  return <div className="financial-preview" data-financial-id={report.id}>
    <p><strong>{f.period.label}</strong></p>
    <p>披露日期：{report.publishedAt}</p>
    {[f.revenue,f.profit].map(m=><p key={m.label}>{m.label}：<strong>{amount(m)}</strong><FinancialChange metric={m} /></p>)}
    {f.operatingChange&&<p>{f.operatingChange}</p>}
    <a className="text-link" href={f.evidence.url} target="_blank" rel="noopener noreferrer">查看业绩原文 ↗</a>
    <details className="report-note"><summary>查看财务依据与口径</summary><p>{f.evidence.locator}</p><p>本期 {f.period.start} 至 {f.period.end}；对比 {f.period.priorStart} 至 {f.period.priorEnd}。</p>{[f.revenue,f.profit].map(m=><p key={m.label}>{m.label}：本期原值 {m.value.toLocaleString('en-US',{maximumFractionDigits:8})}，上年同期 {m.priorValue.toLocaleString('en-US',{maximumFractionDigits:8})}；{m.currency} / {m.unit}；{m.attribution}。{m.change.note}</p>)}<p>{f.limitations}</p><p>成功核查：{report.verifiedAt}；显示金额按原值换算并四舍五入到两位小数，不换汇。</p></details>
  </div>;
}
export function CompanyFinancial({data,companyId,compact=false}) {
  const {report,pending}=latestFinancial(data,companyId);
  return <section className="company-financial" aria-label="公司业绩"><h4>{pending.length?'上一期已核业绩':'最近已核业绩'}</h4>{pending.map(r=><FinancialPreview key={r.id} report={r}/>)}{report?<FinancialPreview report={report} compact={compact}/>:<p className="muted">尚未取得可展示的财务指标。</p>}</section>;
}
