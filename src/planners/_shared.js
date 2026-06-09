/**
 * planners/_shared.js
 *
 * Small helpers shared by the planners: saving generated tasks / raw responses
 * and extracting a JSON object from a model's text response.
 */

import fs from 'fs';
import path from 'path';
import { ensureDir } from '../utils/fileHelper.js';

export const GENERATED_DIR = path.resolve('tasks', 'generated');

/** Filesystem-safe timestamp for filenames. */
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Persist a validated, generated task to tasks/generated/<name>_<ts>.json.
 *
 * @param {object} task
 * @returns {string} file path
 */
export function saveGeneratedTask(task) {
  ensureDir(GENERATED_DIR);
  const safeName = String(task.name || 'task').replace(/[^\w.-]+/g, '_').slice(0, 60);
  const file = path.join(GENERATED_DIR, `${safeName}_${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(task, null, 2));
  return file;
}

/**
 * Persist a raw (rejected) model response for debugging.
 *
 * @param {string} text
 * @param {string} [label]
 * @returns {string} file path
 */
export function saveRawResponse(text, label = 'response') {
  ensureDir(GENERATED_DIR);
  const safe = String(label).replace(/[^\w.-]+/g, '_').slice(0, 40);
  const file = path.join(GENERATED_DIR, `_raw_${safe}_${stamp()}.txt`);
  fs.writeFileSync(file, String(text));
  return file;
}

/**
 * Extract a single JSON object from a model's text response. Tolerates stray
 * markdown fences or surrounding prose by slicing from the first "{" to the
 * last "}". Throws if no valid JSON object can be parsed.
 *
 * @param {string} text
 * @returns {object}
 */
export function extractJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('empty model response');
  }
  // Strip ```json ... ``` / ``` ... ``` fences if present.
  let cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON object found in response');
  }
  const slice = cleaned.slice(start, end + 1);
  return JSON.parse(slice); // throws SyntaxError on malformed JSON
}
