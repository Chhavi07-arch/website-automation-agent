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
   * Verify that a search/results page actually executed by checking that EITHER
   * a results region rendered OR a recognised empty-state message is present.
   * Both outcomes prove the search ran — only the *absence of both* means the
   * search never executed (the false-positive we are guarding against).
   *
   * @param {object} opts
   * @param {string} [opts.resultsSelector] - CSS selector for the results container.
   * @param {string} [opts.emptyHint]       - Regex source matching an empty-state message.
   * @returns {Promise<boolean>} true if results OR a valid empty-state are present.
   */
  async verifyResultsRendered({ resultsSelector, emptyHint } = {}) {
    // Case 1: a results container is visible → results were found.
    if (resultsSelector) {
      const found = await this._page
        .locator(resultsSelector)
        .first()
        .isVisible()
        .catch(() => false);
      if (found) {
        logger.verify(`Results rendered — "${resultsSelector}" visible (results found)`);
        return true;
      }
    }

    // Case 2: an empty-state message is present → search ran, zero results.
    if (emptyHint) {
      const count = await this._page
        .getByText(new RegExp(emptyHint, 'i'))
        .count()
        .catch(() => 0);
      if (count > 0) {
        logger.verify(`Search executed — empty-results state detected (matched /${emptyHint}/i)`);
        return true;
      }
    }

    // Neither → the search did not actually execute.
    logger.warn(
      'No results region and no empty-state detected — search may NOT have executed',
    );
    return false;
  }

  // ---------------------------------------------------------------------------
  // Blocked-state detection (P2) — anti-bot walls
  // ---------------------------------------------------------------------------

  /**
   * Detect whether the current page is an anti-bot wall and classify why.
   *
   * Signals (from live forensics in INVESTIGATION_REPORT_P2.md):
   *   CAPTCHA / unusual traffic — URL path /sorry/, iframe[src*="recaptcha"],
   *     #captcha-form, or body text like "unusual traffic".
   *   consent wall — form[action*="consent"] or "Before you continue to Google".
   *
   * @returns {Promise<{blocked: boolean, reason: string|null}>}
   */
  async verifyBlockedState() {
    const url = this._page.url();

    const info = await this._page.evaluate(() => {
      const has = (sel) => !!document.querySelector(sel);
      const text = (document.body && document.body.innerText) || '';
      return {
        captchaDom: has('iframe[src*="recaptcha"]') || has('#captcha-form') || has('form#captcha'),
        unusual: /unusual traffic|our systems have detected|are you a robot|not a robot|verify (it'?s )?you/i.test(text),
        consentForm: has('form[action*="consent"]'),
        consentText: /before you continue to google|accept all\s+reject all/i.test(text),
      };
    }).catch(() => ({}));

    let reason = null;
    if (url.includes('/sorry/') || info.captchaDom) reason = 'CAPTCHA';
    else if (info.unusual) reason = 'unusual traffic';
    else if (info.consentForm || info.consentText) reason = 'consent wall';

    const blocked = reason !== null;
    if (blocked) {
      logger.warn(`[BLOCKED] Anti-bot state detected — ${reason}`);
    } else {
      logger.verify('No blocked-state (CAPTCHA / consent) detected');
    }
    return { blocked, reason };
  }

  /**
   * Convenience: is a CAPTCHA / "unusual traffic" wall present?
   * @returns {Promise<boolean>}
   */
  async verifyCaptchaPresent() {
    const { reason } = await this.verifyBlockedState();
    return reason === 'CAPTCHA' || reason === 'unusual traffic';
  }

  /**
   * Convenience: is a consent gate present?
   * @returns {Promise<boolean>}
   */
  async verifyConsentPage() {
    const { reason } = await this.verifyBlockedState();
    return reason === 'consent wall';
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
