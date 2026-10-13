import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import data from '../public/assets/catalog.json';
import { TOPICS, SUBCATEGORIES, INFO_TYPES } from './catalog.js';
import { CheckOption } from './components.jsx';

export function HorizontalFilters({ filters, update, toggle, subCounts, regionOptions, companyId, reportsView }) {
  const [open, setOpen] = useState(null);
  const panel = useRef(null);
  const trigger = useRef(null);
  const activeTopic = filters.topics.length === 1 ? TOPICS.find(topic => topic.id === filters.topics[0]) : null;
  const children = SUBCATEGORIES.filter(sub => sub.parentCategoryId === activeTopic?.id);
  const labels = { regions: '覆盖地区', types: '信息类型', companies: '关联公司', access: '获取条件', frequency: '更新频率', rules: '筛选规则', subcategory: activeTopic?.label };

  function close(restoreFocus = false) {
    setOpen(null);
    if (restoreFocus && trigger.current?.isConnected) trigger.current.focus();
  }
  function openPanel(key, event) {
    trigger.current = event.currentTarget;
    setOpen(previous => previous === key ? null : key);
  }
  useEffect(() => {
    if (open === 'subcategory' && (!activeTopic || !children.length)) setOpen(null);
  }, [open, activeTopic?.id, children.length]);

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    function position() {
      if (window.innerWidth <= 800 || !trigger.current?.isConnected) { setOpen(null); return; }
      const anchor = trigger.current.getBoundingClientRect();
      const menu = panel.current;
      if (!menu) return;
      menu.style.maxHeight = `${Math.min(440, window.innerHeight - 32)}px`;
      const menuHeight = menu.offsetHeight;
      const above = anchor.bottom + 8 + menuHeight > window.innerHeight - 16 && anchor.top - 8 >= menuHeight;
      const top = above ? anchor.top - 8 - menuHeight : anchor.bottom + 8;
      menu.style.top = `${Math.max(16, top)}px`;
      menu.style.left = `${Math.max(16, Math.min(anchor.left, window.innerWidth - menu.offsetWidth - 16))}px`;
      menu.style.maxHeight = `${Math.min(440, window.innerHeight - Math.max(16, top) - 16)}px`;
    }
    function outside(event) {
      if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    }
    function escape(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    }
    position();
    panel.current.querySelector('input, summary, button')?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(panel.current);
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function leavePanel(event) {
    if (event.key !== 'Tab') return;
    const controls = [...panel.current.querySelectorAll('input, button, summary, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); close(true); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
      event.preventDefault();
      const pageControls = [...document.querySelectorAll('button, input, select, a[href], summary')].filter(el => !panel.current.contains(el) && !el.disabled && el.getClientRects().length);
      const next = pageControls[pageControls.indexOf(trigger.current) + 1];
      close(); (next || trigger.current)?.focus();
    }
  }
  const listOptions = key => {
    const options = key === 'types' ? INFO_TYPES.map(item => [item.id, item.label])
      : key === 'companies' ? data.companies.filter(company => company.role !== 'reference').map(company => [company.id, company.name])
      : Object.entries(data.labelMaps[key]);
    return options.map(([id, label]) => <CheckOption key={id} label={label} checked={filters[key].includes(id)} onChange={() => toggle(key, id)} />);
  };
  const panelBody = open === 'subcategory' ? <div className="directory-sub-options" role="radiogroup" aria-label={`${activeTopic?.label}子方向`}>
    <label className={!filters.subcategory ? 'selected' : ''}><input type="radio" name="horizontal-subcategory" checked={!filters.subcategory} onChange={() => { update({ subcategory: null }); close(true); }} /><span>全部子方向</span></label>
    {children.map(sub => <label className={filters.subcategory === sub.id ? 'selected' : ''} key={sub.id}><input type="radio" name="horizontal-subcategory" checked={filters.subcategory === sub.id} onChange={() => { update({ subcategory: sub.id }); close(true); }} /><span>{sub.name}</span><small>{subCounts[sub.id]}</small></label>)}
  </div> : open === 'regions' ? regionOptions : open === 'rules' ? <div className="directory-rules">
    <p>父级包含已列子地区；全球、亚太等概览标签不自动代表具体国家。来源按覆盖地区筛选，资料按自身涉及地区筛选。</p>
    <p>同维条件取并集（OR），跨维条件同时满足（AND）。类型和获取条件按实际资料判断，频率表示来源发布节奏；来源目录不使用原文日期窗口。</p>
    <p>单一研究方向可细分；多方向联合检索暂不细分，已选子方向会清除。</p>
  </div> : open ? listOptions(open) : null;

  return <div className="directory-filters" aria-label={reportsView ? '资料筛选' : '来源目录筛选'}>
    <div className="directory-topics" role="group" aria-label="研究方向">
      <span className="directory-filter-label">研究方向</span>
      {TOPICS.map(topic => <div className={`directory-topic ${filters.topics.includes(topic.id) ? 'is-selected' : ''}`} key={topic.id}>
        <CheckOption label={topic.label} checked={filters.topics.includes(topic.id)} onChange={() => toggle('topics', topic.id)} />
        {activeTopic?.id === topic.id && children.length > 0 && <button className="directory-topic-arrow" aria-label={`${open === 'subcategory' ? '收起' : '展开'}${topic.label}子方向`} aria-expanded={open === 'subcategory'} aria-controls={open === 'subcategory' ? 'directory-filter-panel' : undefined} onClick={event => openPanel('subcategory', event)}><IconChevronDown size={16} aria-hidden="true" /></button>}
      </div>)}
    </div>
    <div className="directory-secondary">
      {['regions', 'types', 'companies', 'access', 'frequency'].filter(key => key !== 'companies' || !companyId).map(key => <button key={key} className={`directory-filter-trigger ${filters[key].length ? 'has-selection' : ''}`} aria-expanded={open === key} aria-controls={open === key ? 'directory-filter-panel' : undefined} onClick={event => openPanel(key, event)}>
        <span>{labels[key]}</span><span className="directory-filter-value">{filters[key].length ? `已选 ${filters[key].length} 项` : '不限'}</span><IconChevronDown size={14} aria-hidden="true" />
      </button>)}
      <CheckOption label="显示补充参考资料" checked={filters.showReference} onChange={() => update({ showReference: !filters.showReference })} />
      <button className="text-link directory-rules-trigger" aria-expanded={open === 'rules'} aria-controls={open === 'rules' ? 'directory-filter-panel' : undefined} onClick={event => openPanel('rules', event)}>筛选规则<IconChevronDown size={14} aria-hidden="true" /></button>
    </div>
    {filters.topics.length > 1 && <p className="directory-multi-note">多方向联合检索 · 暂不细分子方向</p>}
    {open && createPortal(<div className={`directory-popover ${open === 'regions' ? 'directory-region-popover' : ''}`} id="directory-filter-panel" role="dialog" aria-modal="false" aria-labelledby="directory-panel-title" ref={panel} onKeyDown={leavePanel}>
      <div className="directory-popover-heading"><strong id="directory-panel-title">{labels[open]}</strong><span>{open === 'subcategory' ? '单选' : open === 'rules' ? '' : '可多选'}</span><button className="icon-button" aria-label="关闭筛选面板" onClick={() => close(true)}><IconX size={18} /></button></div>
      <div className="directory-popover-body">{panelBody}</div>
    </div>, document.body)}
  </div>;
}
