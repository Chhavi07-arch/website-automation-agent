/**
 * FillShadcnFormWorkflow.js  (V2 — Planner-based)
 *
 * Assignment workflow: fill the shadcn React Hook Form demo.
 *
 * V2 change: the workflow no longer calls browser tools directly.
 * It expresses its intent as a named goal, receives a structured action plan
 * from the Planner, then hands the plan to the ActionExecutor to run.
 *
 *   V1 (direct):  workflow called agent.scroll, agent.input.fill, etc.
 *   V2 (planned): workflow → Planner → plan[] → ActionExecutor → tools
 *
 * This makes the workflow:
 *   - Goal-oriented: it says WHAT to do, not HOW.
 *   - Observable:    the full plan is logged before any browser action runs.
 *   - AI-ready:      swap Planner.generatePlan() for an LLM call and this
 *                    file does not change at all.
 */

import { ACTION_TYPES } from '../config/constants.js';
import config           from '../config/env.js';
import logger           from '../utils/logger.js';

export class FillShadcnFormWorkflow {
  /**
   * @param {import('../agent/Agent.js').Agent} agent
   */
  constructor(agent) {
    this._agent = agent;
  }

  /**
   * Declare the goal, obtain a plan from the Planner, execute via ActionExecutor.
   * Throws on unrecoverable errors so index.js can shut down the browser.
   *
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;
    logger.info('--- FillShadcnFormWorkflow starting (V2 — Planner-based) ---');

    // 1. Declare the goal and its parameters.
    agent.think('Requesting action plan from Planner');
    const plan = agent.generatePlan(ACTION_TYPES.GOALS.FILL_SHADCN_FORM, {
      url:              config.target.url,
      nameValue:        config.form.name,
      descriptionValue: config.form.description,
    });

    // 2. Hand the plan to the ActionExecutor — it resolves fields, runs tools.
    agent.act(`Executing ${plan.length}-step plan via ActionExecutor`);
    await agent.executor.executeAll(plan);

    agent.verify('All plan steps completed — workflow finished');
    logger.info('--- FillShadcnFormWorkflow finished ---');
  }
}
