/**
 * SearchGitHubWorkflow.js
 *
 * Skeleton workflow for the SEARCH_GITHUB goal.
 *
 * Current state: skeleton — demonstrates the extension pattern.
 *   - Registers cleanly with GoalRouter (no changes to any existing file).
 *   - Calls Planner.generatePlan() so the full action plan is logged in bold
 *     yellow before anything else happens.
 *   - Skips ActionExecutor.executeAll() (logged as a warning) so no real
 *     browser actions are taken until the implementation is complete.
 *
 * To fully implement this workflow:
 *   1. Complete _planSearchGitHub() in Planner.js (already stubbed).
 *   2. Remove the dry-run guard and call agent.executor.executeAll(plan).
 *   3. Add GitHub-specific element detection hints (search box selector, etc.)
 *      to constants.js if the generic label/aria detection is insufficient.
 *
 * Architecture note:
 *   Like SearchGoogleWorkflow, this file was added without modifying any
 *   existing workflow, tool, service, or the ActionExecutor.  The only other
 *   change was one import + one .register() call in Agent.initialize().
 */

import { ACTION_TYPES } from '../config/constants.js';
import config           from '../config/env.js';
import logger           from '../utils/logger.js';

export class SearchGitHubWorkflow {
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
    logger.info('--- SearchGitHubWorkflow starting (SKELETON) ---');

    // -------------------------------------------------------------------------
    // 1. Generate and log the full action plan.
    // -------------------------------------------------------------------------
    agent.think('Requesting plan from Planner for SEARCH_GITHUB (dry-run)');
    const plan = agent.generatePlan(ACTION_TYPES.GOALS.SEARCH_GITHUB, {
      query: config.search.githubQuery,
    });

    agent.observe(
      `Plan ready (${plan.length} steps) — skipping execution (skeleton mode)`,
    );

    // -------------------------------------------------------------------------
    // 2. Execution gate — remove this block and add executeAll() when ready.
    // -------------------------------------------------------------------------
    logger.warn(
      'SearchGitHubWorkflow: SKELETON — plan was generated and logged above ' +
      'but will not be executed until this workflow is fully implemented.',
    );

    /*
     * Full implementation (Phase 2):
     *
     *   agent.act(`Executing ${plan.length}-step GitHub search plan`);
     *   await agent.executor.executeAll(plan);
     *   agent.verify('GitHub search plan completed');
     */

    logger.info('--- SearchGitHubWorkflow finished ---');
  }
}
