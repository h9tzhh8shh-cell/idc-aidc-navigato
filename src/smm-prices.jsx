import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { IconArrowDown, IconArrowRight, IconArrowUp, IconArrowUpRight, IconChartBar, IconChevronDown, IconX } from '@tabler/icons-react';
import prices from '../public/assets/smm-prices.json';
import './smm-prices.css';

export const smmPriceReportId = prices.reportId;

function PriceRange({ quote, scale }) {
  const x = value => 18 + (value - scale[0]) / (scale[1] - scale[0]) * 344;
  const ticks = Array.from({ length: 4 }, (_, i) => scale[0] + i);
  return <svg className="smm-range" viewBox="0 0 380 70" role="img" aria-label={`价格区间 ${quote.low.toFixed(2)} 至 ${quote.high.toFixed(2)}，均价 ${quote.mean.toFixed(2)} 元每卡时`}>
    <line className="smm-axis" x1="18" x2="362" y1="35" y2="35" />
    {ticks.map(value => <g key={value}><line className="smm-axis" x1={x(value)} x2={x(value)} y1="30" y2="40" /><text className="smm-tick" x={x(value)} y="59">{value}</text></g>)}
    <line className="smm-interval" x1={x(quote.low)} x2={x(quote.high)} y1="35" y2="35" />
    <circle className="smm-mean-dot" cx={x(quote.mean)} cy="35" r="5.5" />
    {[quote.low, quote.mean, quote.high].map((value, i) => <text className="smm-point-label" key={i} x={x(value)} y="17">{value.toFixed(2)}</text>)}
  </svg>;
}

function PriceBoard({ titleId, onClose }) {
  return <>
    <header className="smm-board-header"><div><h3 id={titleId}><IconChartBar size={23} aria-hidden="true" />SMM 算力租赁价格</h3><p>来源：SMM<span>来源更新：{prices.sourceCadence}</span></p></div><div className="smm-board-actions"><a href={prices.sourceUrl} target="_blank" rel="noopener noreferrer">访问原站<IconArrowUpRight size={17} aria-hidden="true" /></a><button className="icon-button" aria-label="关闭算力行情看板" onClick={onClose}><IconX size={19} /></button></div></header>
    <div className="smm-groups">{prices.groups.map(group => <section className="smm-group" key={group.model} aria-label={group.model}>
      <div className="smm-group-heading"><h4>{group.model}</h4><span className={`smm-price-type ${group.type === '零售价' ? 'retail' : ''}`}>{group.type}</span></div>
      {group.quotes.map(quote => {
        const ChangeIcon = quote.change < 0 ? IconArrowDown : quote.change > 0 ? IconArrowUp : IconArrowRight;
        return <div className={`smm-quote ${quote.change < 0 ? 'is-down' : ''}`} key={quote.label}>
          <div className="smm-quote-heading"><span>{quote.label}</span><span className={`smm-change ${quote.change < 0 ? 'down' : quote.change > 0 ? 'up' : ''}`} aria-label={`涨跌幅 ${quote.change.toFixed(2)}%`}><ChangeIcon size={16} aria-hidden="true" />{Math.abs(quote.change).toFixed(2)}%</span></div>
          <p className="smm-price"><strong>{quote.mean.toFixed(2)}</strong><span>元/卡·时</span></p>
          <PriceRange quote={quote} scale={group.scale} />
        </div>;
      })}
      <div className="smm-legend"><span>圆点：均价</span><span>蓝条：价格区间</span><span>单位：元/卡·时</span></div>
    </section>)}</div>
  </>;
}

export function SmmPricePreview() {
  const id = useId();
  const root = useRef(null), trigger = useRef(null), panel = useRef(null);
  const timer = useRef(null), openTimer = useRef(null), pinned = useRef(false), restoringFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const cancelClose = () => clearTimeout(timer.current);
  const cancelOpen = () => clearTimeout(openTimer.current);
  const show = () => {
    cancelOpen(); cancelClose();
    if (panel.current.matches(':popover-open')) return;
    restoringFocus.current = true;
    panel.current.showPopover();
    restoringFocus.current = false;
    setOpen(true);
  };
  const close = (restoreFocus = false) => {
    cancelOpen(); cancelClose(); pinned.current = false; restoringFocus.current = true;
    panel.current.hidePopover(); setOpen(false);
    if (restoreFocus) trigger.current.focus({ preventScroll: true });
    restoringFocus.current = false;
  };
  const scheduleClose = () => {
    cancelOpen(); cancelClose();
    if (!pinned.current) timer.current = setTimeout(() => close(), 180);
  };
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(openTimer.current); }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current.getBoundingClientRect(), box = panel.current.getBoundingClientRect();
      const left = Math.max(16, Math.min(anchor.right - box.width, window.innerWidth - box.width - 16));
      const top = anchor.bottom + 8 + box.height <= window.innerHeight - 16 ? anchor.bottom + 8
        : anchor.top - 8 - box.height >= 16 ? anchor.top - 8 - box.height
        : Math.max(16, (window.innerHeight - box.height) / 2);
      Object.assign(panel.current.style, { left: `${left}px`, top: `${top}px` });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  return <div className="smm-preview" ref={root}
    onPointerEnter={event => { if (event.pointerType === 'mouse') { cancelClose(); cancelOpen(); if (!panel.current.matches(':popover-open')) openTimer.current = setTimeout(show, 500); } }} onPointerLeave={scheduleClose}
    onFocus={() => { if (!restoringFocus.current) show(); }}
    onBlur={event => { if (!root.current.contains(event.relatedTarget)) { pinned.current = false; scheduleClose(); } }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } }}>
    <button ref={trigger} className="smm-preview-trigger" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => { if (pinned.current) close(); else { pinned.current = true; show(); } }}>
      <IconChartBar size={21} aria-hidden="true" /><span><strong>SMM 算力行情</strong><small>H100 / 4090 · 价格与区间</small></span><span className="smm-hover-label">悬停查看</span><span className="smm-touch-label">查看看板</span><IconChevronDown size={16} aria-hidden="true" />
    </button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className="smm-popover"
      onBeforeToggle={() => { restoringFocus.current = true; }}
      onToggle={event => { restoringFocus.current = false; const visible = event.newState === 'open'; setOpen(visible); if (!visible) pinned.current = false; }}
      onPointerEnter={cancelClose} onPointerLeave={scheduleClose}>
      <PriceBoard titleId={`${id}-title`} onClose={() => close(true)} />
    </div>
  </div>;
}
