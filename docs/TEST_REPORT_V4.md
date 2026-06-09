# Test Report V4 — P1 Demo-Quality & Correctness Fixes

**Date:** 2026-06-09  
**Scope:** Priority-1 fixes from `INVESTIGATION_REPORT.md` — GitHub false-positive verification, Demo Mode, realistic shadcn values, detection-confidence observability.  
**Platform:** macOS Darwin 25.3.0 · Node 18+ · Playwright 1.44 · Chromium

```bash
npm test                                   # 3 resilience + 4 verification scenarios
HEADLESS=true npm run github               # live GitHub strong verification
HEADLESS=true npm run shadcn               # realistic values + confidence logs
HEADLESS=true DEMO_MODE=true DEMO_PAUSE_MS=1500 npm run shadcn   # demo pause
```

---

## Summary

| Test | What it proves | Result |
|------|----------------|--------|
| GitHub verification suite (4 deterministic) | q=query + results/empty gates work; failed submission is caught | ✅ 4/4 PASS |
| GitHub live | Real run now verifies query-in-URL **and** results rendered | ✅ PASS |
| Resilience suite (3) | No regressions in retry/recovery | ✅ 3/3 PASS |
| Shadcn live | Fills realistic username + bio; HIGH-confidence detection | ✅ PASS |
| Demo Mode | slow-down banner, timed hold, keep-open (incl. headless guard) | ✅ PASS |

---

## P1-A — GitHub Verification (false positive removed)

### Before
Plan navigated to `https://github.com/search`, then "verified" `url.includes('github.com/search')` — **true before the search even ran.** A no-op would "pass".

### After
Two **hard gates** (fatal) appended to the plan:
1. `VERIFY_URL` fragment = `q=<query>` → proves the query was actually submitted.
2. `VERIFY_RESULTS` → a results container **or** a recognised empty-state must be present (both prove the search executed; only the absence of both fails).

### Deterministic tests (`tests/github-verification.test.mjs`)

| # | Scenario | Setup (data: page) | Expected | Actual |
|---|----------|--------------------|----------|--------|
| 1 | Successful search | `[data-testid="results-list"]` present | pass | ✅ "Results rendered … (results found)" |
| 2 | Zero-result search | "We couldn't find any…" text, no list | pass | ✅ "Search executed — empty-results state detected" |
| 3 | Query in URL | URL contains `q=playwright` | pass | ✅ "URL contains expected fragment: q=playwright" |
| 4 | Failed submission | no `q=`, no results | **fail** | ✅ retried 3× then "hard-gate correctly failed" |

**Test outcomes documented:** a real search → PASS; a zero-result search → PASS (it *did* run); a non-executed search → **FAIL** (the false positive is gone).

### Live GitHub run (observed)
```
Step 12: Verify URL contains "q=playwright" (hard gate)
Step 13: Verify results rendered (selector or empty-state) (hard gate)
[12/13] VERIFY_URL ≈ "q=playwright"   → URL contains expected fragment: "q=playwright"
[13/13] VERIFY_RESULTS (results check) → Results rendered — "[data-testid=results-list]" visible
✅ All done. Workflow completed and verified.
```

---

## P1-B — Demo Mode

Three independent, default-OFF flags (backward compatible):

| Flag | Effect | Observed |
|------|--------|----------|
| `DEMO_MODE=true` | slowMo raised to ≥150ms; banner; screenshots kept | `🎬 DEMO MODE on — actions slowed (slowMo=150ms), screenshots kept` |
| `DEMO_PAUSE_MS=1500` | hold before closing so results stay visible | `⏸  Holding 1500ms so results stay visible…` |
| `KEEP_BROWSER_OPEN=true` | browser stays open until you press Enter | `🖐  Browser left open for manual inspection.` (interactive) |
| `KEEP_BROWSER_OPEN=true` + `HEADLESS=true` | guarded — nothing to inspect | `KEEP_BROWSER_OPEN ignored — browser is headless (nothing to inspect).` |

**Backward compatibility:** with all three at defaults the `finally` block runs `agent.shutdown()` exactly as before — no behavioural change.

**Recommended viva combo:** `DEMO_MODE=true DEMO_PAUSE_MS=5000 KEEP_BROWSER_OPEN=true npm run github`

---

## P1-C — Realistic Shadcn Values

### Root cause
The shadcn "name" field is actually the **username** input (label "Username"); the old default `FORM_NAME=Jane Doe` (a full name with a space) looked artificial in a username box.

### Fix (observed)
```
Step 10: Fill "name" → "chhavi_ahlawat"
Step 13: Fill "description" → "A first-year CS student building browser automation agents."
Field value matches: "chhavi_ahlawat"
Field value matches: "A first-year CS student building browser automation agents."
```
Config: `USERNAME=chhavi_ahlawat`, `FORM_DESCRIPTION=A first-year CS student building browser automation agents.` (old `FORM_NAME` still accepted as a fallback).

---

## P1-D — Detection Confidence (observability only)

`ElementDetectionService.findElement` now logs a confidence level per winning strategy; fallbacks warn loudly. **No behaviour changed** — only logs.

| Strategy | Confidence | Log |
|----------|-----------|-----|
| accessible label | HIGH | `Detection confidence: HIGH (accessible label)` |
| ARIA role | HIGH | `Detection confidence: HIGH (ARIA role)` |
| placeholder | MEDIUM | `Detection confidence: MEDIUM (placeholder)` |
| name attribute | MEDIUM | `Detection confidence: MEDIUM (name attribute)` |
| CSS selector | LOW | `[WARN] Using LOW-confidence fallback locator (CSS selector) — may select an arbitrary element` |
| positional scan | LOW | `[WARN] Using LOW-confidence fallback locator (positional input scan) …` |

Observed on the shadcn run: both fields resolved at **HIGH (accessible label)** — confirming the agent finds the *intended* fields, not arbitrary ones.

---

## Regression check

`npm test` → **Overall: ALL PASS ✅** for both suites (resilience B/D/E + verification 1–4). The shadcn and GitHub live workflows complete and verify. No existing behaviour was broken.

---

## Demo improvements delivered
- A recruiter/examiner can now **see the result**: the browser holds open (or pauses) and prints `✅ All done. Workflow completed and verified.`
- GitHub "success" is now **real** — it cannot pass without an actual executed search.
- The shadcn form looks **believable** (a real username + a real student bio).
- Logs now state **detection confidence**, so an examiner can see the agent chose a HIGH-confidence accessible-label match — not a random textarea.
