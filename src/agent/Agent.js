/**
 * Agent.js
 *
 * Central orchestrator implementing the OTAV loop.  In V3 it also owns the
 * GoalRouter, which maps goal keys to workflow classes and instantiates them.
 *
 * Architecture (V3):
 *   index.js → agent.router.route(goalKey)
 *            → GoalRouter selects WorkflowClass
 *            → workflow.run()
 *            → agent.generatePlan(goal, params)
 *            → Planner → action[]
 *            → agent.executor.executeAll(plan)
 *            → ActionExecutor → Tools → Playwright
 *
 * Agent is the composition root — it imports every workflow class and registers
 * them with GoalRouter.  Adding a new workflow = one import + one register().
 *
 * Usage:
 *   const agent = new Agent();
 *   await agent.initialize();
 *   const workflow = agent.router.route(config.target.goal);
 *   await workflow.run();
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
import { GoalRouter }              from './GoalRouter.js';
import { FillShadcnFormWorkflow }  from '../workflows/FillShadcnFormWorkflow.js';
import { SearchGoogleWorkflow }    from '../workflows/SearchGoogleWorkflow.js';
import { SearchGitHubWorkflow }    from '../workflows/SearchGitHubWorkflow.js';
import { MultiStepWorkflow }       from '../workflows/MultiStepWorkflow.js';
import { AiPlannerWorkflow }       from '../workflows/AiPlannerWorkflow.js';
import { ACTION_TYPES }            from '../config/constants.js';
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

    // --- Routing layer (V3) ---
    /** @type {GoalRouter|null} */     this.router   = null;

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

    // Wire router (maps goal keys to workflow classes) — Agent is the composition root
    this.router = new GoalRouter(this)
      .register(ACTION_TYPES.GOALS.FILL_SHADCN_FORM, FillShadcnFormWorkflow)
      .register(ACTION_TYPES.GOALS.SEARCH_GOOGLE,    SearchGoogleWorkflow)
      .register(ACTION_TYPES.GOALS.SEARCH_GITHUB,    SearchGitHubWorkflow)
      .register(ACTION_TYPES.GOALS.MULTI_STEP,       MultiStepWorkflow)
      .register(ACTION_TYPES.GOALS.AI_PLAN,          AiPlannerWorkflow);

    logger.info(
      `Agent ready — router knows ${this.router.listGoals().length} goals: ` +
      `[${this.router.listGoals().join(', ')}]`,
    );
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

  /**
   * Log a self-healing recovery decision (scroll & re-scan, force rescan, …).
   *
   * @param {string} message
   */
  recovery(message) {
    logger.recovery(message);
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
