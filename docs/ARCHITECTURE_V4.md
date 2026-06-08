# Architecture V4 — Resilience, Fault Tolerance, Self-Healing

## What changed in V4

V3 could execute multi-step plans across multiple workflows, but any single
failed action crashed the whole workflow. V4 makes execution *fault-tolerant*:
actions retry with backoff, field detection self-heals, and every unrecoverable
failure produces a structured diagnostic report.

**No new architectural layer was added.** RetryService is a leaf utility (like
`fileHelper`), and recovery/diagnostics are behaviours *inside* the existing
ActionExecutor and entry point — not coordinators, factories, or managers.

---

## Full V4 execution flow

```
Goal (.env GOAL=…)
  │
  ▼
GoalRouter ──→ Workflow ──→ Planner ──→ action[]
                                          │
                                          ▼
                                   ActionExecutor.executeAll()
                                          │  per action:
                                          ▼
                                   ┌──────────────────────────┐
                                   │ retry policy lookup       │
                                   └──────────────────────────┘
                                     │                  │
                          retryable? │                  │ no
                                     ▼                  ▼
                          RetryService.run()      _rawExecute()  ── once
                          (exp backoff 500→1000→2000)   │
                                     │                  │
                       DETECT_FIELD? │                  │
                                     ▼                  ▼
                          Recovery ladder            Tools ──→ Playwright
                          (scroll+rescan →
                           force rescan →
                           diagnostic screenshot)
                                     │
                              all fail │
                                     ▼
                          throw (tagged failedAction)
                                     │
                                     ▼
                          index.js catch
                                     │
                                     ▼
                          Diagnostic Mode → logs/errors/error_<date>.json
```

---

## Component responsibilities (new in V4)

### RetryService (`src/services/RetryService.js`)
Stateless. `run(fn, {retries, baseDelay, label})` calls `fn(attempt)`; on throw it
waits `baseDelay * 2^(attempt-1)` and retries. `fn` receives the attempt number so
callers can branch (the recovery ladder uses this). Knows nothing about actions.

### Retry policy (in ActionExecutor)
A `switch` mapping action type → `{retries, fatal}`:
- **CLICK, FILL, SEND_KEYS, PRESS_KEY, DETECT_FIELD** → `actionRetries`, fatal
- **VERIFY_URL** → `actionRetries`, **non-fatal** (retry gives slow pages time; a
  failed verify warns, never crashes — preserving V2/V3 semantics)
- **NAVIGATE** → `navigationRetries` (bounded — *never indefinite*)
- everything else → run once

### Recovery ladder (DETECT_FIELD, in ActionExecutor)
```
attempt 1 → normal detection (cached scan)
attempt 2 → [RECOVERY] scroll down + force fresh DOM scan
attempt 3 → [RECOVERY] force fresh DOM scan again
exhausted → [RECOVERY] capture detect-failed-<field> screenshot, then throw
```
Each decision is logged at the new `recovery` level (`[RECOVERY]`, bold red).

### Diagnostic Mode (`src/utils/diagnostics.js`)
On workflow failure, `index.js` calls `writeDiagnosticReport()`, which appends a
record to `logs/errors/error_<YYYY-MM-DD>.json`:
```json
{ "goal", "workflow", "failedAction", "url", "pageTitle", "timestamp", "errorMessage", "screenshot" }
```
Best-effort and self-guarding — the diagnostic process never throws.

### ValidationService additions
`verifyElementVisible()`, `verifyElementEnabled()`, `verifyPageLoaded()` — reusable
checks available to workflows and recovery logic.

---

## Configuration (`.env` → `config.retry`)

| Var | Default | Meaning |
|-----|---------|---------|
| `RETRY_COUNT` | 3 | Max attempts for retryable element actions |
| `NAV_RETRY_COUNT` | 2 | Max attempts for NAVIGATE (bounded) |
| `RETRY_BASE_DELAY_MS` | 500 | First backoff; doubles each attempt |

---

## Why recovery & retries beat adding more workflows

Adding a 4th, 5th, 6th workflow increases what the agent *can attempt* on a perfect
page. But real pages are not perfect — they hydrate late, render elements
asynchronously, rate-limit, and shift layout. A brittle agent with 20 workflows
that each break on the first timing hiccup is less useful than a resilient agent
with 3 workflows that *finish despite* hiccups.

- **Reliability compounds across every workflow.** One RetryService + one recovery
  ladder makes *all* current and future workflows more robust. A new workflow
  multiplies surface area by one; resilience multiplies reliability across all of
  them.
- **Test E proves it:** a field that doesn't exist yet at detection time would have
  crashed V3. V4 waits and recovers — the exact behaviour that separates a script
  from an agent.
- **Failures become debuggable.** Diagnostic Mode turns "it broke" into a dated
  JSON record with screenshot, URL, title, and the precise failed action.

---

## How this moves toward real autonomous browser agents

Real agents (Browser Use, etc.) spend most of their engineering not on *what to do*
but on *coping when reality differs from the plan*. V4 introduces the three
foundations of that:

1. **Retry with backoff** — tolerate transient failures (network blips, late JS).
2. **Recovery escalation** — change strategy when the first approach fails
   (scroll, rescan) instead of giving up.
3. **Observable failure** — structured diagnostics so failures can be analysed and,
   eventually, *learned from*.

The recovery ladder is currently rule-based (scroll → rescan). The seam is now in
place for Phase 4's AI layer to replace those fixed steps with model-chosen
recovery strategies ("the field isn't visible — try dismissing the cookie banner,
then re-scan"), without touching RetryService, the Planner, or any workflow.

---

## File map (V4 additions)

```
src/
  services/
    RetryService.js        ← V4 NEW — exponential-backoff retry utility
    ValidationService.js   ← V4 UPDATED — verifyElementVisible/Enabled/PageLoaded
  utils/
    diagnostics.js         ← V4 NEW — writes logs/errors/error_<date>.json
    logger.js              ← V4 UPDATED — 'recovery' log level
  agent/
    ActionExecutor.js      ← V4 UPDATED — retry policy + DETECT_FIELD recovery ladder
    Agent.js               ← V4 UPDATED — recovery() log passthrough
  config/
    env.js                 ← V4 UPDATED — config.retry
    constants.js           ← V4 UPDATED — LOG_LEVELS.RECOVERY
  index.js                 ← V4 UPDATED — Diagnostic Mode on failure
tests/
  resilience.test.mjs      ← V4 NEW — deterministic B/D/E scenarios
docs/
  TEST_REPORT_V3.md        ← V4 NEW — tests A–E results
  ARCHITECTURE_V4.md       ← V4 NEW — this document
```
