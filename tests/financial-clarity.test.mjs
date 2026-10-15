import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {amount,changeText,latestFinancial} from '../src/domain/financial.js';

test('亏损变化按可比原值区分扩大、收窄及盈亏转换',()=>{
  const sample=latestFinancial(data,'capitalonline').report.financial.profit;
  for(const [value,priorValue,label] of [[-20,-10,'亏损扩大'],[-5,-10,'亏损收窄'],[-10,-10,'亏损持平'],[5,-10,'扭亏为盈'],[-5,10,'由盈转亏'],[0,-10,'亏损收窄至零']]) {
    assert.equal(changeText({...sample,value,priorValue}),label);
  }
});

test('零基数不被描述为由盈转亏或扭亏为盈',()=>{
  const sample=latestFinancial(data,'capitalonline').report.financial.profit;
  assert.equal(changeText({...sample,value:-10,priorValue:0}),'由盈亏平衡转为亏损（上年同期为零）');
  assert.equal(changeText({...sample,value:10,priorValue:0}),'本期金额增加（上年同期为零）');
  assert.equal(changeText({...sample,value:0,priorValue:0}),'本期及上年同期均为零');
});

test('已收录亏损公司的两期展示保持金额符号、单位和币种',()=>{
  const capital=latestFinancial(data,'capitalonline').report.financial.profit;
  const nexwise=latestFinancial(data,'nexwise').report.financial.profit;
  assert.equal(amount(capital),'-3,218.50万元人民币');
  assert.equal(amount(capital,capital.priorValue),'-7,095.93万元人民币');
  assert.equal(amount(nexwise),'-326.10万元人民币');
  assert.equal(amount(nexwise,nexwise.priorValue),'1,872.80万元人民币');
  for(const metric of [capital,nexwise])assert.equal(metric.change.percent,null);
});

test('正金额持平不会被标为增长',()=>{
  const sample=latestFinancial(data,'aofei').report.financial.revenue;
  assert.equal(changeText({...sample,value:100,priorValue:100,change:{...sample.change,percent:0}}),'同比持平');
});
