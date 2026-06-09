/**
 * MultiStepWorkflow.js
 *
 * A single, generic workflow that executes ANY reusable task definition from a
 * JSON file under tasks/ — no per-task workflow class required.
 *
 *   Task File → Variable Resolution → Conditional Evaluation → Planner → Executor → Browser
 *
 * Usage:
 *   GOAL=MULTI_STEP TASK_FILE=github_playwright.json npm start
 *
 * Hardening (P3.5) — all data-driven, the Executor is never changed:
 *   • Variable substitution:  "{{query}}" resolves from env (QUERY=…) or task.vars
 *   • Conditional execution:  { "if": { "selector_exists": ".x" }, "then": [...] }
 *   • Per-step tolerance:     { "action": "...", "continueOnFailure": true }
 *
 * This is the seam for a future OpenAI planner: an LLM emits the same task JSON,
 * which flows through the exact same path unchanged.
 *
 * `loadTask`, `validateTask`, and `resolveVariables` are exported for tests.
 */

import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const TASKS_DIR = path.resolve('tasks');

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

/**
 * Replace every `{{token}}` placeholder in a task's string values.
 *
 * Resolution order per token: vars[token] → env[token] → env[TOKEN].
 * Any token that cannot be resolved is collected and reported as one clear
 * validation error (so a future LLM gets actionable feedback, not a crash).
 *
 * @param {object} task          - The task object (not mutated).
 * @param {object} [vars]        - Explicit variables (e.g. task.vars defaults).
 * @param {object} [env]         - Environment map (defaults to process.env).
 * @returns {object} a new task with all placeholders resolved
 * @throws {Error} listing any unresolved variables
 */
export function resolveVariables(task, vars = {}, env = process.env) {
  const missing = new Set();

  const resolveString = (str) =>
    str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, token) => {
      const candidates = [vars[token], env[token], env[token.toUpperCase()]];
      const value = candidates.find((v) => v !== undefined && v !== '');
      if (value === undefined) { missing.add(token); return match; }
      return String(value);
    });

  const walk = (value) => {
    if (typeof value === 'string') return resolveString(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = walk(value[key]);
      return out;
    }
    return value;
  };

  const resolved = walk(task);

  if (missing.size > 0) {
    const list = [...missing];
    throw new Error(
      `Task "${task.name}": unresolved variable(s): ${list.map((k) => `{{${k}}}`).join(', ')} ` +
      `— provide via env (e.g. ${list[0].toUpperCase()}=…) or a task "vars" block`,
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Schema validation (structural — the Planner validates action semantics)
// ---------------------------------------------------------------------------

/**
 * Validate one step: it must be either an ACTION step (string `action`) or a
 * CONDITIONAL block (`if` object + `then` array, optional `else` array).
 *
 * @param {any} step
 * @param {string} where - human-readable position for errors
 */
function validateStep(step, where) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new Error(`Invalid task schema: ${where} must be an object`);
  }

  if (step.if !== undefined) {
    if (typeof step.if !== 'object' || Array.isArray(step.if)) {
      throw new Error(`Invalid task schema: ${where} "if" must be a condition object`);
    }
    if (!Array.isArray(step.then)) {
      throw new Error(`Invalid task schema: ${where} conditional needs a "then" array`);
    }
    step.then.forEach((s, i) => validateStep(s, `${where} > then[${i + 1}]`));
    if (step.else !== undefined) {
      if (!Array.isArray(step.else)) {
        throw new Error(`Invalid task schema: ${where} "else" must be an array`);
      }
      step.else.forEach((s, i) => validateStep(s, `${where} > else[${i + 1}]`));
    }
    return;
  }

  if (typeof step.action !== 'string' || !step.action.trim()) {
    throw new Error(`Invalid task schema: ${where} must have a string "action" or an "if" block`);
  }
}

/**
 * Validate a task's structural schema.
 *
 * @param {any} task
 * @returns {object} the validated task
 * @throws {Error} with a clear message if the schema is invalid
 */
export function validateTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    throw new Error('Invalid task schema: task must be a JSON object');
  }
  if (typeof task.name !== 'string' || !task.name.trim()) {
    throw new Error('Invalid task schema: missing/empty "name"');
  }
  if (!Array.isArray(task.steps) || task.steps.length === 0) {
    throw new Error('Invalid task schema: "steps" must be a non-empty array');
  }
  if (task.vars !== undefined && (typeof task.vars !== 'object' || Array.isArray(task.vars))) {
    throw new Error('Invalid task schema: "vars" must be an object');
  }
  task.steps.forEach((step, i) => validateStep(step, `step ${i + 1}`));
  return task;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Load + parse + validate + variable-resolve a task file. Names resolve under
 * tasks/; absolute paths are used as-is (handy for tests).
 *
 * @param {string} fileName
 * @returns {object} validated, variable-resolved task
 * @throws {Error} on missing file, bad JSON, invalid schema, or unresolved vars
 */
export function loadTask(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('No TASK_FILE specified (set TASK_FILE=<file>.json)');
  }

  const filePath = path.isAbsolute(fileName) ? fileName : path.resolve(TASKS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Task file not found: ${filePath}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read task file "${fileName}": ${err.message}`);
  }

  let task;
  try {
    task = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Task file "${fileName}" is not valid JSON: ${err.message}`);
  }

  validateTask(task);
  // Resolve placeholders using task.vars defaults overlaid by environment vars.
  return resolveVariables(task, task.vars || {}, process.env);
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export class MultiStepWorkflow {
  /**
   * @param {import('../agent/Agent.js').Agent} agent
   */
  constructor(agent) {
    this._agent = agent;
  }

  /**
   * Load the configured task and execute its steps (with variables already
   * resolved), honouring conditionals and per-step continueOnFailure.
   *
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;
    logger.info('--- MultiStepWorkflow starting ---');

    const task = loadTask(config.task.file);
    agent.observe(`Loaded task "${task.name}" (${task.steps.length} steps) from ${config.task.file}`);
    logger.plan(`=== Executing task: "${task.name}" ===`);

    await this._runSteps(task.steps, task);

    agent.verify(`Task "${task.name}" completed`);
    logger.info('--- MultiStepWorkflow finished ---');
  }

  /**
   * Execute a list of task steps sequentially. Handles:
   *   - conditional blocks ({ if, then, else })
   *   - action steps (translated per-step and run via the ActionExecutor)
   *   - continueOnFailure (a failed action step is logged and skipped)
   *
   * @param {object[]} steps
   * @param {object} task - the owning task (for labels)
   * @returns {Promise<void>}
   */
  async _runSteps(steps, task) {
    const agent = this._agent;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // --- Conditional block ---
      if (step.if) {
        const result = await this._evaluateCondition(step.if);
        agent.think(`Condition ${JSON.stringify(step.if)} → ${result}`);
        const branch = result ? step.then : step.else;
        if (Array.isArray(branch) && branch.length) {
          logger.plan(`Branch taken: ${result ? 'then' : 'else'} (${branch.length} steps)`);
          await this._runSteps(branch, task);
        }
        continue;
      }

      // --- Action step ---
      const actions = agent.planner.translateTaskStep(step, i);
      try {
        await agent.executor.executeAll(actions);
      } catch (err) {
        if (step.continueOnFailure) {
          agent.recovery(
            `Step ${i + 1} (${step.action}) failed but continueOnFailure=true — continuing: ${err.message}`,
          );
          continue;
        }
        throw err; // fatal → propagates to index.js → FAILED / BLOCKED outcome
      }
    }
  }

  /**
   * Evaluate a deterministic condition object. Multiple keys are AND-ed.
   * Supported keys: selector_exists, selector_missing, url_contains.
   *
   * @param {object} cond
   * @returns {Promise<boolean>}
   */
  async _evaluateCondition(cond) {
    const agent = this._agent;
    const checks = [];

    for (const [key, value] of Object.entries(cond)) {
      switch (key) {
        case 'selector_exists':
          checks.push(await agent.validation.verifySelectorPresent(value));
          break;
        case 'selector_missing':
          checks.push(!(await agent.validation.verifySelectorPresent(value)));
          break;
        case 'url_contains':
          checks.push(agent.navigation.currentUrl().includes(value));
          break;
        default:
          throw new Error(`MULTI_STEP: unsupported condition "${key}"`);
      }
    }
    return checks.every(Boolean);
  }
}
