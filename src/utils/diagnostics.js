/**
 * diagnostics.js
 *
 * Diagnostic Mode — when a workflow fails, capture enough context to debug it
 * later without re-running: a screenshot, the current URL, page title, the
 * failed action, the error message, and a timestamp.
 *
 * Reports are written to logs/errors/error_<YYYY-MM-DD>.json as a growing JSON
 * array, so multiple failures on the same day accumulate in one file.
 *
 * This is a focused utility, not an architectural layer — one function with a
 * single responsibility (persist a failure report).
 */

import fs from 'fs';
import path from 'path';
import { ensureDir } from './fileHelper.js';
import logger from './logger.js';

const ERRORS_DIR = path.resolve('logs', 'errors');

/**
 * Capture a diagnostic report for a failed workflow and append it to the
 * day's error file.  Best-effort: every capture step is guarded so the
 * diagnostic process itself never throws.
 *
 * @param {import('../agent/Agent.js').Agent} agent
 * @param {object} ctx
 * @param {string}  ctx.goal          - The goal key that was running.
 * @param {string}  ctx.workflow      - The workflow class name.
 * @param {object?} ctx.failedAction  - The action descriptor that failed (if known).
 * @param {Error}   ctx.error         - The thrown error.
 * @param {string}  [ctx.outcome]     - Execution outcome: 'BLOCKED' | 'FAILED'.
 * @param {string?} [ctx.blockedReason] - If BLOCKED, why (e.g. 'CAPTCHA').
 * @returns {Promise<string|null>} Path to the report file, or null on failure.
 */
export async function writeDiagnosticReport(agent, { goal, workflow, failedAction, error, outcome, blockedReason }) {
  try {
    ensureDir(ERRORS_DIR);

    // --- Gather page context (each guarded individually) ---
    let url = '';
    let pageTitle = '';
    let screenshotPath = null;

    try { url = agent.navigation.currentUrl(); } catch { /* page may be gone */ }
    try { pageTitle = await agent.navigation.currentTitle(); } catch { /* ignore */ }
    try { screenshotPath = await agent.screenshot.capture('diagnostic-failure'); } catch { /* ignore */ }

    // --- Build the report (keys match the documented schema) ---
    const report = {
      goal,
      workflow,
      outcome: outcome ?? 'FAILED',
      blockedReason: blockedReason ?? null,
      failedAction: failedAction?.type ?? null,
      failedActionDetail: failedAction ?? null,
      url,
      pageTitle,
      timestamp: new Date().toISOString(),
      errorMessage: error?.message ?? String(error),
      screenshot: screenshotPath,
    };

    // --- Append to the day's JSON array file ---
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const file = path.join(ERRORS_DIR, `error_${date}.json`);

    let existing = [];
    if (fs.existsSync(file)) {
      try {
        existing = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(existing)) existing = [existing];
      } catch {
        existing = []; // corrupt file — start fresh rather than crash
      }
    }
    existing.push(report);
    fs.writeFileSync(file, JSON.stringify(existing, null, 2));

    // Word the log by outcome: a BLOCKED run is not a failure, so don't call it one.
    const resolvedOutcome = report.outcome;
    if (resolvedOutcome === 'BLOCKED') {
      logger.warn(`[DIAGNOSTIC] BLOCKED report written → ${file}`);
    } else {
      logger.error(`[DIAGNOSTIC] ${resolvedOutcome} report written → ${file}`);
    }
    return file;
  } catch (err) {
    logger.error(`[DIAGNOSTIC] Failed to write diagnostic report: ${err.message}`);
    return null;
  }
}
