/**
 * AiPlannerWorkflow.js
 *
 * The AI entry point. It does exactly two things:
 *   1. Ask the PlannerProvider to turn a natural-language goal into a VALIDATED
 *      task object (mock or OpenRouter, with fallback handled by the provider).
 *   2. Hand that task to MultiStepWorkflow.runTask() — the same execution path a
 *      human-written JSON file uses.
 *
 * The AI never touches the browser, the ActionExecutor, or Playwright. By the
 * time a task reaches runTask() it has already been schema- and semantics-
 * validated, so the executor cannot tell (or care) where it came from.
 *
 *   Natural language → PlannerProvider → task JSON → MultiStepWorkflow.runTask → Browser
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';
import { PlannerProvider } from '../planners/PlannerProvider.js';
import { MultiStepWorkflow } from './MultiStepWorkflow.js';

export class AiPlannerWorkflow {
  /**
   * @param {import('../agent/Agent.js').Agent} agent
   */
  constructor(agent) {
    this._agent = agent;
  }

  /**
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;
    const goal = config.ai.goal;

    logger.info('--- AiPlannerWorkflow starting ---');
    if (!goal || !goal.trim()) {
      throw new Error('AI_GOAL is required for GOAL=AI_PLAN (e.g. AI_GOAL="search github for playwright")');
    }

    agent.think(`AI planner mode: "${config.ai.plannerMode}" — goal: "${goal}"`);

    // 1. Natural language → validated task JSON (provider handles fallback).
    const provider = PlannerProvider.fromConfig(config);
    const task = await provider.generateTask(goal);
    agent.observe(`AI produced task "${task.name}" with ${task.steps.length} steps`);

    // 2. Execute via the SAME path a human-written task uses.
    await new MultiStepWorkflow(agent).runTask(task);

    logger.info('--- AiPlannerWorkflow finished ---');
  }
}
