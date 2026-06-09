/**
 * tests/engine.test.mjs
 *
 * Deterministic tests for the P3.5 engine hardening:
 *   1. Variable substitution (vars + env)
 *   2. Missing variable → clear error
 *   3. Conditional THEN branch (selector_exists true)
 *   4. Conditional ELSE branch (selector_exists false)
 *   5. continueOnFailure (tolerated vs fatal)
 *
 * Uses controlled data: URLs — no live sites. Run: node tests/engine.test.mjs
 */

import { Agent } from '../src/agent/Agent.js';
import { resolveVariables, MultiStepWorkflow } from '../src/workflows/MultiStepWorkflow.js';
import logger from '../src/utils/logger.js';

const results = [];
const record = (id, pass, note = '') => {
  logger.info(`${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}${note ? ` — ${note}` : ''}`);
  results.push(pass);
};
async function expectThrows(fn, re) {
  try { await fn(); return { ok: false, msg: 'did not throw' }; }
  catch (err) { return { ok: re.test(err.message), msg: err.message }; }
}

// A page with #present (visible) but no #absent.
const PAGE = `data:text/html,<html><body><div id="present">I am here</div></body></html>`;

async function main() {
  const agent = new Agent();
  await agent.initialize();
  const wf = new MultiStepWorkflow(agent);
  const reset = () => { agent.executor._fieldsScanned = false; agent.executor._fieldRegistry.clear(); };

  try {
    // --- 1. Variable substitution (vars map + env fallback) ---
    logger.info('\n========== 1: Variable substitution ==========');
    {
      const fromVars = resolveVariables(
        { name: 't', steps: [{ action: 'fill', value: '{{query}}' }] },
        { query: 'openai' }, {},
      );
      const fromEnv = resolveVariables(
        { name: 't', steps: [{ action: 'navigate', url: '{{site}}' }] },
        {}, { SITE: 'https://example.com' },
      );
      const ok = fromVars.steps[0].value === 'openai' && fromEnv.steps[0].url === 'https://example.com';
      record('Scenario 1', ok, `value="${fromVars.steps[0].value}", url="${fromEnv.steps[0].url}"`);
    }

    // --- 2. Missing variable → clear error ---
    logger.info('\n========== 2: Missing variable ==========');
    {
      const r = await expectThrows(
        () => resolveVariables({ name: 't', steps: [{ action: 'fill', value: '{{nope}}' }] }, {}, {}),
        /unresolved variable/i,
      );
      record('Scenario 2', r.ok, r.msg);
    }

    // --- 3. Conditional THEN branch (selector_exists true) ---
    logger.info('\n========== 3: Conditional THEN branch ==========');
    {
      reset();
      await agent.navigation.navigateTo(PAGE);
      // then verifies #present (passes); else verifies #absent (would throw if taken)
      let pass = true, note = 'then branch executed';
      try {
        await wf._runSteps([{
          if: { selector_exists: '#present' },
          then: [{ action: 'verify_selector', selector: '#present' }],
          else: [{ action: 'verify_selector', selector: '#absent' }],
        }], { name: 'cond' });
      } catch (err) { pass = false; note = `unexpected throw: ${err.message}`; }
      record('Scenario 3', pass, note);
    }

    // --- 4. Conditional ELSE branch (selector_exists false) ---
    logger.info('\n========== 4: Conditional ELSE branch ==========');
    {
      reset();
      await agent.navigation.navigateTo(PAGE);
      // condition false (#absent missing) → else runs (screenshot, harmless).
      // then contains a verify for #absent that WOULD throw if wrongly taken.
      let pass = true, note = 'else branch executed';
      try {
        await wf._runSteps([{
          if: { selector_exists: '#absent' },
          then: [{ action: 'verify_selector', selector: '#absent' }],
          else: [{ action: 'screenshot', label: 'engine-else' }],
        }], { name: 'cond' });
      } catch (err) { pass = false; note = `unexpected throw: ${err.message}`; }
      record('Scenario 4', pass, note);
    }

    // --- 5. continueOnFailure (tolerated vs fatal) ---
    logger.info('\n========== 5: continueOnFailure ==========');
    {
      reset();
      await agent.navigation.navigateTo(PAGE);

      // (a) tolerated: a failing verify with continueOnFailure must NOT throw
      let tolerated = true;
      try {
        await wf._runSteps([{ action: 'verify_selector', selector: '#absent', continueOnFailure: true }], { name: 'c' });
      } catch { tolerated = false; }

      // (b) fatal: the same step WITHOUT continueOnFailure must throw
      const fatal = await expectThrows(
        () => wf._runSteps([{ action: 'verify_selector', selector: '#absent' }], { name: 'c' }),
        /VERIFY_SELECTOR/i,
      );

      record('Scenario 5', tolerated && fatal.ok, `tolerated=${tolerated}, fatalThrew=${fatal.ok}`);
    }
  } finally {
    await agent.shutdown();
  }

  logger.info('\n========== ENGINE SUMMARY ==========');
  const allPass = results.every(Boolean);
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
