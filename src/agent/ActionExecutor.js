/**
 * ActionExecutor.js
 *
 * Dispatches action objects (produced by the Planner) to the correct tool,
 * with built-in resilience: retries with exponential backoff, and a recovery
 * escalation ladder for field detection.
 *
 * Architecture position:
 *   Planner → action[] → ActionExecutor → RetryService → Recovery → Tools
 *
 * Resilience model (V4):
 *   - _rawExecute(action)  : single-attempt dispatch (the original switch).
 *   - execute(action)      : looks up a retry policy and wraps _rawExecute in
 *                            RetryService when the action type is retryable.
 *   - DETECT_FIELD         : uses a dedicated recovery ladder instead of a plain
 *                            retry (normal → scroll+rescan → force rescan → fail).
 *
 * Retry policy (configurable via .env → config.retry):
 *   DETECT_FIELD, CLICK, DOUBLE_CLICK, FILL, SEND_KEYS, PRESS_KEY → fatal retry
 *   VERIFY_URL  → non-fatal retry (gives slow pages time; never crashes workflow)
 *   NAVIGATE    → bounded retry (navigationRetries — NOT indefinite)
 *   all others  → run once, no retry
 *
 * Field Registry (from V2): Map<fieldName, Locator> populated by the first scan.
 */

import { ACTION_TYPES, DEFAULT_RESULT_LINK_SELECTOR } from '../config/constants.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { RetryService } from '../services/RetryService.js';
import { BlockedError } from '../utils/errors.js';

export class ActionExecutor {
  /**
   * @param {import('./Agent.js').Agent} agent - Fully-initialised agent instance.
   */
  constructor(agent) {
    this._agent = agent;

    /**
     * Maps semantic field names ('name', 'description', …) to Playwright Locators.
     * @type {Map<string, import('playwright').Locator>}
     */
    this._fieldRegistry = new Map();

    /** Set to true after the first full FormDetection scan. */
    this._fieldsScanned = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Execute a single action descriptor, applying retry/recovery per its policy.
   *
   * @param {object} action - Action descriptor (see _rawExecute for fields).
   * @returns {Promise<any>}
   */
  async execute(action) {
    // DETECT_FIELD has bespoke recovery behaviour — handle it separately.
    if (action.type === ACTION_TYPES.DETECT_FIELD) {
      return this._detectFieldWithRecovery(action);
    }

    const policy = this._retryPolicy(action.type);

    // Non-retryable actions run exactly once.
    if (!policy) {
      return this._rawExecute(action);
    }

    // Retryable actions run through RetryService with exponential backoff.
    try {
      return await RetryService.run(
        () => this._rawExecute(action),
        {
          retries: policy.retries,
          baseDelay: config.retry.baseDelay,
          label: this._label(action),
        },
      );
    } catch (err) {
      // A plan step may override fatality: `fatal: true` forces a crash even on
      // a normally-soft action (used to make GitHub's q=query/results checks
      // hard gates); `fatal: false` forces a soft warning.
      const fatal = action.fatal === true ? true
                  : action.fatal === false ? false
                  : policy.fatal;

      if (fatal) {
        err.failedAction = action;   // tag for diagnostics
        throw err;
      }
      // Non-fatal (e.g. Google VERIFY_URL): exhausting retries warns, not crashes.
      logger.warn(`Non-fatal action "${action.type}" failed after retries: ${err.message}`);
      return false;
    }
  }

  /**
   * Execute an ordered list of actions sequentially, logging each step number.
   * Stops immediately if any action throws (fatal failures propagate).
   *
   * @param {object[]} actions
   * @returns {Promise<any[]>} Results of each action in order.
   */
  async executeAll(actions) {
    const results = [];
    const total = actions.length;

    for (let i = 0; i < total; i++) {
      const action = actions[i];
      const detail = action.field ? ` → "${action.field}"`
                   : action.key   ? ` [${action.key}]`
                   : action.fragment ? ` ≈ "${action.fragment}"`
                   : action.selector ? ` (${action.selector})`
                   : action.resultsSelector || action.emptyHint ? ' (results check)'
                   : '';
      logger.plan(`[${i + 1}/${total}] ${action.type}${detail}`);
      results.push(await this.execute(action));
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Single-attempt dispatch (the original switch — unchanged behaviour)
  // ---------------------------------------------------------------------------

  /**
   * Run one attempt of an action. Throws on failure so RetryService can retry.
   *
   * @param {object} action
   * @param {string} action.type          - One of ACTION_TYPES.
   * @param {string} [action.url]         - NAVIGATE: destination URL.
   * @param {string} [action.field]       - Semantic field name.
   * @param {import('playwright').Locator} [action.locator] - Raw locator (legacy).
   * @param {string} [action.value]       - FILL / SEND_KEYS: text.
   * @param {string} [action.key]         - PRESS_KEY: key name.
   * @param {string} [action.fragment]    - VERIFY_URL: URL substring.
   * @param {string} [action.label]       - SCREENSHOT: filename label.
   * @param {number} [action.pixels]      - SCROLL: distance.
   * @param {string} [action.direction]   - SCROLL: 'up' | 'down'.
   * @param {number} [action.ms]          - WAIT: milliseconds.
   * @returns {Promise<any>}
   */
  async _rawExecute(action) {
    const { type } = action;

    switch (type) {
      // --- Navigation ---
      case ACTION_TYPES.NAVIGATE:
        return this._agent.navigation.navigateTo(action.url);

      case ACTION_TYPES.WAIT_FOR_IDLE:
        return this._agent.navigation.waitForNetworkIdle();

      // --- Field-value verification (non-retryable, returns boolean) ---
      case ACTION_TYPES.VERIFY_FIELD: {
        const locator = this._resolveLocator(action);
        return this._agent.validation.fieldHasValue(locator, action.value);
      }

      // --- Mouse ---
      case ACTION_TYPES.CLICK: {
        const locator = this._resolveLocator(action);
        return this._agent.click.click(locator);
      }

      case ACTION_TYPES.DOUBLE_CLICK: {
        const locator = this._resolveLocator(action);
        return this._agent.click.doubleClick(locator);
      }

      // --- Keyboard (element-targeted) ---
      case ACTION_TYPES.FILL: {
        const locator = this._resolveLocator(action);
        return this._agent.input.fill(locator, action.value);
      }

      case ACTION_TYPES.SEND_KEYS: {
        const locator = this._resolveLocator(action);
        return this._agent.input.sendKeys(locator, action.value);
      }

      // --- Page movement ---
      case ACTION_TYPES.SCROLL:
        if (action.direction === 'up') {
          return this._agent.scroll.scrollUp(action.pixels);
        }
        return this._agent.scroll.scrollDown(action.pixels);

      // --- Page-level keyboard ---
      case ACTION_TYPES.PRESS_KEY:
        return this._agent.input.pressKey(action.key);

      // --- Generic, site-agnostic actions (multi-step engine) ---
      case ACTION_TYPES.WAIT_FOR_SELECTOR: {
        const ok = await this._agent.validation.waitForSelector(action.selector);
        if (!ok) throw new Error(`WAIT_FOR_SELECTOR: "${action.selector}" not visible`);
        return ok;
      }

      case ACTION_TYPES.VERIFY_SELECTOR: {
        const ok = await this._agent.validation.verifySelectorPresent(action.selector);
        if (!ok) throw new Error(`VERIFY_SELECTOR: "${action.selector}" not present`);
        return ok;
      }

      case ACTION_TYPES.OPEN_FIRST_RESULT:
        return this._openFirstResult(action.selector);

      // --- URL verification (retryable: throw on mismatch so it can retry) ---
      case ACTION_TYPES.VERIFY_URL: {
        const ok = this._agent.validation.urlContains(action.fragment);
        if (!ok) {
          throw new Error(`URL does not yet contain "${action.fragment}"`);
        }
        return ok;
      }

      // --- Blocked-state check (run once; throws a typed BlockedError) ---
      // Not retried: a CAPTCHA/consent wall will not clear on its own, so retrying
      // is pointless. The BlockedError propagates so index.js reports BLOCKED.
      case ACTION_TYPES.CHECK_BLOCKED: {
        const { blocked, reason } = await this._agent.validation.verifyBlockedState();
        if (blocked) {
          throw new BlockedError(reason);
        }
        return true;
      }

      // --- Results verification (retryable: throw if neither results nor empty-state) ---
      case ACTION_TYPES.VERIFY_RESULTS: {
        const ok = await this._agent.validation.verifyResultsRendered({
          resultsSelector: action.resultsSelector,
          emptyHint: action.emptyHint,
        });
        if (!ok) {
          throw new Error('results region not rendered yet (search may not have executed)');
        }
        return ok;
      }

      // --- Utilities ---
      case ACTION_TYPES.SCREENSHOT:
        return this._agent.screenshot.capture(action.label || '');

      case ACTION_TYPES.WAIT:
        return new Promise((resolve) => setTimeout(resolve, action.ms || 1000));

      default:
        logger.warn(`Unknown action type: "${type}" — skipping`);
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Retry policy
  // ---------------------------------------------------------------------------

  /**
   * Return the retry policy for an action type, or null if it should run once.
   *
   * @param {string} type
   * @returns {{retries: number, fatal: boolean}|null}
   */
  _retryPolicy(type) {
    const { actionRetries, navigationRetries } = config.retry;

    switch (type) {
      case ACTION_TYPES.CLICK:
      case ACTION_TYPES.DOUBLE_CLICK:
      case ACTION_TYPES.FILL:
      case ACTION_TYPES.SEND_KEYS:
      case ACTION_TYPES.PRESS_KEY:
      case ACTION_TYPES.WAIT_FOR_SELECTOR:
      case ACTION_TYPES.VERIFY_SELECTOR:
      case ACTION_TYPES.OPEN_FIRST_RESULT:
        return { retries: actionRetries, fatal: true };

      case ACTION_TYPES.VERIFY_URL:
        // Retry to give slow pages time. Soft by default (Google), but a plan
        // step can set `fatal: true` to make it a hard gate (GitHub q=query).
        return { retries: actionRetries, fatal: false };

      case ACTION_TYPES.VERIFY_RESULTS:
        // Retry to give results time to render; fatal so a search that never
        // executed is reported as a real failure (removes false positives).
        return { retries: actionRetries, fatal: true };

      case ACTION_TYPES.NAVIGATE:
        // Bounded — navigation must NOT retry indefinitely.
        return { retries: navigationRetries, fatal: true };

      default:
        return null;
    }
  }

  /**
   * Build a human-readable label for retry logs.
   *
   * @param {object} action
   * @returns {string}
   */
  _label(action) {
    if (action.field)           return `${action.type} "${action.field}"`;
    if (action.key)             return `${action.type} [${action.key}]`;
    if (action.fragment)        return `${action.type} ≈ "${action.fragment}"`;
    if (action.selector)        return `${action.type} (${action.selector})`;
    if (action.resultsSelector) return `${action.type} (${action.resultsSelector})`;
    if (action.emptyHint)       return `${action.type} (empty: ${action.emptyHint})`;
    if (action.url)             return `${action.type} ${action.url}`;
    return action.type;
  }

  /**
   * Click the first VISIBLE link in a results region. Generic and site-agnostic:
   * the task supplies `selector`; otherwise a common-pattern default is used.
   *
   * @param {string} [selector]
   * @returns {Promise<boolean>}
   */
  async _openFirstResult(selector) {
    const sel = selector || DEFAULT_RESULT_LINK_SELECTOR;
    const page = this._agent.getPage();
    const locator = page.locator(sel);
    const count = await locator.count();

    for (let i = 0; i < count && i < 30; i++) {
      const el = locator.nth(i);
      if (await el.isVisible().catch(() => false)) {
        await el.scrollIntoViewIfNeeded().catch(() => {});
        logger.act(`Opening first result (match ${i + 1}/${count}) for "${sel}"`);
        await this._agent.click.click(el);
        return true;
      }
    }
    throw new Error(`OPEN_FIRST_RESULT: no visible result link for "${sel}"`);
  }

  // ---------------------------------------------------------------------------
  // DETECT_FIELD recovery ladder
  // ---------------------------------------------------------------------------

  /**
   * Resolve a field with a self-healing escalation ladder:
   *   attempt 1 → normal detection (uses cached scan if present)
   *   attempt 2 → scroll down and re-scan the DOM
   *   attempt 3 → force a full fresh FormDetectionService scan
   *   exhausted → capture a diagnostic screenshot and throw
   *
   * @param {object} action - { type: DETECT_FIELD, field }
   * @returns {Promise<import('playwright').Locator>}
   */
  async _detectFieldWithRecovery(action) {
    const field = action.field;
    const retries = config.retry.actionRetries;

    try {
      return await RetryService.run(
        async (attempt) => {
          if (attempt === 2) {
            logger.recovery(`Field "${field}" not found — scrolling page and retrying detection`);
            await this._agent.scroll.scrollDown(400);
            await this._forceRescan();
          } else if (attempt >= 3) {
            logger.recovery(`Field "${field}" still missing — re-running full DOM scan`);
            await this._forceRescan();
          }

          const locator = await this._detectField(field);
          if (!locator) {
            throw new Error(`field "${field}" not found (attempt ${attempt})`);
          }
          return locator;
        },
        { retries, baseDelay: config.retry.baseDelay, label: `DETECT_FIELD "${field}"` },
      );
    } catch (err) {
      logger.recovery(`Field "${field}" unrecoverable after ${retries} attempts — capturing diagnostic screenshot`);
      try { await this._agent.screenshot.capture(`detect-failed-${field}`); } catch { /* best-effort */ }
      err.failedAction = action;
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Field registry helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure the field registry has been populated by a FormDetectionService scan.
   * The scan runs at most once unless _forceRescan() resets it.
   *
   * @returns {Promise<void>}
   */
  async _ensureScanned() {
    if (this._fieldsScanned) return;

    logger.observe('Running FormDetectionService scan to populate field registry');
    const detected = await this._agent.formDetection.detectFields();
    for (const [key, locator] of Object.entries(detected)) {
      this._fieldRegistry.set(key, locator);
    }
    this._fieldsScanned = true;
    logger.observe(`Field registry populated — keys: [${[...this._fieldRegistry.keys()].join(', ')}]`);
  }

  /**
   * Discard the cached registry and run a fresh scan.
   * Used by the recovery ladder when a field could not be resolved.
   *
   * @returns {Promise<void>}
   */
  async _forceRescan() {
    this._fieldsScanned = false;
    this._fieldRegistry.clear();
    await this._ensureScanned();
  }

  /**
   * Resolve the locator for a named field from the registry (scanning if needed).
   *
   * @param {string} fieldName
   * @returns {Promise<import('playwright').Locator|undefined>}
   */
  async _detectField(fieldName) {
    await this._ensureScanned();
    const locator = this._fieldRegistry.get(fieldName);
    if (locator) {
      logger.verify(`Registry: "${fieldName}" → resolved ✓`);
    } else {
      logger.warn(`Registry: "${fieldName}" not found after scan`);
    }
    return locator;
  }

  /**
   * Resolve a Playwright Locator from an action descriptor.
   * Prefers an explicit `locator`, then looks up `field` in the registry.
   *
   * @param {object} action
   * @returns {import('playwright').Locator}
   */
  _resolveLocator(action) {
    if (action.locator) return action.locator;

    if (!action.field) {
      throw new Error(
        `ActionExecutor: action "${action.type}" has neither locator nor field.`,
      );
    }

    const locator = this._fieldRegistry.get(action.field);
    if (!locator) {
      throw new Error(
        `ActionExecutor: field "${action.field}" not in registry. ` +
        `Include a DETECT_FIELD step for "${action.field}" before this action.`,
      );
    }
    return locator;
  }
}
