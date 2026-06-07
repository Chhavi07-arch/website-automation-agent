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
 * Key behaviour (V2 fix):
 *   All findBy* methods return the first VISIBLE match, not the first DOM match.
 *   Pages like GitHub have hidden header elements (e.g. a search button) that
 *   share labels with visible inputs.  Without visibility filtering, detection
 *   resolves to the hidden element first, causing subsequent clicks/fills to
 *   time out.  _firstVisible() iterates matches and skips hidden ones.
 */

import logger from '../utils/logger.js';

export class ElementDetectionService {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this._page = page;
  }

  // ---------------------------------------------------------------------------
  // Public findBy* methods — each returns the first VISIBLE match or null
  // ---------------------------------------------------------------------------

  /**
   * Find an element by its accessible label (aria-label or <label for="...">).
   *
   * @param {string} labelText
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async findByLabel(labelText) {
    logger.observe(`Searching for element by label: "${labelText}"`);
    const locator = this._page.getByLabel(new RegExp(labelText, 'i'));
    const el = await this._firstVisible(locator);
    if (el) logger.think(`Found element via label: "${labelText}"`);
    return el;
  }

  /**
   * Find an element by its ARIA role and optional accessible name.
   *
   * @param {string} role   - e.g. 'textbox', 'searchbox', 'combobox'
   * @param {string} [name] - Optional accessible name filter.
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async findByRole(role, name) {
    const opts = name ? { name: new RegExp(name, 'i') } : {};
    logger.observe(`Searching for element by role="${role}" name="${name || '*'}"`);
    const locator = this._page.getByRole(role, opts);
    const el = await this._firstVisible(locator);
    if (el) logger.think(`Found element via ARIA role: ${role}`);
    return el;
  }

  /**
   * Find an input by its placeholder attribute.
   *
   * @param {string} placeholderText
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async findByPlaceholder(placeholderText) {
    logger.observe(`Searching for element by placeholder: "${placeholderText}"`);
    const locator = this._page.getByPlaceholder(new RegExp(placeholderText, 'i'));
    const el = await this._firstVisible(locator);
    if (el) logger.think(`Found element via placeholder: "${placeholderText}"`);
    return el;
  }

  /**
   * Find an input by its name attribute.
   *
   * @param {string} nameAttr
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async findByName(nameAttr) {
    logger.observe(`Searching for element by name attribute: "${nameAttr}"`);
    const locator = this._page.locator(`[name="${nameAttr}"]`);
    const el = await this._firstVisible(locator);
    if (el) logger.think(`Found element via name attribute: "${nameAttr}"`);
    return el;
  }

  /**
   * Find an element using a raw CSS selector (last resort).
   *
   * @param {string} selector
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async findByCss(selector) {
    logger.observe(`Searching for element by CSS selector: "${selector}"`);
    const locator = this._page.locator(selector);
    const el = await this._firstVisible(locator);
    if (el) logger.think(`Found element via CSS: "${selector}"`);
    return el;
  }

  /**
   * Try all detection strategies in priority order.
   * Returns the first locator that resolves to a visible element, or null.
   *
   * @param {object} hints
   * @param {string} [hints.label]       - Accessible label text.
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Return the first visible element from a locator, or null.
   *
   * Why this exists:
   *   Pages often have duplicate elements sharing the same label — one visible
   *   (e.g. a search input on the page) and one hidden (e.g. a search button in
   *   a collapsed header).  `.first()` picks by DOM order and may return the
   *   hidden element.  This method iterates until it finds a visible one.
   *
   * @param {import('playwright').Locator} locator
   * @returns {Promise<import('playwright').Locator|null>}
   */
  async _firstVisible(locator) {
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const el = locator.nth(i);
      if (await el.isVisible()) return el;
    }
    return null;
  }
}
