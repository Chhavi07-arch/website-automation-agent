/**
 * src/benchmark/run.mjs
 *
 * Entry point for `npm run benchmark`. Wires the REAL components (no architecture
 * changes) into the BenchmarkRunner and writes JSON + HTML reports.
 *
 *   plan    = PlannerProvider.generateTask (produce + review gate) + reviewTask score
 *   execute = MultiStepWorkflow.runTask (full retry/recovery/diagnostics)
 *
 * Env:
 *   PLANNER_MODE=mock|openrouter   (which planner to benchmark)
 *   BENCHMARK_LIMIT=N              (optional — only run the first N goals)
 *   HEADLESS=true                  (recommended for benchmarks)
 */

import fs from 'fs';
import path from 'path';
import { Agent } from '../agent/Agent.js';
import { PlannerProvider } from '../planners/PlannerProvider.js';
import { reviewTask } from '../planners/TaskReviewer.js';
import { MultiStepWorkflow } from '../workflows/MultiStepWorkflow.js';
import { PlannerValidationError } from '../utils/errors.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { BenchmarkRunner, computeMetrics, writeJsonReport, writeHtmlReport } from './BenchmarkRunner.js';

const REPORTS_DIR = path.resolve('reports');

function loadGoals() {
  const file = path.resolve('benchmark', 'goals.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let goals = data.goals || [];
  const limit = parseInt(process.env.BENCHMARK_LIMIT, 10);
  if (!Number.isNaN(limit) && limit > 0) goals = goals.slice(0, limit);
  return goals;
}

async function main() {
  const goals = loadGoals();
  logger.info(`[BENCH] Running ${goals.length} goals · planner="${config.ai.plannerMode}"`);

  const agent = new Agent();
  await agent.initialize();

  const provider = PlannerProvider.fromConfig(config);

  // plan(): produce + review gate (provider) → re-review for the numeric score.
  const plan = async (goal) => {
    try {
      const task = await provider.generateTask(goal);     // returns only if approved
      const review = reviewTask(task);                     // identical score, captured for metrics
      return { planned: true, approved: true, score: review.score, task };
    } catch (err) {
      const msg = err.message || '';
      if (err instanceof PlannerValidationError && /rejected by reviewer/i.test(msg)) {
        const m = msg.match(/score (\d+)/);
        return { planned: true, approved: false, score: m ? +m[1] : 0, task: null };
      }
      // unparseable / invalid schema / unknown action → planning failure
      return { planned: false, approved: false, score: 0, task: null, error: msg };
    }
  };

  // execute(): run the approved task through the unchanged execution engine.
  const execute = async (task) => {
    agent.executor._fieldsScanned = false;     // isolate goals (eval infra, not engine change)
    agent.executor._fieldRegistry.clear();
    await new MultiStepWorkflow(agent).runTask(task);
  };

  const runner = new BenchmarkRunner({ plan, execute });
  let results = [];
  try {
    results = await runner.runAll(goals);
  } finally {
    await agent.shutdown();
  }

  const metrics = computeMetrics(results);
  const payload = {
    generatedAt: new Date().toISOString(),
    plannerMode: config.ai.plannerMode,
    model: config.ai.plannerMode === 'openrouter' ? config.ai.openrouter.model : 'mock',
    metrics,
    results,
  };

  const jsonPath = writeJsonReport(path.join(REPORTS_DIR, 'benchmark_report.json'), payload);
  const htmlPath = writeHtmlReport(path.join(REPORTS_DIR, 'benchmark_report.html'), payload);

  logger.info('══════════════════════════════════════════════');
  logger.info(`[BENCH] Done — ${metrics.total} goals`);
  logger.info(`[BENCH] planning ${metrics.planningSuccessRate}% · review-approval ${metrics.reviewApprovalRate}% · execution ${metrics.executionSuccessRate}%`);
  logger.info(`[BENCH] avg score ${metrics.avgReviewScore} · avg exec ${metrics.avgExecutionMs}ms`);
  logger.info(`[BENCH] SUCCESS=${metrics.succeeded} BLOCKED=${metrics.blocked} FAILED=${metrics.failed} REJECTED=${metrics.planRejected} PLAN_FAILED=${metrics.planFailed}`);
  logger.info(`[BENCH] reports → ${jsonPath} · ${htmlPath}`);
  logger.info('══════════════════════════════════════════════');
}

main();
