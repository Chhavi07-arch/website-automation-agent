/**
 * index.js
 *
 * Application entry point.  In V3 it no longer imports any specific workflow —
 * it reads the goal from config and delegates selection to the GoalRouter.
 *
 * Responsibilities:
 *   1. Initialise the Agent (launches browser, wires all components).
 *   2. Take a "browser launched" screenshot.
 *   3. Read the active goal from config.target.goal (set via GOAL in .env).
 *   4. Ask GoalRouter to select and instantiate the correct workflow.
 *   5. Run the workflow.
 *   6. Shut down cleanly (always, even on error).
 *
 * To switch workflows: edit GOAL= in .env.  No code changes needed.
 */

import { Agent }  from './agent/Agent.js';
import config     from './config/env.js';
import logger     from './utils/logger.js';

async function main() {
  const agent = new Agent();

  try {
    // --- Initialise: launches browser, wires tools, planner, router ---
    await agent.initialize();

    // --- Screenshot immediately after browser launch ---
    await agent.screenshot.capture('browser-launched');

    // --- Read the active goal and route to the correct workflow ---
    const goalKey  = config.target.goal;
    logger.info(`Active goal: "${goalKey}"`);
    logger.info(`Available goals: [${agent.router.listGoals().join(', ')}]`);

    const workflow = agent.router.route(goalKey);
    await workflow.run();

    logger.info('All done. Agent exiting successfully.');
  } catch (error) {
    logger.error(`Unhandled error in main: ${error.message}`);
    logger.error(error.stack);
    try { await agent.screenshot.capture('error-state'); } catch { /* best-effort */ }
    process.exitCode = 1;
  } finally {
    await agent.shutdown();
  }
}

main();
