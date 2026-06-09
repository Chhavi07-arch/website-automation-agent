/**
 * NavigationTool.js
 *
 * Wraps Playwright's page navigation capabilities.
 * Provides navigate_to_url from the assignment spec.
 *
 * Responsibilities:
 *   - Navigate to a URL and wait for the page to be usable.
 *   - Reload the current page.
 *   - Go back / forward in history.
 *   - Return the current URL and title.
 */

import config from '../config/env.js';
import { PAGE_LOAD_STATE } from '../config/constants.js';
import logger from '../utils/logger.js';

export class NavigationTool {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Navigate to a URL and wait until the page is loaded enough to interact.
   *
   * @param {string} url - The full URL to navigate to.
   * @returns {Promise<void>}
   */
  async navigateTo(url) {
    logger.act(`Navigating to: ${url}`);

    await this._page.goto(url, {
      waitUntil: PAGE_LOAD_STATE,
      timeout: config.timeouts.pageLoad,
    });

    const title = await this._page.title();
    logger.observe(`Page loaded — title: "${title}"`);
  }

  /**
   * Reload the current page.
   *
   * @returns {Promise<void>}
   */
  async reload() {
    logger.act('Reloading current page');
    await this._page.reload({ waitUntil: PAGE_LOAD_STATE });
    logger.observe('Page reloaded');
  }

  /**
   * Return the URL of the currently loaded page.
   *
   * @returns {string}
   */
  currentUrl() {
    return this._page.url();
  }

  /**
   * Return the <title> of the currently loaded page.
   *
   * @returns {Promise<string>}
   */
  async currentTitle() {
    return this._page.title();
  }

  /**
   * Wait until the page network is idle (no pending requests for 500ms).
   * Useful after form submissions or AJAX-heavy pages.
   *
   * @returns {Promise<void>}
   */
  async waitForNetworkIdle() {
    logger.think('Waiting for network to become idle');
    // networkidle is a soft "settle" heuristic — many real pages never reach it
    // (analytics, websockets, anti-bot challenges). Treat a timeout as a warning,
    // not a failure, so a non-idling page does not abort the whole workflow.
    try {
      await this._page.waitForLoadState('networkidle', {
        timeout: config.timeouts.element,
      });
      logger.observe('Network is idle');
    } catch {
      logger.warn('Network did not reach idle within timeout — continuing anyway');
    }
  }
}
