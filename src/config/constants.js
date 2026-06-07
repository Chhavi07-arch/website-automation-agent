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

/** Log level names used in the OTAV cycle + planning layer. */
export const LOG_LEVELS = {
  PLAN:    'plan',    // Planner emitting a structured step description
  OBSERVE: 'observe',
  THINK:   'think',
  ACT:     'act',
  VERIFY:  'verify',
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

  // Utilities
  SCREENSHOT:     'SCREENSHOT',
  WAIT:           'WAIT',            // sleep for N ms

  /** Named goal identifiers passed to Planner.generatePlan(). */
  GOALS: {
    FILL_SHADCN_FORM: 'FILL_SHADCN_FORM',
  },
};
