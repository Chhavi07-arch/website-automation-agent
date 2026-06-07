/**
 * ActionExecutor.js
 *
 * Dispatches action objects to the correct tool method.
 *
 * Why this exists:
 *   Workflows can describe what they want to do as a plain data object:
 *     { type: 'FILL', locator, value: 'Jane' }
 *
 *   The ActionExecutor translates that into the actual tool call.  This makes
 *   it possible in Phase 4 to have an LLM produce action objects that are then
 *   executed here — the LLM never calls tools directly.
 *
 * All action types are defined in config/constants.js (ACTION_TYPES).
 */

import { ACTION_TYPES } from '../config/constants.js';
import logger from '../utils/logger.js';

export class ActionExecutor {
  /**
   * @param {import('./Agent.js').Agent} agent - Fully-initialised agent instance.
   */
  constructor(agent) {
    this._agent = agent;
  }

  /**
   * Execute a single action descriptor.
   *
   * @param {object} action
   * @param {string} action.type        - One of ACTION_TYPES.
   * @param {string} [action.url]       - Used by NAVIGATE.
   * @param {import('playwright').Locator} [action.locator] - Target element.
   * @param {string} [action.value]     - Text value for FILL / SEND_KEYS.
   * @param {string} [action.label]     - Screenshot label for SCREENSHOT.
   * @param {number} [action.pixels]    - Pixels for SCROLL.
   * @param {string} [action.direction] - 'up' | 'down' for SCROLL.
   * @param {number} [action.ms]        - Duration for WAIT.
   * @returns {Promise<any>}
   */
  async execute(action) {
    const { type } = action;
    logger.act(`Executing action: ${type}`);

    switch (type) {
      case ACTION_TYPES.NAVIGATE:
        return this._agent.navigation.navigateTo(action.url);

      case ACTION_TYPES.CLICK:
        return this._agent.click.click(action.locator);

      case ACTION_TYPES.DOUBLE_CLICK:
        return this._agent.click.doubleClick(action.locator);

      case ACTION_TYPES.FILL:
        return this._agent.input.fill(action.locator, action.value);

      case ACTION_TYPES.SEND_KEYS:
        return this._agent.input.sendKeys(action.locator, action.value);

      case ACTION_TYPES.SCROLL:
        if (action.direction === 'up') {
          return this._agent.scroll.scrollUp(action.pixels);
        }
        return this._agent.scroll.scrollDown(action.pixels);

      case ACTION_TYPES.SCREENSHOT:
        return this._agent.screenshot.capture(action.label || '');

      case ACTION_TYPES.WAIT:
        return new Promise((resolve) => setTimeout(resolve, action.ms || 1000));

      default:
        logger.warn(`Unknown action type: "${type}" — skipping`);
        return null;
    }
  }

  /**
   * Execute an ordered list of actions sequentially.
   * Stops immediately if any action throws.
   *
   * @param {object[]} actions
   * @returns {Promise<any[]>} Results of each action.
   */
  async executeAll(actions) {
    const results = [];
    for (const action of actions) {
      results.push(await this.execute(action));
    }
    return results;
  }
}
