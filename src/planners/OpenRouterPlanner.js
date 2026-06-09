/**
 * OpenRouterPlanner.js
 *
 * Converts a natural-language goal into task JSON by calling an OpenRouter chat
 * model with a strict JSON-only system prompt. It ONLY produces task JSON — it
 * never touches Playwright, the ActionExecutor, or the browser.
 *
 * Failure model (two distinct kinds):
 *   - Transport (timeout / 429 / 401 / network)  → throw PlannerTransportError
 *       → the PlannerProvider falls back to the MockPlanner.
 *   - Bad output (unparseable / invalid schema / unknown action) → save the raw
 *       response, then throw PlannerValidationError → the run does NOT execute.
 *
 * `fetchImpl` is injectable so tests never hit the network or need a real key.
 */

import logger from '../utils/logger.js';
import { PlannerTransportError, PlannerValidationError } from '../utils/errors.js';
import { validateGeneratedTask } from '../workflows/MultiStepWorkflow.js';
import { extractJsonObject, saveGeneratedTask, saveRawResponse } from './_shared.js';

export class OpenRouterPlanner {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {string} opts.baseUrl
   * @param {number} [opts.timeoutMs=30000]
   * @param {string} opts.systemPrompt
   * @param {Function} [opts.fetchImpl] - defaults to global fetch (injectable for tests)
   */
  constructor({ apiKey, model, baseUrl, timeoutMs = 30000, systemPrompt, fetchImpl } = {}) {
    this._apiKey = apiKey;
    this._model = model;
    this._baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this._timeoutMs = timeoutMs;
    this._systemPrompt = systemPrompt || '';
    this._fetch = fetchImpl || globalThis.fetch;
  }

  /**
   * @param {string} goal - natural-language goal
   * @returns {Promise<object>} a validated task
   * @throws {PlannerTransportError|PlannerValidationError}
   */
  async generateTask(goal) {
    logger.info(`OpenRouterPlanner: requesting plan from "${this._model}" for goal: "${goal}"`);
    const content = await this._callModel(goal); // throws PlannerTransportError on transport issues

    let task;
    try {
      task = extractJsonObject(content);          // SyntaxError if not JSON
      validateGeneratedTask(task);                // throws on bad schema / unknown action
    } catch (err) {
      const rawPath = saveRawResponse(content, goal.slice(0, 30));
      logger.error(`[AI] Generated task is invalid — NOT executing. Reason: ${err.message}`);
      logger.error(`[AI] Raw model response saved → ${rawPath}`);
      throw new PlannerValidationError(`invalid AI task: ${err.message}`);
    }

    const file = saveGeneratedTask(task);
    logger.info(`[AI] Valid task "${task.name}" generated → ${file}`);
    return task;
  }

  /**
   * Call the OpenRouter chat-completions endpoint and return the message text.
   *
   * @param {string} goal
   * @returns {Promise<string>}
   * @throws {PlannerTransportError}
   */
  async _callModel(goal) {
    const url = `${this._baseUrl}/chat/completions`;
    const body = {
      model: this._model,
      temperature: 0,
      messages: [
        { role: 'system', content: this._systemPrompt },
        { role: 'user', content: goal },
      ],
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    let res;
    try {
      res = await this._fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this._apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/website-automation-agent',
          'X-Title': 'Website Automation Agent',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new PlannerTransportError(
        err?.name === 'AbortError' ? `request timed out after ${this._timeoutMs}ms` : `network error: ${err.message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const status = res.status;

      // Surface the OpenRouter error body + the model slug used (often explains
      // exactly why, e.g. "model is unavailable / use this slug instead").
      let bodyText = '';
      try { bodyText = await res.text(); } catch { /* ignore */ }
      const snippet = bodyText ? ` — body: ${bodyText.slice(0, 500)}` : '';
      logger.warn(`[AI] OpenRouter HTTP ${status} for model "${this._model}"${snippet}`);

      const tail = bodyText ? ` — ${bodyText.slice(0, 200)}` : '';
      if (status === 401 || status === 403) {
        throw new PlannerTransportError(`authentication failed (HTTP ${status}) for model "${this._model}"${tail}`);
      }
      if (status === 429) {
        throw new PlannerTransportError(`rate limited (HTTP 429) for model "${this._model}"${tail}`);
      }
      throw new PlannerTransportError(`OpenRouter HTTP ${status} for model "${this._model}"${tail}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      throw new PlannerTransportError(`could not parse OpenRouter envelope: ${err.message}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new PlannerTransportError('OpenRouter returned no message content');
    return content;
  }
}
