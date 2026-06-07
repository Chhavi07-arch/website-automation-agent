/**
 * SearchGoogleWorkflow.js
 *
 * Full implementation: navigate to Google, detect the search box dynamically,
 * type a query, submit, and verify the results page loaded.
 *
 * Detection strategy:
 *   Google's search box has name="q" on all locales.
 *   FormDetectionService finds it via the 'q' entry in SEARCH_FIELD_HINTS,
 *   so no locale-specific selectors are hardcoded here.
 *
 * Follows the full Workflow → Planner → ActionExecutor → Tools chain.
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
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;
    logger.info('--- SearchGoogleWorkflow starting ---');

    // 1. Ask the Planner for the full action sequence.
    agent.think(`Planning Google search for: "${config.search.googleQuery}"`);
    const plan = agent.generatePlan(ACTION_TYPES.GOALS.SEARCH_GOOGLE, {
      query: config.search.googleQuery,
    });

    // 2. Execute every step through ActionExecutor.
    agent.act(`Executing ${plan.length}-step Google search plan`);
    await agent.executor.executeAll(plan);

    agent.verify('Google search workflow complete');
    logger.info('--- SearchGoogleWorkflow finished ---');
  }
}
