# Test Report V7 — Multi-Step Engine Hardening (P3.5)

**Date:** 2026-06-09  
**Scope:** Variable substitution · conditional execution · HTML run report · real-site validation.  
**Platform:** macOS Darwin 25.3.0 · Node 18+ · Playwright 1.44 · Chromium

```bash
npm test                                              # 5 deterministic suites
HEADLESS=true TASK_FILE=wikipedia_search.json npm run task
HEADLESS=true TASK_FILE=hackernews_top.json   npm run task
HEADLESS=true TASK_FILE=stackoverflow_search.json npm run task
```

---

## Summary

| Test | Proves | Result |
|------|--------|--------|
| Engine suite (5 deterministic) | vars, missing-var error, then/else branches, continueOnFailure | ✅ 5/5 PASS |
| Full `npm test` (5 suites) | no regressions across all phases | ✅ ALL PASS |
| Wikipedia (live) | variable substitution + continueOnFailure | ✅ SUCCESS |
| Hacker News (live) | open first result on a real feed | ✅ SUCCESS |
| Stack Overflow (live) | conditional if/then/else on a real anti-bot block | ✅ SUCCESS (else branch) |
| HTML run report | self-contained report per run | ✅ generated |

---

## Engine suite (`tests/engine.test.mjs`)

| # | Scenario | Expected | Actual |
|---|----------|----------|--------|
| 1 | Variable substitution (vars + env) | `{{query}}`→openai, `{{site}}`→env SITE | ✅ both resolved |
| 2 | Missing variable | clear error | ✅ `unresolved variable(s): {{nope}} — provide via env (NOPE=…) or "vars"` |
| 3 | Conditional THEN (`selector_exists` true) | then branch runs | ✅ `Branch taken: then` |
| 4 | Conditional ELSE (`selector_exists` false) | else branch runs | ✅ `Branch taken: else` |
| 5 | continueOnFailure | tolerated when set; fatal when not | ✅ `tolerated=true, fatalThrew=true` |

---

## Real-site validation (no site-specific code — task JSON only)

### Wikipedia — `wikipedia_search.json`
```
Loaded task "wikipedia_search" (7 steps)
Selector became visible: "#firstHeading"
[RECOVERY] Step 6 (verify_selector) failed but continueOnFailure=true — continuing: VERIFY_SELECTOR: ".infobox" not present
✅ OUTCOME: SUCCESS
```
Demonstrates **variable substitution** (`{{query}}` → "Web scraping", also in the screenshot label) and **continueOnFailure** (optional `.infobox` absent → continues).

### Hacker News — `hackernews_top.json`
```
Loaded task "hackernews_top" (7 steps)
Selector became visible: ".athing"
Opening first result (match 1/58) for ".titleline a"
✅ OUTCOME: SUCCESS
```
Demonstrates `wait_for_selector`, `verify_selector`, and generic `open_first_result` on a real feed.

### Stack Overflow — `stackoverflow_search.json`
```
Loaded task "stackoverflow_search" (4 steps)
Network did not reach idle within timeout — continuing anyway
Selector NOT present: ".s-post-summary"
Condition {"selector_exists":".s-post-summary"} → false
Branch taken: else (1 steps)
✅ OUTCOME: SUCCESS
```
Stack Overflow served its "Human verification" page from this IP. The **conditional if/then/else** detected the absence of results and gracefully took the **else** branch (capture page) instead of failing — exactly the deterministic branching P3.5 adds.

---

## HTML run report

Every run writes `reports/report_<timestamp>.html` (gated by `REPORT`, default on),
self-contained (inline CSS, no JS, relative screenshot links). Verified contents:

```
OUTCOME: SUCCESS
Summary · Planned steps (13) · Executed actions (13)
Recovery events (0) · Retry events (0) · Errors (0) · Screenshots (4)
img src="../screenshots/screenshot_…_github-search-page.png"
```
Includes goal, task, start/end/duration, final URL, executed steps, retry events,
recovery events, errors, and a screenshot gallery.

---

## Bug found & fixed during real-site validation

| Discovered on | Issue | Fix |
|---------------|-------|-----|
| Stack Overflow verification page | `WAIT_FOR_IDLE` waited 30 s for `networkidle` that never came (long-poll/anti-bot), then **FAILED** the whole task | `NavigationTool.waitForNetworkIdle` now treats a `networkidle` timeout as a **warning, not a failure** (it's a soft settle heuristic) and uses the shorter element timeout. No regression: Google/GitHub/shadcn still reach idle and pass. |

This is the value of real-site validation: a hidden brittleness (assuming every page reaches `networkidle`) surfaced and was hardened before any LLM was added.

---

## Conclusion

```
Task JSON → Variable Resolution → Conditional Evaluation → Planner → Executor → HTML Report
```
All four hardening goals are implemented, tested deterministically, and proven on
three unrelated real websites — with **zero executor changes**, so a future
OpenAI planner can emit the same task JSON and inherit all of it.
