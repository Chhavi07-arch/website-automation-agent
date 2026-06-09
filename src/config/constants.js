/**
 * constants.js
 *
 * Immutable, application-wide constants. These are values that will not change
 * between environments (unlike config/env.js which reads from .env).
 *
 * Centralising them here prevents magic numbers from being scattered across
 * the codebase and makes the system easier to tune in one place.
 */

/** Ordered list of strategies the ElementDetectionService will try.
 *  Earlier entries = higher priority. */
export const ELEMENT_DETECTION_PRIORITY = [
  'label',        // <label for="..."> or aria-label
  'aria',         // role + aria-* attributes
  'placeholder',  // placeholder attribute on inputs
  'name',         // name attribute
  'css',          // fallback: CSS selector
];

/** Log level names used in the OTAV cycle + planning + resilience layers. */
export const LOG_LEVELS = {
  RECOVERY: 'recovery', // self-healing decision (scroll & re-scan, force rescan, …)
  PLAN:     'plan',     // Planner emitting a structured step description
  OBSERVE:  'observe',
  THINK:    'think',
  ACT:      'act',
  VERIFY:   'verify',
};

/** How many times to retry a flaky action before giving up. */
export const MAX_RETRIES = 3;

/** ms to wait between retry attempts. */
export const RETRY_DELAY_MS = 1000;

/** Screenshot filename timestamp format token (used in fileHelper). */
export const SCREENSHOT_TIMESTAMP_FORMAT = 'YYYY-MM-DD_HH-mm-ss';

/** Playwright waitUntil state used after navigation. */
export const PAGE_LOAD_STATE = 'domcontentloaded';

/** Viewport dimensions set on every new page. */
export const VIEWPORT = { width: 1280, height: 800 };

/** Names (lowercased) that identify a "name" form field. */
export const NAME_FIELD_HINTS = ['name', 'username', 'full name', 'fullname', 'first name'];

/** Names (lowercased) that identify a "description" form field. */
export const DESCRIPTION_FIELD_HINTS = ['description', 'bio', 'about', 'details', 'summary'];

/**
 * Names / attributes that identify a search box.
 * Ordered by reliability across different sites:
 *   'search' — matches aria-label "Search", "Search GitHub", etc.
 *   'q'      — the standard query-string name used by Google, Bing, DDG, etc.
 *   'query'  — common alternative name attribute
 *   'find'   — used by some internal search forms
 */
export const SEARCH_FIELD_HINTS = ['search', 'q', 'query', 'find'];

/** Action type strings dispatched through ActionExecutor. */
export const ACTION_TYPES = {
  // Navigation
  NAVIGATE:       'NAVIGATE',
  WAIT_FOR_IDLE:  'WAIT_FOR_IDLE',   // wait until network is quiet

  // Mouse
  CLICK:          'CLICK',
  DOUBLE_CLICK:   'DOUBLE_CLICK',

  // Keyboard
  FILL:           'FILL',
  SEND_KEYS:      'SEND_KEYS',

  // Page movement
  SCROLL:         'SCROLL',

  // Intelligence (Planner-specific)
  DETECT_FIELD:   'DETECT_FIELD',    // resolve a named field → locator, cache in registry
  VERIFY_FIELD:   'VERIFY_FIELD',    // assert a field's current value equals expected
  VERIFY_URL:     'VERIFY_URL',      // assert current URL contains a fragment
  VERIFY_RESULTS: 'VERIFY_RESULTS',  // assert a results region OR an empty-state rendered
  CHECK_BLOCKED:  'CHECK_BLOCKED',   // throw BlockedError if a CAPTCHA/consent wall is present

  // Keyboard
  PRESS_KEY:      'PRESS_KEY',       // page-level key press (e.g. '/', 'Enter', 'Escape')

  // Utilities
  SCREENSHOT:     'SCREENSHOT',
  WAIT:           'WAIT',            // sleep for N ms

  /**
   * Execution outcomes — how a workflow run ended. This is a result category,
   * NOT an architectural layer.
   *   SUCCESS — the task completed and was verified.
   *   BLOCKED — the website blocked automation (CAPTCHA / consent / unusual traffic).
   *   FAILED  — a real failure (navigation exhausted, field never found, bug).
   */
  OUTCOMES: {
    SUCCESS: 'SUCCESS',
    BLOCKED: 'BLOCKED',
    FAILED:  'FAILED',
  },

  /**
   * Named goal identifiers passed to GoalRouter.route() and Planner.generatePlan().
   * Add new goals here when introducing new workflows.
   */
  GOALS: {
    FILL_SHADCN_FORM: 'FILL_SHADCN_FORM',  // fill the shadcn React Hook Form demo
    SEARCH_GOOGLE:    'SEARCH_GOOGLE',      // navigate to Google and search for a query
    SEARCH_GITHUB:    'SEARCH_GITHUB',      // navigate to GitHub and search for a query
  },
};
