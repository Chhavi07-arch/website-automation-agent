/**
 * FormDetectionService.js
 *
 * Scans a page for form fields and classifies them semantically.
 * Answers the question: "What fillable fields exist on this page, and what
 * are they for?"
 *
 * Uses ElementDetectionService for the actual locator resolution so the
 * detection strategy hierarchy is honoured everywhere.
 *
 * Responsibilities:
 *   - Detect all input / textarea elements on the page.
 *   - Classify each field using the NAME_FIELD_HINTS and
 *     DESCRIPTION_FIELD_HINTS constants.
 *   - Return a structured map of { fieldType → Locator }.
 */

import { ElementDetectionService } from './ElementDetectionService.js';
import { NAME_FIELD_HINTS, DESCRIPTION_FIELD_HINTS, SEARCH_FIELD_HINTS } from '../config/constants.js';
import logger from '../utils/logger.js';

export class FormDetectionService {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
    this._detector = new ElementDetectionService(page);
  }

  /**
   * Discover and classify form fields on the current page.
   *
   * Returns an object whose keys are semantic field names ('name',
   * 'description', 'unknown_0', …) and values are Playwright Locators.
   *
   * @returns {Promise<Record<string, import('playwright').Locator>>}
   */
  async detectFields() {
    logger.observe('Scanning page for form fields');

    const fields = {};

    // --- Strategy 1: resolve name field via known label hints ---
    for (const hint of NAME_FIELD_HINTS) {
      const locator = await this._detector.findElement({
        label: hint,
        placeholder: hint,
        name: hint,
      });
      if (locator) {
        logger.think(`Identified "name" field via hint: "${hint}"`);
        fields.name = locator;
        break;
      }
    }

    // --- Strategy 2: resolve description field via known label hints ---
    for (const hint of DESCRIPTION_FIELD_HINTS) {
      const locator = await this._detector.findElement({
        label: hint,
        placeholder: hint,
        name: hint,
        css: 'textarea',        // description fields are often textareas
      });
      if (locator) {
        logger.think(`Identified "description" field via hint: "${hint}"`);
        fields.description = locator;
        break;
      }
    }

    // --- Strategy 3: resolve search field via known search hints ---
    for (const hint of SEARCH_FIELD_HINTS) {
      const locator = await this._detector.findElement({
        label:       hint,
        placeholder: hint,
        name:        hint,
      });
      if (locator) {
        logger.think(`Identified "search" field via hint: "${hint}"`);
        fields.search = locator;
        break;
      }
    }

    // --- Strategy 3b: ARIA searchbox role (Google, custom search inputs) ---
    if (!fields.search) {
      const locator = await this._detector.findByRole('searchbox');
      if (locator) {
        logger.think('Identified "search" field via ARIA searchbox role');
        fields.search = locator;
      }
    }

    // --- Strategy 4: fall back to scanning all visible inputs ---
    if (!fields.name || !fields.description || !fields.search) {
      logger.think('Falling back to full-page input scan for remaining unclassified fields');
      const inputs = this._page.locator('input:visible, textarea:visible');
      const count = await inputs.count();
      logger.observe(`Found ${count} visible input/textarea elements`);

      for (let i = 0; i < count; i++) {
        const el = inputs.nth(i);

        // Collect accessible metadata for classification
        const ariaLabel   = await el.getAttribute('aria-label')   || '';
        const placeholder = await el.getAttribute('placeholder')  || '';
        const nameAttr    = await el.getAttribute('name')         || '';
        const id          = await el.getAttribute('id')           || '';
        const type        = await el.getAttribute('type')         || 'text';

        const combined = [ariaLabel, placeholder, nameAttr, id]
          .join(' ')
          .toLowerCase();

        if (!fields.search && (type === 'search' || SEARCH_FIELD_HINTS.some((h) => combined.includes(h)))) {
          logger.think(`Classified input[${i}] as "search" via metadata scan — confidence: MEDIUM`);
          fields.search = el;
        } else if (!fields.name && NAME_FIELD_HINTS.some((h) => combined.includes(h))) {
          logger.think(`Classified input[${i}] as "name" via metadata scan — confidence: MEDIUM`);
          fields.name = el;
        } else if (!fields.description && DESCRIPTION_FIELD_HINTS.some((h) => combined.includes(h))) {
          logger.think(`Classified input[${i}] as "description" via metadata scan — confidence: MEDIUM`);
          fields.description = el;
        } else if (!fields.name && !fields.description && !fields.search) {
          const key = `unknown_${i}`;
          logger.warn(`[WARN] Using LOW-confidence fallback locator (positional input scan) — storing input[${i}] as "${key}"`);
          fields[key] = el;
        }
      }
    }

    const found = Object.keys(fields);
    logger.observe(`Field detection complete — found: [${found.join(', ')}]`);
    return fields;
  }
}
