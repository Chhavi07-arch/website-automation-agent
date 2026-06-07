# Architecture V3 — Multi-Goal Routing

## What changed in V3

Version 2 had a single hardcoded workflow in `index.js`:

```js
// V2 — hardcoded
const workflow = new FillShadcnFormWorkflow(agent);
await workflow.run();
```

Version 3 inserts a **GoalRouter** between the entry point and the workflow
layer, and moves goal selection into a `.env` variable:

```js
// V3 — dynamic routing
const goalKey  = config.target.goal;          // from GOAL= in .env
const workflow = agent.router.route(goalKey); // GoalRouter selects the class
await workflow.run();
```

---

## Full V3 Architecture

```
.env (GOAL=FILL_SHADCN_FORM)
  │
  ▼
index.js
  │  reads config.target.goal
  ▼
Agent.router.route(goalKey)
  │
  ▼
GoalRouter                         ← NEW in V3
  │  Map<goalKey, WorkflowClass>
  │  registered in Agent.initialize()
  ▼
Workflow (FillShadcnFormWorkflow
          SearchGoogleWorkflow     ← NEW skeleton
          SearchGitHubWorkflow)    ← NEW skeleton
  │
  ▼
Planner.generatePlan(goal, params) ← adds skeleton plans for new goals
  │  returns action[]
  ▼
ActionExecutor.executeAll(plan)
  │  resolves field names → Locators via field registry
  ▼
Tools (NavigationTool, InputTool, ClickTool, ScrollTool, …)
  │
  ▼
Playwright → Browser
```

---

## The GoalRouter Registry Pattern

GoalRouter holds a `Map<string, WorkflowClass>`:

```js
// Agent.initialize() — the composition root
this.router = new GoalRouter(this)
  .register('FILL_SHADCN_FORM', FillShadcnFormWorkflow)
  .register('SEARCH_GOOGLE',    SearchGoogleWorkflow)
  .register('SEARCH_GITHUB',    SearchGitHubWorkflow);
```

`register()` returns `this`, enabling fluent chaining.  
`route(goalKey)` instantiates a **fresh** workflow on every call — no state leaks.

**Why registry over switch statement:**

| Switch statement | Registry Map |
|-----------------|--------------|
| Every new case = edit GoalRouter | New workflow = `register()` in Agent |
| Grows linearly with every goal | Fixed size — never needs editing |
| All workflows must be imported upfront | Could load lazily (Phase 6) |
| Not introspectable | `listGoals()`, `hasGoal()` available |

---

## Adding a new workflow (3 steps, no existing file changes)

1. **Create the workflow file** (`src/workflows/MyNewWorkflow.js`) with a
   `run()` method.

2. **Add a plan** in `Planner.js` — one private method `_planMyNew(params)`.
   Register it in the `GOAL_MAP` inside `generatePlan()`.

3. **Register it** in `Agent.initialize()`:
   ```js
   .register(ACTION_TYPES.GOALS.MY_NEW_GOAL, MyNewWorkflow)
   ```
   Add the key to `ACTION_TYPES.GOALS` in `constants.js`.

No other file changes.  `FillShadcnFormWorkflow` is untouched.

---

## Switching goals without touching code

```bash
# In .env:
GOAL=FILL_SHADCN_FORM   # runs the shadcn form workflow
GOAL=SEARCH_GOOGLE      # runs the Google search skeleton
GOAL=SEARCH_GITHUB      # runs the GitHub search skeleton
```

---

## Skeleton workflow pattern

`SearchGoogleWorkflow` and `SearchGitHubWorkflow` demonstrate the extension
pattern.  They call `agent.generatePlan()` so the full plan is logged in bold
yellow, but skip `executeAll()` until the implementation is ready:

```
[PLAN] === Planning goal: "SEARCH_GOOGLE" ===
[PLAN] Plan contains 9 steps:
[PLAN]   Step 01: Navigate → https://www.google.com
[PLAN]   Step 02: Screenshot [google-loaded]
[PLAN]   Step 03: Wait for network idle
...
[WARN]  SearchGoogleWorkflow: SKELETON — plan logged but not executed
```

To promote a skeleton to a full implementation, remove the guard block and
uncomment `await agent.executor.executeAll(plan)`.

---

## How this supports natural-language goals (Phase 6)

The GoalRouter currently maps **string keys** to **static WorkflowClasses**.
In Phase 6, the entry point changes to:

```js
// Phase 6 — natural language input
const nlGoal  = process.argv[2];             // "search GitHub for playwright"
const goalKey = await llm.classify(nlGoal);  // → "SEARCH_GITHUB"
const params  = await llm.extractParams(nlGoal, goalKey); // → { query: 'playwright' }
const workflow = agent.router.route(goalKey);
await workflow.run(params);
```

Three things change:
1. An LLM classifier converts NL → `goalKey`.
2. A param extractor fills the params object.
3. `workflow.run()` accepts params directly.

GoalRouter, all existing Workflows, Planner, ActionExecutor, and all Tools
remain **unchanged**.

---

## File map (V3 additions)

```
src/
  agent/
    GoalRouter.js              ← V3 NEW  — registry-pattern goal router
    Agent.js                   ← V3 UPDATED — imports & registers 3 workflows
    Planner.js                 ← V3 UPDATED — skeleton plans for new goals
  workflows/
    FillShadcnFormWorkflow.js  ← UNCHANGED
    SearchGoogleWorkflow.js    ← V3 NEW skeleton
    SearchGitHubWorkflow.js    ← V3 NEW skeleton
  config/
    constants.js               ← V3 UPDATED — SEARCH_GOOGLE, SEARCH_GITHUB goals
    env.js                     ← V3 UPDATED — config.target.goal, config.search.*
  index.js                     ← V3 UPDATED — reads GOAL, delegates to router
.env                           ← V3 UPDATED — GOAL, GOOGLE_QUERY, GITHUB_QUERY
```
