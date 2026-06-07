/**
 * ElementDetectionService.js
 *
 * Finds interactive elements on a page using a priority-ordered strategy:
 *
 *   1. Accessible label (<label for="..."> or aria-label)
 *   2. ARIA role + name
 *   3. Placeholder attribute
 *   4. name attribute
 *   5. CSS selector (fallback)
 *
 * This priority order follows WCAG accessibility best practices and avoids
 * brittle selectors that break when the DOM structure changes.
 *
 * The service does NOT know about specific form fields — it is a general
 * element-finding utility. FormDetectionService builds on top of it.
 */

import config from '../config/env.js';
import logger from '../utils/logger.js';

export class ElementDetectionService {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  /**
   * Find an element by its visible label text.
   * Matches <label> elements whose text includes the query (case-insensitive).
   *
   * @param {string} labelText
   * @returns {import('playwright').Locator|null}
   */
  async findByLabel(labelText) {
    logger.observe(`Searching for element by label: "${labelText}"`);
    const locator = this._page.getByLabel(new RegExp(labelText, 'i'));
    if (await locator.count() > 0) {
      logger.think(`Found element via label: "${labelText}"`);
      return locator.first();
    }
    return null;
  }

  /**
   * Find an element by its ARIA role and optional accessible name.
   *
   * @param {string} role - e.g. 'textbox', 'button', 'combobox'
   * @param {string} [name] - Optional accessible name filter.
   * @returns {import('playwright').Locator|null}
   */
  async findByRole(role, name) {
    const opts = name ? { name: new RegExp(name, 'i') } : {};
    logger.observe(`Searching for element by role="${role}" name="${name || '*'}"`);
    const locator = this._page.getByRole(role, opts);
    if (await locator.count() > 0) {
      logger.think(`Found element via ARIA role: ${role}`);
      return locator.first();
    }
    return null;
  }

  /**
   * Find an input by its placeholder attribute.
   *
   * @param {string} placeholderText
   * @returns {import('playwright').Locator|null}
   */
  async findByPlaceholder(placeholderText) {
    logger.observe(`Searching for element by placeholder: "${placeholderText}"`);
    const locator = this._page.getByPlaceholder(new RegExp(placeholderText, 'i'));
    if (await locator.count() > 0) {
      logger.think(`Found element via placeholder: "${placeholderText}"`);
      return locator.first();
    }
    return null;
  }

  /**
   * Find an input by its name attribute.
   *
   * @param {string} nameAttr
   * @returns {import('playwright').Locator|null}
   */
  async findByName(nameAttr) {
    logger.observe(`Searching for element by name attribute: "${nameAttr}"`);
    const locator = this._page.locator(`[name="${nameAttr}"]`);
    if (await locator.count() > 0) {
      logger.think(`Found element via name attribute: "${nameAttr}"`);
      return locator.first();
    }
    return null;
  }

  /**
   * Find an element using a raw CSS selector (last resort).
   *
   * @param {string} selector
   * @returns {import('playwright').Locator|null}
   */
  async findByCss(selector) {
    logger.observe(`Searching for element by CSS selector: "${selector}"`);
    const locator = this._page.locator(selector);
    if (await locator.count() > 0) {
      logger.think(`Found element via CSS: "${selector}"`);
      return locator.first();
    }
    return null;
  }

  /**
   * Try all detection strategies in priority order.
   * Returns the first locator that resolves to at least one element, or null.
   *
   * @param {object} hints
   * @param {string} [hints.label]       - Label text to search for.
   * @param {string} [hints.role]        - ARIA role.
   * @param {string} [hints.roleName]    - Accessible name for the role.
   * @param {string} [hints.placeholder] - Placeholder text.
   * @param {string} [hints.name]        - name attribute value.
   * @param {string} [hints.css]         - CSS selector fallback.
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async findElement(hints) {
    logger.think(`Resolving element — hints: ${JSON.stringify(hints)}`);

    if (hints.label) {
      const el = await this.findByLabel(hints.label);
      if (el) return el;
    }

    if (hints.role) {
      const el = await this.findByRole(hints.role, hints.roleName);
      if (el) return el;
    }

    if (hints.placeholder) {
      const el = await this.findByPlaceholder(hints.placeholder);
      if (el) return el;
    }

    if (hints.name) {
      const el = await this.findByName(hints.name);
      if (el) return el;
    }

    if (hints.css) {
      const el = await this.findByCss(hints.css);
      if (el) return el;
    }

    logger.warn(`Could not locate element with hints: ${JSON.stringify(hints)}`);
    return null;
  }
}
