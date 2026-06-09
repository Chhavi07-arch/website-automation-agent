/**
 * tests/github-verification.test.mjs
 *
 * Deterministic tests for the strengthened GitHub search verification (P1-A).
 * Uses controlled data: URL pages so the new VERIFY_URL (q=query) and
 * VERIFY_RESULTS (results-list OR empty-state) logic can be proven without
 * depending on live GitHub.
 *
 * Run: node tests/github-verification.test.mjs
 *
 * Scenarios:
 *   1. Successful search   — results container present → VERIFY_RESULTS passes
 *   2. Zero-result search  — empty-state message present → VERIFY_RESULTS passes
 *   3. Query-in-URL        — URL contains q=playwright → VERIFY_URL passes
 *   4. Failed submission   — no q= in URL, no results → hard-gate checks FAIL
 */

import { Agent } from '../src/agent/Agent.js';
import { ACTION_TYPES } from '../src/config/constants.js';
import logger from '../src/utils/logger.js';

const RESULTS_SELECTOR = '[data-testid="results-list"]';
const EMPTY_HINT = "couldn'?t find any|we couldn'?t find|no results";

// A real GitHub results page has a results-list container.
const PAGE_RESULTS = `data:text/html,<html><body><h1>Repository search results</h1>`
  + `<div data-testid="results-list"><a>microsoft/playwright</a></div></body></html>`;

// A zero-result page shows an empty-state message (search DID execute).
const PAGE_EMPTY = `data:text/html,<html><body><h1>Repository search results</h1>`
  + `<p>We couldn't find any repositories matching your search.</p></body></html>`;

// A page whose URL contains the submitted query (proves the search ran).
const PAGE_QUERY_URL = `data:text/html,<html><body>results for q=playwright</body></html>`;

// A bare form page — no q= in URL, no results, no empty-state: search NEVER ran.
const PAGE_FAILED = `data:text/html,<html><body><form><input name="q"></form></body></html>`;

/**
 * @param {Agent} agent
 * @param {{id:string,title:string,url:string,plan:object[],expect:'success'|'failure'}} s
 * @returns {Promise<boolean>}
 */
async function scenario(agent, { id, title, url, plan, expect }) {
  logger.info(`\n========== Scenario ${id}: ${title} ==========`);
  await agent.navigation.navigateTo(url);

  let outcome;
  try {
    await agent.executor.executeAll(plan);
    outcome = 'success';
  } catch (err) {
    outcome = 'failure';
    logger.info(`Scenario ${id}: hard-gate correctly failed → ${err.message}`);
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
    results.push(['1', await scenario(agent, {
      id: '1', title: 'Successful search — results container present',
      url: PAGE_RESULTS,
      plan: [{ type: ACTION_TYPES.VERIFY_RESULTS, resultsSelector: RESULTS_SELECTOR, emptyHint: EMPTY_HINT, fatal: true }],
      expect: 'success',
    })]);

    results.push(['2', await scenario(agent, {
      id: '2', title: 'Zero-result search — empty-state present (search executed)',
      url: PAGE_EMPTY,
      plan: [{ type: ACTION_TYPES.VERIFY_RESULTS, resultsSelector: RESULTS_SELECTOR, emptyHint: EMPTY_HINT, fatal: true }],
      expect: 'success',
    })]);

    results.push(['3', await scenario(agent, {
      id: '3', title: 'Query appears in URL — VERIFY_URL q=playwright',
      url: PAGE_QUERY_URL,
      plan: [{ type: ACTION_TYPES.VERIFY_URL, fragment: 'q=playwright', fatal: true }],
      expect: 'success',
    })]);

    results.push(['4', await scenario(agent, {
      id: '4', title: 'Failed submission — no q= in URL, no results (must FAIL)',
      url: PAGE_FAILED,
      plan: [{ type: ACTION_TYPES.VERIFY_URL, fragment: 'q=playwright', fatal: true }],
      expect: 'failure',
    })]);
  } finally {
    await agent.shutdown();
  }

  logger.info('\n========== GITHUB VERIFICATION SUMMARY ==========');
  let allPass = true;
  for (const [id, pass] of results) {
    logger.info(`Scenario ${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!pass) allPass = false;
  }
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
