/**
 * tests/planner.test.mjs
 *
 * Tests for the AI planner integration (Phase 4A). ALL network is mocked via an
 * injected fetchImpl — no real OpenRouter key or connection is required.
 *
 * Scenarios:
 *   1. Valid OpenRouter response   → validated task returned
 *   2. Malformed JSON              → PlannerValidationError (not executed)
 *   3. Unsupported action          → PlannerValidationError
 *   4. Missing required fields     → PlannerValidationError
 *   5. Timeout fallback            → PlannerProvider falls back to MockPlanner
 *   6. Auth failure fallback (401) → PlannerProvider falls back to MockPlanner
 *   7. MockPlanner success         → valid task from a natural-language goal
 *
 * Run: node tests/planner.test.mjs
 */

import { OpenRouterPlanner } from '../src/planners/OpenRouterPlanner.js';
import { MockPlanner } from '../src/planners/MockPlanner.js';
import { PlannerProvider } from '../src/planners/PlannerProvider.js';
import { PlannerTransportError, PlannerValidationError } from '../src/utils/errors.js';
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

/** Build a fake fetch that returns a chat-completion envelope wrapping `content`. */
const fetchReturning = (content) => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});
/** Build a fake fetch that returns an HTTP error status. */
const fetchStatus = (status) => async () => ({
  ok: false,
  status,
  text: async () => `error ${status}`,
});
/** A fake fetch that simulates a timeout/network failure. */
const fetchRejecting = () => async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };

const opts = (fetchImpl) => ({
  apiKey: 'test-key', model: 'test/model', baseUrl: 'https://openrouter.ai/api/v1',
  timeoutMs: 5000, systemPrompt: 'system', fetchImpl,
});

const VALID = JSON.stringify({
  name: 'github_search',
  steps: [
    { action: 'navigate', url: 'https://github.com/search' },
    { action: 'search', field: 'search', value: 'browser automation' },
    { action: 'submit' },
  ],
});

async function main() {
  // --- 1. Valid OpenRouter response ---
  {
    const planner = new OpenRouterPlanner(opts(fetchReturning('```json\n' + VALID + '\n```')));
    let pass = false, note = '';
    try {
      const task = await planner.generateTask('search github for browser automation');
      pass = task.name === 'github_search' && Array.isArray(task.steps) && task.steps.length === 3;
      note = `task="${task.name}", steps=${task.steps.length}`;
    } catch (err) { note = err.message; }
    record('1 valid response', pass, note);
  }

  // --- 2. Malformed JSON ---
  {
    const planner = new OpenRouterPlanner(opts(fetchReturning('not json at all <<<')));
    const r = await expectThrows(() => planner.generateTask('x'), PlannerValidationError);
    record('2 malformed JSON', r.ok, r.msg);
  }

  // --- 3. Unsupported action ---
  {
    const bad = JSON.stringify({ name: 't', steps: [{ action: 'fly', to: 'moon' }] });
    const planner = new OpenRouterPlanner(opts(fetchReturning(bad)));
    const r = await expectThrows(() => planner.generateTask('x'), PlannerValidationError);
    record('3 unsupported action', r.ok, r.msg);
  }

  // --- 4. Missing required fields (no steps) ---
  {
    const bad = JSON.stringify({ name: 'no_steps' });
    const planner = new OpenRouterPlanner(opts(fetchReturning(bad)));
    const r = await expectThrows(() => planner.generateTask('x'), PlannerValidationError);
    record('4 missing fields', r.ok, r.msg);
  }

  // --- 5. Timeout fallback → MockPlanner ---
  {
    const openRouter = new OpenRouterPlanner(opts(fetchRejecting()));
    const provider = new PlannerProvider({ mode: 'openrouter', openRouter, mock: new MockPlanner() });
    let pass = false, note = '';
    try {
      const task = await provider.generateTask('search github for playwright');
      pass = task.name.startsWith('mock_'); // fell back to mock
      note = `fellback to "${task.name}"`;
    } catch (err) { note = err.message; }
    record('5 timeout fallback', pass, note);
  }

  // --- 6. Auth failure (401) fallback → MockPlanner ---
  {
    const openRouter = new OpenRouterPlanner(opts(fetchStatus(401)));
    const provider = new PlannerProvider({ mode: 'openrouter', openRouter, mock: new MockPlanner() });
    let pass = false, note = '';
    try {
      const task = await provider.generateTask('look up ai on wikipedia');
      pass = task.name.startsWith('mock_');
      note = `fellback to "${task.name}"`;
    } catch (err) { note = err.message; }
    record('6 auth fallback', pass, note);
  }

  // --- 7. MockPlanner success ---
  {
    const task = await new MockPlanner().generateTask('search github for playwright');
    const hasNavigate = task.steps.some((s) => s.action === 'navigate');
    record('7 mock success', task.name === 'mock_github_search' && hasNavigate, `task="${task.name}"`);
  }

  // --- bonus: a transport error must NOT be swallowed when there is no fallback path
  //     (validation errors must propagate even via the provider) ---
  {
    const openRouter = new OpenRouterPlanner(opts(fetchReturning('{"name":"x","steps":[{"action":"fly"}]}')));
    const provider = new PlannerProvider({ mode: 'openrouter', openRouter, mock: new MockPlanner() });
    const r = await expectThrows(() => provider.generateTask('x'), PlannerValidationError);
    record('8 validation not masked by fallback', r.ok, r.msg);
  }

  logger.info('\n========== PLANNER SUMMARY ==========');
  const allPass = results.every(Boolean);
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
