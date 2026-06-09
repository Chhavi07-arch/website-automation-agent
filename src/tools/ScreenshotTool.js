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
import config from '../config/env.js';
import logger from '../utils/logger.js';

export class ScreenshotTool {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Capture a screenshot and save it to disk.
   *
   * Tries a full-page capture first (bounded by a timeout). Very tall pages
   * (e.g. a long Wikipedia article) can exceed Playwright's screenshot timeout
   * "waiting for fonts to load", so on failure we fall back to a fast
   * viewport-only capture. A screenshot is auxiliary evidence — if even that
   * fails it is logged and skipped rather than failing the whole workflow.
   *
   * @param {string} label - Short human-readable label used in the filename.
   * @returns {Promise<string>} - Absolute path to the (attempted) screenshot.
   */
  async capture(label = '') {
    const filePath = buildScreenshotPath(label);
    const timeout = config.timeouts.element; // bounded; default 10s
    logger.act(`Taking screenshot: ${filePath}`);

    // 1) Preferred: full-page.
    try {
      await this._page.screenshot({ path: filePath, fullPage: true, timeout });
      logger.verify(`Screenshot saved — ${filePath}`);
      return filePath;
    } catch (err) {
      logger.warn(`Full-page screenshot failed (${err.message.split('\n')[0]}) — falling back to viewport`);
    }

    // 2) Fallback: viewport-only (fast, reliable on huge pages).
    try {
      await this._page.screenshot({ path: filePath, fullPage: false, timeout });
      logger.verify(`Screenshot saved (viewport) — ${filePath}`);
      return filePath;
    } catch (err) {
      // 3) Best-effort: never let an auxiliary screenshot fail the run.
      logger.warn(`Screenshot skipped (${err.message.split('\n')[0]}) — continuing`);
      return filePath;
    }
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
