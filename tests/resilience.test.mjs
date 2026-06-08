/**
 * tests/resilience.test.mjs
 *
 * Deterministic resilience scenarios that exercise the retry + recovery layer
 * without depending on flaky live websites.  Each scenario loads a controlled
 * data: URL page and drives the real ActionExecutor.
 *
 * Scenarios:
 *   B. Broken selector   — page has NO inputs; DETECT_FIELD must escalate & fail.
 *   D. Missing field     — page has an input, but not the requested one.
 *   E. Hidden initially  — field is hidden, revealed by JS after a delay;
 *                          recovery must wait/rescan until it appears, then succeed.
 *
 * Run: node tests/resilience.test.mjs
 *
 * Scenarios A (normal) and C (slow page load) are exercised through the real
 * entry point (index.js) and documented in docs/TEST_REPORT_V3.md.
 */

import { Agent } from '../src/agent/Agent.js';
import { ACTION_TYPES } from '../src/config/constants.js';
import logger from '../src/utils/logger.js';

/** A page with a heading but no form inputs at all. */
const PAGE_NO_INPUTS = `data:text/html,<html><body><h1>No form here</h1></body></html>`;

/** A page with an email input, but no "name"/"search" field. */
const PAGE_WRONG_INPUT = `data:text/html,<html><body>
  <label>Email <input type="email" name="email" aria-label="email"></label>
</body></html>`;

/**
 * A page whose search input starts hidden and becomes visible after 1800ms.
 * The recovery ladder (with backoff 500 + 1000 = 1500ms of waiting plus rescans)
 * should eventually see it.
 */
const PAGE_HIDDEN_THEN_SHOWN = `data:text/html,<html><body>
  <input id="s" aria-label="search" style="display:none">
  <script>
    setTimeout(function () {
      document.getElementById('s').style.display = 'block';
    }, 1800);
  </script>
</body></html>`;

/**
 * Run a single scenario and report whether the observed outcome matched what
 * we expected.
 *
 * @param {Agent} agent
 * @param {object} scenario
 * @param {string} scenario.id
 * @param {string} scenario.title
 * @param {string} scenario.url
 * @param {object[]} scenario.plan
 * @param {'success'|'failure'} scenario.expect
 * @returns {Promise<boolean>} true if the scenario behaved as expected
 */
async function runScenario(agent, { id, title, url, plan, expect }) {
  logger.info(`\n================ Scenario ${id}: ${title} ================`);
  // Reset the executor's field registry between scenarios so each starts clean.
  agent.executor._fieldsScanned = false;
  agent.executor._fieldRegistry.clear();

  await agent.navigation.navigateTo(url);

  let outcome;
  try {
    await agent.executor.executeAll(plan);
    outcome = 'success';
  } catch (err) {
    outcome = 'failure';
    logger.info(`Scenario ${id}: caught expected-class error → ${err.message}`);
    logger.info(`Scenario ${id}: failedAction tagged → ${err.failedAction?.type ?? 'none'}`);
  }

  const pass = outcome === expect;
  logger.info(`Scenario ${id} RESULT: expected=${expect}, actual=${outcome} → ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

async function main() {
  const agent = new Agent();
  await agent.initialize();

  const results = [];

  try {
    // --- Scenario B: broken selector (no inputs on the page) ---
    results.push(['B', await runScenario(agent, {
      id: 'B',
      title: 'Broken selector — no matching element exists',
      url: PAGE_NO_INPUTS,
      plan: [
        { type: ACTION_TYPES.DETECT_FIELD, field: 'name' },
        { type: ACTION_TYPES.FILL, field: 'name', value: 'X' },
      ],
      expect: 'failure',
    })]);

    // --- Scenario D: missing field (page has inputs, but not "name") ---
    results.push(['D', await runScenario(agent, {
      id: 'D',
      title: 'Missing field — requested field absent from a populated form',
      url: PAGE_WRONG_INPUT,
      plan: [
        { type: ACTION_TYPES.DETECT_FIELD, field: 'name' },
        { type: ACTION_TYPES.FILL, field: 'name', value: 'X' },
      ],
      expect: 'failure',
    })]);

    // --- Scenario E: element hidden initially, revealed after a delay ---
    results.push(['E', await runScenario(agent, {
      id: 'E',
      title: 'Hidden initially — field appears after JS delay; recovery waits',
      url: PAGE_HIDDEN_THEN_SHOWN,
      plan: [
        { type: ACTION_TYPES.DETECT_FIELD, field: 'search' },
        { type: ACTION_TYPES.FILL, field: 'search', value: 'playwright' },
      ],
      expect: 'success',
    })]);
  } finally {
    await agent.shutdown();
  }

  // --- Summary ---
  logger.info('\n================ RESILIENCE SUMMARY ================');
  let allPass = true;
  for (const [id, pass] of results) {
    logger.info(`Scenario ${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!pass) allPass = false;
  }
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
