/**
 * ClickTool.js
 *
 * Handles mouse-click interactions.
 * Provides click_on_screen and double_click from the assignment spec.
 *
 * Responsibilities:
 *   - Single click on a locator.
 *   - Double-click on a locator.
 *   - Click at absolute screen coordinates (for screenshot-based interaction).
 */

import config from '../config/env.js';
import { sleep } from '../utils/fileHelper.js';
import logger from '../utils/logger.js';

export class ClickTool {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Single-click on a located element.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<void>}
   */
  async click(locator) {
    logger.act('Clicking element');
    await locator.click({ timeout: config.timeouts.element });
    await sleep(config.timeouts.actionDelay);
    logger.verify('Click completed');
  }

  /**
   * Double-click on a located element.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<void>}
   */
  async doubleClick(locator) {
    logger.act('Double-clicking element');
    await locator.dblclick({ timeout: config.timeouts.element });
    await sleep(config.timeouts.actionDelay);
    logger.verify('Double-click completed');
  }

  /**
   * Click at a specific coordinate on the viewport.
   * Used when element selectors are not available (future screenshot-AI mode).
   *
   * @param {number} x
   * @param {number} y
   * @returns {Promise<void>}
   */
  async clickAt(x, y) {
    logger.act(`Clicking at coordinates (${x}, ${y})`);
    await this._page.mouse.click(x, y);
    await sleep(config.timeouts.actionDelay);
    logger.verify(`Clicked at (${x}, ${y})`);
  }

  /**
   * Hover over an element without clicking (useful for revealing tooltips).
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<void>}
   */
  async hover(locator) {
    logger.act('Hovering over element');
    await locator.hover({ timeout: config.timeouts.element });
    logger.verify('Hover completed');
  }
}
