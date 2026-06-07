/**
 * GoalRouter.js
 *
 * Routes a goal identifier to the correct Workflow class and instantiates it.
 *
 * Design: Registry Pattern
 *   A Map<string, WorkflowClass> holds all registered goal→workflow mappings.
 *   Callers use register() to add entries and route() to resolve them.
 *
 * Why a registry instead of a switch statement:
 *   - Adding a new workflow = one register() call. No existing file changes.
 *   - The registry is introspectable at runtime (listGoals(), hasGoal()).
 *   - In Phase 6, the registry can be populated dynamically from a config file
 *     or by an LLM that selects the appropriate workflow for a natural-language
 *     request.
 *
 * Architecture position:
 *   index.js → agent.router.route(goalKey)
 *            → GoalRouter selects WorkflowClass
 *            → new WorkflowClass(agent)
 *            → workflow.run()
 *            → Planner → ActionExecutor → Tools
 *
 * Registrations live in Agent.initialize() — Agent is the composition root.
 */

import logger from '../utils/logger.js';

export class GoalRouter {
  /**
   * @param {import('./Agent.js').Agent} agent
   *   Passed through to every workflow at instantiation time.
   */
  constructor(agent) {
    this._agent = agent;

    /**
     * Maps goal key strings to uninstantiated Workflow classes.
     * Values are class references, NOT instances — the router instantiates
     * them fresh on each route() call so workflow state never leaks between runs.
     *
     * @type {Map<string, new(agent: import('./Agent.js').Agent) => object>}
     */
    this._registry = new Map();
  }

  // ---------------------------------------------------------------------------
  // Registration API
  // ---------------------------------------------------------------------------

  /**
   * Register a workflow class for a goal key.
   *
   * Returns `this` so calls can be chained fluently:
   *   router
   *     .register(GOALS.FILL_SHADCN_FORM, FillShadcnFormWorkflow)
   *     .register(GOALS.SEARCH_GOOGLE,    SearchGoogleWorkflow)
   *
   * Registering the same key twice overwrites the previous entry (last wins).
   *
   * @param {string}   goalKey       - One of ACTION_TYPES.GOALS.*
   * @param {Function} WorkflowClass - Class with a run() method.
   * @returns {this}
   */
  register(goalKey, WorkflowClass) {
    if (typeof WorkflowClass !== 'function') {
      throw new TypeError(
        `GoalRouter.register: expected a class for goal "${goalKey}", ` +
        `got ${typeof WorkflowClass}`,
      );
    }
    this._registry.set(goalKey, WorkflowClass);
    logger.info(`GoalRouter: registered "${goalKey}" → ${WorkflowClass.name}`);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Routing API
  // ---------------------------------------------------------------------------

  /**
   * Resolve a goal key to a fresh workflow instance.
   *
   * @param {string} goalKey - Must match a previously registered key.
   * @returns {object}       - A new workflow instance with a run() method.
   * @throws  {Error}        - If no workflow is registered for the goal.
   */
  route(goalKey) {
    const WorkflowClass = this._registry.get(goalKey);

    if (!WorkflowClass) {
      const available = this.listGoals().join(', ') || '(none registered)';
      throw new Error(
        `GoalRouter: no workflow registered for goal "${goalKey}". ` +
        `Available goals: [${available}]`,
      );
    }

    logger.think(`GoalRouter: "${goalKey}" → ${WorkflowClass.name}`);
    return new WorkflowClass(this._agent);
  }

  // ---------------------------------------------------------------------------
  // Introspection API
  // ---------------------------------------------------------------------------

  /**
   * Return all currently registered goal keys.
   *
   * @returns {string[]}
   */
  listGoals() {
    return [...this._registry.keys()];
  }

  /**
   * Check whether a goal key has a registered workflow.
   *
   * @param {string} goalKey
   * @returns {boolean}
   */
  hasGoal(goalKey) {
    return this._registry.has(goalKey);
  }
}
