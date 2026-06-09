/**
 * BrowserManager.js
 *
 * Manages the Playwright browser lifecycle: launching, creating browser
 * contexts, opening pages, and closing everything cleanly.
 *
 * This is the single source of truth for the browser instance. All other
 * tools receive a `page` reference from here rather than creating their own.
 *
 * Responsibility:
 *   open_browser capability from the assignment spec.
 */

import { chromium, firefox, webkit } from 'playwright';
import config from '../config/env.js';
import { VIEWPORT } from '../config/constants.js';
import logger from '../utils/logger.js';

/** Map of browser-type strings to their Playwright launcher functions. */
const BROWSER_LAUNCHERS = { chromium, firefox, webkit };

export class BrowserManager {
  constructor() {
    /** @type {import('playwright').Browser|null} */
    this._browser = null;

    /** @type {import('playwright').BrowserContext|null} */
    this._context = null;

    /** @type {import('playwright').Page|null} */
    this._page = null;
  }

  /**
   * Launch the browser, create a context and an initial page.
   * Applies viewport and slow-motion settings from config.
   *
   * @returns {Promise<import('playwright').Page>} The ready-to-use page.
   */
  async launch() {
    const browserType = config.browser.type;
    const launcher = BROWSER_LAUNCHERS[browserType];

    if (!launcher) {
      throw new Error(
        `Unknown browser type "${browserType}". Valid options: chromium, firefox, webkit.`,
      );
    }

    // Demo Mode slows actions slightly so each step is watchable on screen.
    const slowMo = config.demo.enabled
      ? Math.max(config.browser.slowMo, 150)
      : config.browser.slowMo;

    if (config.demo.enabled) {
      logger.info(`🎬 DEMO MODE on — actions slowed (slowMo=${slowMo}ms), screenshots kept`);
    }
    logger.info(`Launching ${browserType} browser (headless=${config.browser.headless})`);

    this._browser = await launcher.launch({
      headless: config.browser.headless,
      slowMo,
    });

    // A realistic context (locale + desktop UA + Accept-Language) makes the
    // agent look less like a bot, which materially reduces anti-bot walls
    // (e.g. Google CAPTCHA). See INVESTIGATION_REPORT_P2.md.
    this._context = await this._browser.newContext({
      viewport: VIEWPORT,
      locale: config.browser.locale,
      ...(config.browser.userAgent ? { userAgent: config.browser.userAgent } : {}),
      extraHTTPHeaders: { 'Accept-Language': `${config.browser.locale},en;q=0.9` },
    });

    this._page = await this._context.newPage();

    logger.info('Browser launched and page ready');
    return this._page;
  }

  /**
   * Return the current active page.
   * Throws if the browser has not been launched yet.
   *
   * @returns {import('playwright').Page}
   */
  getPage() {
    if (!this._page) {
      throw new Error('No active page. Call launch() first.');
    }
    return this._page;
  }

  /**
   * Gracefully close the browser and release all resources.
   * Safe to call even if launch() was never called.
   *
   * @returns {Promise<void>}
   */
  async close() {
    if (this._browser) {
      logger.info('Closing browser');
      await this._browser.close();
      this._browser = null;
      this._context = null;
      this._page = null;
    }
  }
}
