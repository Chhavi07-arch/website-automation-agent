/**
 * ScrollTool.js
 *
 * Handles page and element scrolling.
 * Provides scroll from the assignment spec.
 *
 * Responsibilities:
 *   - Scroll the page up or down by a pixel amount.
 *   - Scroll to bring a specific element into the viewport.
 *   - Scroll to the very top or bottom of the page.
 */

import { sleep } from '../utils/fileHelper.js';
import logger from '../utils/logger.js';

export class ScrollTool {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Scroll the page down by a given number of pixels.
   *
   * @param {number} [pixels=400]
   * @returns {Promise<void>}
   */
  async scrollDown(pixels = 400) {
    logger.act(`Scrolling down ${pixels}px`);
    await this._page.mouse.wheel(0, pixels);
    await sleep(300);
    logger.verify('Scrolled down');
  }

  /**
   * Scroll the page up by a given number of pixels.
   *
   * @param {number} [pixels=400]
   * @returns {Promise<void>}
   */
  async scrollUp(pixels = 400) {
    logger.act(`Scrolling up ${pixels}px`);
    await this._page.mouse.wheel(0, -pixels);
    await sleep(300);
    logger.verify('Scrolled up');
  }

  /**
   * Scroll until a specific element is visible in the viewport.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<void>}
   */
  async scrollToElement(locator) {
    logger.act('Scrolling element into view');
    await locator.scrollIntoViewIfNeeded();
    await sleep(300);
    logger.verify('Element is in viewport');
  }

  /**
   * Scroll to the absolute top of the page.
   *
   * @returns {Promise<void>}
   */
  async scrollToTop() {
    logger.act('Scrolling to top of page');
    await this._page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    logger.verify('At top of page');
  }

  /**
   * Scroll to the absolute bottom of the page.
   *
   * @returns {Promise<void>}
   */
  async scrollToBottom() {
    logger.act('Scrolling to bottom of page');
    await this._page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight),
    );
    await sleep(300);
    logger.verify('At bottom of page');
  }
}
