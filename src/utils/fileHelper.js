/**
 * fileHelper.js
 *
 * Shared filesystem utilities. Keeps all path-manipulation and directory
 * creation logic in one place so other modules never have to reason about
 * the underlying OS path API directly.
 */

import fs from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, creating it (recursively) if it does not.
 * Safe to call multiple times — no error is thrown if the dir already exists.
 *
 * @param {string} dirPath - Absolute or relative path to the directory.
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Build a timestamped file path inside the screenshots directory.
 *
 * Example output: screenshots/screenshot_2024-06-07_14-30-05_after-fill.png
 *
 * @param {string} label   - Short description appended to the filename.
 * @param {string} [dir]   - Target directory (defaults to screenshots/).
 * @returns {string}       - Full absolute path.
 */
export function buildScreenshotPath(label = '', dir = 'screenshots') {
  ensureDir(dir);
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');              // 2024-06-07T14-30-05
  const slug = label ? `_${label.replace(/\s+/g, '-').toLowerCase()}` : '';
  const filename = `screenshot_${timestamp}${slug}.png`;
  return path.resolve(dir, filename);
}

/**
 * Sleep for a given number of milliseconds.
 * Wrapped here so callers don't litter the codebase with raw setTimeout.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
