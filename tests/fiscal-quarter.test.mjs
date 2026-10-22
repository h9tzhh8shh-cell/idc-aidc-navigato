import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import {validateFinancial} from '../src/domain/financial.js';

const fixture=()=>{
  const report=structuredClone(data.reports.find(r=>r.financial?.status==='verified'));
  report.publishedAt='2026-07-24';
  report.financial.period={label:'2026财年第二季度｜13周',type:'quarter',basis:'13-weeks',start:'2026-03-29',end:'2026-06-27',priorStart:'2025-03-30',priorEnd:'2025-06-28'};
  return report;
};
test('13-week fiscal quarters preserve actual dates and comparable prior quarter',()=>{
  const r=fixture();
  assert.deepEqual(validateFinancial(r.financial,r,'2026-10-22'),[]);
  delete r.financial.period.basis;
  assert.ok(validateFinancial(r.financial,r,'2026-10-22').some(e=>e.includes('期间不一致')));
});
test('fiscal quarters reject unequal lengths and non-comparable prior periods',()=>{
  for(const patch of [{end:'2026-06-30'},{priorStart:'2025-03-29'},{priorStart:'2024-03-31',priorEnd:'2024-06-29'},{type:'half-year'}]){
    const r=fixture();Object.assign(r.financial.period,patch);
    assert.ok(validateFinancial(r.financial,r,'2026-10-22').length,JSON.stringify(patch));
  }
});
