/**
 * MockPlanner.js
 *
 * Offline planner: maps a natural-language goal to a valid task using simple
 * keyword rules — no network, no API key. Used for development, tests, and as
 * the automatic fallback when OpenRouter is unavailable.
 *
 * Like the real planner, it ONLY produces task JSON; it never touches the
 * browser. Output is validated before being returned.
 */

import logger from '../utils/logger.js';
import { validateGeneratedTask } from '../workflows/MultiStepWorkflow.js';
import { saveGeneratedTask } from './_shared.js';

/** Pull the search term out of a goal ("search github for X" → "X"). */
function extractQuery(goal) {
  const g = String(goal || '').trim();
  const forMatch = g.match(/\bfor\s+(.+)$/i);
  if (forMatch) return forMatch[1].replace(/["']/g, '').trim();
  const verbMatch = g.match(/\b(?:search|find|look ?up|open|go to)\s+(.+)$/i);
  if (verbMatch) return verbMatch[1].replace(/^(?:on|in|the)\s+/i, '').replace(/["']/g, '').trim();
  return g.replace(/["']/g, '').trim();
}

export class MockPlanner {
  /**
   * @param {string} goal
   * @returns {Promise<object>} a validated task
   */
  async generateTask(goal) {
    logger.think(`MockPlanner: mapping goal → task: "${goal}"`);
    const g = String(goal || '').toLowerCase();
    const query = extractQuery(goal) || 'playwright';

    let task;
    if (/wiki(pedia)?/.test(g)) {
      task = {
        name: 'mock_wikipedia_search',
        description: `Search Wikipedia for ${query}.`,
        steps: [
          { action: 'navigate', url: 'https://en.wikipedia.org' },
          { action: 'search', field: 'search', value: query },
          { action: 'submit' },
          { action: 'wait_for_selector', selector: '#firstHeading' },
          { action: 'verify_selector', selector: '#mw-content-text' },
          { action: 'screenshot', label: 'wikipedia' },
        ],
      };
    } else if (/hacker\s*news|hn\b/.test(g)) {
      task = {
        name: 'mock_hackernews_top',
        description: 'Open the first Hacker News story.',
        steps: [
          { action: 'navigate', url: 'https://news.ycombinator.com' },
          { action: 'wait_for_selector', selector: '.athing' },
          { action: 'open_first_result', selector: '.titleline a' },
          { action: 'screenshot', label: 'hn-story' },
        ],
      };
    } else if (/stack\s*overflow|stackoverflow/.test(g)) {
      task = {
        name: 'mock_stackoverflow_search',
        description: `Search Stack Overflow for ${query}.`,
        steps: [
          { action: 'navigate', url: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}` },
          { action: 'wait', ms: 1500 },
          { action: 'screenshot', label: 'so-search' },
        ],
      };
    } else {
      // Default → GitHub search (also covers "search github for …").
      task = {
        name: 'mock_github_search',
        description: `Search GitHub for ${query}.`,
        steps: [
          { action: 'navigate', url: 'https://github.com/search' },
          { action: 'search', field: 'search', value: query },
          { action: 'submit' },
          { action: 'verify_url', fragment: `q=${query.split(/\s+/)[0]}` },
          { action: 'verify_selector', selector: '[data-testid="results-list"]' },
          { action: 'screenshot', label: 'github-results' },
        ],
      };
    }

    validateGeneratedTask(task);                 // never ship an invalid task
    const file = saveGeneratedTask(task);
    logger.info(`MockPlanner generated task "${task.name}" → ${file}`);
    return task;
  }
}
