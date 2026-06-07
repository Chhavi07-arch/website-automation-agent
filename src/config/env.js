/**
 * env.js
 *
 * Central configuration loader. Reads environment variables (via dotenv) and
 * exports a single typed config object used throughout the application.
 *
 * All other modules import from here — never from process.env directly —
 * so configuration is validated and documented in one place.
 */

import 'dotenv/config';

/**
 * Parse a string env var as a boolean.
 * "true" / "1" / "yes" → true, everything else → false.
 *
 * @param {string|undefined} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function parseBool(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Parse a string env var as an integer.
 *
 * @param {string|undefined} value
 * @param {number} defaultValue
 * @returns {number}
 */
function parseInt_(value, defaultValue) {
  const n = parseInt(value, 10);
  return isNaN(n) ? defaultValue : n;
}

const config = {
  browser: {
    /** Which Playwright browser engine to use: chromium | firefox | webkit */
    type: process.env.BROWSER_TYPE || 'chromium',
    /** Run browser without a visible window */
    headless: parseBool(process.env.HEADLESS, false),
    /** Slow down Playwright actions by this many ms (useful for demos) */
    slowMo: parseInt_(process.env.SLOW_MO, 50),
  },

  timeouts: {
    /** Maximum ms to wait for a full page load */
    pageLoad: parseInt_(process.env.PAGE_LOAD_TIMEOUT, 30000),
    /** Maximum ms to wait for a single element to appear */
    element: parseInt_(process.env.ELEMENT_TIMEOUT, 10000),
    /** ms to pause between consecutive actions (makes demos readable) */
    actionDelay: parseInt_(process.env.ACTION_DELAY, 500),
  },

  form: {
    /** Value to type into any "name" field found on the page */
    name: process.env.FORM_NAME || 'Jane Doe',
    /** Value to type into any "description" field found on the page */
    description:
      process.env.FORM_DESCRIPTION ||
      'This is an automated description filled by the Website Automation Agent.',
  },

  target: {
    /** The URL the agent will navigate to */
    url: process.env.TARGET_URL || 'https://ui.shadcn.com/docs/forms/react-hook-form',
  },

  logging: {
    /** Minimum log level: error | warn | info | verbose | debug | silly */
    level: process.env.LOG_LEVEL || 'info',
    /** Whether to write logs to files in addition to the console */
    toFile: parseBool(process.env.LOG_TO_FILE, true),
  },
};

export default config;
