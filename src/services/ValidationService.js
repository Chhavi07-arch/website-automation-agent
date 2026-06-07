/**
 * ValidationService.js
 *
 * Verifies that actions had their intended effect.
 * This is the "Verify" step in the OTAV loop.
 *
 * Responsibilities:
 *   - Confirm a field contains the expected value after filling.
 *   - Confirm an element is visible / enabled / focused.
 *   - Confirm navigation reached the expected URL.
 */

import logger from '../utils/logger.js';
import config from '../config/env.js';

export class ValidationService {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Confirm that an input or textarea contains the expected value.
   *
   * @param {import('playwright').Locator} locator
   * @param {string} expectedValue
   * @returns {Promise<boolean>}
   */
  async fieldHasValue(locator, expectedValue) {
    const actual = await locator.inputValue({ timeout: config.timeouts.element });
    const passed = actual === expectedValue;

    if (passed) {
      logger.verify(`Field value matches: "${expectedValue}"`);
    } else {
      logger.warn(`Field value mismatch — expected: "${expectedValue}", actual: "${actual}"`);
    }

    return passed;
  }

  /**
   * Confirm that an element is visible on the page.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<boolean>}
   */
  async elementIsVisible(locator) {
    const visible = await locator.isVisible();
    if (visible) {
      logger.verify('Element is visible');
    } else {
      logger.warn('Element is NOT visible');
    }
    return visible;
  }

  /**
   * Confirm that the current page URL contains the expected substring.
   *
   * @param {string} expectedFragment
   * @returns {boolean}
   */
  urlContains(expectedFragment) {
    const currentUrl = this._page.url();
    const passed = currentUrl.includes(expectedFragment);

    if (passed) {
      logger.verify(`URL contains expected fragment: "${expectedFragment}"`);
    } else {
      logger.warn(
        `URL mismatch — expected fragment: "${expectedFragment}", actual URL: "${currentUrl}"`,
      );
    }

    return passed;
  }

  /**
   * Wait until a locator becomes visible within the timeout, then assert.
   *
   * @param {import('playwright').Locator} locator
   * @param {string} [description] - Human-readable description for the log.
   * @returns {Promise<boolean>}
   */
  async waitForVisible(locator, description = 'element') {
    try {
      await locator.waitFor({ state: 'visible', timeout: config.timeouts.element });
      logger.verify(`"${description}" became visible`);
      return true;
    } catch {
      logger.warn(`"${description}" did not become visible within timeout`);
      return false;
    }
  }
}
