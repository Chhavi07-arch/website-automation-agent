/**
 * tests/multistep.test.mjs
 *
 * Deterministic tests for the Multi-Step Workflow Engine (P3):
 *   1. Valid task execution         (data: URL — runs end to end)
 *   2. Missing task file            (loadTask throws)
 *   3. Invalid task schema          (validateTask throws)
 *   4. Unsupported action           (Planner throws)
 *   5. Successful GitHub-like task  (results-list + open_first_result)
 *
 * Live GitHub coverage (github_playwright.json) is exercised separately via
 * `GOAL=MULTI_STEP TASK_FILE=github_playwright.json npm start` and recorded in
 * docs/TEST_REPORT_V6.md.
 *
 * Run: node tests/multistep.test.mjs
 */

import { Agent } from '../src/agent/Agent.js';
import { ACTION_TYPES } from '../src/config/constants.js';
import { loadTask, validateTask } from '../src/workflows/MultiStepWorkflow.js';
import logger from '../src/utils/logger.js';

const results = [];
const record = (id, pass, note = '') => {
  logger.info(`${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}${note ? ` — ${note}` : ''}`);
  results.push(pass);
};

/** Assert that `fn` throws an error whose message matches `re`. */
async function expectThrows(fn, re) {
  try { await fn(); return { ok: false, msg: 'did not throw' }; }
  catch (err) { return { ok: re.test(err.message), msg: err.message }; }
}

/** Run a task object end to end via the real Planner + Executor. */
async function runTask(agent, task) {
  agent.executor._fieldsScanned = false;
  agent.executor._fieldRegistry.clear();
  const plan = agent.generatePlan(ACTION_TYPES.GOALS.MULTI_STEP, { task });
  await agent.executor.executeAll(plan);
}

// NOTE: avoid '#' in data: URLs — it starts a URL fragment and truncates the HTML.
const PAGE_BASIC = `data:text/html,<html><body><div id="r">Hello world`
  + `<a href="x">link</a></div></body></html>`;

const PAGE_RESULTS = `data:text/html,<html><body>`
  + `<div data-testid="results-list">Results: <a href="x">first-repo</a> <a href="x">second</a></div>`
  + `</body></html>`;

async function main() {
  const agent = new Agent();
  await agent.initialize();

  try {
    // --- 1. Valid task execution (end to end) ---
    logger.info('\n========== 1: Valid task execution ==========');
    try {
      await runTask(agent, {
        name: 'valid_basic',
        steps: [
          { action: 'navigate', url: PAGE_BASIC },
          { action: 'verify_selector', selector: '#r' },
          { action: 'screenshot', label: 'multistep-valid' },
        ],
      });
      record('Scenario 1', true, 'task ran end to end');
    } catch (err) {
      record('Scenario 1', false, err.message);
    }

    // --- 2. Missing task file ---
    logger.info('\n========== 2: Missing task file ==========');
    {
      const r = await expectThrows(() => loadTask('___does_not_exist___.json'), /not found/i);
      record('Scenario 2', r.ok, r.msg);
    }

    // --- 3. Invalid task schema ---
    logger.info('\n========== 3: Invalid task schema ==========');
    {
      const r1 = await expectThrows(() => validateTask({ name: 'x' }), /steps/i);              // no steps
      const r2 = await expectThrows(() => validateTask({ steps: [{ action: 'navigate' }] }), /name/i); // no name
      const r3 = await expectThrows(() => validateTask({ name: 'x', steps: [{}] }), /action/i);  // step missing action
      record('Scenario 3', r1.ok && r2.ok && r3.ok, `${r1.msg} | ${r2.msg} | ${r3.msg}`);
    }

    // --- 4. Unsupported action ---
    logger.info('\n========== 4: Unsupported action ==========');
    {
      const r = await expectThrows(
        () => agent.generatePlan(ACTION_TYPES.GOALS.MULTI_STEP, {
          task: { name: 'bad', steps: [{ action: 'fly' }] },
        }),
        /unsupported action/i,
      );
      record('Scenario 4', r.ok, r.msg);
    }

    // --- 5. Successful GitHub-like task (results + open_first_result) ---
    logger.info('\n========== 5: Successful GitHub-like task ==========');
    try {
      await runTask(agent, {
        name: 'github_like',
        steps: [
          { action: 'navigate', url: PAGE_RESULTS },
          { action: 'verify_selector', selector: '[data-testid="results-list"]' },
          { action: 'screenshot', label: 'multistep-results' },
          { action: 'open_first_result', selector: '[data-testid="results-list"] a' },
          { action: 'screenshot', label: 'multistep-opened' },
        ],
      });
      record('Scenario 5', true, 'results verified + first result opened');
    } catch (err) {
      record('Scenario 5', false, err.message);
    }
  } finally {
    await agent.shutdown();
  }

  logger.info('\n========== MULTI-STEP SUMMARY ==========');
  const allPass = results.every(Boolean);
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
