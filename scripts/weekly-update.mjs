import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { generateIssue, saveIssue } from '../src/domain/discovery.js';
import { validateCatalog } from '../src/domain/catalog.js';

export function mergeWeeklyReview(data, input) {
  const issue = generateIssue(data, { kind: 'weekly', date: input.requestedDate, generatedAt: input.generatedAt, weeklyReview: input });
  const previous = data.discovery.issues.find(item => item.id === issue.id);
  if (previous && JSON.stringify(previous) !== JSON.stringify(issue)) throw new Error('同一版本内容不同，请使用新的生成时间');
  const next = { ...data, discovery: { ...data.discovery, issues: saveIssue(data.discovery.issues, issue) } };
  const errors = validateCatalog(next);
  if (errors.length) throw new Error(errors.join('\n'));
  return next;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filename = new URL('../public/assets/catalog.json', import.meta.url);
  const data = JSON.parse(await readFile(filename, 'utf8'));
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const next = mergeWeeklyReview(data, input), temporary = new URL(filename.href + '.weekly-pending-' + process.pid);
  if (next.discovery.issues !== data.discovery.issues) {
    try { await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, filename); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  console.log(JSON.stringify({ issue: next.discovery.issues.at(-1).id, sources: next.discovery.issues.at(-1).reportIds.length }));
}
