const units = { 元: 1, 千元: 1000, 万元: 10000, 百万元: 1000000, 亿元: 100000000 };
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value);
export function validateFinancial(f, report, today) {
  const errors = [], fail = message => errors.push(`reports.${report.id}.financial: ${message}`);
  const keys = (value, allowed, name) => { if (!object(value)) { fail(`${name} 必须为对象`); return false; } for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name} 未知字段 ${key}`); return true; };
  const text = (value, name) => { if (typeof value !== 'string' || !value.trim()) fail(`${name} 必须有明确说明`); };
  if (!keys(f,['companyId','status','statementBasis','period','revenue','profit','evidence','limitations','operatingChange'],'financial')) return errors;
  if (f.statementBasis !== 'actual-results') fail('财务指标仅允许正式实际业绩，不能以预告或预测替代');
  if (!report.companyIds?.includes(f.companyId) || report.kind !== 'disclosure') fail('必须关联本公司的正式披露资料');
  if (!['verified','pending'].includes(f.status)) fail('status 无效');
  text(f.limitations,'limitations');
  const p=f.period;
  if (keys(p,['label','start','end','type','priorStart','priorEnd'],'period')) {
    text(p.label,'period.label');
    if (!['quarter','half-year','nine-months','annual'].includes(p.type)) fail('period.type 无效');
    if (!day(p.start)||!day(p.end)||p.start>p.end||p.end>today) fail('报告期日期无效');
    const months={quarter:3,'half-year':6,'nine-months':9,annual:12}[p.type];
    if (months&&day(p.start)&&day(p.end)) { const end=new Date(p.start);end.setUTCMonth(end.getUTCMonth()+months);end.setUTCDate(end.getUTCDate()-1);if(end.toISOString().slice(0,10)!==p.end)fail('单季/累计/全年与期间不一致'); }
    if (report.publishedAt && p.end > report.publishedAt) fail('实际业绩不得早于报告期结束披露');
    if (f.status==='verified' && (!day(p.priorStart)||!day(p.priorEnd)||Number(p.start?.slice(0,4))-Number(p.priorStart?.slice(0,4))!==1||p.start?.slice(4)!==p.priorStart?.slice(4)||Number(p.end?.slice(0,4))-Number(p.priorEnd?.slice(0,4))!==1||p.end?.slice(4)!==p.priorEnd?.slice(4))) fail('必须使用同口径上年同期');
  }
  if (keys(f.evidence,['url','locator'],'evidence')) {
    try { if(new URL(f.evidence.url).protocol!=='https:') fail('依据必须为 HTTPS'); } catch { fail('依据 URL 无效'); }
    text(f.evidence.locator,'evidence.locator');
    if (![report.url,report.originalUrl,...(report.relatedLinks||[]).map(x=>x.url)].includes(f.evidence.url)) fail('财务依据须为本资料或已关联同件');
  }
  if (f.status==='pending') { if(f.revenue||f.profit)fail('待核报告不能填指标'); return errors; }
  if (!report.verifiedAt || !['full','partial','abstract'].includes(report.contentScope)) fail('指标需要已取得的正式实际业绩正文或公开摘要');
  for(const key of ['revenue','profit']) {
    const m=f[key];if(!keys(m,['label','value','priorValue','currency','unit','attribution','change'],'metric'))continue;
    for(const k of ['label','attribution'])text(m[k],key+'.'+k);
    if(!number(m.value)||!number(m.priorValue))fail(`${key} 原值和上期值须为有限数字，未知不能填零`);
    if(!units[m.unit]||!['CNY','USD','HKD','SGD','MYR','EUR'].includes(m.currency))fail(`${key} 币种或单位无效`);
    if(key==='revenue'&&(m.value<0||m.priorValue<0))fail('营业收入不得为负');
    const c=m.change;if(!keys(c,['basis','percent','note'],'change'))continue;
    if(!['reported','calculated','amount'].includes(c.basis))fail('同比依据无效');text(c.note,'change.note');
    if(m.priorValue<=0||m.value<0) { if(c.percent!==null||c.basis!=='amount')fail('零基数/亏损须按金额表达盈亏变化'); }
    else if(c.basis==='amount') { if(c.percent!==null)fail('金额变化不能带百分比'); }
    else if(!number(c.percent)||Math.abs(c.percent-(m.value-m.priorValue)/m.priorValue*100)>.11)fail('同比与可比原值不符');
  }
  if (f.operatingChange!==undefined)text(f.operatingChange,'operatingChange');
  return errors;
}
export function amount(metric,value=metric.value) {
  const raw=value*units[metric.unit], currency={CNY:'人民币',USD:'美元',HKD:'港元',SGD:'新加坡元',MYR:'林吉特',EUR:'欧元'}[metric.currency];
  return `${(Math.abs(raw)>=1e8?raw/1e8:raw/1e4).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}${Math.abs(raw)>=1e8?'亿':'万'}${metric.currency==='CNY'?'元人民币':currency}`;
}
export function changeText(m) {
  const a=m.value,b=m.priorValue;
  if(b===0)return a===0?'本期及上年同期均为零':a<0?'由盈亏平衡转为亏损（上年同期为零）':'本期金额增加（上年同期为零）';
  if(b<0&&a>=0)return a===0?'亏损收窄至零':'扭亏为盈';
  if(b>=0&&a<0)return '由盈转亏';
  if(b<0&&a<0)return a>b?'亏损收窄':a<b?'亏损扩大':'亏损持平';
  if(m.change.percent===null)return m.change.note;
  if(m.change.percent===0)return '同比持平';
  return `同比${m.change.percent>=0?'增长':'下降'}${Math.abs(m.change.percent).toFixed(2)}%${m.change.basis==='calculated'?'（计算值）':''}`;
}
export function latestFinancial(data,companyId) {
  const reports=data.reports.filter(r=>r.visibility!=='archived'&&!r.duplicateOf&&r.financial?.companyId===companyId).sort((a,b)=>b.financial.period.end.localeCompare(a.financial.period.end)||(b.publishedAt||'').localeCompare(a.publishedAt||'')||a.id.localeCompare(b.id));
  const verified=reports.find(r=>r.financial.status==='verified');
  return {report:verified,pending:reports.filter(r=>r.financial.status==='pending'&&(!verified||r.financial.period.end>=verified.financial.period.end))};
}
