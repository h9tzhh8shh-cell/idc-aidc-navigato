// Export the same canonical reports used by the local reader.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { availableIssues, beijingTimestamp } from '../src/domain/discovery.js';
import { briefReading, briefReadingMarkdown } from '../src/domain/brief-reading.js';

const output = process.argv[2];
if (!output) throw new Error('用法：node scripts/export-briefs.mjs 输出目录 [YYYY-MM-DD]');
const asOf = process.argv[3] || beijingTimestamp().slice(0, 10);
const data = JSON.parse(await readFile(new URL('../public/assets/catalog.json', import.meta.url), 'utf8'));
await mkdir(output, { recursive: true });
for (const kind of ['daily', 'weekly']) {
  const issue = availableIssues(data.discovery.issues, kind, asOf)[0];
  if (!issue) continue;
  const filename = kind === 'daily' ? `每日快报-${issue.date}.md` : `行业周报-${issue.periodStart}至${issue.periodEnd}.md`;
  await writeFile(resolve(output, filename), briefReadingMarkdown(briefReading(issue, data)), 'utf8');
  console.log(filename);
}
