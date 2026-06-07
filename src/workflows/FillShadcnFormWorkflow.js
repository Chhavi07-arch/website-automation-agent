/**
 * FillShadcnFormWorkflow.js
 *
 * Assignment-specific workflow: navigate to the shadcn React Hook Form demo
 * page, detect the Name and Description fields, fill them, and capture
 * screenshots at each major step.
 *
 * This class contains all task-specific logic. The Agent and its tools/services
 * are intentionally generic and task-agnostic — only this file knows about
 * shadcn, the target URL, or what values to fill.
 *
 * Workflow steps (mirrors CLAUDE.md "Current Assignment Workflow"):
 *   1.  Screenshot after browser launch (done in index.js)
 *   2.  Navigate to target URL
 *   3.  Wait for page load
 *   4.  Screenshot after navigation
 *   5.  Detect form fields
 *   6.  Screenshot before filling
 *   7.  Fill Name field
 *   8.  Verify Name field
 *   9.  Fill Description field
 *   10. Verify Description field
 *   11. Screenshot after filling
 *   12. Done
 */

import config from '../config/env.js';
import logger  from '../utils/logger.js';

export class FillShadcnFormWorkflow {
  /**
   * @param {import('../agent/Agent.js').Agent} agent
   */
  constructor(agent) {
    this._agent = agent;
  }

  /**
   * Execute the full workflow.
   * Throws on unrecoverable errors so the caller (index.js) can shut down
   * the browser cleanly.
   *
   * @returns {Promise<void>}
   */
  async run() {
    const agent = this._agent;

    logger.info('--- FillShadcnFormWorkflow starting ---');

    // -------------------------------------------------------------------------
    // Step 1: Navigate
    // -------------------------------------------------------------------------
    agent.act('Navigating to target URL');
    await agent.goTo(config.target.url);   // also takes a screenshot

    // -------------------------------------------------------------------------
    // Step 2: Wait for the page to be fully interactive
    // -------------------------------------------------------------------------
    agent.observe('Waiting for page content to stabilise');
    await agent.navigation.waitForNetworkIdle();

    // The shadcn docs page renders the form inside a code-highlighted demo
    // block. Give the React hydration a moment to finish.
    agent.think('Allowing React hydration to complete');
    await new Promise((r) => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // Step 3: Scroll to the live demo form (it is below the fold)
    // -------------------------------------------------------------------------
    agent.think('Scrolling down to reveal the form demo');
    await agent.scroll.scrollDown(600);
    await agent.screenshot.capture('before-form-fill');

    // -------------------------------------------------------------------------
    // Step 4: Detect form fields
    // -------------------------------------------------------------------------
    agent.observe('Initiating form field detection');
    const fields = await agent.formDetection.detectFields();

    if (!fields.name && !fields.description) {
      // Neither field found — try scrolling further and re-detecting
      agent.think('No fields found yet — scrolling further and retrying');
      await agent.scroll.scrollDown(800);
      await agent.screenshot.capture('retry-scan');
      const retried = await agent.formDetection.detectFields();
      Object.assign(fields, retried);
    }

    // -------------------------------------------------------------------------
    // Step 5: Fill Name field
    // -------------------------------------------------------------------------
    if (fields.name) {
      agent.think(`Identified Name field — will fill with: "${config.form.name}"`);
      await agent.click.click(fields.name);
      await agent.input.fill(fields.name, config.form.name);

      const nameOk = await agent.validation.fieldHasValue(fields.name, config.form.name);
      if (!nameOk) {
        logger.warn('Name field value verification failed — attempting sendKeys fallback');
        await agent.input.clear(fields.name);
        await agent.input.sendKeys(fields.name, config.form.name);
      }
    } else {
      logger.warn('Name field was not detected — skipping Name fill');
    }

    // -------------------------------------------------------------------------
    // Step 6: Fill Description field
    // -------------------------------------------------------------------------
    if (fields.description) {
      agent.think(
        `Identified Description field — will fill with: "${config.form.description}"`,
      );
      await agent.click.click(fields.description);
      await agent.input.fill(fields.description, config.form.description);

      const descOk = await agent.validation.fieldHasValue(
        fields.description,
        config.form.description,
      );
      if (!descOk) {
        logger.warn('Description field value verification failed — attempting sendKeys fallback');
        await agent.input.clear(fields.description);
        await agent.input.sendKeys(fields.description, config.form.description);
      }
    } else {
      logger.warn('Description field was not detected — skipping Description fill');
    }

    // -------------------------------------------------------------------------
    // Step 7: Final screenshot
    // -------------------------------------------------------------------------
    await agent.screenshot.capture('after-form-fill');
    agent.verify('Workflow complete — form filled and screenshot captured');

    logger.info('--- FillShadcnFormWorkflow finished ---');
  }
}
