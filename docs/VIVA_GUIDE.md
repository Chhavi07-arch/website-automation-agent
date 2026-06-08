# 🎓 Viva Guide — Website Automation Agent

A complete preparation kit for demonstrating and defending this project in a viva / oral examination.

---

## 1. How to Demo the Project (5 minutes, live)

> Keep `HEADLESS=false` so the examiner can watch the browser.

1. **Show the layered structure** — open `src/` and point out `agent/`, `workflows/`, `services/`, `tools/`. One sentence: *"Each layer only depends on the one below it."*

2. **Run the assignment workflow:**
   ```bash
   npm start            # FILL_SHADCN_FORM
   ```
   Narrate the colour-coded log as it runs: `[PLAN]` prints the whole plan first, then `[OBSERVE]/[THINK]/[ACT]/[VERIFY]` show the OTAV loop. The browser fills the name + description fields.

3. **Switch goals without touching code:**
   ```bash
   npm run github       # SEARCH_GITHUB
   ```
   Point out: *"Only `.env` changed conceptually — the GoalRouter picked a different workflow."*

4. **Show resilience (the highlight):**
   ```bash
   npm test             # deterministic retry/recovery scenarios
   ```
   Point to the `[RETRY]` backoff lines and the bold-red `[RECOVERY]` decisions. Emphasise **Scenario E** — the agent *recovers* and succeeds on a field that didn't exist yet.

5. **Show a diagnostic report:**
   ```bash
   PAGE_LOAD_TIMEOUT=1 GOAL=SEARCH_GOOGLE npm start
   cat logs/errors/error_*.json
   ```
   *"When it can't recover, it fails observably — screenshot, URL, failed action, timestamp."*

---

## 2. Key Architecture Decisions

| Decision | Why |
|----------|-----|
| **Layered: Tools → Services → Agent → Workflows** | Separation of concerns; each layer is independently testable and replaceable. |
| **Planner emits pure-data `action[]`** | Plans are inspectable, loggable, serialisable — and an LLM could generate them later with zero changes downstream. |
| **GoalRouter registry (Map), not a switch** | Adding a workflow = one `.register()` call; no existing file changes. |
| **Accessibility-first detection** | Labels/ARIA are far more stable than CSS paths; mirrors how a human reads a page. |
| **Retry + recovery inside the Executor** | Reliability compounds across *all* workflows from one place. |
| **Diagnostics to JSON** | Turns failures into reproducible, debuggable artifacts. |
| **Config in `.env` via one validated module** | No magic numbers scattered in code; environment-tunable. |

---

## 3. Common Viva Questions & Strong Answers

**Q: Is this just a Playwright script?**
> No. A script hardcodes selectors and does one task. This is a framework: a goal router selects a workflow, a planner produces an action plan, an executor runs it with retries and self-healing recovery, and failures generate diagnostic reports. The OTAV loop and layered design make it extensible to new tasks and, eventually, an AI planner.

**Q: Walk me through what happens when I run `npm start`.**
> `index.js` initialises the `Agent` (launches the browser, wires tools/services/planner/router). It reads `GOAL` from `.env`, asks the `GoalRouter` for the matching workflow, and runs it. The workflow asks the `Planner` for a pure-data action plan, which is logged in full. The `ActionExecutor` then runs each action — resolving fields via the detection services, retrying on failure, and recovering when detection fails. Screenshots are captured throughout; on failure a diagnostic JSON is written.

**Q: How does element detection work?**
> `ElementDetectionService` tries strategies in priority order — accessible label → ARIA role → placeholder → name attribute → CSS selector — and returns the first **visible** match. `FormDetectionService` uses it to scan a page and classify fields (name / description / search) using hint lists. This avoids brittle DOM-path selectors.

**Q: Why return the first *visible* match?**
> A real bug I hit: GitHub's homepage has a hidden `<button aria-label="Search…">` in the header that shares the "search" label with the real input. `.first()` matched the hidden button and the click timed out. `_firstVisible()` iterates matches and skips hidden ones — fixing it for every page with duplicate hidden/visible elements.

**Q: How do retries work?** → see §6.
**Q: How does recovery work?** → see §7.
**Q: Difference between a workflow and the planner?** → see §8.

**Q: What happens if an element is never found?**
> The recovery ladder runs (scroll + re-scan, then full re-scan), each attempt spaced by exponential backoff. If still not found, the agent captures a `detect-failed-<field>` screenshot, tags the error with the failed action, and throws — which triggers Diagnostic Mode at the top level.

**Q: How would you add a new task, e.g. "search Bing"?**
> Three steps, no edits to existing workflows: (1) add `SEARCH_BING` to `ACTION_TYPES.GOALS`, (2) add a `_planSearchBing()` method to the Planner, (3) `.register()` it in `Agent.initialize()`. That's the whole point of the registry.

**Q: How is logging structured?**
> A Winston logger with custom levels mapping to the agent's mental states: `OBSERVE`, `THINK`, `ACT`, `VERIFY`, plus `PLAN` and `RECOVERY`. Console output is colour-coded; files store JSON. Errors also go to `logs/errors.log`.

**Q: How did you test resilience without flaky websites?**
> `data:` URL pages with known, controlled DOMs — one with no inputs, one with the wrong input, and one where a field is revealed by JS after a delay. This makes retry/recovery behaviour deterministic and repeatable.

---

## 4. Tradeoffs Made

| Tradeoff | Rationale |
|----------|-----------|
| **Rule-based recovery, not AI** | Keeps the project deterministic and explainable; the AI seam is intentionally left for a future phase. |
| **GitHub uses `/search` URL directly** | The homepage search is a dialog-opening button, not a text input; navigating to `/search` is more robust than fighting the dialog. |
| **Verification (`VERIFY_URL`) is non-fatal** | A failed verify shouldn't crash a workflow that otherwise succeeded; it retries (to allow slow pages) then warns. |
| **Bounded navigation retries (2)** | Navigation failures are usually real (bad URL / network); retrying indefinitely wastes time. |
| **Single browser context** | Simpler lifecycle; multi-tab/multi-context deferred to the roadmap. |
| **No TypeScript** | Assignment specified JavaScript; JSDoc provides type hints without a build step. |

---

## 5. Why Playwright (vs Selenium / Puppeteer)?

- **Auto-waiting** — Playwright waits for elements to be actionable by default, reducing flaky `sleep()` calls.
- **First-class accessibility selectors** — `getByRole`, `getByLabel`, `getByPlaceholder` map directly to our accessibility-first detection strategy.
- **Cross-browser** — chromium / firefox / webkit from one API (selectable via `BROWSER_TYPE`).
- **Modern async API** — clean `async/await`, no callback hell.
- **Reliable network helpers** — `waitForLoadState('networkidle')` for AJAX-heavy pages.
- vs **Selenium**: lighter, faster, no separate WebDriver process. vs **Puppeteer**: cross-browser and richer locator API.

---

## 6. How Retries Work

- `RetryService.run(fn, {retries, baseDelay, label})` is a stateless utility. It calls `fn(attempt)`; if it **throws**, it waits `baseDelay * 2^(attempt-1)` and tries again.
- Backoff schedule with defaults: **500 ms → 1000 ms → 2000 ms**.
- The `ActionExecutor` holds a **retry policy** per action type:
  - `CLICK / FILL / SEND_KEYS / PRESS_KEY / DETECT_FIELD` → retry, **fatal** on exhaustion.
  - `VERIFY_URL` → retry, **non-fatal** (warns, never crashes).
  - `NAVIGATE` → **bounded** retries (default 2 — never infinite).
  - Everything else → run once.
- All counts/delays are configurable via `.env`.

---

## 7. How Recovery Works

Recovery is **smarter than retry**: instead of repeating the same action, it changes strategy each attempt. For `DETECT_FIELD`:

```
Attempt 1 → normal detection (cached scan)
Attempt 2 → [RECOVERY] scroll down + force a fresh DOM scan
Attempt 3 → [RECOVERY] force another full DOM scan
Exhausted → [RECOVERY] capture diagnostic screenshot, then fail
```

This is implemented by passing the **attempt number** into the retry callback and branching on it. Scenario E proves it heals: a field hidden until 1800 ms is found once the backoff waiting + re-scan push past the reveal time.

---

## 8. Workflow vs Planner (the question examiners love)

| | **Workflow** | **Planner** |
|---|---|---|
| Answers | *Which* goal + *what* parameters | *How* — the ordered steps |
| Output | A call to the executor | A pure-data `action[]` array |
| Knows about | One task's intent (URL, query, values) | How to translate a goal into navigate/detect/fill/verify steps |
| Example | `SearchGoogleWorkflow` says "search Google for X" | `_planSearchGoogle()` emits `[NAVIGATE, DETECT_FIELD, FILL, PRESS_KEY, VERIFY_URL, …]` |
| Size | ~10 lines (declarative) | The step logic |

**One-liner:** *"The workflow declares the intent; the planner decides the steps; the executor performs them."* This separation is what lets a future AI planner replace `Planner.generatePlan()` without touching any workflow.

---

## 9. 30-Second Elevator Pitch

> "I built a modular browser automation **agent** in Node.js and Playwright. It dynamically detects page elements using accessibility-first heuristics, follows an Observe-Think-Act-Verify loop with full reasoning logs, and routes between multiple goal-driven workflows. The part I'm proudest of is the resilience layer — it retries with exponential backoff, *self-heals* by scrolling and re-scanning when an element isn't found yet, and writes structured diagnostic reports when it genuinely fails. The architecture is layered so a new task is one registration call, and an AI planner could drop in without rewriting anything."
