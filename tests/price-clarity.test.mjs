import test from 'node:test';
import assert from 'node:assert/strict';
import prices from '../public/assets/smm-prices.json' with {type:'json'};
import {beijingPriceDate,priceQuoteState} from '../src/domain/prices.js';

const now='2026-10-15T06:30:00.000Z';
const quote={quoteDate:'2026-10-15',checkedAt:'2026-10-15T06:24:39.687Z',sourceChange:{percent:0},comparison:null};

test('来源显示0%但缺比较日时不将其作为可比涨跌幅',()=>{
  for(const comparison of [null,{percent:0,basis:'上一报价日'},{date:'2026-10-14',percent:0}]) {
    assert.equal(priceQuoteState({...quote,comparison},now).comparison,null);
  }
});
test('比较日期与依据明确时保留0%及正负涨跌幅',()=>{
  for(const percent of [0,2.5,-3.7]) {
    const comparison={date:'2026-10-14',basis:'同口径报价',percent};
    assert.deepEqual(priceQuoteState({...quote,comparison},now).comparison,comparison);
  }
  for(const date of ['2026-10-15','2026-10-16','2026-02-30']) {
    assert.equal(priceQuoteState({...quote,comparison:{date,percent:0,basis:'同口径报价'}},now).comparison,null);
  }
});
test('历史快照依据报价日期，不以最近核对时间替代',()=>{
  const state=priceQuoteState({...quote,quoteDate:'2026-10-14'},now);
  assert.equal(state.dateStatus,'historical');
  assert.equal(state.dateLabel,'2026-10-14');
  assert.equal(state.checkedLabel,'2026-10-15 14:24（北京时间）');
});
test('未知与无效报价日期保留待核实，不能推算为核对日期',()=>{
  for(const quoteDate of [null,undefined,'','10-15','2026-02-30','2026-10-16']) {
    const state=priceQuoteState({...quote,quoteDate},now);
    assert.equal(state.dateStatus,'unverified');
    assert.equal(state.dateLabel,'待核实');
    assert.equal(state.comparison,null);
  }
});
test('北京时间跨日后当天报价自动变为历史快照',()=>{
  assert.equal(beijingPriceDate('2026-10-15T15:59:59Z'),'2026-10-15');
  assert.equal(beijingPriceDate('2026-10-15T16:00:00Z'),'2026-10-16');
  assert.equal(priceQuoteState(quote,'2026-10-15T15:59:59Z').dateStatus,'current');
  assert.equal(priceQuoteState(quote,'2026-10-15T16:00:00Z').dateStatus,'historical');
});
test('四组人工核对报价各自保存报价日、核对时间及来源证据',()=>{
  const quotes=prices.groups.flatMap(group=>group.quotes);
  assert.equal(quotes.length,4);
  assert.deepEqual(quotes.map(item=>[item.mean,item.low,item.high]),[[14.32,13.54,15.1],[14.06,13.54,14.58],[1.9,1.38,2.29],[1.95,1.48,3.6]]);
  for(const item of quotes) {
    const percent=item.productCode==='SMM-GPU-CC-021'?-14.85:0;
    assert.equal(item.quoteDate,'2026-10-21');
    assert.match(item.checkedAt,/^2026-10-22T/);
    assert.equal(item.sourceChange.percent,percent);
    assert.deepEqual(item.comparison,{date:'2026-10-20',basis:'已核同口径均价',percent});
    assert.equal(item.sourceUrl,'https://aidc.smm.cn/price');
    assert.equal(item.unit,'元/卡·时');
    assert.deepEqual(priceQuoteState(item,'2026-10-22T01:30:00Z').comparison,item.comparison);
  }
});
