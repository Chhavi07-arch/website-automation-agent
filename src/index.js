/**
 * index.js
 *
 * Application entry point.
 *
 * Responsibilities:
 *   1. Create and initialise the Agent.
 *   2. Take a "browser launched" screenshot.
 *   3. Hand the agent to the target workflow.
 *   4. Shut the browser down (in a finally block — runs even on error).
 *   5. Exit with a non-zero code if the workflow fails (so CI can detect it).
 *
 * Nothing domain-specific lives here. If you want to run a different workflow,
 * change the import and the line inside the try block.
 */

import { Agent }                    from './agent/Agent.js';
import { FillShadcnFormWorkflow }   from './workflows/FillShadcnFormWorkflow.js';
import logger                       from './utils/logger.js';

async function main() {
  const agent = new Agent();

  try {
    // --- Initialise: launches browser, wires all tools ---
    await agent.initialize();

    // --- Screenshot immediately after browser launch ---
    await agent.screenshot.capture('browser-launched');

    // --- Run the assignment workflow ---
    const workflow = new FillShadcnFormWorkflow(agent);
    await workflow.run();

    logger.info('All done. Agent exiting successfully.');
  } catch (error) {
    // Log the full error before shutting down so the screenshot + log files
    // are still written even if the error bubbles up.
    logger.error(`Unhandled error in main: ${error.message}`);
    logger.error(error.stack);

    // Take an error screenshot for debugging
    try {
      await agent.screenshot.capture('error-state');
    } catch {
      // If we can't screenshot we're in a bad state — just continue to shutdown
    }

    process.exitCode = 1;
  } finally {
    await agent.shutdown();
  }
}

main();
