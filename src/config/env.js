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
    /**
     * Browser UI locale. A realistic locale reduces anti-bot triggers
     * (e.g. Google's CAPTCHA/consent walls). Set BROWSER_LOCALE to override.
     */
    locale: process.env.BROWSER_LOCALE || 'en-US',
    /**
     * User-Agent string. A realistic desktop UA reduces anti-bot triggers
     * (the default headless UA contains "HeadlessChrome", a strong bot signal).
     * Set BROWSER_UA='' to fall back to Playwright's default.
     */
    userAgent:
      process.env.BROWSER_UA !== undefined
        ? process.env.BROWSER_UA
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
    /**
     * Value typed into the shadcn "name" field.
     * NOTE: on the shadcn demo this field is actually the *username* input
     * (label "Username"), so the value should look like a username, not a
     * full name. `USERNAME` is the canonical var; `FORM_NAME` is kept as a
     * backward-compatible fallback.
     */
    username: process.env.USERNAME || process.env.FORM_NAME || 'chhavi_ahlawat',
    /** Value typed into the "description" textarea — a believable bio. */
    description:
      process.env.FORM_DESCRIPTION ||
      'A first-year CS student building browser automation agents.',
  },

  target: {
    /** The URL the agent will navigate to (used by FILL_SHADCN_FORM) */
    url: process.env.TARGET_URL || 'https://ui.shadcn.com/docs/forms/react-hook-form',
    /**
     * Which goal to run.  Must match one of ACTION_TYPES.GOALS.
     * Defaults to FILL_SHADCN_FORM for backward compatibility.
     */
    goal: process.env.GOAL || 'FILL_SHADCN_FORM',
  },

  search: {
    /** Query string used by SearchGoogleWorkflow */
    googleQuery: process.env.GOOGLE_QUERY || 'Playwright browser automation',
    /** Query string used by SearchGitHubWorkflow */
    githubQuery: process.env.GITHUB_QUERY || 'playwright',
  },

  task: {
    /**
     * Task definition file (under tasks/) executed by the MULTI_STEP goal.
     * e.g. TASK_FILE=github_playwright.json GOAL=MULTI_STEP npm start
     */
    file: process.env.TASK_FILE || 'github_playwright.json',
  },

  report: {
    /** Write a self-contained HTML run report after each run (reports/). */
    enabled: parseBool(process.env.REPORT, true),
  },

  retry: {
    /** Max attempts for retryable element actions (CLICK, FILL, DETECT_FIELD, …) */
    actionRetries: parseInt_(process.env.RETRY_COUNT, 3),
    /**
     * Max attempts for NAVIGATE. Kept small and bounded — navigation must NOT
     * retry indefinitely. Default 2 = one retry after a transient failure.
     */
    navigationRetries: parseInt_(process.env.NAV_RETRY_COUNT, 2),
    /** First backoff delay in ms; doubles each attempt (500 → 1000 → 2000). */
    baseDelay: parseInt_(process.env.RETRY_BASE_DELAY_MS, 500),
  },

  logging: {
    /** Minimum log level: error | warn | info | verbose | debug | silly */
    level: process.env.LOG_LEVEL || 'info',
    /** Whether to write logs to files in addition to the console */
    toFile: parseBool(process.env.LOG_TO_FILE, true),
  },

  demo: {
    /** Master demo switch — slows actions slightly and prints clear banners. */
    enabled: parseBool(process.env.DEMO_MODE, false),
    /** If > 0, pause this many ms before finishing so results stay on screen. */
    pauseMs: parseInt_(process.env.DEMO_PAUSE_MS, 0),
    /** If true, do NOT auto-close the browser — wait for the user to press Enter. */
    keepBrowserOpen: parseBool(process.env.KEEP_BROWSER_OPEN, false),
  },
};

export default config;
