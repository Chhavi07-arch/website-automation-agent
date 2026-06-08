/**
 * RetryService.js
 *
 * Generic, stateless retry utility with exponential backoff.
 *
 * It is NOT an architectural layer — it is a leaf utility (like fileHelper)
 * that any caller can wrap around a flaky async operation.  It knows nothing
 * about actions, tools, or the agent; it only knows "call this function, and
 * if it throws, wait and try again".
 *
 * Backoff schedule (baseDelay = 500):
 *   attempt 1 fails → wait 500ms
 *   attempt 2 fails → wait 1000ms
 *   attempt 3 fails → (no attempts left) → throw the last error
 *
 * The function passed to run() receives the 1-based attempt number, so callers
 * that need attempt-specific behaviour (e.g. a recovery escalation ladder) can
 * branch on it.
 */

import logger from '../utils/logger.js';
import { sleep } from '../utils/fileHelper.js';

export class RetryService {
  /**
   * Compute the exponential backoff delay before a given attempt's retry.
   *
   * @param {number} attempt   - 1-based attempt number that just failed.
   * @param {number} baseDelay - Delay for the first retry (ms).
   * @returns {number} ms to wait before the next attempt.
   */
  static backoffDelay(attempt, baseDelay) {
    return baseDelay * 2 ** (attempt - 1);
  }

  /**
   * Run an async function, retrying with exponential backoff if it throws.
   *
   * @param {(attempt: number) => Promise<any>} fn - Operation to run; receives the attempt #.
   * @param {object} [opts]
   * @param {number} [opts.retries=3]    - Maximum number of attempts.
   * @param {number} [opts.baseDelay=500]- First backoff delay (ms); doubles each time.
   * @param {string} [opts.label='action'] - Human-readable label for logs.
   * @returns {Promise<any>} Resolves with fn's return value on first success.
   * @throws The last error if every attempt fails.
   */
  static async run(fn, { retries = 3, baseDelay = 500, label = 'action' } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;

        if (attempt < retries) {
          const delay = RetryService.backoffDelay(attempt, baseDelay);
          logger.warn(`[RETRY] "${label}" attempt ${attempt}/${retries} failed: ${err.message}`);
          logger.warn(`[RETRY] backing off ${delay}ms before attempt ${attempt + 1}`);
          await sleep(delay);
        } else {
          logger.warn(`[RETRY] "${label}" attempt ${attempt}/${retries} failed — no attempts left`);
        }
      }
    }

    throw lastError;
  }
}
