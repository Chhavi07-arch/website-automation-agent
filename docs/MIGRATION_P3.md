# Migration Report — Phase 3: Multi-Step Workflow Engine

## What changed

A generic, JSON-driven task engine was **added** alongside the existing goals —
nothing was replaced or refactored.

| File | Change |
|------|--------|
| `src/config/constants.js` | + `GOALS.MULTI_STEP`; + actions `OPEN_FIRST_RESULT`, `WAIT_FOR_SELECTOR`, `VERIFY_SELECTOR`; + `DEFAULT_RESULT_LINK_SELECTOR` |
| `src/config/env.js` | + `config.task.file` (from `TASK_FILE`) |
| `src/services/ValidationService.js` | + `waitForSelector()`, `verifySelectorPresent()` |
| `src/agent/ActionExecutor.js` | + 3 action cases, retry-policy entries, `_openFirstResult()` helper, labels |
| `src/agent/Planner.js` | + `_planMultiStep()` translator + GOAL_MAP entry + describe entries |
| `src/workflows/MultiStepWorkflow.js` | **new** generic workflow + exported `loadTask` / `validateTask` |
| `src/agent/Agent.js` | register `MULTI_STEP → MultiStepWorkflow` (one line) |
| `tasks/*.json` | **new** — 3 reusable task definitions |
| `tests/multistep.test.mjs` | **new** — 5 deterministic scenarios |

**Untouched (as required):** GoalRouter, RetryService, recovery ladder,
Diagnostics, outcome model, and the `FILL_SHADCN_FORM` / `SEARCH_GOOGLE` /
`SEARCH_GITHUB` goals + their tests.

---

## Why it was added

1. **Reusability without code.** Before, every new task meant a new goal +
   planner method + workflow class. Now a task is a **data file** — add JSON,
   run it. `npm run task` with any `TASK_FILE` works immediately.
2. **A stable contract.** The task schema (`{name, steps[]}`) is a clean,
   serialisable description of "what to do" that is independent of Playwright.
3. **One translation seam.** `_planMultiStep()` is the only place that maps task
   verbs to executor actions — easy to reason about, test, and later replace.

---

## Why these specific design choices

- **Generic actions only.** `OPEN_FIRST_RESULT` / `WAIT_FOR_SELECTOR` /
  `VERIFY_SELECTOR` are site-agnostic; any site-specific selector is supplied by
  the task JSON, keeping the engine reusable.
- **Two-layer validation** (structural in the workflow, semantic in the planner)
  gives precise error messages and routes failures through the existing
  FAILED-outcome + diagnostics path.
- **Reuse over addition.** No new architectural layer — `MULTI_STEP` is just
  another goal; `MultiStepWorkflow` is just another workflow; the executor only
  gained three leaf actions.

---

## How this prepares for a future OpenAI planner

The task JSON is **exactly** the format an LLM planner would produce:

```
Today
  tasks/*.json ─────────────────────────────→ Planner._planMultiStep → ActionExecutor → Browser

Future (Phase 4)
  "Open GitHub and find the playwright repo"
        │  (OpenAI: natural language → task JSON)
        ▼
  { "name": "...", "steps": [ {action:"navigate",...}, {action:"search",...}, ... ] }
        │  (same file format — no change below this line)
        ▼
  Planner._planMultiStep → ActionExecutor → RetryService → Recovery → Browser
```

To add the OpenAI planner later, you only insert **one step**: a function that
turns a natural-language instruction into the task JSON this engine already
executes. Concretely:

```js
// Phase 4 sketch — NOT implemented now (no OpenAI per constraints)
const taskJson = await openaiPlanner.toTask(naturalLanguageGoal); // NL → {name, steps[]}
// then reuse everything below, unchanged:
const plan = agent.generatePlan(GOALS.MULTI_STEP, { task: taskJson });
await agent.executor.executeAll(plan);
```

**Guarantees that hold for the future planner:**
- The **executor does not change** — it already runs the action types the planner emits.
- Retry, recovery, diagnostics, and SUCCESS/BLOCKED/FAILED outcomes apply automatically.
- The task schema is the contract; the LLM only has to produce valid task JSON
  (and `validateTask` + `_planMultiStep` already reject malformed output safely).

---

## Verification

- `npm test` → 4 suites, **ALL PASS** (resilience, github-verification,
  google-verification, multistep).
- Live `GOAL=MULTI_STEP TASK_FILE=github_playwright.json` → **SUCCESS** (searched,
  verified `q=playwright` + results-list, opened result 1/71).
- Backward-compat: `SEARCH_GITHUB`, `FILL_SHADCN_FORM` goals still **SUCCESS**.
- Missing/invalid/unsupported task inputs → **FAILED** with clear messages.

See [TEST_REPORT_V6.md](TEST_REPORT_V6.md) for full evidence.
