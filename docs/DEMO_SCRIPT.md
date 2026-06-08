# 🎬 Demo Script — Website Automation Agent

Three timed scripts for presenting the project. Each is a word-for-word-ready narration with the exact commands to run.

> **Setup before any demo:** `HEADLESS=false` in `.env` (default), terminal + browser visible side by side, `npm install` already done.

---

## ⏱ 3-Minute Version (elevator demo)

**Goal: prove it works and it's resilient. Two commands.**

**[0:00 – 0:30] Frame it**
> "This is a browser-automation *agent* — not a script. It detects page elements dynamically, follows an Observe-Think-Act-Verify loop, and recovers from failures. Let me show you."

**[0:30 – 1:45] Run the main workflow**
```bash
npm start
```
> "It printed the whole plan first — that's the planner. Now watch the log: `OBSERVE` it read the page, `THINK` it found the 'name' field by its label, `ACT` it typed, `VERIFY` it confirmed the value. The browser filled both fields. No hardcoded selectors — it found them by accessibility labels."

**[1:45 – 2:45] Run the resilience suite**
```bash
npm test
```
> "These are failure scenarios. See the yellow `[RETRY]` lines backing off 500ms, 1000ms — and the red `[RECOVERY]` decisions where it scrolls and re-scans the page. The key one is Scenario E: a field that doesn't exist yet when we look. The agent waits, re-scans, finds it, and succeeds. That's self-healing."

**[2:45 – 3:00] Close**
> "Layered architecture, retries, recovery, diagnostics — adding a new task is a single registration call. That's the difference between a script and an agent."

---

## ⏱ 5-Minute Version (standard viva)

**[0:00 – 0:45] Architecture overview**
> Open `src/`. "Four layers. `tools/` wraps Playwright. `services/` adds intelligence like element detection. `agent/` orchestrates — a goal router, a planner, an executor. `workflows/` are the tasks. Each layer only depends on the one below."
> Show the README architecture diagram (Mermaid): *Goal → Workflow → Planner → Executor → Retry → Recovery → Browser.*

**[0:45 – 2:15] Main workflow with narration**
```bash
npm start
```
> Narrate the `[PLAN]` block: "The planner produced a 15-step plan as pure data — fully logged before anything runs. That matters because an AI could generate this same format later."
> Narrate OTAV: "label-based detection → click → fill → verify value matches."
> Open a saved screenshot from `screenshots/` to show evidence capture.

**[2:15 – 3:15] Goal routing**
```bash
npm run github
```
> "I changed only the goal. The GoalRouter — a registry, not a switch — picked `SearchGitHubWorkflow`. It detects the search input past a *hidden* header button (it only matches visible elements), types, submits, and verifies the results URL."

**[3:15 – 4:30] Resilience**
```bash
npm test
```
> Explain retry policy: "Clicks and fills retry with exponential backoff. Navigation retries are *bounded* — it won't loop forever on a bad URL. Verifications retry but never crash the run."
> Explain the recovery ladder on `DETECT_FIELD`: normal → scroll+rescan → full rescan → diagnostic screenshot → fail.
> Highlight Scenario E self-healing.

**[4:30 – 5:00] Diagnostics + close**
```bash
PAGE_LOAD_TIMEOUT=1 GOAL=SEARCH_GOOGLE npm start
cat logs/errors/error_*.json
```
> "When it can't recover, it fails *observably* — a JSON report with screenshot, URL, page title, and the exact failed action. That's production-minded debugging."

---

## ⏱ 10-Minute Version (full presentation)

**[0:00 – 1:00] Motivation**
> "Most automation projects are one brittle script with hardcoded selectors. My goal was to show the difference between a script and an *agent*: extensible, observable, and resilient." Show the README comparison table.

**[1:00 – 2:30] Architecture deep-dive**
> Walk the layers with a file open in each:
> - `tools/ClickTool.js` — "thin Playwright wrapper, one responsibility."
> - `services/ElementDetectionService.js` — "priority strategies, visible-only matching; I'll explain a real bug this fixed."
> - `agent/Planner.js` — "goal → pure-data plan."
> - `agent/ActionExecutor.js` — "dispatch + retry + recovery."
> - `workflows/` — "declarative intent."
> Show the V1→V4 evolution diagram and explain each version *extended* without rewriting.

**[2:30 – 4:00] Live: FILL_SHADCN_FORM**
```bash
npm start
```
> Full OTAV narration + planner block + screenshots. Pause on a `[VERIFY]` line: "it doesn't assume success, it confirms it."

**[4:00 – 5:30] Live: both searches**
```bash
npm run google
npm run github
```
> "Same engine, different goals via the router." For GitHub, explain the visible-element bug: "the homepage has a hidden search *button* sharing the 'search' label — `.first()` matched it and clicks timed out. I made detection return the first *visible* match. Real debugging on real sites."

**[5:30 – 7:30] Resilience in depth**
```bash
npm test
```
> Open `services/RetryService.js`: "stateless, exponential backoff, passes the attempt number to the callback."
> Open the recovery ladder in `ActionExecutor.js`: "that attempt number lets each retry change *strategy* — scroll, then full rescan. Recovery is smarter than retry."
> Walk through Scenarios B, D, E line by line. Emphasise E's self-heal and the `failedAction` tagging.

**[7:30 – 8:45] Diagnostics + config**
```bash
PAGE_LOAD_TIMEOUT=1 GOAL=SEARCH_GOOGLE npm start
cat logs/errors/error_*.json
```
> Show the JSON. Then open `.env` / `.env.example`: "everything tunable — timeouts, retry counts, goal, headless — in one validated config module. No magic numbers in code."

**[8:45 – 9:45] Extensibility & roadmap**
> "Adding a workflow is three steps and zero edits to existing workflows." Show `GoalRouter.register()` in `Agent.js`.
> Open `docs/FUTURE_ROADMAP.md`: "Implemented / Planned / Stretch. The big one — an AI planner — is a single method swap because plans are already pure data. That seam was designed in from V2."

**[9:45 – 10:00] Close**
> "So: a layered, observable, resilient agent framework — not a script. It retries, it self-heals, it fails observably, and it's built to grow an AI brain without a rewrite."

---

## Quick Command Reference (keep on screen)

```bash
npm start                                   # run goal from .env (FILL_SHADCN_FORM)
npm run shadcn | npm run google | npm run github
npm test                                    # resilience scenarios
PAGE_LOAD_TIMEOUT=1 GOAL=SEARCH_GOOGLE npm start   # force a diagnostic report
cat logs/errors/error_*.json                # view diagnostics
ls screenshots/                             # view captured evidence
```

## Demo Tips

- Keep `SLOW_MO=50` (or raise it) so the browser actions are watchable.
- If Wi-Fi is unreliable, lead with `npm test` (uses `data:` URLs — no network).
- Have one `error_*.json` and a couple of screenshots pre-generated as a fallback.
- The single best moment to land: **Scenario E self-healing.** Pause and name it.
