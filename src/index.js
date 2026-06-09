/**
 * index.js
 *
 * Application entry point.  Reads the goal from config and delegates selection
 * to the GoalRouter.  In P1 it also supports Demo Mode (pause / keep-open) so a
 * viva examiner or recruiter can watch the result before the browser closes.
 *
 * Responsibilities:
 *   1. Initialise the Agent (launches browser, wires all components).
 *   2. Capture before-task / after-task screenshots.
 *   3. Route to the workflow named by GOAL and run it.
 *   4. (Demo Mode) keep the browser open for DEMO_PAUSE_MS — on success OR failure.
 *   5. Shut down cleanly (always, even on error).
 *
 * Demo Mode is fully opt-in (KEEP_BROWSER_OPEN / DEMO_PAUSE_MS). With the
 * defaults (all OFF) the browser closes immediately after the run.
 */

import readline from 'node:readline';
import { Agent }                 from './agent/Agent.js';
import { writeDiagnosticReport } from './utils/diagnostics.js';
import { writeRunReport }        from './utils/report.js';
import { holdForInspection }     from './utils/demoMode.js';
import { BlockedError }          from './utils/errors.js';
import { ACTION_TYPES }          from './config/constants.js';
import config                    from './config/env.js';
import logger, { getLogBuffer, clearLogBuffer } from './utils/logger.js';

const { OUTCOMES } = ACTION_TYPES;

/**
 * Wait for the user to press Enter (keeps the process — and the browser — alive).
 *
 * @param {string} prompt
 * @returns {Promise<void>}
 */
function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${prompt}\n`, () => { rl.close(); resolve(); });
  });
}

async function main() {
  const agent = new Agent();
  const goalKey = config.target.goal;
  let workflow = null;

  // Run-report bookkeeping (P3.5).
  clearLogBuffer();
  const startTime = Date.now();
  let outcome = OUTCOMES.SUCCESS;
  let blockedReason = null;

  try {
    // --- Initialise: launches browser, wires tools, planner, router ---
    await agent.initialize();

    // --- Screenshot immediately after browser launch ---
    await agent.screenshot.capture('browser-launched');

    // --- Read the active goal and route to the correct workflow ---
    logger.info(`Active goal: "${goalKey}"`);
    logger.info(`Available goals: [${agent.router.listGoals().join(', ')}]`);

    workflow = agent.router.route(goalKey);

    // --- Demo screenshot: state before the task runs ---
    await agent.screenshot.capture('before-task');

    await workflow.run();

    // --- OUTCOME: SUCCESS ---
    logger.info('══════════════════════════════════════════════');
    logger.info('✅ OUTCOME: SUCCESS — workflow completed and verified.');
    logger.info('══════════════════════════════════════════════');
  } catch (error) {
    const workflowName = workflow?.constructor?.name ?? 'unknown';

    if (error instanceof BlockedError) {
      // --- OUTCOME: BLOCKED (the website stopped us — NOT a bug) ---
      outcome = OUTCOMES.BLOCKED;
      blockedReason = error.blockedReason;
      logger.warn('══════════════════════════════════════════════');
      logger.warn('🛑 OUTCOME: BLOCKED — Workflow blocked by anti-bot protection.');
      logger.warn(`🛑 Reason: ${error.blockedReason}`);
      logger.warn('══════════════════════════════════════════════');

      try { await agent.screenshot.capture('blocked-state'); } catch { /* best-effort */ }
      await writeDiagnosticReport(agent, {
        goal: goalKey,
        workflow: workflowName,
        outcome: OUTCOMES.BLOCKED,
        blockedReason: error.blockedReason,
        failedAction: error.failedAction ?? null,
        error,
      });

      process.exitCode = 2;   // distinct from FAILED (1) and SUCCESS (0)
    } else {
      // --- OUTCOME: FAILED (a real failure / bug) ---
      outcome = OUTCOMES.FAILED;
      logger.error('══════════════════════════════════════════════');
      logger.error(`❌ OUTCOME: FAILED — ${error.message}`);
      logger.error('══════════════════════════════════════════════');
      logger.error(error.stack);

      await writeDiagnosticReport(agent, {
        goal: goalKey,
        workflow: workflowName,
        outcome: OUTCOMES.FAILED,
        failedAction: error.failedAction ?? null,
        error,
      });

      process.exitCode = 1;
    }
  } finally {
    // Capture the final URL before the browser closes (for the report).
    let finalUrl = '';
    try { finalUrl = agent.navigation.currentUrl(); } catch { /* page may be gone */ }

    // --- Demo screenshot: final state after the task (success OR failure) ---
    try { await agent.screenshot.capture('after-task'); } catch { /* best-effort */ }

    // --- Demo Mode: keep the browser open for inspection (success OR failure) ---
    // Gated entirely by KEEP_BROWSER_OPEN — disabled behaves exactly as before.
    await holdForInspection({
      keepBrowserOpen: config.demo.keepBrowserOpen,
      pauseMs: config.demo.pauseMs,
      headless: config.browser.headless,
      waitForEnterFn: waitForEnter,
    });

    await agent.shutdown();

    // --- Self-contained HTML run report (P3.5) ---
    if (config.report.enabled) {
      const taskName = goalKey === ACTION_TYPES.GOALS.MULTI_STEP ? config.task.file
                     : goalKey === ACTION_TYPES.GOALS.AI_PLAN ? `AI: ${config.ai.goal}`
                     : goalKey;
      writeRunReport({
        goal: goalKey,
        taskName,
        outcome,
        blockedReason,
        startTime,
        endTime: Date.now(),
        finalUrl,
        logBuffer: getLogBuffer(),
      });
    }
  }
}

main();
