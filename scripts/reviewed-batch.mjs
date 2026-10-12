// Reviewed local batches only. No fetching, inference, scheduling or deployment.
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateCatalog, isVerifiedMilestone } from '../src/domain/catalog.js';
import { excludedProduct } from '../src/domain/exclusions.js';
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function append(records, incoming, key, label) {
  for (const record of incoming || []) {
    const old = records.find(x => x[key] === record[key]);
    if (old && !equal(old,record)) throw new Error(`${label} conflicts: ${record[key]}`);
    if (!old) records.push(structuredClone(record));
  }
}
export function mergeBatch(original, batch) {
  const inputHash = createHash('sha256').update(JSON.stringify(batch)).digest('hex');
  const previous = original.changeBatches?.find(item => item.batchId === batch.changeBatch?.batchId);
  if (previous) {
    if (previous.inputHash !== inputHash) throw new Error('Batch ID conflicts with a different reviewed input');
    return structuredClone(original);
  }
  const data = structuredClone(original);
  if (batch.excludedProducts) append(data.excludedProducts ||= [],batch.excludedProducts,'id','Excluded product');
  for (const company of batch.companies || []) {
    if (company.role !== 'reference') throw new Error('New companies must remain references');
    append(data.companies,[company],'id','Company');
  }
  for (const patch of batch.companyReviews || []) {
    const company = data.companies.find(c => c.id === patch.companyId);
    if (!company) throw new Error('Unknown company review');
    const review = company.disclosureReview || { checks: [] };
    append(review.checks,patch.review.checks,'id','Company review');
    if (!review.lastAttemptAt || patch.review.lastAttemptAt >= review.lastAttemptAt) Object.assign(review,{lastAttemptAt:patch.review.lastAttemptAt,result:patch.review.result,note:patch.review.note});
    company.disclosureReview = review;
  }
  for (const patch of batch.sources || []) {
    const source = data.sources.find(s=>s.id===patch.id);
    if (!source) { if (excludedProduct(data,patch,'source')) throw new Error('Excluded source cannot be reintroduced'); data.sources.push(structuredClone(patch)); continue; }
    if (source.visibility === 'archived') continue;
    if (Object.keys(patch).some(key=>!['id','lastCheckAttemptAt','verificationNote','verifiedAt','verificationStatus','accessNote','subcategoryIds','categoryIds','entryUrl','entryChangeNote','visibility','visibilityReason'].includes(key))) throw new Error('Source patch only updates reviewed evidence and coverage');
    if (patch.entryUrl && patch.entryUrl !== source.entryUrl && !patch.entryChangeNote) throw new Error('Changed entry requires explanation');
    if (patch.verificationNote && !patch.verificationNote.startsWith(source.verificationNote)) throw new Error('Keep original source evidence');
    if (source.verifiedAt && Object.hasOwn(patch,'verifiedAt') && (!patch.verifiedAt || patch.verifiedAt < source.verifiedAt)) throw new Error('Keep successful source verification');
    Object.assign(source,structuredClone(patch));
  }
  for (const report of batch.reports || []) {
    const old = data.reports.find(r => r.id === report.id);
    if (old?.visibility === 'archived') continue;
    if (report.visibility !== 'archived' && (excludedProduct(data,{...old,...report}) || data.sources.find(s=>s.id===(report.sourceId||old?.sourceId))?.visibility==='archived')) throw new Error('Excluded product cannot be reintroduced');
    const sameUrl = data.reports.find(r => r.id !== report.id && r.url === report.url && !r.duplicateOf);
    if (sameUrl?.visibility === 'archived') continue;
    if (sameUrl && (!report.documentVersion || !sameUrl.documentVersion || sameUrl.documentVersion === report.documentVersion)) throw new Error('Same document needs its original ID or explicit distinct versions');
    if (!old) { data.reports.push(structuredClone(report)); continue; }
    for (const field of ['sourceId','publishedAt','url','originalPublisher','originalUrl']) if (Object.hasOwn(report,field) && !equal(old[field],report[field])) throw new Error(`Historical identity protected: ${field}`);
    if (report.verificationNote && !report.verificationNote.startsWith(old.verificationNote || '')) throw new Error('Keep original verification note');
    if (old.verifiedAt && Object.hasOwn(report,'verifiedAt') && (!report.verifiedAt || report.verifiedAt < old.verifiedAt)) throw new Error('Keep successful verification');
    if (old.financial?.status === 'verified' && Object.hasOwn(report,'financial') && (!report.financial || report.financial.status !== 'verified')) throw new Error('Keep verified financial evidence');
    const links = structuredClone(old.relatedLinks || []);
    append(links,report.relatedLinks,'url','Related evidence');
    Object.assign(old,structuredClone(report));
    if (links.length) old.relatedLinks=links;
  }
  for (const entry of batch.events || []) {
    const { event, nodes = [], nodeEvidence = [], nodeReviews = [], review, current } = entry;
    let old = data.events.find(e => e.id === event.id);
    if (!old) {
      if (data.events.some(e => e.title === event.title && equal(e.companyIds,event.companyIds))) throw new Error('Existing event requires its original ID');
      old = structuredClone(event); data.events.push(old);
    } else {
      for (const key of ['type','companyIds']) if (event[key] && !equal(event[key],old[key])) throw new Error('Event identity change requires separate review');
    }
    for (const node of nodes) {
      if (old.milestones.some(m => m.id !== node.id && m.primaryEvidenceReportId === node.primaryEvidenceReportId)) throw new Error('Same evidence cannot create another business node in event ' + event.id + ': ' + node.primaryEvidenceReportId);
      append(old.milestones,[node],'id','Milestone');
    }
    for (const patch of nodeEvidence) {
      const node = old.milestones.find(n=>n.id===patch.id);
      if (!node) throw new Error('Unknown evidence node');
      for (const ref of patch.evidenceRefs || []) if (!node.evidenceRefs.some(r=>equal(r,ref))) node.evidenceRefs.push(structuredClone(ref));
    }
    for (const patch of nodeReviews) {
      const node=old.milestones.find(n=>n.id===patch.id);
      if (!node || patch.reason !== 'official-supplement' || Object.keys(patch).some(k=>!['id','reason','title','summary','verificationLevel','isProgress'].includes(k))) throw new Error('Node review must supplement existing identity');
      const primary=data.reports.find(r=>r.id===node.primaryEvidenceReportId);
      if (primary?.evidenceLevel !== 'official-body' || !primary.relatedLinks?.some(l=>l.role.includes('指定披露同件'))) throw new Error('Official same-document evidence required');
      const {id,reason,...fields}=patch;Object.assign(node,structuredClone(fields));
    }
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
  if (batch.changeBatch) {
    const { batchId, recordedAt, scope, summary, periodStart, notes = {}, checks = [] } = batch.changeBatch;
    const changes = [];
    const add = (objectType, item, old, kinds, beforeRefs, afterRefs) => changes.push({objectType,objectId:item.id,kinds,beforeRefs,afterRefs,note:notes[item.id] || `${old?'修订':'补入'}：${item.title || item.name}`});
    for (const report of data.reports) {
      const old = original.reports.find(r=>r.id===report.id);
      if (equal(old,report)) continue;
      const evidenceChanged = old && ['verifiedAt','contentScope','verificationNote','relatedLinks','verificationStatus'].some(key=>!equal(old[key],report[key]));
      const informationChanged = old && Object.keys(report).some(key=>!['verifiedAt','contentScope','verificationNote','relatedLinks','verificationStatus','lastCheckAttemptAt'].includes(key) && !equal(old[key],report[key]));
      const kinds = old ? [...(informationChanged?['revision']:[]),...(evidenceChanged?['evidence']:[])] : [report.publishedAt && report.publishedAt >= periodStart ? 'new-record' : 'historical'];
      if (report.financial && !equal(old?.financial,report.financial)) kinds.push('financial');
      if (report.visibility === 'archived' && old?.visibility !== 'archived') kinds.push('archive');
      if (kinds.length) add('report',report,old,kinds,old?[old.id]:[],[report.id]);
    }
    for (const event of data.events || []) {
      const old = original.events?.find(e=>e.id===event.id);
      const newNodes = event.milestones.filter(node=>!old?.milestones.some(n=>n.id===node.id));
      const verifiedNodes = newNodes.filter(node=>isVerifiedMilestone(node,data.reports));
      const changedCurrent = old && ['currentSummary','uncertainties','latestVerifiedMilestoneId'].some(key=>!equal(old[key],event[key]));
      const supplemented = old && !equal(old.milestones,event.milestones) && !newNodes.length;
      if (!newNodes.length && !changedCurrent && !supplemented) continue;
      const kinds = [...(verifiedNodes.length?['event-node']:[]),...(newNodes.some(node=>data.reports.find(r=>r.id===node.primaryEvidenceReportId)?.publishedAt < periodStart)?['historical']:[]),...(newNodes.some(n=>!isVerifiedMilestone(n,data.reports))?['evidence']:[]),...(changedCurrent?['revision']:[])];
      if (supplemented) kinds.push('evidence');
      add('event',event,old,kinds,old?[...new Set(old.milestones.flatMap(n=>n.evidenceRefs.map(r=>r.reportId)))]:[],[...new Set(event.milestones.flatMap(n=>n.evidenceRefs.map(r=>r.reportId)))]);
    }
    for (const source of data.sources) {
      const old = original.sources.find(s=>s.id===source.id);
      if (!equal(old,source)) add('source',source,old,[source.visibility==='archived'&&old?.visibility!=='archived'?'archive':'source'],[],[]);
    }
    const oldChecks = [...(original.changeBatches || []).flatMap(item=>item.checks),...original.companies.flatMap(c=>c.disclosureReview?.checks || []),...(original.events || []).flatMap(e=>e.review.checks)];
    const candidates = [...checks,...(batch.companyReviews || []).flatMap(p=>p.review.checks),...(batch.events || []).flatMap(e=>e.review?.checks || [])];
    const freshChecks = [];
    for (const check of candidates) if (!oldChecks.some(old=>equal(old,check))) append(freshChecks,[check],'id','Batch check');
    if (changes.length || freshChecks.length) data.changeBatches = [...(data.changeBatches || []),{batchId,recordedAt,scope,summary,periodStart,inputHash,previousBatchId:data.changeBatches?.at(-1)?.batchId || null,changes,checks:freshChecks}];
    else if (equal({...data,maintainedAt:original.maintainedAt},original)) return structuredClone(original);
  }
  const errors=validateCatalog(data);
  if(errors.length) throw new Error(errors.join('\n'));
  return data;
}

// One atomic destination replacement only after the whole reviewed batch validates.
export async function applyBatchFile(filename,batch) {
  if (filename instanceof URL) filename=fileURLToPath(filename);
  const before=await readFile(filename,'utf8'), original=JSON.parse(before), next=mergeBatch(original,batch);
  if (equal(original,next)) return {changed:false};
  const temporary=filename+'.pending-'+process.pid;
  try { await writeFile(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx'}); await rename(temporary,filename); }
  finally { await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;}); }
  return {changed:true};
}
