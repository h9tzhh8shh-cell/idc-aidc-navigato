// Usage: node scripts/discovery-update.mjs path/to/reviewed-batch.json
// This is a local import, not a search service or scheduler.
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mergeBatch } from './reviewed-batch.mjs';
import { validateCatalog } from '../src/domain/catalog.js';
import { generateIssue, saveIssue, discoveryEligibleReport } from '../src/domain/discovery.js';

export function mergeDiscoveryBatch(original, input) {
  if (!input.changeBatch || !input.discovery) throw new Error('需要已核批次及发现说明');
  const next = mergeBatch(original, input);
  if (original.changeBatches?.some(batch => batch.batchId === input.changeBatch.batchId)) return next;
  const identity = value => value.trim().toLocaleLowerCase();
  for (const company of next.companies.filter(company => !original.companies.some(old => old.id === company.id))) {
    if (next.companies.some(other => other.id !== company.id && [other.legalName, other.name, ...other.aliases].some(name => identity(name) === identity(company.legalName)))) throw new Error(`企业已存在，须复核并沿用原 ID：${company.legalName}`);
  }
  const articleUrls = new Set();
  for (const report of next.reports.filter(report => report.kind === 'news' && !report.duplicateOf)) {
    const articleUrl = `${report.originalUrl || report.url}|${report.documentVersion || ''}`;
    if (articleUrls.has(articleUrl)) throw new Error(`同一原文不可重复收录：${articleUrl}`);
    articleUrls.add(articleUrl);
  }
  next.discovery ||= {
    baselineCompanyIds: original.companies.map(company => company.id),
    fixedMediaSourceIds: original.sources.filter(source => source.sourceType === 'media').map(source => source.id),
    batches: [], issues: [],
  };
  const companyIds = next.companies.filter(company => !original.companies.some(old => old.id === company.id)).map(company => company.id);
  const reportIds = next.reports.filter(report => !original.reports.some(old => old.id === report.id) &&
    discoveryEligibleReport(next, report, input.maintainedAt)).map(report => report.id);
  next.discovery.batches.push({ batchId: input.changeBatch.batchId, cutoffAt: input.changeBatch.recordedAt,
    companyIds, reportIds, highlightReportIds: input.discovery.highlightReportIds || [], note: input.discovery.note });
  for (const request of input.discovery.issueRequests || []) {
    next.discovery.issues = saveIssue(next.discovery.issues, generateIssue(next, { weekPolicy: input.discovery.weekPolicy || 'containing', weeklyFormat: input.discovery.weeklyFormat || 'legacy', ...request, batchId: input.changeBatch.batchId, generatedAt: input.discovery.generatedAt }));
  }
  const errors = validateCatalog(next);
  if (errors.length) throw new Error(errors.join('\n'));
  return next;
}
export async function applyDiscoveryFile(filename, input) {
  const original = JSON.parse(await readFile(filename, 'utf8'));
  const next = mergeDiscoveryBatch(original, input);
  if (JSON.stringify(next) === JSON.stringify(original)) return { changed: false };
  const temporary = filename + '.discovery-pending-' + process.pid;
  try { await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, filename); }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return { changed: true, batch: input.changeBatch.batchId, companies: next.discovery.batches.at(-1).companyIds.length, reports: next.discovery.batches.at(-1).reportIds.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('用法：node scripts/discovery-update.mjs 已核批次.json');
    const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
    console.log(JSON.stringify(await applyDiscoveryFile(fileURLToPath(new URL('../public/assets/catalog.json', import.meta.url)), input)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
