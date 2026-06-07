/**
 * ScreenshotTool.js
 *
 * Captures screenshots of the current browser page.
 * Provides take_screenshot from the assignment spec.
 *
 * Screenshots are saved under screenshots/ with timestamped filenames so
 * every run produces a new set of files without overwriting previous ones.
 */

import { buildScreenshotPath } from '../utils/fileHelper.js';
import logger from '../utils/logger.js';

export class ScreenshotTool {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Capture a full-page screenshot and save it to disk.
   *
   * @param {string} label - Short human-readable label used in the filename.
   * @returns {Promise<string>} - Absolute path to the saved screenshot.
   */
  async capture(label = '') {
    const filePath = buildScreenshotPath(label);
    logger.act(`Taking screenshot: ${filePath}`);

    await this._page.screenshot({
      path: filePath,
      fullPage: true,
    });

    logger.verify(`Screenshot saved — ${filePath}`);
    return filePath;
  }

  /**
   * Capture a screenshot of a specific element only.
   *
   * @param {import('playwright').Locator} locator - The element to capture.
   * @param {string} label
   * @returns {Promise<string>}
   */
  async captureElement(locator, label = 'element') {
    const filePath = buildScreenshotPath(label);
    logger.act(`Taking element screenshot: ${filePath}`);

    await locator.screenshot({ path: filePath });

    logger.verify(`Element screenshot saved — ${filePath}`);
    return filePath;
  }
}
