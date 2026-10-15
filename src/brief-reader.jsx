import { useEffect, useState } from 'react';
import { OutLink } from './components.jsx';
import { availableIssues, beijingTimestamp, discoveryBatch, generateIssue, previousCompleteWeek, saveIssue } from './domain/discovery.js';
import { briefReading, briefSummaryText } from './domain/brief-reading.js';
import './brief-reader.css';

const storageKey = 'navigator-local-briefs-v1';
function JumpLink({ target, children, className }) {
  return <a className={className} href={`#${target}`} onClick={event => {
    event.preventDefault();
    const section = document.getElementById(target);
    section?.focus({ preventScroll: true }); section?.scrollIntoView({ block: 'start' });
  }}>{children}</a>;
}
function Sources({ ids, references }) {
  return <span className="brief-citations">{ids.map(id => {
    const index = references.findIndex(ref => ref.id === id);
    return index >= 0 ? <JumpLink key={id} target={`brief-source-${index}`}><span className="sr-only">来源 </span>[{index + 1}]</JumpLink> : null;
  })}</span>;
}
export function BriefReader({ data, kind, navigation, onNavigate, issues, onIssues, onReport, onBack }) {
  const issue = navigation.issue ? issues.find(item => item.kind === kind && item.id === navigation.issue) : availableIssues(issues, kind)[0];
  const model = issue ? briefReading(issue, data) : null;
  const [date, setDate] = useState(beijingTimestamp().slice(0, 10));
  const [notice, setNotice] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  useEffect(() => { setNotice(''); setCopyFallback(''); }, [kind]);
  useEffect(() => setCopyFallback(''), [issue?.id]);
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
  async function copySummary() {
    const text = briefSummaryText(model);
    try { await navigator.clipboard.writeText(text); setNotice('摘要已复制，包含报告日期和来源链接。'); setCopyFallback(''); }
    catch { setCopyFallback(text); setNotice('请复制下方摘要。'); }
  }
  return <section className="brief-workspace brief-reading" id="results" tabIndex={-1}>
    <div className="discovery-heading brief-reading-toolbar"><h2>{kind === 'daily' ? '每日快报' : '行业周报'}</h2><div className="brief-reading-actions">
      {onBack && <button className="button secondary" onClick={onBack}>返回检索</button>}
      {model && <><button className="button secondary" onClick={copySummary}>复制摘要</button><button className="button primary" onClick={() => window.print()}>打印 / 保存 PDF</button></>}
    </div></div>
    <details className="brief-generate"><summary>生成报告</summary><div><label>{kind === 'daily' ? '日报日期' : '更新日期'}<input aria-label="报告所属日期" type="date" value={date} onChange={event => setDate(event.target.value)} max={kind === 'weekly' ? beijingTimestamp().slice(0, 10) : discoveryBatch(data)?.cutoffAt.slice(0, 10)} /></label><button className="button primary" onClick={generate}>从已收录资料生成</button></div>{kind === 'weekly' && <p className="brief-period">周报范围：{week.start} — {week.end}</p>}</details>
    {notice && <p className="brief-notice" role="status">{notice}</p>}
    {copyFallback && <div className="brief-copy-fallback"><label htmlFor="brief-copy-text">摘要、日期与来源</label><textarea id="brief-copy-text" readOnly value={copyFallback} onFocus={event => event.target.select()} /><button className="text-link" onClick={() => setCopyFallback('')}>收起</button></div>}
    {!model ? <p className="discovery-empty">暂无报告，可生成新一期。</p> : <div className="brief-reading-layout">
      <nav className="brief-contents" aria-label="报告章节目录"><strong>章节目录</strong><JumpLink target="brief-summary">阅读摘要</JumpLink>{model.sections.map((section, index) => <JumpLink key={section.id} target={`brief-section-${section.id}`}>{index + 1}. {section.label}</JumpLink>)}<JumpLink target="brief-sources">重要信息来源</JumpLink></nav>
      <article className="brief-paper">
        <header><h2>{model.title}</h2><p>{model.dateLabel}</p><p>{model.references.length} 项来源资料 · 生成于 {model.generatedAt}</p></header>
        <section className="brief-reading-summary" id="brief-summary" tabIndex={-1} aria-labelledby="brief-summary-title"><h3 id="brief-summary-title">阅读摘要</h3><div className="brief-summary-columns">{model.summary.map(group => <div key={group.id}><h4>{group.label}</h4>{group.items.length ? <ul>{group.items.map((item, index) => <li key={index}><span className="brief-evidence-label">{item.fields[0].label}</span>{item.fields[0].text}<Sources ids={item.reportIds} references={model.references} /></li>)}</ul> : <p>本期未整理此项。</p>}</div>)}</div></section>
        <div className="weekly-research">{model.sections.map((section, index) => <section key={section.id} id={`brief-section-${section.id}`} data-weekly-section={issue.kind === 'weekly' ? section.id : undefined} tabIndex={-1}>
          <h3>{index + 1}. {section.label}</h3>{section.summaryLink && <p><JumpLink className="text-link" target="brief-summary">核心事实与重要性见阅读摘要</JumpLink></p>}{section.intro && <p>{section.intro}</p>}{!section.items.length && <p>{section.emptyText || '本期暂无相关资料。'}</p>}
          {section.items.map((item, itemIndex) => <div className="brief-news" key={itemIndex}><h4>{item.title}</h4>{item.fields.map(field => <p key={field.key}><strong>{field.label}：</strong>{field.text}</p>)}<div className="brief-links">{item.reportIds.map(id => {
            const ref = model.references.find(ref => ref.id === id);
            return ref ? <OutLink key={id} href={ref.url} className="text-link">{ref.publisher} · {ref.publishedAt}</OutLink> : null;
          })}{item.report && <button className="text-link brief-open-detail" onClick={event => onReport(item.report, event)}>查看详情</button>}</div></div>)}
        </section>)}</div>
        <section className="brief-reading-sources" id="brief-sources" tabIndex={-1}><h3>重要信息来源</h3><ol>{model.references.map((ref, index) => <li key={ref.id} id={`brief-source-${index}`} tabIndex={-1}><span>{ref.publishedAt} · {ref.publisher}</span><OutLink href={ref.url} className="text-link">{ref.title}</OutLink><span className="brief-source-url">{ref.url}</span>{(ref.relatedLinks || []).map(link => <div key={link.url}><OutLink href={link.url} className="text-link">{link.publishedAt} {link.publisher} · {link.role}</OutLink><span className="brief-source-url">{link.url}</span></div>)}</li>)}</ol></section>
      </article>
    </div>}
  </section>;
}
