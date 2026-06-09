# Test Report V6 — Multi-Step Workflow Engine (P3)

**Date:** 2026-06-09  
**Scope:** P3 — JSON-driven multi-step task engine (`MULTI_STEP` goal).  
**Platform:** macOS Darwin 25.3.0 · Node 18+ · Playwright 1.44 · Chromium

```bash
npm test                                                  # 4 suites, deterministic
HEADLESS=true TASK_FILE=github_playwright.json npm run task   # live evidence
```

---

## Summary

| Test | Proves | Result |
|------|--------|--------|
| Multi-step suite (5 deterministic) | valid/missing/invalid/unsupported/github-like | ✅ 5/5 PASS |
| Full `npm test` (4 suites) | no regressions across all phases | ✅ ALL PASS |
| Live MULTI_STEP github task | end-to-end JSON → browser | ✅ SUCCESS |
| Backward-compat goals | original 3 goals unchanged | ✅ SUCCESS |
| shadcn_demo.json task | form fill via JSON | ✅ SUCCESS |
| Missing task file (via index.js) | clear FAILED outcome | ✅ FAILED, exit 1 |

---

## Deterministic suite (`tests/multistep.test.mjs`)

| # | Scenario | Expected | Actual |
|---|----------|----------|--------|
| 1 | Valid task execution (data: URL: navigate → verify_selector → screenshot) | runs end to end | ✅ PASS |
| 2 | Missing task file (`loadTask` on nonexistent) | throws "not found" | ✅ `Task file not found: …/tasks/___does_not_exist___.json` |
| 3 | Invalid schema (no steps / no name / step without action) | throws schema errors | ✅ all three rejected |
| 4 | Unsupported action (`{action:"fly"}`) | Planner throws | ✅ `MULTI_STEP: unsupported action "fly" at step 1` |
| 5 | GitHub-like task (results-list + open_first_result) | results verified, first result opened | ✅ PASS (`Opening first result (match 1/2)`) |

---

## Live MULTI_STEP — `github_playwright.json` (the headline capability)

```
OBSERVE Loaded task "github_playwright" (9 steps) from github_playwright.json
PLAN    Translating task "github_playwright" (9 task-steps)
PLAN    Plan contains 15 steps:
PLAN      Step 09: Verify URL contains "q=playwright" (hard gate)
PLAN      Step 10: Verify selector "[data-testid=results-list]" (hard gate)
PLAN      Step 12: Open first result ([data-testid=results-list] a)
VERIFY  URL contains expected fragment: "q=playwright"
ACT     Opening first result (match 1/71) for "[data-testid=results-list] a"
VERIFY  Selector became visible: "main"
✅ OUTCOME: SUCCESS — workflow completed and verified.
```

A 9-step JSON task expanded to a 15-action plan, ran against live GitHub, opened
the first of 71 results, and verified the repo page — all with **zero new code**,
just a data file.

---

## Backward compatibility (requirement 7)

| Goal | Result |
|------|--------|
| `SEARCH_GITHUB` | ✅ SUCCESS |
| `FILL_SHADCN_FORM` | ✅ SUCCESS |
| `SEARCH_GOOGLE` | BLOCKED (live CAPTCHA — correct P2 behaviour, unchanged) |

Plus `shadcn_demo.json` via `MULTI_STEP`:
```
Loaded task "shadcn_demo" (6 steps)
Field filled with: "chhavi_ahlawat"
Field filled with: "A first-year CS student building browser automation agents."
✅ OUTCOME: SUCCESS
```

---

## Error handling (via the real entry point)

```
$ TASK_FILE=nope.json npm run task
❌ OUTCOME: FAILED — Task file not found: …/tasks/nope.json   (exit code 1)
```

Missing / invalid / unsupported task inputs all surface as **FAILED** with a
precise message and a diagnostic report — never a silent or misleading success.

---

## Conclusion

The engine satisfies the target capability: **Task JSON → Planner → Executor →
Browser**, reusable across sites with no per-task code, while preserving every
prior-phase guarantee (retry, recovery, diagnostics, SUCCESS/BLOCKED/FAILED).
