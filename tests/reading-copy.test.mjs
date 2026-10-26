import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/assets/catalog.json' with {type:'json'};
import { validateCatalog } from '../src/domain/catalog.js';
import { briefReading, briefReadingMarkdown, briefSummaryText } from '../src/domain/brief-reading.js';

test('all saved reports and copied summaries omit collection disclaimers while retaining dated sources',()=>{
  const removed=/仅供参考|不构成.{0,12}建议|取得范围|成功核查|未补齐建议篇幅|零条不代表|本次未|本轮未|未独立核实|核查快照/;
  for(const issue of data.discovery.issues){
    const model=briefReading(issue,data),markdown=briefReadingMarkdown(model),summary=briefSummaryText(model);
    assert.doesNotMatch(markdown,removed,issue.id);
    assert.doesNotMatch(summary,removed,issue.id);
    assert.ok(markdown.includes(model.dateLabel));
    for(const ref of model.references)assert.ok(markdown.includes(ref.url));
  }
});

test('financial and discovery entries do not require defensive filler fields',()=>{
  assert.deepEqual(validateCatalog(data),[]);
  for(const report of data.reports.filter(r=>r.financial))assert.equal(report.financial.limitations,undefined);
  for(const company of data.companies.filter(c=>c.discoveryProfile))assert.equal(company.discoveryProfile.financialNote,undefined);
  const hongjing=data.reports.find(r=>r.id==='hongjing-2026-q3').financial;
  assert.equal(hongjing.revenue.priorValue,1021460726.78);
  assert.match(hongjing.operatingChange,/会计差错更正/);
  const event=data.events.find(e=>e.id==='hec-chindata-listed-reorganization');
  assert.ok(!event.milestones.some(n=>n.id==='newer-attachment-pending'));
  assert.equal(event.latestVerifiedMilestoneId,'antitrust-mirror-read');
  assert.match(event.currentSummary,/尚需上交所审核及证监会同意注册/);
  assert.equal(data.reports.find(r=>r.id==='hec-reorganization-newer-attachment-pending').visibility,'archived');
});
