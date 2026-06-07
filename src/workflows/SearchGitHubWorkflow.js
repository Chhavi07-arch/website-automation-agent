/**
 * SearchGitHubWorkflow.js
 *
 * Full implementation: navigate to GitHub, open the search dialog via the '/'
 * keyboard shortcut, detect the search input dynamically, type a query, submit,
 * and verify the results page loaded.
 *
 * URL strategy:
 *   Navigates to https://github.com/search instead of the GitHub homepage.
 *   The homepage exposes search as a <button aria-haspopup="dialog"> —
 *   not a text input — causing getByLabel(/search/i) to resolve to the button,
 *   which cannot be filled.  The /search page has a standard <input name="q">
 *   that the 'q' entry in SEARCH_FIELD_HINTS detects reliably on all locales.
 *
 * Follows the full Workflow → Planner → ActionExecutor → Tools chain.
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
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;
    logger.info('--- SearchGitHubWorkflow starting ---');

    // 1. Ask the Planner for the full action sequence.
    agent.think(`Planning GitHub search for: "${config.search.githubQuery}"`);
    const plan = agent.generatePlan(ACTION_TYPES.GOALS.SEARCH_GITHUB, {
      query: config.search.githubQuery,
    });

    // 2. Execute every step through ActionExecutor.
    agent.act(`Executing ${plan.length}-step GitHub search plan`);
    await agent.executor.executeAll(plan);

    agent.verify('GitHub search workflow complete');
    logger.info('--- SearchGitHubWorkflow finished ---');
  }
}
