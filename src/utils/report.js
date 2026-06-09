/**
 * report.js
 *
 * Generates a self-contained HTML run report from the in-memory log buffer
 * (populated by the logger's MemoryTransport). No external dependencies — inline
 * CSS, no JavaScript, screenshots linked by relative path.
 *
 * Output: reports/report_<timestamp>.html
 *
 * This is fully passive: it reads what already happened (logs + screenshots) and
 * never changes the executor, tools, or workflows.
 */

import fs from 'fs';
import path from 'path';
import { ensureDir } from './fileHelper.js';
import logger from './logger.js';

const REPORTS_DIR = path.resolve('reports');

/** HTML-escape a string for safe embedding. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Badge colour per outcome. */
const OUTCOME_COLOR = { SUCCESS: '#1a7f37', BLOCKED: '#9a6700', FAILED: '#cf222e' };

/**
 * Build + write the HTML report.
 *
 * @param {object} ctx
 * @param {string}  ctx.goal
 * @param {string}  ctx.taskName
 * @param {string}  ctx.outcome        - SUCCESS | BLOCKED | FAILED
 * @param {string?} [ctx.blockedReason]
 * @param {number}  ctx.startTime       - epoch ms
 * @param {number}  ctx.endTime         - epoch ms
 * @param {string}  [ctx.finalUrl]
 * @param {Array<{level:string,message:string,t:number}>} ctx.logBuffer
 * @returns {string|null} report file path, or null on failure
 */
export function writeRunReport(ctx) {
  try {
    ensureDir(REPORTS_DIR);
    const { goal, taskName, outcome, blockedReason, startTime, endTime, finalUrl, logBuffer = [] } = ctx;

    // --- Extract structured events from the log buffer ---
    const steps      = logBuffer.filter((e) => e.level === 'plan' && /^\s*\[\d+\/\d+\]/.test(e.message));
    const planLines  = logBuffer.filter((e) => e.level === 'plan' && /^\s*Step \d{2}:/.test(e.message));
    const retries    = logBuffer.filter((e) => e.message.includes('[RETRY]'));
    const recoveries = logBuffer.filter((e) => e.level === 'recovery');
    const errors     = logBuffer.filter((e) => e.level === 'error');
    const screenshots = logBuffer
      .map((e) => {
        const m = e.message.match(/Screenshot saved — (.+\.png)\s*$/);
        return m ? m[1] : null;
      })
      .filter(Boolean);

    const durationMs = Math.max(0, (endTime || Date.now()) - (startTime || Date.now()));
    const color = OUTCOME_COLOR[outcome] || '#57606a';
    const ts = new Date(startTime || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // --- Helpers to render sections ---
    const li = (s) => `<li><code>${esc(s)}</code></li>`;
    const listOrEmpty = (arr, mapFn, empty) =>
      arr.length ? `<ul>${arr.map(mapFn).join('')}</ul>` : `<p class="muted">${empty}</p>`;

    const shotsHtml = screenshots.length
      ? screenshots.map((abs) => {
          const rel = path.relative(REPORTS_DIR, abs);
          const name = path.basename(abs);
          return `<figure><a href="${esc(rel)}"><img src="${esc(rel)}" loading="lazy" alt="${esc(name)}"></a><figcaption>${esc(name)}</figcaption></figure>`;
        }).join('')
      : '<p class="muted">No screenshots captured.</p>';

    const planHtml = (planLines.length ? planLines : steps)
      .map((e) => li(e.message)).join('') || '<li class="muted">No plan recorded.</li>';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Run Report — ${esc(taskName)} (${esc(outcome)})</title>
<style>
  :root { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  body { margin: 0; background: #f6f8fa; color: #1f2328; }
  header { background: #24292f; color: #fff; padding: 20px 28px; }
  header h1 { margin: 0 0 6px; font-size: 20px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 999px; color: #fff;
           font-weight: 700; font-size: 13px; background: ${color}; }
  main { max-width: 1000px; margin: 0 auto; padding: 24px 28px 60px; }
  section { background: #fff; border: 1px solid #d0d7de; border-radius: 10px;
            padding: 16px 20px; margin: 16px 0; }
  section h2 { margin: 0 0 12px; font-size: 15px; color: #24292f; }
  .meta { display: grid; grid-template-columns: 160px 1fr; gap: 6px 16px; font-size: 14px; }
  .meta div:nth-child(odd) { color: #57606a; }
  code { background: #f6f8fa; padding: 1px 5px; border-radius: 5px; font-size: 12.5px;
         font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  ul { margin: 0; padding-left: 18px; } li { margin: 3px 0; font-size: 13px; }
  .muted { color: #8c959f; font-style: italic; }
  .pill { font-size: 12px; color: #57606a; }
  figure { display: inline-block; margin: 8px; vertical-align: top; width: 280px; }
  figure img { width: 280px; border: 1px solid #d0d7de; border-radius: 8px; background:#fff; }
  figcaption { font-size: 11px; color: #57606a; margin-top: 4px; word-break: break-all; }
  .count { color: #fff; background: ${color}; border-radius: 999px; padding: 0 8px; font-size: 12px; }
  .warn code { color: #9a6700; } .err code { color: #cf222e; } .rec code { color: #cf222e; font-weight:600; }
</style>
</head>
<body>
<header>
  <h1>🤖 Website Automation Agent — Run Report</h1>
  <span class="badge">OUTCOME: ${esc(outcome)}</span>
  ${blockedReason ? `<span class="pill" style="color:#ffd; margin-left:10px;">reason: ${esc(blockedReason)}</span>` : ''}
</header>
<main>
  <section>
    <h2>Summary</h2>
    <div class="meta">
      <div>Goal</div><div><code>${esc(goal)}</code></div>
      <div>Task</div><div><code>${esc(taskName)}</code></div>
      <div>Outcome</div><div><span class="badge">${esc(outcome)}</span></div>
      ${blockedReason ? `<div>Blocked reason</div><div><code>${esc(blockedReason)}</code></div>` : ''}
      <div>Started</div><div>${esc(new Date(startTime).toString())}</div>
      <div>Ended</div><div>${esc(new Date(endTime).toString())}</div>
      <div>Duration</div><div>${(durationMs / 1000).toFixed(1)} s</div>
      <div>Final URL</div><div><code>${esc(finalUrl || '(unknown)')}</code></div>
    </div>
  </section>

  <section>
    <h2>Planned steps <span class="count">${planLines.length || steps.length}</span></h2>
    <ul>${planHtml}</ul>
  </section>

  <section>
    <h2>Executed actions <span class="count">${steps.length}</span></h2>
    ${listOrEmpty(steps, (e) => li(e.message), 'No actions recorded.')}
  </section>

  <section class="rec">
    <h2>Recovery events <span class="count">${recoveries.length}</span></h2>
    ${listOrEmpty(recoveries, (e) => li(e.message), 'None — no self-healing was needed.')}
  </section>

  <section class="warn">
    <h2>Retry events <span class="count">${retries.length}</span></h2>
    ${listOrEmpty(retries, (e) => li(e.message), 'None — every action succeeded first try.')}
  </section>

  <section class="err">
    <h2>Errors <span class="count">${errors.length}</span></h2>
    ${listOrEmpty(errors, (e) => li(e.message), 'None.')}
  </section>

  <section>
    <h2>Screenshots <span class="count">${screenshots.length}</span></h2>
    ${shotsHtml}
  </section>

  <section>
    <p class="muted">Generated by Website Automation Agent — self-contained (no external dependencies).</p>
  </section>
</main>
</body>
</html>`;

    const file = path.join(REPORTS_DIR, `report_${ts}.html`);
    fs.writeFileSync(file, html);
    logger.info(`[REPORT] HTML run report written → ${file}`);
    return file;
  } catch (err) {
    logger.error(`[REPORT] Failed to write run report: ${err.message}`);
    return null;
  }
}
