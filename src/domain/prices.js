const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function beijingPriceDate(now = new Date()) {
  return new Date(new Date(now).getTime()+8*60*60*1000).toISOString().slice(0,10);
}
export function priceQuoteState(quote, now = new Date()) {
  const today=beijingPriceDate(now);
  const dateKnown=validDay(quote.quoteDate) && quote.quoteDate<=today;
  const dateStatus=!dateKnown?'unverified':quote.quoteDate<today?'historical':'current';
  const checked=quote.checkedAt && Number.isFinite(Date.parse(quote.checkedAt))
    ? new Date(Date.parse(quote.checkedAt)+8*60*60*1000).toISOString().slice(0,16).replace('T',' ') : null;
  const candidate=quote.comparison;
  const comparison=dateKnown && validDay(candidate?.date) && candidate.date<quote.quoteDate && typeof candidate.basis==='string' && candidate.basis.trim() && typeof candidate.percent==='number' && Number.isFinite(candidate.percent)
    ? {date:candidate.date,basis:candidate.basis,percent:candidate.percent} : null;
  return {dateStatus,dateLabel:dateKnown?quote.quoteDate:'待核实',checkedLabel:checked?`${checked}（北京时间）`:'待核实',comparison};
}
