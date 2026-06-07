/**
 * InputTool.js
 *
 * Handles keyboard input and form filling.
 * Provides send_keys from the assignment spec.
 *
 * Responsibilities:
 *   - Fill an input/textarea with a string value.
 *   - Press individual keys or key combinations.
 *   - Clear an input field.
 */

import config from '../config/env.js';
import { sleep } from '../utils/fileHelper.js';
import logger from '../utils/logger.js';

export class InputTool {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Fill a located element with the given text, replacing any existing value.
   * Uses Playwright's fill() which is safer than type() for most inputs.
   *
   * @param {import('playwright').Locator} locator
   * @param {string} text - Text to enter.
   * @returns {Promise<void>}
   */
  async fill(locator, text) {
    logger.act(`Filling field with: "${text}"`);
    await locator.fill(text, { timeout: config.timeouts.element });
    await sleep(config.timeouts.actionDelay);
    logger.verify(`Field filled with: "${text}"`);
  }

  /**
   * Type text character-by-character with a natural delay.
   * Useful for fields that listen to keystroke events (e.g. autocomplete).
   *
   * @param {import('playwright').Locator} locator
   * @param {string} text
   * @param {number} [delay=50] - ms between each keystroke.
   * @returns {Promise<void>}
   */
  async sendKeys(locator, text, delay = 50) {
    logger.act(`Typing key-by-key: "${text}"`);
    await locator.pressSequentially(text, { delay });
    await sleep(config.timeouts.actionDelay);
    logger.verify(`Keys sent: "${text}"`);
  }

  /**
   * Clear the current value of an input field.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<void>}
   */
  async clear(locator) {
    logger.act('Clearing input field');
    await locator.fill('');
    logger.verify('Input field cleared');
  }

  /**
   * Press a keyboard shortcut or single key (e.g. 'Enter', 'Tab', 'Control+A').
   *
   * @param {string} key - Playwright key string.
   * @returns {Promise<void>}
   */
  async pressKey(key) {
    logger.act(`Pressing key: ${key}`);
    await this._page.keyboard.press(key);
  }
}
