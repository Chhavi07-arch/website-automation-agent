/**
 * TaskReviewer.js
 *
 * Quality gate for AI-generated tasks. Reviews a task JSON object BEFORE it is
 * executed and returns a score with issues/warnings. The PlannerProvider only
 * executes plans that score >= APPROVAL_THRESHOLD — so the browser never runs a
 * low-quality AI plan.
 *
 * This is pure analysis (no browser, no network) — easy to test in isolation.
 */

import fs from 'fs';
import path from 'path';
import { ensureDir } from '../utils/fileHelper.js';
import { SUPPORTED_TASK_ACTIONS } from '../config/constants.js';
import logger from '../utils/logger.js';

export const APPROVAL_THRESHOLD = 80;

const REPORTS_DIR = path.resolve('reports');

/** Penalties (points subtracted from 100). Issues are heavy; warnings light. */
const PENALTY = {
  NO_NAME:               20,  // issue
  EMPTY_TASK:           100,  // issue
  UNSUPPORTED_ACTION:    40,  // issue (per action)
  EMPTY_VALUE:           25,  // issue (per field)
  INTERACT_BEFORE_NAV:   30,  // issue
  NO_USEFUL_ACTIONS:     25,  // issue
  CONSECUTIVE_DUPLICATE: 15,  // warning (per pair)
  FIRST_NOT_NAVIGATE:    10,  // warning
};

const INTERACTION_ACTIONS = new Set(['search', 'fill', 'click', 'submit', 'open_first_result']);
const USEFUL_ACTIONS = new Set([
  'search', 'fill', 'click', 'submit', 'open_first_result',
  'verify_selector', 'verify_url', 'screenshot',
]);

/** Required non-empty fields per action (for the empty-value check). */
const REQUIRED_FIELDS = {
  navigate:          ['url'],
  search:            ['field', 'value'],
  fill:              ['field', 'value'],
  click:             ['field'],
  wait_for_selector: ['selector'],
  verify_selector:   ['selector'],
  verify_url:        ['fragment'],
};

/** Recursively collect action steps (descends into if/then/else blocks). */
function collectActionSteps(steps, acc = []) {
  for (const step of steps || []) {
    if (step && step.if) {
      collectActionSteps(step.then || [], acc);
      collectActionSteps(step.else || [], acc);
    } else if (step && typeof step.action === 'string') {
      acc.push(step);
    }
  }
  return acc;
}

/** A short signature for consecutive-duplicate detection. */
function stepSignature(step) {
  return [step.action, step.url, step.field, step.value, step.selector, step.fragment]
    .filter((v) => v !== undefined)
    .join('|');
}

/**
 * Review a task and produce a quality score.
 *
 * @param {object} task
 * @returns {{score:number, issues:string[], warnings:string[], approved:boolean}}
 */
export function reviewTask(task) {
  const issues = [];
  const warnings = [];
  let penalty = 0;
  const addIssue = (msg, p) => { issues.push(msg); penalty += p; };
  const addWarning = (msg, p) => { warnings.push(msg); penalty += p; };

  // 1. Name present.
  if (!task || typeof task.name !== 'string' || !task.name.trim()) {
    addIssue('Task has no "name".', PENALTY.NO_NAME);
  }

  // 2. At least one step.
  const topSteps = Array.isArray(task?.steps) ? task.steps : [];
  if (topSteps.length === 0) {
    addIssue('Task has no steps (empty plan).', PENALTY.EMPTY_TASK);
    const score = Math.max(0, 100 - penalty);
    return { score, issues, warnings, approved: score >= APPROVAL_THRESHOLD };
  }

  const actionSteps = collectActionSteps(topSteps);

  // 3. First step is usually navigate.
  const first = topSteps[0];
  if (first && first.action && first.action !== 'navigate') {
    addWarning(`First step is "${first.action}", not "navigate".`, PENALTY.FIRST_NOT_NAVIGATE);
  }

  // 5. No unsupported actions  +  4. No empty required values.
  for (const step of actionSteps) {
    if (!SUPPORTED_TASK_ACTIONS.includes(step.action)) {
      addIssue(`Unsupported action "${step.action}".`, PENALTY.UNSUPPORTED_ACTION);
      continue;
    }
    for (const field of REQUIRED_FIELDS[step.action] || []) {
      const v = step[field];
      if (v === undefined || v === null || String(v).trim() === '') {
        addIssue(`Action "${step.action}" has empty "${field}".`, PENALTY.EMPTY_VALUE);
      }
    }
  }

  // 6. No duplicated consecutive actions (on the top-level sequence).
  const topActions = topSteps.filter((s) => s && s.action);
  for (let i = 1; i < topActions.length; i++) {
    if (stepSignature(topActions[i]) === stepSignature(topActions[i - 1])) {
      addWarning(`Duplicated consecutive step "${topActions[i].action}".`, PENALTY.CONSECUTIVE_DUPLICATE);
    }
  }

  // 7. Obviously useless plans.
  //    (a) an interaction occurs before any navigate.
  let navigated = false;
  let interactedBeforeNav = false;
  for (const step of actionSteps) {
    if (step.action === 'navigate') navigated = true;
    else if (INTERACTION_ACTIONS.has(step.action) && !navigated) { interactedBeforeNav = true; break; }
  }
  if (interactedBeforeNav) {
    addIssue('An interaction happens before any "navigate".', PENALTY.INTERACT_BEFORE_NAV);
  }
  //    (b) the plan does nothing useful (no interaction / verify / screenshot).
  const hasUseful = actionSteps.some((s) => USEFUL_ACTIONS.has(s.action));
  if (!hasUseful) {
    addIssue('Plan has no useful actions (only navigation/waits).', PENALTY.NO_USEFUL_ACTIONS);
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { score, issues, warnings, approved: score >= APPROVAL_THRESHOLD };
}

/**
 * Write a planner review report to reports/planner_review_<ts>.json.
 *
 * @param {object} ctx
 * @param {string} ctx.goal
 * @param {string} ctx.plannerMode
 * @param {object} ctx.task
 * @param {object} ctx.review - the reviewTask() result
 * @returns {string|null} path
 */
export function writePlannerReview({ goal, plannerMode, task, review }) {
  try {
    ensureDir(REPORTS_DIR);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(REPORTS_DIR, `planner_review_${ts}.json`);
    const payload = {
      goal,
      plannerMode,
      score: review.score,
      approved: review.approved,
      threshold: APPROVAL_THRESHOLD,
      issues: review.issues,
      warnings: review.warnings,
      generatedTask: task,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    return file;
  } catch (err) {
    logger.error(`[REVIEW] Could not write review report: ${err.message}`);
    return null;
  }
}
