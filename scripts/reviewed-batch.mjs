// Reviewed local batches only. No fetching, inference, scheduling or deployment.
import { validateCatalog } from '../src/domain/catalog.js';
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function append(records, incoming, key, label) {
  for (const record of incoming || []) {
    const old = records.find(x => x[key] === record[key]);
    if (old && !equal(old,record)) throw new Error(`${label} conflicts: ${record[key]}`);
    if (!old) records.push(structuredClone(record));
  }
}
export function mergeBatch(original, batch) {
  const data = structuredClone(original);
  for (const report of batch.reports || []) {
    const old = data.reports.find(r => r.id === report.id);
    if (old?.visibility === 'archived' || data.sources.find(s => s.id === (report.sourceId || old?.sourceId))?.visibility === 'archived') continue;
    const sameUrl = data.reports.find(r => r.id !== report.id && r.url === report.url && !r.duplicateOf);
    if (sameUrl?.visibility === 'archived') continue;
    if (sameUrl && (!report.documentVersion || !sameUrl.documentVersion || sameUrl.documentVersion === report.documentVersion)) throw new Error('Same document needs its original ID or explicit distinct versions');
    if (!old) { data.reports.push(structuredClone(report)); continue; }
    for (const field of ['sourceId','publishedAt','url','originalPublisher','originalUrl']) if (Object.hasOwn(report,field) && !equal(old[field],report[field])) throw new Error(`Historical identity protected: ${field}`);
    if (report.verificationNote && !report.verificationNote.startsWith(old.verificationNote || '')) throw new Error('Keep original verification note');
    if (old.verifiedAt && Object.hasOwn(report,'verifiedAt') && (!report.verifiedAt || report.verifiedAt < old.verifiedAt)) throw new Error('Keep successful verification');
    const links = structuredClone(old.relatedLinks || []);
    append(links,report.relatedLinks,'url','Related evidence');
    Object.assign(old,structuredClone(report));
    if (links.length) old.relatedLinks=links;
  }
  for (const entry of batch.events || []) {
    const { event, nodes = [], review, current } = entry;
    let old = data.events.find(e => e.id === event.id);
    if (!old) {
      if (data.events.some(e => e.title === event.title && equal(e.companyIds,event.companyIds))) throw new Error('Existing event requires its original ID');
      old = structuredClone(event); data.events.push(old);
    } else {
      for (const key of ['type','companyIds']) if (event[key] && !equal(event[key],old[key])) throw new Error('Event identity change requires separate review');
    }
    for (const node of nodes) {
      if (old.milestones.some(m => m.id !== node.id && m.primaryEvidenceReportId === node.primaryEvidenceReportId)) throw new Error('Same evidence cannot create another business node');
    }
    append(old.milestones,nodes,'id','Milestone');
    if (review) {
      append(old.review.checks,review.checks,'id','Review attempt');
      if (!old.review.lastAttemptAt || review.lastAttemptAt >= old.review.lastAttemptAt) Object.assign(old.review,{lastAttemptAt:review.lastAttemptAt,result:review.result,note:review.note});
    }
    if (current) {
      if (Object.keys(current).some(key=>!['reason','currentSummary','latestVerifiedMilestoneId','basisMilestoneIds','uncertainties'].includes(key))) throw new Error('Current patch cannot change event identity or history');
      if (!['progress','correction','withdrawal'].includes(current.reason)) throw new Error('Explicit reviewed reason required');
      if (review && ['blocked','conflict','no-new','not-checked'].includes(review.result)) throw new Error('Failed or non-progress review cannot replace current facts');
      if (current.reason !== 'correction' && !old.milestones.some(m=>m.id===current.latestVerifiedMilestoneId)) throw new Error('Current needs an existing evidence node');
      const { reason, ...patch } = current; Object.assign(old,structuredClone(patch));
    }
  }
  if (batch.maintainedAt) data.maintainedAt=batch.maintainedAt;
  const errors=validateCatalog(data);
  if(errors.length) throw new Error(errors.join('\n'));
  return data;
}
