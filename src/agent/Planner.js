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
      default:
        return step.type;
    }
  }
}
