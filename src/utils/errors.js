/**
 * errors.js
 *
 * Typed errors that let the entry point classify a run's outcome without
 * inspecting message strings. This is a tiny utility, not an architectural
 * layer — it simply distinguishes "the website blocked us" (BLOCKED) from
 * "something genuinely failed" (FAILED).
 */

/**
 * Thrown when a website presents an anti-bot wall (CAPTCHA, "unusual traffic",
 * or a consent gate) that prevents the workflow from continuing.
 *
 * A BlockedError is NOT a code failure — index.js reports it as the BLOCKED
 * outcome (distinct from FAILED) so a viewer can tell the site stopped us, not
 * a bug in the agent.
 */
export class BlockedError extends Error {
  /**
   * @param {string} blockedReason - Short reason, e.g. 'CAPTCHA' | 'consent wall'.
   */
  constructor(blockedReason) {
    super(`Workflow blocked by anti-bot protection: ${blockedReason}`);
    this.name = 'BlockedError';
    /** @type {string} */
    this.blockedReason = blockedReason;
  }
}
