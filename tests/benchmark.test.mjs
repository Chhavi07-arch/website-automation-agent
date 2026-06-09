/**
 * tests/benchmark.test.mjs
 *
 * Tests for the benchmark evaluation infrastructure (Phase 5). Pure logic with
 * injected fakes — no browser, no network, no LLM.
 *
 * Run: node tests/benchmark.test.mjs
 */

import { BenchmarkRunner, computeMetrics, RESULT, writeJsonReport, writeHtmlReport } from '../src/benchmark/BenchmarkRunner.js';
import { BlockedError } from '../src/utils/errors.js';
import { ensureDir } from '../src/utils/fileHelper.js';
import fs from 'fs';
import path from 'path';
import logger from '../src/utils/logger.js';

const results = [];
const record = (id, pass, note = '') => {
  logger.info(`${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}${note ? ` — ${note}` : ''}`);
  results.push(pass);
};
const silent = { info() {}, warn() {} };

async function main() {
  // --- runGoal: plan success + execute success → SUCCESS ---
  {
    let t = 1000;
    const r = new BenchmarkRunner({
      plan: async () => ({ planned: true, approved: true, score: 100, task: { name: 'x' } }),
      execute: async () => {},
      now: () => (t += 250),
      log: silent,
    });
    const rec = await r.runGoal({ goal: 'g', category: 'c', id: 1 });
    record('1 success path', rec.outcome === RESULT.SUCCESS && rec.executed && rec.executionMs === 250 && rec.reviewScore === 100,
      `outcome=${rec.outcome}, ms=${rec.executionMs}`);
  }

  // --- runGoal: execute throws BlockedError → BLOCKED ---
  {
    const r = new BenchmarkRunner({
      plan: async () => ({ planned: true, approved: true, score: 100, task: { name: 'x' } }),
      execute: async () => { throw new BlockedError('CAPTCHA'); },
      log: silent,
    });
    const rec = await r.runGoal({ goal: 'g' });
    record('2 blocked path', rec.outcome === RESULT.BLOCKED && rec.executed, `outcome=${rec.outcome}`);
  }

  // --- runGoal: execute throws Error → FAILED ---
  {
    const r = new BenchmarkRunner({
      plan: async () => ({ planned: true, approved: true, score: 90, task: { name: 'x' } }),
      execute: async () => { throw new Error('boom'); },
      log: silent,
    });
    const rec = await r.runGoal({ goal: 'g' });
    record('3 failed path', rec.outcome === RESULT.FAILED && rec.error === 'boom', `outcome=${rec.outcome}`);
  }

  // --- runGoal: plan approved=false → PLAN_REJECTED, NOT executed ---
  {
    let executed = false;
    const r = new BenchmarkRunner({
      plan: async () => ({ planned: true, approved: false, score: 45, task: null }),
      execute: async () => { executed = true; },
      log: silent,
    });
    const rec = await r.runGoal({ goal: 'g' });
    record('4 plan rejected', rec.outcome === RESULT.PLAN_REJECTED && !rec.executed && !executed, `outcome=${rec.outcome}`);
  }

  // --- runGoal: plan planned=false → PLAN_FAILED ---
  {
    const r = new BenchmarkRunner({
      plan: async () => ({ planned: false, approved: false, score: 0, task: null, error: 'bad json' }),
      execute: async () => {},
      log: silent,
    });
    const rec = await r.runGoal({ goal: 'g' });
    record('5 plan failed', rec.outcome === RESULT.PLAN_FAILED && !rec.executed && rec.error === 'bad json', `outcome=${rec.outcome}`);
  }

  // --- computeMetrics: known mix → exact rates ---
  {
    const sample = [
      { planned: true, approved: true, reviewScore: 100, executed: true, outcome: RESULT.SUCCESS, executionMs: 100 },
      { planned: true, approved: true, reviewScore: 80,  executed: true, outcome: RESULT.BLOCKED, executionMs: 300 },
      { planned: true, approved: true, reviewScore: 90,  executed: true, outcome: RESULT.FAILED,  executionMs: 200 },
      { planned: true, approved: false, reviewScore: 45, executed: false, outcome: RESULT.PLAN_REJECTED, executionMs: 0 },
      { planned: false, approved: false, reviewScore: 0, executed: false, outcome: RESULT.PLAN_FAILED, executionMs: 0 },
    ];
    const m = computeMetrics(sample);
    const ok =
      m.total === 5 &&
      m.planningSuccessRate === 80 &&            // 4/5
      m.reviewApprovalRate === 75 &&             // 3/4 produced approved
      m.executionSuccessRate === 33.3 &&         // 1/3 executed succeeded
      m.avgReviewScore === 78.8 &&               // mean over PLANNED only: (100+80+90+45)/4
      m.avgExecutionMs === 200;                  // (100+300+200)/3
    record('6 computeMetrics', ok,
      `plan=${m.planningSuccessRate} review=${m.reviewApprovalRate} exec=${m.executionSuccessRate} avgScore=${m.avgReviewScore} avgMs=${m.avgExecutionMs}`);
  }

  // --- report writers produce files ---
  {
    const tmp = path.resolve('reports', '_bench_test');
    ensureDir(tmp);
    const payload = { generatedAt: 'now', plannerMode: 'mock', model: 'mock', metrics: computeMetrics([]), results: [] };
    const j = writeJsonReport(path.join(tmp, 'b.json'), payload);
    const h = writeHtmlReport(path.join(tmp, 'b.html'), payload);
    const ok = fs.existsSync(j) && fs.existsSync(h) && fs.readFileSync(h, 'utf8').includes('Planner Benchmark Report');
    record('7 report writers', ok, `json+html written`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  logger.info('\n========== BENCHMARK SUMMARY ==========');
  const allPass = results.every(Boolean);
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
