/**
 * Agent.js
 *
 * Central orchestrator implementing the OTAV (Observe → Think → Act → Verify)
 * loop.  In V2 it also owns the Planner, which sits between a Workflow's goal
 * declaration and the ActionExecutor's dispatch.
 *
 * Architecture (V2):
 *   Workflow → agent.generatePlan(goal, params)
 *            → Planner  → action[]
 *            → agent.executor.executeAll(plan)
 *            → ActionExecutor → Tools → Playwright
 *
 * Design philosophy:
 *   - Agent owns every component; Workflows hold only an Agent reference.
 *   - No page-specific or task-specific logic lives here.
 *   - Future AI integration (Phase 4) will replace Planner.generatePlan() with
 *     an LLM call — the Agent interface does not change.
 *
 * Usage:
 *   const agent = new Agent();
 *   await agent.initialize();
 *   await new FillShadcnFormWorkflow(agent).run();
 *   await agent.shutdown();
 */

import { BrowserManager }          from '../tools/BrowserManager.js';
import { NavigationTool }          from '../tools/NavigationTool.js';
import { ScreenshotTool }          from '../tools/ScreenshotTool.js';
import { InputTool }               from '../tools/InputTool.js';
import { ClickTool }               from '../tools/ClickTool.js';
import { ScrollTool }              from '../tools/ScrollTool.js';
import { ElementDetectionService } from '../services/ElementDetectionService.js';
import { FormDetectionService }    from '../services/FormDetectionService.js';
import { ValidationService }       from '../services/ValidationService.js';
import { ActionExecutor }          from './ActionExecutor.js';
import { Planner }                 from './Planner.js';
import logger                      from '../utils/logger.js';

export class Agent {
  constructor() {
    // --- Tools (low-level Playwright wrappers) ---
    this.browserManager = new BrowserManager();
    /** @type {NavigationTool|null} */   this.navigation  = null;
    /** @type {ScreenshotTool|null} */   this.screenshot  = null;
    /** @type {InputTool|null} */        this.input       = null;
    /** @type {ClickTool|null} */        this.click       = null;
    /** @type {ScrollTool|null} */       this.scroll      = null;

    // --- Services (business logic above raw tools) ---
    /** @type {ElementDetectionService|null} */ this.elementDetection = null;
    /** @type {FormDetectionService|null} */   this.formDetection    = null;
    /** @type {ValidationService|null} */      this.validation       = null;

    // --- Planning layer ---
    /** @type {Planner|null} */        this.planner  = null;

    // --- Action dispatcher ---
    /** @type {ActionExecutor|null} */ this.executor = null;

    /** Raw Playwright page reference, shared by all tools. */
    this._page = null;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Launch the browser and wire every tool/service to the active page.
   * Must be called before any workflow runs.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('=== Agent initialising ===');

    this._page = await this.browserManager.launch();

    // Wire tools to the page
    this.navigation = new NavigationTool(this._page);
    this.screenshot = new ScreenshotTool(this._page);
    this.input      = new InputTool(this._page);
    this.click      = new ClickTool(this._page);
    this.scroll     = new ScrollTool(this._page);

    // Wire services to the page
    this.elementDetection = new ElementDetectionService(this._page);
    this.formDetection    = new FormDetectionService(this._page);
    this.validation       = new ValidationService(this._page);

    // Wire executor (dispatches action objects to tools)
    this.executor = new ActionExecutor(this);

    // Wire planner (translates goals into action arrays for the executor)
    this.planner  = new Planner(this);

    logger.info('Agent ready — all tools, services, and planner initialised');
  }

  /**
   * Close the browser and release all resources.
   * Always call this — even if an error occurs (use try/finally in workflows).
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('=== Agent shutting down ===');
    await this.browserManager.close();
    logger.info('Agent shutdown complete');
  }

  // ---------------------------------------------------------------------------
  // OTAV helpers — called by workflows to emit structured logs
  // ---------------------------------------------------------------------------

  /**
   * Log an observation about the current page state.
   *
   * @param {string} message
   */
  observe(message) {
    logger.observe(message);
  }

  /**
   * Log a reasoning / decision step.
   *
   * @param {string} message
   */
  think(message) {
    logger.think(message);
  }

  /**
   * Log that an action is about to be taken.
   *
   * @param {string} message
   */
  act(message) {
    logger.act(message);
  }

  /**
   * Log the result of a verification check.
   *
   * @param {string} message
   */
  verify(message) {
    logger.verify(message);
  }

  /**
   * Log a planning step (emitted by the Planner before execution begins).
   *
   * @param {string} message
   */
  plan(message) {
    logger.plan(message);
  }

  // ---------------------------------------------------------------------------
  // Planning proxy — Workflows call this instead of importing Planner directly
  // ---------------------------------------------------------------------------

  /**
   * Generate an action plan for a named goal.
   * Thin proxy to Planner.generatePlan() so Workflows have a single import.
   *
   * @param {string} goalKey  - One of ACTION_TYPES.GOALS.*
   * @param {object} [params] - Goal-specific parameters.
   * @returns {object[]}      - Ordered action descriptors ready for executeAll().
   */
  generatePlan(goalKey, params = {}) {
    return this.planner.generatePlan(goalKey, params);
  }

  // ---------------------------------------------------------------------------
  // Convenience helpers — thin wrappers that make workflow code read naturally
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a URL and take a screenshot after landing.
   *
   * @param {string} url
   * @returns {Promise<void>}
   */
  async goTo(url) {
    await this.navigation.navigateTo(url);
    await this.screenshot.capture('after-navigation');
  }

  /**
   * Return the raw Playwright page (rarely needed by workflows directly).
   *
   * @returns {import('playwright').Page}
   */
  getPage() {
    return this._page;
  }
}
