/**
 * Planner.js
 *
 * The Planning Layer — sits between a Workflow's high-level goal and the
 * ActionExecutor's low-level dispatch.
 *
 * Responsibility:
 *   Translate a named goal (e.g. 'FILL_SHADCN_FORM') plus a parameters object
 *   into an ordered array of typed action objects.  The array is pure data —
 *   no Playwright objects, no side effects — making it easy to inspect, log,
 *   replay, or eventually generate with an LLM.
 *
 * Why this layer exists:
 *   Without a Planner, workflows contain a mixture of "what to do" and "how to
 *   do it".  By separating planning from execution:
 *
 *   1. Workflows become goal-oriented (1-2 lines) and unit-testable without
 *      a real browser.
 *   2. Plans can be logged in their entirety before any browser action runs,
 *      making the agent's intent fully transparent.
 *   3. In Phase 4, the generatePlan() method can be replaced with an LLM call
 *      that produces the same action-object format — no other code changes
 *      are required.
 *
 * Architecture position:
 *   Workflow → Planner.generatePlan() → action[] → ActionExecutor → Tools
 *
 * Adding a new goal:
 *   1. Add the goal key to ACTION_TYPES.GOALS in constants.js.
 *   2. Add a private _plan<GoalName>() method that returns the action array.
 *   3. Register it in the GOAL_MAP inside generatePlan().
 */

import { ACTION_TYPES } from '../config/constants.js';
import logger from '../utils/logger.js';

export class Planner {
  /**
   * @param {import('./Agent.js').Agent} agent
   *   Stored for future use (e.g. querying page state to produce adaptive plans).
   *   Not used in v1 — plans are fully static given the input params.
   */
  constructor(agent) {
    this._agent = agent;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Generate a structured action plan for a named goal.
   *
   * @param {string} goalKey  - One of ACTION_TYPES.GOALS.*
   * @param {object} [params] - Goal-specific parameters (url, field values, …).
   * @returns {object[]}      - Ordered array of action descriptors.
   */
  generatePlan(goalKey, params = {}) {
    logger.plan(`=== Planning goal: "${goalKey}" ===`);

    const GOAL_MAP = {
      [ACTION_TYPES.GOALS.FILL_SHADCN_FORM]: () => this._planFillShadcnForm(params),
      [ACTION_TYPES.GOALS.SEARCH_GOOGLE]:    () => this._planSearchGoogle(params),
      [ACTION_TYPES.GOALS.SEARCH_GITHUB]:    () => this._planSearchGitHub(params),
      [ACTION_TYPES.GOALS.MULTI_STEP]:       () => this._planMultiStep(params),
    };

    const planFn = GOAL_MAP[goalKey];
    if (!planFn) {
      throw new Error(
        `Planner: unknown goal "${goalKey}". ` +
        `Available goals: ${Object.keys(GOAL_MAP).join(', ')}`,
      );
    }

    const plan = planFn();

    // Log every step so the full plan is visible before execution starts.
    logger.plan(`Plan contains ${plan.length} steps:`);
    plan.forEach((step, i) => {
      logger.plan(`  Step ${String(i + 1).padStart(2, '0')}: ${this._describeStep(step)}`);
    });

    return plan;
  }

  // ---------------------------------------------------------------------------
  // Goal plans
  // ---------------------------------------------------------------------------

  /**
   * Plan for filling the shadcn React Hook Form demo.
   *
   * Steps follow the "Current Assignment Workflow" in CLAUDE.md:
   *   navigate → wait → scroll → detect fields → fill name → fill description → screenshot
   *
   * @param {object} params
   * @param {string} params.url             - URL to navigate to.
   * @param {string} params.nameValue       - Value for the Name field.
   * @param {string} params.descriptionValue - Value for the Description field.
   * @returns {object[]}
   */
  _planFillShadcnForm({ url, nameValue, descriptionValue }) {
    if (!url || !nameValue || !descriptionValue) {
      throw new Error(
        'Planner: FILL_SHADCN_FORM requires params: url, nameValue, descriptionValue',
      );
    }

    return [
      // --- Navigation phase ---
      { type: ACTION_TYPES.NAVIGATE,      url },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'after-navigation' },
      { type: ACTION_TYPES.WAIT_FOR_IDLE },
      { type: ACTION_TYPES.WAIT,          ms: 1500 },   // React hydration buffer

      // --- Reveal the form (it is below the fold on the shadcn docs page) ---
      { type: ACTION_TYPES.SCROLL,        direction: 'down', pixels: 600 },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'before-form-fill' },

      // --- Field detection (ActionExecutor caches results in its registry) ---
      { type: ACTION_TYPES.DETECT_FIELD,  field: 'name' },
      { type: ACTION_TYPES.DETECT_FIELD,  field: 'description' },

      // --- Fill Name ---
      { type: ACTION_TYPES.CLICK,         field: 'name' },
      { type: ACTION_TYPES.FILL,          field: 'name',        value: nameValue },
      { type: ACTION_TYPES.VERIFY_FIELD,  field: 'name',        value: nameValue },

      // --- Fill Description ---
      { type: ACTION_TYPES.CLICK,         field: 'description' },
      { type: ACTION_TYPES.FILL,          field: 'description', value: descriptionValue },
      { type: ACTION_TYPES.VERIFY_FIELD,  field: 'description', value: descriptionValue },

      // --- Final evidence screenshot ---
      { type: ACTION_TYPES.SCREENSHOT,    label: 'after-form-fill' },
    ];
  }

  /**
   * Plan: navigate to Google and search for a query.
   *
   * Detection strategy:
   *   Google's search box has name="q" on all locales.
   *   FormDetectionService will find it via the 'q' entry in SEARCH_FIELD_HINTS.
   *
   * @param {object} params
   * @param {string} params.query - The search term.
   * @returns {object[]}
   */
  _planSearchGoogle({ query }) {
    if (!query) throw new Error('Planner: SEARCH_GOOGLE requires params.query');

    // First token of the query — robust for the q=<query> URL check across
    // Google's `+`/encoding differences (e.g. "Playwright browser…" → "q=Playwright").
    const firstToken = query.trim().split(/\s+/)[0];

    return [
      // --- Load Google homepage ---
      { type: ACTION_TYPES.NAVIGATE,      url: 'https://www.google.com' },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'google-loaded' },
      { type: ACTION_TYPES.WAIT_FOR_IDLE },
      // A consent wall can appear on landing → catch it as BLOCKED, not a bug.
      { type: ACTION_TYPES.CHECK_BLOCKED },

      // --- Find and fill the search box ---
      { type: ACTION_TYPES.DETECT_FIELD,  field: 'search' },
      { type: ACTION_TYPES.CLICK,         field: 'search' },
      { type: ACTION_TYPES.FILL,          field: 'search', value: query },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'google-query-typed' },

      // --- Submit and wait for the results page ---
      { type: ACTION_TYPES.PRESS_KEY,     key: 'Enter' },
      { type: ACTION_TYPES.WAIT,          ms: 1500 },
      { type: ACTION_TYPES.WAIT_FOR_IDLE },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'google-results' },

      // --- Classify the outcome (order matters) ---
      // 1. BLOCKED? A /sorry CAPTCHA page also contains "google.com/search" in
      //    its continue= param, so we MUST check for the block BEFORE trusting URL.
      { type: ACTION_TYPES.CHECK_BLOCKED },
      // 2. Did the query actually get submitted? (hard gate)
      { type: ACTION_TYPES.VERIFY_URL,     fragment: `q=${firstToken}`, fatal: true },
      // 3. Did real results render? (hard gate — content, not just URL)
      {
        type: ACTION_TYPES.VERIFY_RESULTS,
        resultsSelector: '#search, #rso, #result-stats',
        emptyHint: 'did not match any documents|no results found',
        fatal: true,
      },
    ];
  }

  /**
   * Plan: navigate to GitHub and search for a query.
   *
   * URL strategy:
   *   We navigate to https://github.com/search rather than the homepage.
   *   GitHub's homepage exposes search as a <button aria-haspopup="dialog">
   *   — not a text input — so getByLabel(/search/i) resolves to the button,
   *   which cannot be filled.  The /search page has a standard <input name="q">
   *   that our 'q' hint in SEARCH_FIELD_HINTS detects correctly on all locales.
   *
   * Detection strategy:
   *   The search input has name="q" → matches 'q' entry in SEARCH_FIELD_HINTS
   *   via ElementDetectionService.findByName('q').
   *
   * @param {object} params
   * @param {string} params.query - The search term.
   * @returns {object[]}
   */
  _planSearchGitHub({ query }) {
    if (!query) throw new Error('Planner: SEARCH_GITHUB requires params.query');

    return [
      // --- Navigate directly to GitHub's search page (has a real text input) ---
      { type: ACTION_TYPES.NAVIGATE,      url: 'https://github.com/search' },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'github-search-page' },
      { type: ACTION_TYPES.WAIT_FOR_IDLE },

      // --- Detect the search input (name="q") and fill it ---
      { type: ACTION_TYPES.DETECT_FIELD,  field: 'search' },
      { type: ACTION_TYPES.CLICK,         field: 'search' },
      { type: ACTION_TYPES.FILL,          field: 'search', value: query },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'github-query-typed' },

      // --- Submit and wait for results page ---
      { type: ACTION_TYPES.PRESS_KEY,     key: 'Enter' },
      { type: ACTION_TYPES.WAIT,          ms: 1500 },
      { type: ACTION_TYPES.WAIT_FOR_IDLE },
      { type: ACTION_TYPES.SCREENSHOT,    label: 'github-results' },

      // --- STRONG verification (replaces the old always-true /search check) ---
      // 1. The query must appear in the URL — proves the search was submitted,
      //    not just that we landed on the /search page. Hard gate (fatal).
      { type: ACTION_TYPES.VERIFY_URL,    fragment: `q=${encodeURIComponent(query)}`, fatal: true },
      // 2. Results must have actually rendered — either a results list OR a
      //    recognised empty-state. Both prove the search executed. Hard gate.
      {
        type: ACTION_TYPES.VERIFY_RESULTS,
        resultsSelector: '[data-testid="results-list"]',
        emptyHint: "couldn'?t find any|we couldn'?t find|no results",
        fatal: true,
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Multi-step task translation (P3)
  // ---------------------------------------------------------------------------

  /**
   * Translate a reusable task definition (loaded from JSON) into the low-level
   * action[] the ActionExecutor runs.
   *
   * This is the single translation point between the human/LLM-friendly task
   * vocabulary (navigate, search, submit, open_first_result, …) and the
   * executor's ACTION_TYPES. A future OpenAI planner will emit the SAME task
   * JSON — so it plugs in here without touching the executor.
   *
   * Supported task verbs:
   *   navigate {url}                  → NAVIGATE + WAIT_FOR_IDLE
   *   search   {field, value}         → DETECT_FIELD + CLICK + FILL
   *   fill     {field, value}         → DETECT_FIELD + FILL
   *   click    {field}               → DETECT_FIELD + CLICK
   *   submit   {key?, ms?}            → PRESS_KEY + WAIT + WAIT_FOR_IDLE
   *   open_first_result {selector?}   → OPEN_FIRST_RESULT + WAIT_FOR_IDLE
   *   wait     {ms}                   → WAIT
   *   wait_for_selector {selector}    → WAIT_FOR_SELECTOR
   *   verify_selector {selector, fatal?} → VERIFY_SELECTOR
   *   verify_url {fragment, fatal?}   → VERIFY_URL
   *   scroll   {direction?, pixels?}  → SCROLL
   *   screenshot {label?}             → SCREENSHOT
   *
   * @param {object} params
   * @param {{name:string, steps:object[]}} params.task
   * @returns {object[]}
   */
  _planMultiStep({ task }) {
    if (!task || !Array.isArray(task.steps)) {
      throw new Error('Planner: MULTI_STEP requires params.task with a steps[] array');
    }

    logger.plan(`Translating task "${task.name}" (${task.steps.length} task-steps)`);
    const plan = [];
    task.steps.forEach((step, idx) => {
      plan.push(...this.translateTaskStep(step, idx));
    });
    return plan;
  }

  /**
   * Translate ONE task step into its low-level action(s). This is the single
   * task-verb → ACTION_TYPES mapping, used both by _planMultiStep (flat tasks)
   * and by MultiStepWorkflow (step-by-step, for conditionals/continueOnFailure).
   *
   * @param {object} step  - A task step (must have an `action`).
   * @param {number} [idx] - 0-based index, for error messages.
   * @returns {object[]} low-level action descriptors
   */
  translateTaskStep(step, idx = 0) {
    const A = ACTION_TYPES;
    const n = idx + 1;
    const action = String(step.action || '').toLowerCase();
    const need = (cond, msg) => { if (!cond) throw new Error(`MULTI_STEP step ${n} (${action}): ${msg}`); };

    switch (action) {
      case 'navigate':
        need(step.url, 'missing "url"');
        return [{ type: A.NAVIGATE, url: step.url }, { type: A.WAIT_FOR_IDLE }];

      case 'search':
        need(step.field, 'missing "field"');
        need(step.value !== undefined, 'missing "value"');
        return [
          { type: A.DETECT_FIELD, field: step.field },
          { type: A.CLICK, field: step.field },
          { type: A.FILL, field: step.field, value: step.value },
        ];

      case 'fill':
        need(step.field, 'missing "field"');
        need(step.value !== undefined, 'missing "value"');
        return [
          { type: A.DETECT_FIELD, field: step.field },
          { type: A.FILL, field: step.field, value: step.value },
        ];

      case 'click':
        need(step.field, 'missing "field"');
        return [
          { type: A.DETECT_FIELD, field: step.field },
          { type: A.CLICK, field: step.field },
        ];

      case 'submit':
        return [
          { type: A.PRESS_KEY, key: step.key || 'Enter' },
          { type: A.WAIT, ms: step.ms || 1500 },
          { type: A.WAIT_FOR_IDLE },
        ];

      case 'open_first_result':
        return [
          { type: A.OPEN_FIRST_RESULT, selector: step.selector },
          { type: A.WAIT_FOR_IDLE },
        ];

      case 'wait':
        return [{ type: A.WAIT, ms: step.ms || 1000 }];

      case 'wait_for_selector':
        need(step.selector, 'missing "selector"');
        return [{ type: A.WAIT_FOR_SELECTOR, selector: step.selector }];

      case 'verify_selector':
        need(step.selector, 'missing "selector"');
        return [{ type: A.VERIFY_SELECTOR, selector: step.selector, fatal: step.fatal !== false }];

      case 'verify_url':
        need(step.fragment, 'missing "fragment"');
        return [{ type: A.VERIFY_URL, fragment: step.fragment, fatal: step.fatal !== false }];

      case 'scroll':
        return [{ type: A.SCROLL, direction: step.direction || 'down', pixels: step.pixels || 500 }];

      case 'screenshot':
        return [{ type: A.SCREENSHOT, label: step.label || `step-${n}` }];

      default:
        throw new Error(`MULTI_STEP: unsupported action "${step.action}" at step ${n}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Produce a human-readable one-line description of an action step.
   * Used when logging the plan before execution.
   *
   * @param {object} step
   * @returns {string}
   */
  _describeStep(step) {
    switch (step.type) {
      case ACTION_TYPES.NAVIGATE:
        return `Navigate → ${step.url}`;
      case ACTION_TYPES.SCREENSHOT:
        return `Screenshot [${step.label || 'unlabeled'}]`;
      case ACTION_TYPES.WAIT_FOR_IDLE:
        return 'Wait for network idle';
      case ACTION_TYPES.WAIT:
        return `Wait ${step.ms}ms`;
      case ACTION_TYPES.SCROLL:
        return `Scroll ${step.direction} ${step.pixels}px`;
      case ACTION_TYPES.DETECT_FIELD:
        return `Detect field "${step.field}"`;
      case ACTION_TYPES.CLICK:
        return `Click field "${step.field || '(locator)'}"`;
      case ACTION_TYPES.FILL:
        return `Fill "${step.field}" → "${step.value}"`;
      case ACTION_TYPES.VERIFY_FIELD:
        return `Verify "${step.field}" === "${step.value}"`;
      case ACTION_TYPES.SEND_KEYS:
        return `Send keys to "${step.field}" → "${step.value}"`;
      case ACTION_TYPES.DOUBLE_CLICK:
        return `Double-click "${step.field || '(locator)'}"`;
      case ACTION_TYPES.PRESS_KEY:
        return `Press key [${step.key}]`;
      case ACTION_TYPES.VERIFY_URL:
        return `Verify URL contains "${step.fragment}"${step.fatal ? ' (hard gate)' : ''}`;
      case ACTION_TYPES.VERIFY_RESULTS:
        return `Verify results rendered (selector or empty-state)${step.fatal ? ' (hard gate)' : ''}`;
      case ACTION_TYPES.CHECK_BLOCKED:
        return 'Check for anti-bot wall (CAPTCHA / consent) → BLOCKED if present';
      case ACTION_TYPES.OPEN_FIRST_RESULT:
        return `Open first result (${step.selector || 'default heuristic'})`;
      case ACTION_TYPES.WAIT_FOR_SELECTOR:
        return `Wait for selector "${step.selector}"`;
      case ACTION_TYPES.VERIFY_SELECTOR:
        return `Verify selector "${step.selector}"${step.fatal ? ' (hard gate)' : ''}`;
      default:
        return step.type;
    }
  }
}
