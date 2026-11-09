// Local maintenance checks. Use the existing catalog, tests, build and export entry points.
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, open, readFile, realpath, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeBatch } from './reviewed-batch.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const catalog = join(repo, 'public/assets/catalog.json');
const vite = join(repo, 'node_modules/vite/bin/vite.js');
const readJson = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));

async function checkCandidate(input, baseline = catalog) {
  const [batch, before] = await Promise.all([readJson(input), readJson(baseline)]);
  const oldReports = new Map(before.reports.map(report => [report.id, report]));
  const wrongRegions = (batch.reports || []).filter(report =>
    report.regions?.includes('印度尼西亚') &&
    JSON.stringify(report.regions) !== JSON.stringify(oldReports.get(report.id)?.regions));
  if (wrongRegions.length) {
    throw new Error('地区标签请使用“印尼”：' + wrongRegions.map(report => report.id).join(', '));
  }
  mergeBatch(before, batch);
  return { status: 'pass', input: resolve(input), reports: (batch.reports || []).length };
}

async function roundDirectory(path) {
  await mkdir(path, { recursive: true });
  return realpath(path);
}

async function preflight(path) {
  await access(vite);
  const round = await roundDirectory(path);
  const probe = await mkdtemp(join(round, 'update-probe-'));
  const original = join(probe, 'original');
  const replacement = join(probe, 'replacement');
  try {
    await writeFile(original, 'before');
    await writeFile(replacement, 'after');
    await rename(replacement, original);
    if (await readFile(original, 'utf8') !== 'after') throw new Error('工作目录内替换文件失败');
  } finally {
    await rm(original, { force: true });
    await rm(replacement, { force: true });
    await rmdir(probe);
  }
  return { status: 'pass', round };
}

async function runCheck(logDir, name, args, env = process.env) {
  const log = join(logDir, name + '.log');
  const startedAt = new Date();
  const file = await open(log, 'wx');
  let code = 1;
  try {
    code = await new Promise((done, fail) => {
      const child = spawn(process.execPath, args, {
        cwd: repo, env, windowsHide: true, stdio: ['ignore', file.fd, file.fd],
      });
      child.once('error', fail);
      child.once('close', exitCode => done(exitCode ?? 1));
    });
  } catch (error) {
    await file.writeFile(String(error) + '\n');
  } finally {
    await file.close();
  }
  const finishedAt = new Date();
  return { code, startedAt, finishedAt, elapsedMs: finishedAt - startedAt, log };
}

async function verify(path, day) {
  const round = await roundDirectory(path);
  const logDir = await mkdtemp(join(round, '验收-'));
  const testTemp = await mkdtemp(join(logDir, 'test-tmp-'));
  const testEnv = { ...process.env, TEMP: testTemp, TMP: testTemp, TMPDIR: testTemp };
  const tasks = [
    ['data', ['scripts/validate-data.mjs']],
    ['tests', ['--test', '--test-isolation=none', 'tests/*.test.mjs'], testEnv],
    ['build', [vite, 'build']],
    ['export', ['scripts/export-briefs.mjs', join(round, '导出稿'), day]],
  ];
  const entries = await Promise.all(tasks.map(async ([name, args, env]) =>
    [name, await runCheck(logDir, name, args, env)]));
  const checks = Object.fromEntries(entries);
  const status = entries.every(([, check]) => check.code === 0) ? 'pass' : 'fail';
  const receipt = join(logDir, 'summary.json');
  await writeFile(receipt, JSON.stringify({ status, day, checks }, null, 2) + '\n');
  if (checks.tests.code === 0) {
    const target = await realpath(testTemp);
    if (dirname(target) !== await realpath(logDir)) throw new Error('测试临时目录路径已变更');
    await rm(target, { recursive: true });
  }
  return { status, receipt, checks: Object.fromEntries(entries.map(([name, check]) =>
    [name, { code: check.code, elapsedMs: check.elapsedMs }])) };
}

const [mode, path, detail] = process.argv.slice(2);
try {
  let result;
  if (mode === 'preflight' && path) result = await preflight(path);
  else if (mode === 'candidate' && path) result = await checkCandidate(path, detail);
  else if (mode === 'verify' && path && /^\d{4}-\d{2}-\d{2}$/.test(detail || '')) {
    result = await verify(path, detail);
  } else {
    throw new Error('用法：update-checks.mjs preflight <本轮目录> | candidate <候选文件> [基线] | verify <本轮目录> <YYYY-MM-DD>');
  }
  console.log(JSON.stringify(result));
  if (result.status !== 'pass') process.exitCode = 1;
} catch (error) {
  console.error(String(error.message).split('\n').slice(0, 8).join('\n'));
  process.exitCode = 1;
}
