/**
 * SearchGoogleWorkflow.js
 *
 * Skeleton workflow for the SEARCH_GOOGLE goal.
 *
 * Current state: skeleton — demonstrates the extension pattern.
 *   - Registers cleanly with GoalRouter (no changes to any existing file needed).
 *   - Calls Planner.generatePlan() so the full action plan is logged in bold
 *     yellow before anything else happens.
 *   - Skips ActionExecutor.executeAll() (logged as a warning) so no real
 *     browser actions are taken until the implementation is complete.
 *
 * To fully implement this workflow:
 *   1. Complete _planSearchGoogle() in Planner.js (already stubbed).
 *   2. Remove the dry-run guard and call agent.executor.executeAll(plan).
 *   3. Add any Google-specific element detection hints to constants.js if needed.
 *
 * Architecture note:
 *   This file was added without modifying any existing workflow, tool, service,
 *   or the ActionExecutor.  Only two lines changed elsewhere:
 *     - One import + one .register() call in Agent.initialize().
 *   That is the extension point the GoalRouter was designed to enable.
 */

import { ACTION_TYPES } from '../config/constants.js';
import config           from '../config/env.js';
import logger           from '../utils/logger.js';

export class SearchGoogleWorkflow {
  /**
   * @param {import('../agent/Agent.js').Agent} agent
   */
  constructor(agent) {
    this._agent = agent;
  }

  /**
   * Entry point called by the agent runner.
   *
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;
    logger.info('--- SearchGoogleWorkflow starting (SKELETON) ---');

    // -------------------------------------------------------------------------
    // 1. Ask the Planner what the action sequence looks like.
    //    Even in skeleton mode this produces a fully-logged plan, showing the
    //    agent's intent before any browser action is taken.
    // -------------------------------------------------------------------------
    agent.think('Requesting plan from Planner for SEARCH_GOOGLE (dry-run)');
    const plan = agent.generatePlan(ACTION_TYPES.GOALS.SEARCH_GOOGLE, {
      query: config.search.googleQuery,
    });

    agent.observe(
      `Plan ready (${plan.length} steps) — skipping execution (skeleton mode)`,
    );

    // -------------------------------------------------------------------------
    // 2. Execution gate — remove this block and add executeAll() when ready.
    // -------------------------------------------------------------------------
    logger.warn(
      'SearchGoogleWorkflow: SKELETON — plan was generated and logged above ' +
      'but will not be executed until this workflow is fully implemented.',
    );

    /*
     * Full implementation (Phase 2):
     *
     *   agent.act(`Executing ${plan.length}-step Google search plan`);
     *   await agent.executor.executeAll(plan);
     *   agent.verify('Google search plan completed');
     */

    logger.info('--- SearchGoogleWorkflow finished ---');
  }
}
