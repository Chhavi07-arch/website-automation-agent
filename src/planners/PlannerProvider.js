/**
 * PlannerProvider.js
 *
 * Facade that selects the planner (mock | openrouter) and exposes a single
 * method — generateTask(goal) — returning a validated task object.
 *
 * Fallback policy:
 *   - Transport failure (timeout / 429 / auth / network) → log a warning and
 *     fall back to the MockPlanner so the run continues.
 *   - Validation failure (bad model output) → propagate; the run must NOT
 *     execute an invalid task.
 *
 * Configuration validation: PLANNER_MODE=openrouter with no API key degrades to
 * the MockPlanner (with a warning) instead of crashing.
 */

import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { PlannerTransportError, PlannerValidationError } from '../utils/errors.js';
import { MockPlanner } from './MockPlanner.js';
import { OpenRouterPlanner } from './OpenRouterPlanner.js';
import { reviewTask, writePlannerReview } from './TaskReviewer.js';

const PROMPT_PATH = path.resolve('src', 'prompts', 'planner-system-prompt.txt');

/** Read the versioned planner system prompt from disk. */
function loadSystemPrompt() {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8');
  } catch (err) {
    logger.warn(`Could not read planner prompt (${err.message}) — using minimal fallback prompt`);
    return 'Convert the user goal into a single JSON task object with {name, steps[]}. Output ONLY JSON.';
  }
}

export class PlannerProvider {
  /**
   * @param {object} deps
   * @param {string} deps.mode            - 'mock' | 'openrouter'
   * @param {object|null} deps.openRouter - an OpenRouterPlanner (or null)
   * @param {object} deps.mock            - a MockPlanner
   */
  constructor({ mode, openRouter, mock }) {
    this._mode = mode;
    this._openRouter = openRouter;
    this._mock = mock;
  }

  /**
   * Build a provider from app config. Validates configuration and wires the
   * real planners. Injection-free path for production use.
   *
   * @param {import('../config/env.js').default} config
   * @returns {PlannerProvider}
   */
  static fromConfig(config) {
    const mode = config.ai.plannerMode;
    const mock = new MockPlanner();
    let openRouter = null;

    if (mode === 'openrouter') {
      if (!config.ai.openrouter.apiKey) {
        logger.warn('PLANNER_MODE=openrouter but OPENROUTER_API_KEY is empty — using MockPlanner');
      } else {
        openRouter = new OpenRouterPlanner({
          ...config.ai.openrouter,
          systemPrompt: loadSystemPrompt(),
        });
      }
    }
    return new PlannerProvider({ mode, openRouter, mock });
  }

  /**
   * Convert a natural-language goal into a validated task object, then run it
   * through the quality reviewer. A plan that scores below the approval
   * threshold is saved with its review report and is NOT returned for execution.
   *
   * @param {string} goal
   * @returns {Promise<object>} a validated AND reviewer-approved task
   * @throws {PlannerValidationError} if the plan is rejected by the reviewer
   */
  async generateTask(goal) {
    const task = await this._produceTask(goal);

    // --- Quality gate: review BEFORE execution ---
    const review = reviewTask(task);
    if (!review.approved) {
      const reportPath = writePlannerReview({ goal, plannerMode: this._mode, task, review });
      logger.error(
        `[REVIEW] Plan REJECTED — score ${review.score}/100 (need >= 80). NOT executing.`,
      );
      review.issues.forEach((i) => logger.error(`[REVIEW]   issue: ${i}`));
      review.warnings.forEach((w) => logger.warn(`[REVIEW]   warning: ${w}`));
      logger.error(`[REVIEW] Review report saved → ${reportPath}`);
      throw new PlannerValidationError(`plan rejected by reviewer (score ${review.score}/100)`);
    }

    logger.info(`[REVIEW] Plan approved — score ${review.score}/100`);
    review.warnings.forEach((w) => logger.warn(`[REVIEW]   warning: ${w}`));
    return task;
  }

  /**
   * Produce a task from the configured planner (OpenRouter with Mock fallback on
   * transport errors, or Mock directly). Schema/semantics already validated by
   * the planner; quality review happens in generateTask().
   *
   * @param {string} goal
   * @returns {Promise<object>}
   */
  async _produceTask(goal) {
    if (this._openRouter) {
      try {
        return await this._openRouter.generateTask(goal);
      } catch (err) {
        if (err instanceof PlannerTransportError) {
          logger.warn(`OpenRouter unavailable (${err.message}) — falling back to MockPlanner`);
          return this._mock.generateTask(goal);
        }
        throw err; // validation failure → do NOT execute, do NOT fall back
      }
    }

    logger.info('PlannerProvider: using MockPlanner');
    return this._mock.generateTask(goal);
  }
}
