/**
 * tests/reviewer.test.mjs
 *
 * Tests for the planner quality reviewer (Phase 4B):
 *   1. Good task            → approved (score 100)
 *   2. Missing navigate     → rejected
 *   3. Unsupported action   → rejected
 *   4. Duplicate actions    → rejected
 *   5. Empty task           → rejected
 *   6. Integration: PlannerProvider rejects a low-quality plan (no execution)
 *   7. Integration: a good plan is approved and returned
 *
 * Pure analysis + mocked planner — no browser, no network. Run: node tests/reviewer.test.mjs
 */

import { reviewTask } from '../src/planners/TaskReviewer.js';
import { PlannerProvider } from '../src/planners/PlannerProvider.js';
import { OpenRouterPlanner } from '../src/planners/OpenRouterPlanner.js';
import { MockPlanner } from '../src/planners/MockPlanner.js';
import { PlannerValidationError } from '../src/utils/errors.js';
import logger from '../src/utils/logger.js';

const results = [];
const record = (id, pass, note = '') => {
  logger.info(`${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}${note ? ` — ${note}` : ''}`);
  results.push(pass);
};
async function expectThrows(fn, ErrType) {
  try { await fn(); return { ok: false, msg: 'did not throw' }; }
  catch (err) { return { ok: err instanceof ErrType, msg: `${err.name}: ${err.message}` }; }
}

const GOOD = {
  name: 'github_search',
  steps: [
    { action: 'navigate', url: 'https://github.com/search' },
    { action: 'search', field: 'search', value: 'browser automation' },
    { action: 'submit' },
    { action: 'verify_url', fragment: 'q=browser' },
    { action: 'verify_selector', selector: '[data-testid="results-list"]' },
    { action: 'screenshot', label: 'results' },
  ],
};

const fetchReturning = (obj) => async () => ({
  ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
});
const orOpts = (fetchImpl) => ({
  apiKey: 'k', model: 'm', baseUrl: 'https://openrouter.ai/api/v1', timeoutMs: 5000, systemPrompt: 's', fetchImpl,
});

async function main() {
  // 1. Good task
  {
    const r = reviewTask(GOOD);
    record('1 good task', r.approved && r.score === 100, `score=${r.score}, approved=${r.approved}`);
  }

  // 2. Missing navigate (fill with no navigate)
  {
    const r = reviewTask({ name: 't', steps: [{ action: 'fill', field: 'search', value: 'x' }] });
    record('2 missing navigate', !r.approved, `score=${r.score}, issues=${r.issues.length}`);
  }

  // 3. Unsupported action
  {
    const r = reviewTask({ name: 't', steps: [{ action: 'navigate', url: 'https://x' }, { action: 'fly' }] });
    const flagged = r.issues.some((i) => /unsupported/i.test(i));
    record('3 unsupported action', !r.approved && flagged, `score=${r.score}, flagged=${flagged}`);
  }

  // 4. Duplicate consecutive actions
  {
    const r = reviewTask({ name: 't', steps: [
      { action: 'navigate', url: 'https://x' },
      { action: 'navigate', url: 'https://x' },
      { action: 'navigate', url: 'https://x' },
    ] });
    record('4 duplicate actions', !r.approved, `score=${r.score}, warnings=${r.warnings.length}`);
  }

  // 5. Empty task
  {
    const r = reviewTask({ name: 'empty', steps: [] });
    record('5 empty task', !r.approved && r.score < 80, `score=${r.score}`);
  }

  // 6. Integration: provider REJECTS a low-quality (schema-valid) plan → no execution
  {
    const lowQuality = { name: 'useless', steps: [
      { action: 'navigate', url: 'https://a' },
      { action: 'navigate', url: 'https://a' },
      { action: 'navigate', url: 'https://a' },
    ] };
    const openRouter = new OpenRouterPlanner(orOpts(fetchReturning(lowQuality)));
    const provider = new PlannerProvider({ mode: 'openrouter', openRouter, mock: new MockPlanner() });
    const r = await expectThrows(() => provider.generateTask('do something'), PlannerValidationError);
    record('6 provider rejects low quality', r.ok, r.msg);
  }

  // 7. Integration: a good plan is approved + returned
  {
    const openRouter = new OpenRouterPlanner(orOpts(fetchReturning(GOOD)));
    const provider = new PlannerProvider({ mode: 'openrouter', openRouter, mock: new MockPlanner() });
    let pass = false, note = '';
    try { const t = await provider.generateTask('search github for browser automation'); pass = t.name === 'github_search'; note = `returned "${t.name}"`; }
    catch (err) { note = err.message; }
    record('7 provider approves good plan', pass, note);
  }

  logger.info('\n========== REVIEWER SUMMARY ==========');
  const allPass = results.every(Boolean);
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
