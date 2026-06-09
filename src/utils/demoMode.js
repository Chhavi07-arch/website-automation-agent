/**
 * demoMode.js
 *
 * Demonstration-experience lifecycle only — NOT execution architecture.
 *
 * `holdForInspection` decides whether to keep the browser open after a run (on
 * success OR failure) and for how long. Extracted into a pure, injectable helper
 * so the behaviour can be unit-tested without launching a real browser.
 *
 * Demo Mode is gated entirely by KEEP_BROWSER_OPEN:
 *   - disabled (false) → returns immediately, no hold, no logs → behaves exactly
 *     as before (the browser closes right away).
 *   - enabled (true)   → logs "[DEMO] Keeping browser open for inspection" and
 *     holds for DEMO_PAUSE_MS (or waits for Enter if pauseMs is 0 and headed).
 */

import logger from './logger.js';
import { sleep } from './fileHelper.js';

/**
 * @param {object} opts
 * @param {boolean} opts.keepBrowserOpen
 * @param {number}  [opts.pauseMs=0]        - how long to hold the browser open (ms)
 * @param {boolean} [opts.headless=false]
 * @param {Function} [opts.sleepFn]         - injectable sleep (tests)
 * @param {Function} [opts.waitForEnterFn]  - injectable "press Enter" (tests/headed)
 * @param {object}  [opts.log]              - injectable logger (tests)
 * @returns {Promise<{held:boolean, waitedMs:number, mode:'disabled'|'pause'|'enter'|'noop'}>}
 */
export async function holdForInspection({
  keepBrowserOpen,
  pauseMs = 0,
  headless = false,
  sleepFn = sleep,
  waitForEnterFn = null,
  log = logger,
} = {}) {
  // Disabled → exactly as before: no hold, no logging.
  if (!keepBrowserOpen) {
    return { held: false, waitedMs: 0, mode: 'disabled' };
  }

  log.info('[DEMO] Keeping browser open for inspection');

  // Timed hold (success OR failure) — the primary demo behaviour.
  if (pauseMs > 0) {
    log.info(`[DEMO] Holding browser open for ${pauseMs}ms before shutdown…`);
    await sleepFn(pauseMs);
    return { held: true, waitedMs: pauseMs, mode: 'pause' };
  }

  // No pause set but headed → stay open until the user presses Enter.
  if (!headless && waitForEnterFn) {
    await waitForEnterFn('[DEMO] Press ENTER to close the browser…');
    return { held: true, waitedMs: 0, mode: 'enter' };
  }

  // Headless with no pause → nothing meaningful to hold for.
  log.warn('[DEMO] Headless + DEMO_PAUSE_MS=0 — nothing to hold open for.');
  return { held: false, waitedMs: 0, mode: 'noop' };
}
