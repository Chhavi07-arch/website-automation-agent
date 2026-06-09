/**
 * tests/demo.test.mjs
 *
 * Tests for Demo Mode lifecycle (Phase 4C). Verifies, deterministically and
 * without launching a browser, that:
 *   1. browser remains open (a real hold happens) when enabled
 *   2. the pause duration is respected (DEMO_PAUSE_MS passed through exactly)
 *   3. disabled mode behaves exactly as before (no hold, no [DEMO] logs)
 *   4. keep-open + headless + no pause → safe no-op (no hang)
 *   5. the hold is outcome-agnostic (same on success or failure)
 *
 * Run: node tests/demo.test.mjs
 */

import { holdForInspection } from '../src/utils/demoMode.js';
import logger from '../src/utils/logger.js';

const results = [];
const record = (id, pass, note = '') => {
  logger.info(`${id}: ${pass ? 'PASS ✅' : 'FAIL ❌'}${note ? ` — ${note}` : ''}`);
  results.push(pass);
};
/** Capturing fake logger. */
const makeLog = () => { const msgs = []; return { msgs, info: (m) => msgs.push(m), warn: (m) => msgs.push(m) }; };

async function main() {
  // 1. Browser remains open — a REAL hold of ~pauseMs occurs when enabled.
  {
    const log = makeLog();
    const t0 = Date.now();
    const r = await holdForInspection({ keepBrowserOpen: true, pauseMs: 200, headless: true, log });
    const elapsed = Date.now() - t0;
    const opened = log.msgs.some((m) => m.includes('[DEMO] Keeping browser open for inspection'));
    record('1 browser remains open', r.held && opened && elapsed >= 180,
      `held=${r.held}, elapsed=${elapsed}ms, logged=${opened}`);
  }

  // 2. Pause duration respected — DEMO_PAUSE_MS passed to sleep unchanged.
  {
    let sleptMs = null;
    const r = await holdForInspection({
      keepBrowserOpen: true, pauseMs: 15000, headless: true,
      sleepFn: async (ms) => { sleptMs = ms; }, log: makeLog(),
    });
    record('2 pause duration respected', sleptMs === 15000 && r.waitedMs === 15000 && r.mode === 'pause',
      `slept=${sleptMs}, waitedMs=${r.waitedMs}`);
  }

  // 3. Disabled mode behaves exactly as before — no hold, no sleep, no [DEMO] logs.
  {
    let sleepCalled = false;
    const log = makeLog();
    const r = await holdForInspection({
      keepBrowserOpen: false, pauseMs: 15000, headless: true,
      sleepFn: async () => { sleepCalled = true; }, log,
    });
    const noDemoLogs = !log.msgs.some((m) => m.includes('[DEMO]'));
    record('3 disabled = as before', r.held === false && r.mode === 'disabled' && !sleepCalled && noDemoLogs,
      `held=${r.held}, sleepCalled=${sleepCalled}, demoLogs=${!noDemoLogs}`);
  }

  // 4. Keep-open + headless + no pause → safe no-op (does not hang on Enter).
  {
    let sleepCalled = false;
    const r = await holdForInspection({
      keepBrowserOpen: true, pauseMs: 0, headless: true,
      sleepFn: async () => { sleepCalled = true; }, log: makeLog(),
    });
    record('4 headless+no-pause no-op', r.held === false && r.mode === 'noop' && !sleepCalled,
      `mode=${r.mode}, sleepCalled=${sleepCalled}`);
  }

  // 5. Outcome-agnostic — the helper takes no outcome; index.js calls it in
  //    `finally`, so the same hold applies on SUCCESS and FAILURE. Verify the
  //    behaviour is identical for two invocations (proxy for both code paths).
  {
    const opts = { keepBrowserOpen: true, pauseMs: 50, headless: true, log: makeLog() };
    const a = await holdForInspection(opts);
    const b = await holdForInspection(opts);
    record('5 same hold on success & failure', a.held === b.held && a.mode === b.mode && a.waitedMs === b.waitedMs,
      `${a.mode}==${b.mode}`);
  }

  logger.info('\n========== DEMO MODE SUMMARY ==========');
  const allPass = results.every(Boolean);
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
