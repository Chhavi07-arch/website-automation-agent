# Test Report V5 — P2 Google Reliability & Outcome Classification

**Date:** 2026-06-09  
**Scope:** P2 — blocked-state detection, content-based verification, SUCCESS/BLOCKED/FAILED outcomes, realistic browser context.  
**Platform:** macOS Darwin 25.3.0 · Node 18+ · Playwright 1.44 · Chromium

```bash
npm test                        # resilience + github + google suites (deterministic)
npm run google                  # live (headful) — observes real SUCCESS or BLOCKED
HEADLESS=true npm run google    # live (headless)
```

---

## Summary

| Test | Proves | Result |
|------|--------|--------|
| Google outcome suite (5 deterministic) | SUCCESS/BLOCKED/FAILED classified correctly | ✅ 5/5 PASS |
| Full `npm test` (3 suites, 12 scenarios) | No regressions | ✅ ALL PASS |
| Live Google (headful + headless) | CAPTCHA → **BLOCKED**, never false success | ✅ exit 2, blocked report written |
| Live GitHub / shadcn (realistic UA) | Still SUCCESS after context change | ✅ PASS |

---

## P2 deterministic tests (`tests/google-verification.test.mjs`)

Controlled `data:` URL pages exercise the post-submit classification chain
(`CHECK_BLOCKED → VERIFY_URL q= → VERIFY_RESULTS`):

| # | Scenario | Page signals | Expected | Actual |
|---|----------|--------------|----------|--------|
| 1 | Successful search | `#search`/`#rso` results + `q=playwright` in URL | SUCCESS | ✅ SUCCESS |
| 2 | Consent page | `form[action*="consent"]` + "Before you continue to Google" | BLOCKED | ✅ BLOCKED (consent wall) |
| 3 | CAPTCHA page | `#captcha-form` + `iframe[src*="recaptcha"]` | BLOCKED | ✅ BLOCKED (CAPTCHA) |
| 4 | Unusual-traffic page | "Our systems have detected unusual traffic" | BLOCKED | ✅ BLOCKED (unusual traffic) |
| 5 | Normal failure | no `q=`, no results, not blocked | FAILED | ✅ FAILED (hard-gate `q=` failed) |

---

## Live Google (the real-world proof)

From a datacenter IP, Google serves a reCAPTCHA `/sorry/` page even with a
realistic UA (IP reputation dominates). Observed:

```
[4/15]  CHECK_BLOCKED  → No blocked-state detected        (landing OK)
… types query, submits …
[13/15] CHECK_BLOCKED  → [BLOCKED] Anti-bot state detected — CAPTCHA
🛑 OUTCOME: BLOCKED — Workflow blocked by anti-bot protection.
🛑 Reason: CAPTCHA
exit code = 2
```

Blocked diagnostic written to `logs/errors/error_2026-06-09.json`:
```json
{ "outcome": "BLOCKED", "blockedReason": "CAPTCHA",
  "url": "https://www.google.com/sorry/index?continue=…", … }
```

**Critical:** `CHECK_BLOCKED` (step 13) runs *before* `VERIFY_URL` (step 14).
The `/sorry/` URL contains `google.com/search` in its `continue=` param, so the
old check would have **falsely passed** — that path is now dead.

---

## Regression — realistic browser context

Adding `locale: en-US` + a desktop `userAgent` + `Accept-Language` (to reduce
anti-bot triggers) did **not** break the other workflows:

| Workflow | Result |
|----------|--------|
| GitHub (live) | ✅ SUCCESS — `q=playwright` + results-list verified |
| Shadcn (live) | ✅ SUCCESS — `chhavi_ahlawat` + bio filled & verified |
| `npm test` (all) | ✅ ALL PASS |

---

## Success criteria — met

A recruiter watching the demo can now instantly tell the three apart, by banner
**and** exit code, without reading source:

| | Banner | Exit |
|---|--------|------|
| **SUCCESS** | `✅ OUTCOME: SUCCESS` | 0 |
| **BLOCKED BY WEBSITE** | `🛑 OUTCOME: BLOCKED — anti-bot protection` | 2 |
| **FAILED DUE TO BUG** | `❌ OUTCOME: FAILED` | 1 |
