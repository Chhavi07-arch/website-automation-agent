# 🔬 Investigation Report P2 — Google Reliability & Real-World Verification

**Date:** 2026-06-09  
**Method:** Live read-only probe of `https://www.google.com` in three contexts (headless, headful, headful + realistic UA/locale), capturing URL, title, and identifying DOM signals before and after a search.

---

## A. Observed Page States (evidence)

### State 1 — Landing page (all contexts)
```
url:   https://www.google.com/
title: Google
sig:   searchbox:true, no consent/captcha signals
```
The search box (`textarea[name="q"]`) is present on load in every context.

### State 2 — BLOCKED via /sorry (default headless AND default headful)
After submitting the search:
```
url:   https://www.google.com/sorry/index?continue=https://www.google.com/search%3Fq%3D...&q=EgTKg4UoG...
title: (the continue-URL string — no real title)
sig:   recaptchaIframe:true, captchaForm:true (#captcha-form), unusualText:true,
       searchDiv:false, rso:false, resultStats:false
```
**Identifying signals:** URL path `/sorry/`; `iframe[src*="recaptcha"]`; `#captcha-form`; body text matching `unusual traffic`.

### State 3 — SUCCESS (headful + realistic UA + en-US locale)
```
url:   https://www.google.com/search?q=playwright+browser+automation&...
title: (results)
sig:   real /search URL, NOT /sorry
```
A realistic `userAgent` + `locale: 'en-US'` turned **BLOCKED → SUCCESS**.

### State 4 — Consent screen (region-dependent, not hit from this IP)
Not triggered from the test location, but the documented form is `form[action*="consent"]` with text "Before you continue to Google" / "Accept all" / "Reject all". Detection is included defensively.

---

## B. The critical false positive (confirmed)

The current Google plan verifies `url.includes('google.com/search')`. On the **BLOCKED** `/sorry/` page the URL is:
```
https://www.google.com/sorry/index?continue=https://www.google.com/search%3Fq%3D...
```
That string **contains `www.google.com/search`** (inside the `continue=` parameter), so the existing check **PASSES on a CAPTCHA page** — reporting a block as success. This is the core bug P2 must fix.

Note also: the literal `q=playwright` does **not** appear on `/sorry` (it is URL-encoded as `q%3Dplaywright` in `continue`, while the top-level `&q=` is a CAPTCHA token), so a `q=<query>` check correctly fails there.

---

## C. Root causes

| # | Root cause | Effect |
|---|-----------|--------|
| G1 | URL-substring verification (`/search`) | False PASS on `/sorry/` CAPTCHA pages |
| G2 | No blocked-state detection | CAPTCHA/consent indistinguishable from success or bug |
| G3 | No content verification | "Search ran" never actually confirmed |
| G4 | Default browser context (headless UA, no locale) | Triggers Google anti-bot far more often |
| G5 | Binary outcome model (success/throw) | A site block looks like a code crash (FAILED) |

---

## D. Fix strategy (implemented in P2)

1. **Realistic browser context** (G4): `locale: en-US`, a desktop Chrome `userAgent`, `Accept-Language` header — reduces triggering. Configurable.
2. **Blocked-state detection** (G2): `verifyBlockedState()` / `verifyCaptchaPresent()` / `verifyConsentPage()` using the signals above; a `CHECK_BLOCKED` action throws a typed `BlockedError`.
3. **Content + query verification** (G1, G3): `VERIFY_URL q=<query>` (hard gate) + `VERIFY_RESULTS` on `#search`/`#rso` (or a no-results empty-state).
4. **Outcome classification** (G5): `SUCCESS` / `BLOCKED` / `FAILED` reported distinctly by `index.js`, with exit codes 0 / 2 / 1 and a clear final banner.
5. **Demo behaviour** (P2-E): on BLOCKED, capture a screenshot, keep the browser open (if Demo Mode), and print "Workflow blocked by anti-bot protection." — never a misleading success.

These are execution-outcome and detection additions — **no new architectural layer**.
