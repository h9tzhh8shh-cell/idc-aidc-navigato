import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import { IconSearch, IconX, IconChevronDown, IconLink, IconInfoCircle, IconWorld, IconClock, IconLockOpen, IconLock, IconFileText, IconAdjustmentsHorizontal, IconCheck } from '@tabler/icons-react';
import data from '../public/assets/catalog.json';
import { REGION_TREE, TOPICS, INFO_TYPES, decorateSources, filterSources, filterReports, getMatchReason, readQuery, writeQuery, normalizeFilters, isVisible, getSeaSources, getSeaReports, groupReportsByRegion, SUBCATEGORIES, subcategoryCounts, subcategoryNotice } from './catalog.js';
import { Highlight, SourceLogo, OutLink, Facet, CheckOption, SourceDetail, ReportRow, SourcePreview, trapDialogFocus } from './components.jsx';

import { CompanyBrowser, CompanyPanorama } from './company-components.jsx';

const sources = decorateSources(data);
const labels = data.labelMaps;
const emptyFilters = (scope = 'domestic') => ({ q: '', topics: [], companies: [], subcategory: null, regions: [], types: [], access: [], frequency: [], sort: 'relevance', scope, showReference: false });
const scopeLabels = { domestic: '国内（中国 / 中国香港）', sea: '东南亚六国', all: '全部地区' };
const lookup = Object.fromEntries(sources.map(s => [s.id, s]));
const allRegions = [];
function collectRegions(nodes, ancestors = []) { nodes.forEach(node => { allRegions.push({ ...node, ancestors }); if (node.children) collectRegions(node.children, [...ancestors, node.id]); }); }
collectRegions(REGION_TREE);
const regionById = Object.fromEntries(allRegions.map(n => [n.id, n]));
function leafIds(node) { return node.children?.length ? node.children.flatMap(leafIds) : [node.id]; }

export function App() {
  const initial = useMemo(() => readQuery(window.location.search), []);
  const [filters, setFilters] = useState({ ...emptyFilters(), ...initial.filters });
  const [draft, setDraft] = useState(initial.filters.q || '');
  const [view, setView] = useState(initial.view);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [navigation, setNavigation] = useState(initial.navigation || {});
  const [filterNotice, setFilterNotice] = useState(initial.notice || '');
  const companyTrigger = useRef(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [moreCountries, setMoreCountries] = useState(initial.filters.regions.some(id => ['泰国', '印尼', '越南', '菲律宾'].includes(id)));
  const [moreTypes, setMoreTypes] = useState(initial.filters.types.some(id => INFO_TYPES.slice(4).some(type => type.id === id)));
  const [toast, setToast] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const searchInput = useRef(null);
  const main = useRef(null);
  const detailTrigger = useRef(null);
  const filterTrigger = useRef(null);
  const filterDialog = useRef(null);
  const historyMode = useRef('replace');
  const southeast = view.startsWith('southeast');
  const reportsView = view.endsWith('reports');
  const effectiveFilters = useMemo(() => normalizeFilters(filters, view), [filters, view]);
  const results = useMemo(() => southeast ? getSeaSources(sources, effectiveFilters) : filterSources(sources, effectiveFilters), [effectiveFilters, southeast]);
  const reports = useMemo(() => southeast ? getSeaReports(data.reports, sources, effectiveFilters) : filterReports(data.reports, sources, effectiveFilters), [effectiveFilters, southeast]);
  const groupedReports = effectiveFilters.scope === 'all' && !effectiveFilters.regions.length && effectiveFilters.topics.length > 0 && effectiveFilters.topics.every(id => ['policy-planning', 'regulation'].includes(id)) ? groupReportsByRegion(reports) : [{ id: 'all', label: null, items: reports }];
  const currentSource = lookup[selectedId];
  const selectedEvent = data.events?.find(event => event.id === navigation.event);
  const companyId = navigation.company || (navigation.event ? selectedEvent?.companyIds[0] || 'invalid-record' : null);
  const listedOnly = effectiveFilters.topics.length === 1 && effectiveFilters.topics[0] === 'listed-companies';
  const companyMode = listedOnly && navigation.listedMode !== 'sources' && !companyId;
  const subCounts = useMemo(() => subcategoryCounts(data,sources,effectiveFilters,reportsView), [effectiveFilters,reportsView]);
  useEffect(() => {
    const query = writeQuery(filters, view, selectedId, navigation);
    const url = window.location.pathname + (query ? `?${query}` : '');
    if (url !== window.location.pathname + window.location.search) window.history[historyMode.current === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
    historyMode.current = 'push';
  }, [filters, view, selectedId, navigation]);
  useEffect(() => {
    function restore() { historyMode.current = 'replace'; const state = readQuery(window.location.search); setFilters({ ...emptyFilters(), ...state.filters }); setDraft(state.filters.q); setView(state.view); setSelectedId(state.selectedId); setNavigation(state.navigation || {}); setFilterNotice(state.notice || ''); }
    function shortcut(e) { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); searchInput.current?.focus(); } }
    window.addEventListener('popstate', restore); window.addEventListener('keydown', shortcut);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('keydown', shortcut); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (mobileFilters) filterDialog.current?.showModal(); }, [mobileFilters]);
  function update(changes) { const raw = { ...filters, ...changes }; setFilterNotice(subcategoryNotice(raw,view)); setFilters(normalizeFilters(raw,view)); if (changes.topics) setNavigation({}); main.current?.scrollTo({ top: 0 }); }
  function toggle(key, id) { update({ [key]: filters[key].includes(id) ? filters[key].filter(x => x !== id) : [...filters[key], id] }); }
  function reset() { setDraft(''); setNavigation({}); setFilterNotice(''); setFilters(emptyFilters(effectiveFilters.scope)); main.current?.scrollTo({ top: 0 }); }
  function covered(id) { const node = regionById[id]; return filters.regions.includes(id) || node.ancestors.some(p => filters.regions.includes(p)); }
  function toggleRegion(id) {
    const node = regionById[id], parent = node.ancestors.find(p => filters.regions.includes(p));
    if (parent) { const excluded = leafIds(node); update({ regions: [...filters.regions.filter(x => x !== parent), ...leafIds(regionById[parent]).filter(x => !excluded.includes(x))] }); }
    else if (filters.regions.includes(id)) update({ regions: filters.regions.filter(x => x !== id) });
    else update({ regions: [...filters.regions.filter(x => !regionById[x]?.ancestors.includes(id)), id] });
  }
  function regionOption(node, level = 0) {
    return <div key={node.id}><CheckOption label={node.label} checked={covered(node.id)} onChange={() => toggleRegion(node.id)} level={level} hint={node.id === '亚太' ? '含中国、东南亚' : undefined} />{node.children?.map((child, index) => level === 1 && index > 1 && !moreCountries ? null : regionOption(child, level + 1))}{node.id === '东南亚' && <button className="more-options" onClick={() => setMoreCountries(!moreCountries)}>{moreCountries ? '收起国家' : '其他 4 个国家'}<IconChevronDown size={13} className={moreCountries ? 'up' : ''} /></button>}</div>;
  }
  async function copyLink() { try { await navigator.clipboard.writeText(window.location.href); setToast('检索链接已复制，包含当前搜索与筛选条件'); } catch { setCopyFallback(window.location.href); } }
  function openSource(source, event) { detailTrigger.current = event.currentTarget; setSelectedId(source.id); }
  function closeSource() { setSelectedId(null); requestAnimationFrame(() => (detailTrigger.current || searchInput.current)?.focus()); }
  function closeFilters() { setMobileFilters(false); requestAnimationFrame(() => filterTrigger.current?.focus()); }
  function goView(next) { setNavigation({}); setFilterNotice(subcategoryNotice(filters,next)); setView(next); setSelectedId(null); setFilters(previous => normalizeFilters(previous, next)); main.current?.scrollTo({ top: 0 }); }
  function goHome() { setNavigation({}); setFilterNotice(''); setView('sources'); setSelectedId(null); setDraft(''); setFilters(emptyFilters()); main.current?.scrollTo({ top: 0 }); }
  function openCompany(id, event) { companyTrigger.current=event?.currentTarget; setNavigation({ company:id, returnQuery:writeQuery(filters,view,null,{ listedMode:navigation.listedMode }) }); main.current?.scrollTo({top:0}); }
  function openEvent(id) { const event=data.events.find(e=>e.id===id); setNavigation(previous=>({...previous,company:event?.companyIds.includes(companyId)?companyId:event?.companyIds[0] || companyId,event:id})); }
  function backToSearch() { const previous=navigation.returnQuery?readQuery(navigation.returnQuery):null; if(previous){setFilters(previous.filters);setDraft(previous.filters.q);setView(previous.view);setNavigation(previous.navigation || {});}else setNavigation({}); setFilterNotice(''); requestAnimationFrame(()=>{ if(companyTrigger.current?.isConnected) companyTrigger.current.focus(); else document.getElementById('results')?.focus(); }); }
  const chips = [
    ...(filters.q ? [{ key: 'q', id: filters.q, text: `关键词：${filters.q}` }] : []),
    ...filters.topics.map(id => ({ key: 'topics', id, text: `研究：${TOPICS.find(t => t.id === id)?.label}` })),
    ...(filters.subcategory ? [{key:'subcategory',id:filters.subcategory,text:`细分：${SUBCATEGORIES.find(s=>s.id===filters.subcategory)?.name}`}] : []),
    ...filters.companies.map(id=>({key:'companies',id,text:`公司：${data.companies.find(c=>c.id===id)?.name}`})),
    ...filters.regions.map(id => ({ key: 'regions', id, text: `地区：${id}${regionById[id]?.children ? '（含下级地区）' : ''}` })),
    ...filters.types.map(id => ({ key: 'types', id, text: `类型：${INFO_TYPES.find(t => t.id === id)?.label}` })),
    ...filters.access.map(id => ({ key: 'access', id, text: `获取：${labels.access[id]}` })),
    ...filters.frequency.map(id => ({ key: 'frequency', id, text: `频率：${labels.frequency[id]}` })),
  ];
  const activeConditions = [scopeLabels[effectiveFilters.scope], ...chips.map(chip => chip.text)];
  const topicOnlyFilters = { ...emptyFilters(effectiveFilters.scope), topics: filters.topics };
  const topicOnlyCount = filters.topics.length ? (reportsView ? filterReports(data.reports, sources, topicOnlyFilters) : filterSources(sources, topicOnlyFilters)).length : 0;
  const filtered = Boolean(filters.q || chips.length || southeast);
  const heading = companyId ? '公司全景' : companyMode ? '同业上市公司动态' : southeast ? '东南亚专题' : reportsView ? '动态与报告' : '来源目录';
  const hasHiddenMatch = source => filters.q && !filters.q.toLowerCase().split(/\s+/).every(q => `${source.name} ${source.purpose}`.toLowerCase().includes(q));
  const facetContent = (mobile = false) => <>
    <div className="filter-title"><h2>筛选{reportsView ? '资料' : '来源'}</h2><button className="text-link" onClick={reset}>清空</button></div>
    <Facet title="研究方向">{TOPICS.map(t => <div key={t.id}><CheckOption label={t.label} checked={filters.topics.includes(t.id)} onChange={() => toggle('topics', t.id)} />{filters.topics.length===1 && filters.topics[0]===t.id && SUBCATEGORIES.some(s=>s.parentCategoryId===t.id) && <div className="subcategory-options" role="group" aria-label={t.label+'子方向'}><label><input type="radio" name={mobile?'mobile-subcategory':'subcategory'} checked={!filters.subcategory} onChange={()=>update({subcategory:null})} />全部</label>{SUBCATEGORIES.filter(s=>s.parentCategoryId===t.id).map(sub=><label key={sub.id} className={filters.subcategory===sub.id?'checked':''}><input type="radio" name={mobile?'mobile-subcategory':'subcategory'} checked={filters.subcategory===sub.id} onChange={()=>update({subcategory:sub.id})} /><span>{sub.name}</span><small>{subCounts[sub.id]}</small></label>)}</div>}</div>)}</Facet>
    <Facet title="覆盖地区"><p className="region-note">按内容覆盖标签筛选。全球、亚太等概览标签不自动代表具体国家；父级包含下级已列地区。</p>{(southeast ? regionById['东南亚'].children : REGION_TREE).map(n => regionOption(n))}</Facet>
    <Facet title="信息类型"><p className="region-note">按已收录资料的实际类型和获取条件筛选；更新频率表示来源发布节奏。</p>{INFO_TYPES.slice(0, moreTypes ? undefined : 4).map(t => <CheckOption key={t.id} label={t.label} checked={filters.types.includes(t.id)} onChange={() => toggle('types', t.id)} />)}<button className="more-options" onClick={() => setMoreTypes(!moreTypes)}>{moreTypes ? '收起' : '其他 4 种类型'}<IconChevronDown size={13} className={moreTypes ? 'up' : ''} /></button></Facet>
    {!companyId && <Facet title="关联公司" initialOpen={filters.companies.length>0}>{data.companies.filter(c=>c.role!=='reference').map(company=><CheckOption key={company.id} label={company.name} checked={filters.companies.includes(company.id)} onChange={()=>toggle('companies',company.id)} />)}</Facet>}
    <Facet title="获取条件" initialOpen={filters.access.length > 0}>{Object.entries(labels.access).map(([id, label]) => <CheckOption key={id} label={label} checked={filters.access.includes(id)} onChange={() => toggle('access', id)} />)}</Facet>
    <Facet title="更新频率" initialOpen={filters.frequency.length > 0}>{Object.entries(labels.frequency).map(([id, label]) => <CheckOption key={id} label={label} checked={filters.frequency.includes(id)} onChange={() => toggle('frequency', id)} />)}</Facet>
    <CheckOption label="显示补充参考资料" checked={filters.showReference} onChange={() => update({ showReference: !filters.showReference })} />
    <p className="filter-note">同组条件取并集，不同组条件同时满足。</p>
  </>;
  return <>
    <a className="skip-link" href="#results">跳至检索结果</a>
    <header className="app-header"><a className="brand" href="?" onClick={e => { e.preventDefault(); goHome(); }}><FontAwesomeIcon icon={faLayerGroup} aria-hidden="true" /><span><strong>算力研究导航</strong><small>IDC / AIDC Navigator</small></span></a><nav aria-label="主导航">{[['sources', '来源目录'], ['southeast', '东南亚专题'], ['reports', '动态与报告']].map(([id, text]) => <button key={id} className={view === id || (id === 'southeast' && southeast) ? 'active' : ''} aria-current={view === id || (id === 'southeast' && southeast) ? 'page' : undefined} onClick={() => goView(id)}>{text}</button>)}</nav><div className="header-meta"><span>资料维护批次：{data.maintainedAt}</span><span>共 {sources.filter(source => isVisible(source)).length} 个正式来源</span></div></header>
    <div className="workspace"><aside className="filter-rail" aria-label="来源筛选">{facetContent()}</aside><main ref={main} className="main-panel">
      <div className="page-heading"><div><h1>{heading}</h1><p>{southeast ? '追踪东南亚六国的项目进展、供电条件与政策变化。' : reportsView ? '回到原文，区分发布日期、数据所属期与核查日期。' : '从研究问题出发，找到可用的信息来源。'}</p></div><button ref={filterTrigger} className="button mobile-filter" onClick={() => setMobileFilters(true)}><IconAdjustmentsHorizontal size={18} />筛选{chips.length > 0 && <span>{chips.length}</span>}</button></div>
      <div className="scope-tabs" role="group" aria-label="地区范围">{Object.entries(scopeLabels).map(([id, label]) => <button key={id} aria-pressed={effectiveFilters.scope === id} onClick={() => { if (southeast && id !== 'sea') setView(reportsView ? 'reports' : 'sources'); setFilters(previous => normalizeFilters({ ...previous, scope: id, regions: [] })); }}>{label}</button>)}</div>
      {southeast && <div className="topic-tabs" role="group" aria-label="专题内容"><button aria-pressed={!reportsView} onClick={() => setView('southeast')}>追踪来源</button><button aria-pressed={reportsView} onClick={() => setView('southeast-reports')}>最新动态</button><span>默认覆盖东南亚六国</span></div>}
      <form className="search-form" role="search" onSubmit={e => { e.preventDefault(); const q = draft.trim(); setDraft(q); update({ q }); }}><div className="search-input"><IconSearch size={21} stroke={1.8} aria-hidden="true" /><input ref={searchInput} type="search" aria-label={reportsView ? '搜索动态与报告' : '搜索来源、机构、指标或关键词'} placeholder={reportsView ? '搜索资料标题、机构或关键词' : '搜索来源、机构、指标或关键词'} value={draft} onChange={e => { setDraft(e.target.value); if (!e.target.value) update({ q: '' }); }} />{draft ? <button type="button" className="icon-button" aria-label="清除搜索词" onClick={() => { setDraft(''); update({ q: '' }); searchInput.current?.focus(); }}><IconX size={17} /></button> : <kbd>/</kbd>}</div><button className="button primary search-button" type="submit">搜索</button></form>
      <div className="active-filters" aria-label="已选筛选条件">{chips.map(c => <button className="filter-chip" key={`${c.key}-${c.id}`} onClick={() => { if (c.key === 'subcategory') update({subcategory:null}); else if (c.key === 'q') { setDraft(''); update({ q: '' }); } else toggle(c.key, c.id); requestAnimationFrame(() => searchInput.current?.focus()); }} aria-label={`移除${c.text}`}>{c.text}<IconX size={14} /></button>)}{chips.length > 0 && <button className="text-link" onClick={reset}>清空条件</button>}</div>
      <div className="query-summary"><IconInfoCircle size={19} aria-hidden="true" /><p>范围：{scopeLabels[effectiveFilters.scope]}<span className="summary-divider">|</span>当前检索：<strong>{filters.q || (chips.length ? '不限关键词' : southeast ? (reportsView ? '本专题全部资料' : '本专题全部来源') : reportsView ? '全部资料' : '全部来源')}</strong>{filters.regions.length > 0 && <><span className="summary-divider">|</span>地区：{filters.regions.join('、')}{filters.regions.some(id => regionById[id]?.children) && '（含下级地区）'}</>}{southeast && !filters.regions.length && <><span className="summary-divider">|</span>地区：东南亚六国</>}</p><button className="text-link copy-link" onClick={copyLink}><IconLink size={18} />复制检索链接</button></div>
      {copyFallback && <div className="copy-fallback"><label>复制此检索链接<input value={copyFallback} readOnly onFocus={e => e.target.select()} autoFocus /></label><button className="text-link" onClick={() => setCopyFallback('')}>关闭</button></div>}
      {filterNotice && <p className="filter-notice" role="status">{filterNotice}<button className="text-link" onClick={()=>setFilterNotice('')}>关闭提示</button></p>}
      {listedOnly && !companyId && <div className="topic-tabs" role="group" aria-label="同业浏览方式"><button aria-pressed={companyMode} onClick={()=>setNavigation({})}>按公司浏览</button><button aria-pressed={!companyMode} onClick={()=>setNavigation({listedMode:'sources'})}>保留来源／资料列表</button></div>}
      {companyId ? <CompanyPanorama data={data} sources={sources} companyId={companyId} eventId={navigation.event} eventType={navigation.eventType} filters={effectiveFilters} onBack={backToSearch} onEvent={openEvent} onEventType={eventType=>setNavigation(previous=>({...previous,eventType}))} onSource={openSource} /> : companyMode ? <CompanyBrowser data={data} sources={sources} filters={effectiveFilters} onCompany={openCompany} /> : <>
      <div className="results-heading" id="results" tabIndex={-1}><h2>{reportsView ? '相关资料' : filtered ? '相关来源' : '全部来源'}<span className="result-count" role="status" aria-label={`${reportsView ? reports.length : results.length} ${reportsView ? '条资料' : '个来源'}`}>{reportsView ? reports.length : results.length}</span></h2><span className="result-hint">{filters.q && '文本匹配'}{filters.q && chips.some(c => c.key !== 'q') && ' + '}{chips.some(c => c.key !== 'q') && '条件筛选'}</span><label className="sort-control"><span className="sr-only">排序方式</span><select value={filters.sort} onChange={e => update({ sort: e.target.value })}><option value="relevance">{reportsView ? (filters.q ? '相关性优先' : '发布日期优先') : '综合相关性'}</option><option value="name">名称顺序</option><option value="verified">最近核查</option></select><IconChevronDown size={16} aria-hidden="true" /></label></div>
      {!(reportsView ? reports : results).length ? <div className="empty-state"><IconSearch size={36} stroke={1.3} /><h3>没有找到匹配的{reportsView ? '资料' : '来源'}</h3><p>{activeConditions.length ? `当前生效条件：${activeConditions.join('；')}。` : '当前没有可显示的内容。'}<br />关键词与各筛选组须同时满足；同组多选满足任一项。可以移除部分条件，扩大查找范围。</p><p>{topicOnlyCount > 0 && '“仅按研究方向查看”将清除关键词、地区、类型、获取条件、频率及排序，保留研究方向、当前范围和栏目。'}</p><div className="empty-actions">{topicOnlyCount > 0 && <button className="button primary" onClick={() => { setDraft(''); update(topicOnlyFilters); requestAnimationFrame(() => searchInput.current?.focus()); }}>仅按研究方向查看（{topicOnlyCount}）</button>}<button className={`button ${topicOnlyCount > 0 ? 'secondary' : 'primary'}`} onClick={reset}>{southeast ? '清空条件，查看本专题' : '清空条件，保留当前范围'}</button></div></div> : reportsView ? <div className="report-list">{groupedReports.map(group => <section key={group.id} aria-label={group.label || "相关资料"}>{group.label && <h3 className="region-group-title">{group.label} <span>{group.items.length}</span></h3>}{group.items.map(report => <ReportRow key={report.id} report={report} source={lookup[report.sourceId]} query={filters.q} onSource={e => openSource(lookup[report.sourceId], e)} />)}</section>)}</div> : <div className="source-list">{results.map(source => <article className="source-row" key={source.id}>
        <SourceLogo source={source} /><div className="source-copy"><h3><button className="source-title" onClick={e => openSource(source, e)}><Highlight text={source.name} query={filters.q} /></button></h3><p className="source-purpose"><Highlight text={source.purpose} query={filters.q} /></p><div className="source-meta"><span title={source.regions.join(' / ')}><IconWorld size={17} />{source.regions.length === 6 && source.regions.includes('菲律宾') ? '东南亚六国' : source.regions.join(' / ')}</span><span><IconFileText size={17} />{labels.sourceType[source.sourceType]}</span><span><IconClock size={17} />{labels.frequency[source.frequency]}</span><span className={`access ${source.access === 'free' ? 'free' : source.access === 'mixed' ? 'mixed' : ''}`}>{source.access === 'free' ? <IconLockOpen size={17} /> : <IconLock size={17} />}{labels.access[source.access]}</span></div>{hasHiddenMatch(source) && <p className="match-reason">{getMatchReason(source, filters.q, effectiveFilters)?.label || '匹配内容'}：<Highlight text={getMatchReason(source, filters.q, effectiveFilters)?.text || source.aliases.join('、')} query={filters.q} /></p>}<SourcePreview source={source} filters={effectiveFilters} /></div>
        <div className="row-actions"><OutLink href={source.entryUrl} className="button primary visit-button">访问原站</OutLink><button className="button secondary" onClick={e => openSource(source, e)}>查看详情</button></div>
      </article>)}</div>}
      </>}
      <footer className="results-footer"><span>{filters.showReference ? '含补充参考 · ' : ''}{companyId || companyMode ? '公司与事项视图' : `显示 ${reportsView ? reports.length : results.length} ${reportsView ? '条资料' : '个来源'}`} · 人工整理，原始来源</span><span>资料维护批次 {data.maintainedAt} · 核查范围见详情</span></footer>
    </main></div>
    {mobileFilters && <dialog ref={filterDialog} className="mobile-filter-dialog" onKeyDown={trapDialogFocus} onCancel={closeFilters} aria-labelledby="mobile-filter-title"><div className="mobile-filter-top"><strong id="mobile-filter-title">组合筛选</strong><button className="icon-button" aria-label="关闭筛选" onClick={closeFilters}><IconX size={22} /></button></div><div className="mobile-facets">{facetContent(true)}</div><div className="mobile-filter-bottom"><button className="button primary" onClick={closeFilters}>查看 {reportsView ? reports.length : results.length} 个结果</button></div></dialog>}
    {currentSource && <SourceDetail key={currentSource.id} source={currentSource} showReference={filters.showReference} onClose={closeSource} />}
    {toast && <div className="toast" role="status"><IconCheck size={19} />{toast}</div>}
  </>;
}
