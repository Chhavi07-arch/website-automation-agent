/**
 * tests/google-verification.test.mjs
 *
 * Deterministic tests for Google reliability (P2): blocked-state detection,
 * content verification, and SUCCESS / BLOCKED / FAILED outcome classification.
 * Uses controlled data: URL pages so behaviour is reproducible without live
 * Google (which is non-deterministic — it CAPTCHAs from datacenter IPs).
 *
 * Run: node tests/google-verification.test.mjs
 *
 * Outcome classification under test:
 *   no error thrown        → SUCCESS
 *   BlockedError thrown    → BLOCKED
 *   any other error thrown → FAILED
 */

import { Agent } from '../src/agent/Agent.js';
import { ACTION_TYPES } from '../src/config/constants.js';
import { BlockedError } from '../src/utils/errors.js';
import logger from '../src/utils/logger.js';

const RESULTS_SELECTOR = '#search, #rso, #result-stats';
const EMPTY_HINT = 'did not match any documents|no results found';

// A real Google results page: results container present, query in (data) URL.
const PAGE_SUCCESS = `data:text/html,<html><body>q=playwright`
  + `<div id="search"><div id="rso"><a>playwright.dev</a></div></div></body></html>`;

// A consent wall: structural consent form + heading text.
const PAGE_CONSENT = `data:text/html,<html><body><h1>Before you continue to Google</h1>`
  + `<form action="https://consent.google.com/save"><button>Accept all</button></form></body></html>`;

// A reCAPTCHA wall.
const PAGE_CAPTCHA = `data:text/html,<html><body><form id="captcha-form">`
  + `<iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe></form></body></html>`;

// An "unusual traffic" block page (the /sorry variant, by text).
const PAGE_BLOCKED = `data:text/html,<html><body>`
  + `<p>Our systems have detected unusual traffic from your computer network.</p></body></html>`;

// A normal failure: not blocked, but the search never executed (no q=, no results).
const PAGE_FAILED = `data:text/html,<html><body><form><input name="q"></form></body></html>`;

/** Plan that mirrors the Google post-submit classification chain. */
const classifyPlan = (firstToken) => [
  { type: ACTION_TYPES.CHECK_BLOCKED },
  { type: ACTION_TYPES.VERIFY_URL, fragment: `q=${firstToken}`, fatal: true },
  { type: ACTION_TYPES.VERIFY_RESULTS, resultsSelector: RESULTS_SELECTOR, emptyHint: EMPTY_HINT, fatal: true },
];

/**
 * @param {Agent} agent
 * @param {{id,title,url,plan,expect:'SUCCESS'|'BLOCKED'|'FAILED'}} s
 * @returns {Promise<boolean>}
 */
async function scenario(agent, { id, title, url, plan, expect }) {
  logger.info(`\n========== ${id}: ${title} ==========`);
  agent.executor._fieldsScanned = false;
  agent.executor._fieldRegistry.clear();
  await agent.navigation.navigateTo(url);

  let outcome;
  try {
    await agent.executor.executeAll(plan);
    outcome = 'SUCCESS';
  } catch (err) {
    outcome = err instanceof BlockedError ? 'BLOCKED' : 'FAILED';
    logger.info(`${id}: classified as ${outcome} → ${err.message}`);
  }

  const pass = outcome === expect;
  logger.info(`${id} RESULT: expected=${expect}, actual=${outcome} → ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

async function main() {
  const agent = new Agent();
  await agent.initialize();
  const results = [];

  try {
    results.push(await scenario(agent, {
      id: '1', title: 'Successful search → SUCCESS',
      url: PAGE_SUCCESS, plan: classifyPlan('playwright'), expect: 'SUCCESS',
    }));
    results.push(await scenario(agent, {
      id: '2', title: 'Consent page → BLOCKED',
      url: PAGE_CONSENT, plan: classifyPlan('playwright'), expect: 'BLOCKED',
    }));
    results.push(await scenario(agent, {
      id: '3', title: 'CAPTCHA page → BLOCKED',
      url: PAGE_CAPTCHA, plan: classifyPlan('playwright'), expect: 'BLOCKED',
    }));
    results.push(await scenario(agent, {
      id: '4', title: 'Unusual-traffic block page → BLOCKED',
      url: PAGE_BLOCKED, plan: classifyPlan('playwright'), expect: 'BLOCKED',
    }));
    results.push(await scenario(agent, {
      id: '5', title: 'Normal failure (search never executed) → FAILED',
      url: PAGE_FAILED, plan: classifyPlan('playwright'), expect: 'FAILED',
    }));
  } finally {
    await agent.shutdown();
  }

  logger.info('\n========== GOOGLE OUTCOME SUMMARY ==========');
  const allPass = results.every(Boolean);
  results.forEach((p, i) => logger.info(`Scenario ${i + 1}: ${p ? 'PASS ✅' : 'FAIL ❌'}`));
  logger.info(`Overall: ${allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);
  process.exitCode = allPass ? 0 : 1;
}

main();
