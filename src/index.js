/**
 * index.js
 *
 * Application entry point.  Reads the goal from config and delegates selection
 * to the GoalRouter.  In P1 it also supports Demo Mode (pause / keep-open) so a
 * viva examiner or recruiter can watch the result before the browser closes.
 *
 * Responsibilities:
 *   1. Initialise the Agent (launches browser, wires all components).
 *   2. Take a "browser launched" screenshot.
 *   3. Route to the workflow named by GOAL and run it.
 *   4. (Demo Mode) hold / keep the browser open for inspection.
 *   5. Shut down cleanly (always, even on error).
 *
 * Demo Mode is fully opt-in: with the defaults (all OFF) behaviour is identical
 * to before — the browser closes immediately after the run.
 */

import readline from 'node:readline';
import { Agent }                 from './agent/Agent.js';
import { writeDiagnosticReport } from './utils/diagnostics.js';
import { sleep }                 from './utils/fileHelper.js';
import { BlockedError }          from './utils/errors.js';
import { ACTION_TYPES }          from './config/constants.js';
import config                    from './config/env.js';
import logger                    from './utils/logger.js';

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

  try {
    // --- Initialise: launches browser, wires tools, planner, router ---
    await agent.initialize();

    // --- Screenshot immediately after browser launch ---
    await agent.screenshot.capture('browser-launched');

    // --- Read the active goal and route to the correct workflow ---
    logger.info(`Active goal: "${goalKey}"`);
    logger.info(`Available goals: [${agent.router.listGoals().join(', ')}]`);

    workflow = agent.router.route(goalKey);
    await workflow.run();

    // --- OUTCOME: SUCCESS ---
    logger.info('══════════════════════════════════════════════');
    logger.info('✅ OUTCOME: SUCCESS — workflow completed and verified.');
    logger.info('══════════════════════════════════════════════');
  } catch (error) {
    const workflowName = workflow?.constructor?.name ?? 'unknown';

    if (error instanceof BlockedError) {
      // --- OUTCOME: BLOCKED (the website stopped us — NOT a bug) ---
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
    // --- Demo Mode: let the examiner inspect the final state before teardown ---
    if (config.demo.keepBrowserOpen && !config.browser.headless) {
      logger.info('🖐  Browser left open for manual inspection.');
      await waitForEnter('Press ENTER to close the browser and exit…');
    } else if (config.demo.keepBrowserOpen && config.browser.headless) {
      logger.warn('KEEP_BROWSER_OPEN ignored — browser is headless (nothing to inspect).');
    } else if (config.demo.pauseMs > 0) {
      logger.info(`⏸  Holding ${config.demo.pauseMs}ms so results stay visible…`);
      await sleep(config.demo.pauseMs);
    }

    await agent.shutdown();
  }
}

main();
