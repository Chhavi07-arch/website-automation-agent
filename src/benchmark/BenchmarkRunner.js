/**
 * BenchmarkRunner.js
 *
 * Evaluation infrastructure — measures planner quality objectively. It does NOT
 * change the planner or execution engine; it orchestrates the existing,
 * already-built pieces (plan → review → execute) via injected functions so the
 * logic is fully unit-testable without a browser or network.
 *
 * Per goal it records: was a plan produced, was it approved (+score), did it
 * execute, the outcome, and how long execution took.
 */

import fs from 'fs';
import path from 'path';
import { ensureDir } from '../utils/fileHelper.js';
import { BlockedError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/** Per-goal outcome categories. */
export const RESULT = {
  SUCCESS: 'SUCCESS',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  PLAN_REJECTED: 'PLAN_REJECTED', // produced but reviewer score < threshold
  PLAN_FAILED: 'PLAN_FAILED',     // planner could not produce a valid task
};

export class BenchmarkRunner {
  /**
   * @param {object} deps
   * @param {(goal:string) => Promise<{planned:boolean, approved:boolean, score:number, task:object|null, error?:string}>} deps.plan
   * @param {(task:object) => Promise<void>} deps.execute - throws BlockedError/Error on failure
   * @param {() => number} [deps.now] - timestamp source (injectable for tests)
   * @param {object} [deps.log]
   */
  constructor({ plan, execute, now = () => Date.now(), log = logger }) {
    this._plan = plan;
    this._execute = execute;
    this._now = now;
    this._log = log;
  }

  /**
   * Run one goal through plan → review → execute.
   *
   * @param {{id?:number, category?:string, goal:string}} item
   * @returns {Promise<object>} result record
   */
  async runGoal(item) {
    const goal = typeof item === 'string' ? item : item.goal;
    const rec = {
      id: item.id ?? null,
      category: item.category ?? null,
      goal,
      planned: false,
      approved: false,
      reviewScore: 0,
      executed: false,
      outcome: RESULT.PLAN_FAILED,
      executionMs: 0,
      taskName: null,
      error: null,
    };

    this._log.info(`[BENCH] Goal: "${goal}"`);

    // --- plan + review ---
    const p = await this._plan(goal);
    rec.planned = !!p.planned;
    rec.approved = !!p.approved;
    rec.reviewScore = p.score ?? 0;
    rec.taskName = p.task?.name ?? null;

    if (!rec.planned) { rec.outcome = RESULT.PLAN_FAILED; rec.error = p.error ?? 'no task produced'; return rec; }
    if (!rec.approved) { rec.outcome = RESULT.PLAN_REJECTED; return rec; }

    // --- execute ---
    const start = this._now();
    try {
      await this._execute(p.task);
      rec.outcome = RESULT.SUCCESS;
    } catch (err) {
      rec.outcome = err instanceof BlockedError ? RESULT.BLOCKED : RESULT.FAILED;
      rec.error = err.message;
    }
    rec.executionMs = this._now() - start;
    rec.executed = true;
    this._log.info(`[BENCH] → ${rec.outcome} (score ${rec.reviewScore}, ${rec.executionMs}ms)`);
    return rec;
  }

  /**
   * Run every goal sequentially.
   *
   * @param {Array} items
   * @returns {Promise<object[]>}
   */
  async runAll(items) {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      this._log.info(`[BENCH] ${i + 1}/${items.length}`);
      results.push(await this.runGoal(items[i]));
    }
    return results;
  }
}

/**
 * Compute aggregate metrics from per-goal results. Pure → unit-testable.
 *
 * @param {object[]} results
 * @returns {object}
 */
export function computeMetrics(results) {
  const total = results.length;
  const planned = results.filter((r) => r.planned).length;
  const approved = results.filter((r) => r.approved).length;
  const executed = results.filter((r) => r.executed).length;
  const succeeded = results.filter((r) => r.outcome === RESULT.SUCCESS).length;
  const blocked = results.filter((r) => r.outcome === RESULT.BLOCKED).length;
  const failed = results.filter((r) => r.outcome === RESULT.FAILED).length;
  const planRejected = results.filter((r) => r.outcome === RESULT.PLAN_REJECTED).length;
  const planFailed = results.filter((r) => r.outcome === RESULT.PLAN_FAILED).length;

  const pct = (n, d) => (d > 0 ? +((n / d) * 100).toFixed(1) : 0);
  const mean = (arr) => (arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0);

  const plannedScores = results.filter((r) => r.planned).map((r) => r.reviewScore);
  const execTimes = results.filter((r) => r.executed).map((r) => r.executionMs);

  return {
    total,
    planned,
    approved,
    executed,
    succeeded,
    blocked,
    failed,
    planRejected,
    planFailed,
    planningSuccessRate: pct(planned, total),       // % of goals that yielded a valid task
    reviewApprovalRate: pct(approved, planned),     // % of produced plans that passed review
    executionSuccessRate: pct(succeeded, executed), // % of executed tasks that succeeded
    avgReviewScore: mean(plannedScores),
    avgExecutionMs: mean(execTimes),
  };
}

/**
 * Write the JSON benchmark report.
 *
 * @param {string} file
 * @param {object} payload
 * @returns {string}
 */
export function writeJsonReport(file, payload) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

/**
 * Write a self-contained HTML benchmark report (inline CSS, no external deps).
 *
 * @param {string} file
 * @param {object} payload - { generatedAt, plannerMode, model, metrics, results }
 * @returns {string}
 */
export function writeHtmlReport(file, payload) {
  ensureDir(path.dirname(file));
  const { generatedAt, plannerMode, model, metrics: m, results } = payload;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const color = { SUCCESS: '#1a7f37', BLOCKED: '#9a6700', FAILED: '#cf222e', PLAN_REJECTED: '#8250df', PLAN_FAILED: '#cf222e' };

  const card = (label, value) =>
    `<div class="card"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;

  const rows = results.map((r) => `
    <tr>
      <td>${r.id ?? ''}</td>
      <td>${esc(r.category ?? '')}</td>
      <td>${esc(r.goal)}</td>
      <td>${r.planned ? '✓' : '✗'}</td>
      <td>${r.reviewScore}</td>
      <td>${r.approved ? '✓' : '✗'}</td>
      <td><span class="badge" style="background:${color[r.outcome] || '#57606a'}">${esc(r.outcome)}</span></td>
      <td>${r.executionMs || ''}</td>
    </tr>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Planner Benchmark Report</title>
<style>
  :root{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  body{margin:0;background:#f6f8fa;color:#1f2328}
  header{background:#24292f;color:#fff;padding:20px 28px}
  header h1{margin:0 0 4px;font-size:20px} header .sub{color:#9da7b3;font-size:13px}
  main{max-width:1100px;margin:0 auto;padding:24px 28px 60px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 20px}
  .card{background:#fff;border:1px solid #d0d7de;border-radius:10px;padding:14px 16px;text-align:center}
  .card .v{font-size:22px;font-weight:700} .card .l{font-size:12px;color:#57606a;margin-top:4px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d0d7de;border-radius:10px;overflow:hidden}
  th,td{padding:8px 10px;font-size:13px;text-align:left;border-bottom:1px solid #eaeef2}
  th{background:#f6f8fa;color:#57606a} td:nth-child(3){max-width:380px}
  .badge{color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700}
</style></head><body>
<header>
  <h1>🤖 Planner Benchmark Report</h1>
  <div class="sub">${esc(generatedAt)} · planner=${esc(plannerMode)} · model=${esc(model || 'n/a')}</div>
</header>
<main>
  <div class="cards">
    ${card('Goals', m.total)}
    ${card('Planning success', m.planningSuccessRate + '%')}
    ${card('Review approval', m.reviewApprovalRate + '%')}
    ${card('Execution success', m.executionSuccessRate + '%')}
    ${card('Avg review score', m.avgReviewScore)}
    ${card('Avg exec time', m.avgExecutionMs + ' ms')}
  </div>
  <div class="cards">
    ${card('SUCCESS', m.succeeded)}
    ${card('BLOCKED', m.blocked)}
    ${card('FAILED', m.failed)}
    ${card('Plan rejected', m.planRejected)}
    ${card('Plan failed', m.planFailed)}
  </div>
  <table>
    <thead><tr><th>#</th><th>Category</th><th>Goal</th><th>Planned</th><th>Score</th><th>Approved</th><th>Outcome</th><th>Exec ms</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#8c959f;font-size:12px;margin-top:16px">Generated by the Website Automation Agent benchmark suite — self-contained, no external dependencies.</p>
</main></body></html>`;

  fs.writeFileSync(file, html);
  return file;
}
