import { useEffect, useRef, useState } from 'react';
import { IconX, IconChevronDown, IconChevronRight, IconArrowUpRight, IconBuilding, IconInfoCircle, IconAlertCircle } from '@tabler/icons-react';
import data from '../public/assets/catalog.json';
import logos from './logos.json';
import { getReportMatchReason, getSourcePreview, getSourceReports, TOPICS, sortReportsByDate } from './catalog.js';
import { contentScopeLabels, judgmentLabels } from './domain/catalog.js';
const labels = data.labelMaps;

export function Highlight({ text = '', query = '' }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return text;
  return String(text).split(new RegExp(`(${words.join('|')})`, 'ig')).map((s, i) => i % 2 ? <mark key={i}>{s}</mark> : s);
}
export function SourceLogo({ source, large = false }) {
  return <span className={`source-logo ${large ? 'large' : ''}`}>{logos[source.id] ? <img src={logos[source.id]} alt={`${source.organization} 标识`} /> : <IconBuilding size={large ? 34 : 27} stroke={1.5} aria-hidden="true" />}</span>;
}
export function OutLink({ href, children, className = '' }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}<IconArrowUpRight size={17} stroke={1.8} aria-hidden="true" /><span className="sr-only">（在新标签页打开）</span></a>;
}
export function Facet({ title, children, initialOpen = true }) {
  const [open, setOpen] = useState(initialOpen);
  return <section className="facet"><button className="facet-heading" onClick={() => setOpen(!open)} aria-expanded={open}>{title}<IconChevronDown size={16} className={open ? '' : 'rotate'} aria-hidden="true" /></button>{open && <div className="facet-options">{children}</div>}</section>;
}
export function CheckOption({ label, checked, onChange, hint, level = 0 }) {
  return <label className={`check-option ${checked ? 'checked' : ''}`} style={{ '--level': level }}><input type="checkbox" aria-label={label} checked={checked} onChange={onChange} /><span>{label}</span>{hint && <small>{hint}</small>}</label>;
}
export function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll('button, a[href], input, select, summary')].filter(element => !element.disabled && element.getClientRects().length && (!element.closest('details:not([open])') || element.tagName === 'SUMMARY'));
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first?.focus();
  }
}
export function SourceDetail({ source, showReference = false, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const related = getSourceReports(source, { scope: 'all', showReference });
  const historical = sortReportsByDate(source.relatedReports.filter(report => report.visibility === 'archived' || report.duplicateOf));
  return <dialog className="detail-dialog" ref={dialog} onKeyDown={trapDialogFocus} onCancel={onClose} onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right) onClose(); } }} aria-labelledby="detail-title">
    <div className="detail-header"><span>来源详情</span><button className="icon-button" aria-label="关闭来源详情" onClick={onClose} autoFocus><IconX size={21} /></button></div>
    <div className="detail-content"><div className="detail-identity"><SourceLogo source={source} large /><div><h2 id="detail-title">{source.name}</h2><p>{new URL(source.entryUrl).hostname}</p><p>{source.organization} · {source.sourceType === 'company' ? '企业官方来源' : labels.sourceType[source.sourceType]}</p></div></div>
      {source.visibility !== 'active' && <section className="caution"><h3>{source.visibility === 'archived' ? '已归档 · 不计入有效来源' : '补充参考 · 内容仍待核'}</h3><p>{source.visibilityReason}</p></section>}
      <div className="detail-actions"><OutLink href={source.entryUrl} className="button primary">访问原站</OutLink>{source.methodologyUrl && <OutLink href={source.methodologyUrl} className="text-link">方法说明</OutLink>}</div>
      <dl className="detail-facts"><div><dt>覆盖地区</dt><dd>{source.regions.join(' / ')}</dd></div><div><dt>更新频率</dt><dd>{labels.frequency[source.frequency]}</dd></div><div><dt>获取条件</dt><dd>{labels.access[source.access]}</dd></div></dl>
      <section><h3>适合研究什么</h3><ul>{source.questions.map(q => <li key={q}>{q}</li>)}</ul></section>
      <section><h3>主要指标</h3><div className="metric-tags">{source.metrics.map(m => <span key={m}>{m}</span>)}</div></section>
      {!!source.companyIds?.length && <section><h3>关联公司与主体</h3>{source.companyIds.map(id => source.companyLookup[id]).filter(Boolean).map(company => <div className="company-identity" key={company.id}><strong>{company.name} · {company.role === 'core' ? '核心公司' : company.role === 'operator' ? '运营商' : '参考公司'}</strong><p>{company.legalName}</p><p>{company.securities.map(security => `${security.exchange}:${security.code}`).join(' / ') || '未按上市证券标注'}</p><p>{company.identityNote}</p>{company.identityUrls.map((url, index) => <OutLink key={url} href={url} className="text-link">主体依据 {index + 1}</OutLink>)}</div>)}</section>}
      {!!source.caveats?.length && <section className="caution"><h3><IconAlertCircle size={18} />口径与使用提示</h3><ul>{source.caveats.map(c => <li key={c}>{c}</li>)}</ul></section>}
      <section><h3>来源核查记录</h3><p className="muted small">入口与具体资料分别核查；成功日期和最近尝试分列。</p><p className={`verification ${source.verificationStatus === 'verified' ? 'verified' : ''}`}><IconInfoCircle size={17} />{labels.verificationStatus[source.verificationStatus]} · {source.verifiedAt || '暂无成功核查日期'}</p><p className="secondary-copy">{source.verificationNote}</p><p className="muted small">最近尝试核查：{source.lastCheckAttemptAt || '暂无记录'}</p></section>
      <details className="detail-disclosure"><summary>完整来源说明<IconChevronDown size={17} /></summary><p>{source.purpose}</p><h4>更新频率说明</h4><p>{source.frequencyNote}</p><h4>获取条件说明</h4><p>{source.accessNote}</p>{source.trackingNote && <><h4>建议跟踪方式</h4><p>{source.trackingNote}</p></>}{source.subscriptionNote && <p>{source.subscriptionNote}</p>}{source.subscriptionUrl && <OutLink href={source.subscriptionUrl} className="text-link">订阅入口</OutLink>}<h4>检索别名</h4><p>{source.aliases.join('、')}</p></details>
      <details className="detail-disclosure"><summary>已收录资料（{related.length}）{showReference && ' · 含补充参考'}<IconChevronDown size={17} /></summary>{related.length ? related.map(report => <ReportRow key={report.id} report={report} source={source} />) : <p>暂未收录可展示的具体资料，可前往原站查看。</p>}</details>
      {!!historical.length && <details className="detail-disclosure"><summary>历史归档与合并记录（{historical.length}）<IconChevronDown size={17} /></summary>{historical.map(report => <article className="related-report" key={report.id}><OutLink href={report.url} className="text-link">{report.title}</OutLink><p>{report.visibilityReason || `已合并至 ${report.duplicateOf}`}</p><p>发布日期：{report.publishedAt || '未知 / 待核查'}；历史成功核查：{report.verifiedAt || '暂无记录'}。{report.verificationNote}</p></article>)}</details>}
    </div>
  </dialog>;
}
export function ReportRow({ report, source, query, onSource }) {
  const reason = getReportMatchReason(report, source, query);
  return <article className="report-row" data-report-id={report.id}><div className="report-topline"><span>{TOPICS.find(topic => topic.id === report.primaryCategoryId)?.label} · {labels.kind[report.kind]}</span><span className={report.verificationStatus === 'verified' ? 'verified' : 'muted'}>{labels.verificationStatus[report.verificationStatus]}</span></div><h3><OutLink href={report.url} className="report-title"><Highlight text={report.title} query={query} /></OutLink></h3>{onSource && <button className="report-source" onClick={onSource}>来源：{source.name}<IconChevronRight size={14} /></button>}<ReportEvidence report={report} /><p className="report-summary"><Highlight text={report.summary} query={query} /></p><p className="report-coverage">资料地区：<Highlight text={report.regions.length ? report.regions.join(' / ') : '未明确 / 待核'} query={query} /></p>{reason && <p className="match-reason">{reason.label}：<Highlight text={reason.text} query={query} /></p>}<dl className="report-dates"><div><dt>发布日期</dt><dd>{report.publishedAt || '未知 / 待核查'}</dd></div><div><dt>数据所属期</dt><dd>{report.dataPeriod || '未知 / 不适用'}</dd></div><div><dt>最近成功核查</dt><dd>{report.verifiedAt || '暂无成功记录'}</dd></div></dl>{report.dateNote && <p className="report-coverage">{report.dateNote}</p>}<details className="report-note"><summary>核查说明与原始依据<IconChevronDown size={14} /></summary><p>原发布者：{report.originalPublisher}。{report.verificationNote}</p>{report.regionNote && <p>地区依据：{report.regionNote}</p>}{report.originalUrl && report.originalUrl !== report.url && <OutLink href={report.originalUrl} className="text-link">原始文件</OutLink>}{report.relatedLinks?.map(link => <p key={link.url}><OutLink href={link.url} className="text-link">{link.role} · {link.publisher}</OutLink>{link.publishedAt && ` · ${link.publishedAt}`}</p>)}</details></article>;
}

function ReportEvidence({ report }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  return <div className="report-evidence"><p>取得范围：{contentScopeLabels[report.contentScope]} · {labels.access[report.access]}{report.judgmentTypes.length > 0 && ` · ${report.judgmentTypes.map(type => judgmentLabels[type]).join(' / ')}`}{report.visibility === 'reference' && ' · 补充参考，非已核实动态'}</p>{report.stage && <p>阶段：{report.stage}</p>}{report.documentStatus && <p>文件状态：{report.documentStatus}{report.jurisdiction && ` · 适用法域：${report.jurisdiction}`}</p>}{report.effectiveAt && <p>{report.effectiveAt > today ? '将于' : '文件载明生效日：'}{report.effectiveAt}{report.effectiveAt > today ? '生效' : ''}</p>}{report.deadlineAt && <p>截止日期：{report.deadlineAt}</p>}</div>;
}

export function SourcePreview({ source, filters }) {
  const report = getSourcePreview(source, filters);
  const hasReports = source.relatedReports.some(item => item.visibility !== 'archived' && !item.duplicateOf);
  if (!report) return <p className="source-preview-empty">{hasReports ? '暂未收录符合当前条件的资料' : '暂未收录具体资料'}</p>;
  return <div className="source-preview" data-preview-id={report.id}><div className="preview-meta"><span>{report.kind === 'methodology' ? '参考资料 / 方法说明' : report.visibility === 'reference' ? '补充参考' : '近期匹配资料'} · {labels.kind[report.kind]}</span><span>发布日期：{report.publishedAt || '未知 / 待核查'}</span></div><OutLink href={report.url} className="preview-title"><Highlight text={report.title} query={filters.q} /></OutLink><p className="preview-summary"><Highlight text={report.summary} query={filters.q} /></p><p className="preview-regions">资料地区：{report.regions.length ? report.regions.join(' / ') : '未明确 / 待核'}</p><ReportEvidence report={report} />{report.dateNote && <p className="preview-regions">{report.dateNote}</p>}</div>;
}
