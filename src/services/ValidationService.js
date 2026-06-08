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

  // ---------------------------------------------------------------------------
  // Reusable verification actions (V4)
  // ---------------------------------------------------------------------------

  /**
   * Verify an element is visible, waiting up to the element timeout for it to
   * appear.  Unlike elementIsVisible() (an instantaneous check), this gives a
   * lazily-rendered element time to show up — useful in recovery scenarios.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<boolean>}
   */
  async verifyElementVisible(locator) {
    try {
      await locator.waitFor({ state: 'visible', timeout: config.timeouts.element });
      logger.verify('Element is visible');
      return true;
    } catch {
      logger.warn('Element did not become visible within timeout');
      return false;
    }
  }

  /**
   * Verify an element is enabled (not disabled / not [aria-disabled]).
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<boolean>}
   */
  async verifyElementEnabled(locator) {
    const enabled = await locator.isEnabled().catch(() => false);
    if (enabled) {
      logger.verify('Element is enabled');
    } else {
      logger.warn('Element is NOT enabled');
    }
    return enabled;
  }

  /**
   * Verify the page finished loading (document.readyState === 'complete').
   * Waits for the 'load' state up to the page-load timeout first.
   *
   * @returns {Promise<boolean>}
   */
  async verifyPageLoaded() {
    try {
      await this._page.waitForLoadState('load', { timeout: config.timeouts.pageLoad });
      const state = await this._page.evaluate(() => document.readyState);
      const loaded = state === 'complete';
      if (loaded) {
        logger.verify('Page fully loaded (readyState=complete)');
      } else {
        logger.warn(`Page not fully loaded (readyState=${state})`);
      }
      return loaded;
    } catch {
      logger.warn('verifyPageLoaded: timed out waiting for load state');
      return false;
    }
  }
}
