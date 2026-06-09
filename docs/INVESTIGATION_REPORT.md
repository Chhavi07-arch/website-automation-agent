# 🔬 Investigation Report — Demo-Quality & Correctness Audit

**Date:** 2026-06-09  
**Status:** Investigation only — no fixes applied yet.  
**Method:** Static code review + log forensics + a live read-only DOM probe against the real shadcn page.

---

## Executive Summary

| Area | Verdict | Severity |
|------|---------|----------|
| Shadcn form detection | Hits **real** form fields, but by **loose/lucky** matching; "name" is actually the *username* field; latent arbitrary-element fallbacks exist | Medium |
| Google CAPTCHA | Real risk; current `VERIFY_URL` can **false-pass or false-fail** on a challenge page | High |
| GitHub verification | **`VERIFY_URL` is broken-by-design** — the success fragment is present *before* the search even runs | High |
| Demo experience | Browser closes instantly; examiner cannot inspect; no pacing/recording | High (demo) |

**Headline finding:** The GitHub workflow's "success" is a **false positive** — the most serious correctness issue. The shadcn form is *not* filling a random element (good news), but its detection is correct **by luck**, not by design.

---

## A. Form Workflow Analysis (shadcn)

### Ground truth (live DOM probe)

`getByLabel(/name/i)` resolved to **exactly one visible element**:
```html
<input name="username" id="form-rhf-input-username" placeholder="shadcn" data-slot="input">
```

`getByLabel(/description/i)` resolved to **exactly one visible element**:
```html
<textarea name="description" id="form-rhf-demo-description"
          placeholder="I'm having an issue with the login button on mobile.">
```

The page actually contains **19 visible inputs/textareas** (the docs demo grew into a large composite React-Hook-Form): `title`, `description`, `username`, `about`, checkboxes, radios, and email array fields.

### How "name" is detected — step by step
1. `FormDetectionService` iterates `NAME_FIELD_HINTS = ['name', 'username', …]`. First hint = `'name'`.
2. Calls `ElementDetectionService.findElement({label:'name', placeholder:'name', name:'name'})`.
3. **Strategy order tried:** `findByLabel(/name/i)` → `findByPlaceholder(/name/i)` → `findByName('name')`. (No CSS hint for name.)
4. `findByLabel(/name/i)` matches — because the regex `/name/i` is a **case-insensitive substring** and `"Usernam​e"` contains `"name"`.
5. `_firstVisible()` returns the single visible match → the **username input**.
6. **Winner:** the *label* strategy, first hint, first try.

### How "description" is detected — step by step
1. First hint = `'description'`.
2. `findElement({label:'description', placeholder:'description', name:'description', css:'textarea'})`.
3. **Strategy order:** `findByLabel(/description/i)` → placeholder → name → **`findByCss('textarea')`**.
4. `findByLabel(/description/i)` matches the real `<textarea name="description">` on the **first** try.
5. **Winner:** the *label* strategy. The `css:'textarea'` fallback was **not** reached.

### Is a CSS / generic-textarea fallback being used?
**Not on this page** — both fields win on the label strategy. **But the fallback exists and is a latent landmine:**
- `description` detection has `css:'textarea'` → if the label ever fails, it grabs **the first `<textarea>` anywhere on the page**, regardless of meaning. *This is exactly the "arbitrary textarea" the report was asked to find.*
- `FormDetectionService` Strategy 4 stores unclassified inputs as `unknown_i` (positional) — another arbitrary-element path.

### Does the detected field belong to the real shadcn form?
**Yes.** Both elements carry shadcn's `data-slot` attributes, stable `name`/`id`, and belong to the page's live React-Hook-Form demo. It is **not** filling a random/injected element.

### Is it filling a legitimate form or a random element?
**Legitimate fields — but the result looks artificial for three reasons:**
1. **Semantic mismatch:** "name" is really the **username** field. Typing `"Jane Doe"` (with a space) into a username input whose placeholder is `"shadcn"` looks wrong to any observer.
2. **Partial fill:** only 2 of ~19 visible fields are touched, so the form looks half-done/random.
3. **Better-matching fields ignored:** the page has a `title` input and an `about` textarea that are never considered.

### Latent correctness risks (the suspicion is architecturally valid)
1. **Loose regex matching** — `/name/i` also matches `username`, `display name`, `filename`, `name@example.com` labels, etc. No exact-match or word-boundary preference.
2. **`css:'textarea'` fallback** — grabs the first textarea anywhere when labels fail.
3. **Positional `unknown_i` fallback** — stores arbitrary inputs.
4. **Ambiguity is resolved by DOM order** — if `/name/i` matched several, `_firstVisible()` silently picks the first; brittle across page changes.
5. **No "is this really a form field?" assertion** — no check that the match is editable / inside a `<form>` before filling (fill would throw on a non-editable, but that's reactive, not preventive).

---

## B. Google Workflow Analysis (CAPTCHA)

### Why CAPTCHA pages occur
- Playwright Chromium advertises automation (`navigator.webdriver = true`), uses a **fresh profile with no cookies/history**, a default UA/fingerprint, and often **repeated rapid requests** from one IP — all classic bot signals. Google responds with an **"unusual traffic" / reCAPTCHA** interstitial (and, in many regions, a **consent/cookie** wall *before* search).

### Should CAPTCHA be treated as success or failure?
**Neither a silent success nor a generic crash.** It should be a **distinct, clearly-logged `BLOCKED` outcome** — "the site blocked automation," not "your code is broken." Treating it as success hides a real failure; treating it as a generic error makes a working agent look buggy in a viva.

### Current behaviour is unreliable
- `VERIFY_URL` checks `url.includes('google.com/search')`.
- A reCAPTCHA challenge served **inline on a `/search` URL** → **false PASS** (URL matches, but there are no results).
- A `/sorry/index` redirect → **false FAIL** that looks like a code bug.

### How to detect CAPTCHA reliably
Check for any of: URL contains `/sorry/`; an `iframe[src*="recaptcha"]` or `#captcha-form`; page text/heading matching `/unusual traffic|not a robot|verify you're human/i`; absence of the results container (`#search`, `#rso`).

### Proposed solution
1. Add a reusable **CAPTCHA/consent detector** and report a separate `BLOCKED` status (logged loudly, screenshot captured) — *not* a hard failure.
2. Reduce triggering: realistic **context** (locale, UA, viewport, accept-language), avoid rapid repeated runs, optionally auto-accept the consent dialog.
3. For demo robustness, verify results **by content** (a results container exists), not just by URL.
4. *(Out of scope per constraints, noted only:)* a less bot-aggressive engine (DuckDuckGo/Bing) would be more demo-stable — but no new workflow is to be added now.

---

## C. GitHub Workflow Analysis (verification)

### Current verification
Single step: `VERIFY_URL` with fragment `"github.com/search"`.

### Is `VERIFY_URL` too weak? — **Yes, it is fundamentally broken here.**
The workflow **navigates to `https://github.com/search` first** (see `Planner._planSearchGitHub`). So the URL **already contains `github.com/search` before anything is typed or submitted.** The verification would pass even if:
- the search box was never filled,
- Enter was never pressed,
- the search returned **zero results**,
- GitHub served a rate-limit/login wall.

This is the exact "appears successful but doesn't actually verify results" issue reported.

### Does the search query appear in the URL?
**Not checked.** A real GitHub results URL is `github.com/search?q=playwright&type=repositories`. The agent never asserts the `q=` parameter, so it cannot tell a real search from the bare landing page.

### Are results present?
**Not checked at all.** No content assertion exists. "We couldn't find any repositories" would still "pass."

### Proposed stronger validation
1. Change the success fragment to include the query: `search?q=playwright` (URL-encoded) — proves the search actually executed.
2. Add a **content check** — a results container / result-count element is visible (e.g. results list, or an explicit "N results" / "we couldn't find" branch).
3. Add `VERIFY_FIELD` on the search input *before* submit (currently absent from the GitHub plan) to prove the query was typed.
4. Distinguish **"0 results"** (valid) from **"blocked / login required"** (environmental) so the demo narrative is honest.

---

## D. Demo Experience Analysis

### Why the demo is weak
- `index.js` `finally → agent.shutdown() → browser.close()` runs **immediately** after the workflow, so the browser **vanishes** before anyone can look.
- Final results aren't held on screen.
- The examiner cannot pause, inspect the DOM, or ask "show me that field."

### Proposed Demo Mode (lives in config/BrowserManager/index.js — *not* the execution engine)

| Feature | Benefit | Complexity | Recommendation |
|---------|---------|-----------|----------------|
| **`KEEP_BROWSER_OPEN`** | Browser stays open after the run; examiner inspects the real page | **Low** — guard `shutdown()` + wait for Enter/long sleep | ✅ **P1 — do first** |
| **`DEMO_MODE`** (umbrella) | One switch enables slow-mo + pauses + keep-open + extra capture | Low–Med — composes existing knobs | ✅ **P1** |
| **`DEMO_PAUSE_MS`** | Pause between steps so each action is watchable/narratable | Low — pause hook in `executeAll` loop (additive, not engine logic) | ✅ **P1/P2** |
| **Step-by-step mode** (press Enter per step) | Maximal control during Q&A | Med — readline gate per step | ◻ **P3 — optional** (pause covers 80%) |
| **Screenshots timeline** | Auto HTML page indexing the run's screenshots — portfolio artifact | Med — new util, no engine change | ◻ **P3** |
| **Video recording** | Shareable proof for resume/LinkedIn; great viva fallback | **Low** — Playwright `recordVideo` context option | ✅ **P2 — high value/low cost** |

> All Demo Mode features are config/lifecycle concerns — they honour the "do not modify the execution engine" constraint (the `DEMO_PAUSE_MS` hook is an additive pause in the loop, not a change to dispatch/retry logic).

---

## Root Causes (consolidated)

| # | Root cause | Symptom it produces |
|---|------------|---------------------|
| R1 | GitHub plan navigates to `/search` then verifies `/search` is in the URL | False-positive "success" with no real results |
| R2 | `VERIFY_URL` checks path only — never the query or page content | No workflow proves it actually did the task |
| R3 | Loose substring label matching + arbitrary `textarea`/positional fallbacks | "name"→username; correct-by-luck; fragile on other pages |
| R4 | No CAPTCHA/consent awareness | Google runs falsely pass/fail and look buggy |
| R5 | Unconditional immediate `browser.close()` | Examiner can't see anything |
| R6 | Demo values are semantically off ("Jane Doe" as a username) and partial | Demo looks artificial/weak |

---

## Recommended Fixes (what, not yet how)

- **F1 (R1/R2):** Strengthen GitHub verification — assert `q=<query>` in URL **and** a results/empty container is present; add a pre-submit `VERIFY_FIELD`.
- **F2 (R4):** Add a reusable CAPTCHA/consent detector; report a distinct **`BLOCKED`** status; give the Google context a realistic UA/locale; verify Google results by content.
- **F3 (R3):** Tighten detection — prefer **exact / word-boundary** label matches over substring; demote or guard the `css:'textarea'` and positional fallbacks (warn loudly when used); when multiple candidates match, log the ambiguity.
- **F4 (R5/R6):** Demo Mode — `KEEP_BROWSER_OPEN`, `DEMO_MODE`, `DEMO_PAUSE_MS`; use semantically sensible demo values; optionally fill the genuinely-matching fields (`title`/`username`/`description`/`about`) so the form looks real.
- **F5 (R6):** Video recording for portfolio artifacts.

---

## Prioritised Roadmap (Phase 2 — for approval, not yet implemented)

### 🔴 Priority 1 — Critical demo-quality / correctness bugs
1. **Fix GitHub false-positive verification** (F1) — the single most important correctness fix.
2. **Demo Mode core**: `KEEP_BROWSER_OPEN` + `DEMO_MODE` + `DEMO_PAUSE_MS` (F4) — makes any demo viable.
3. **Sensible shadcn demo values** + honest field naming (username) (F4/F6).

### 🟠 Priority 2 — Reliability improvements
4. **Google CAPTCHA/consent handling** → `BLOCKED` status + realistic context (F2).
5. **Content-based result verification** for Google & GitHub (reusable `ValidationService` checks).
6. **Video recording** of runs (F5).

### 🟡 Priority 3 — Architecture improvements
7. **Tighten ElementDetection**: exact-match preference, guarded fallbacks, ambiguity logging (F3).
8. **Stronger ValidationService**: `verifyResultsPresent`, `verifyNoCaptcha`, `verifyUrlQuery` as reusable verifications (small additions, not a new layer).
9. **Screenshots timeline / HTML run report**; optional **step-by-step** mode.

### 🔵 Priority 4 — Future AI capabilities
10. **LLM element disambiguation** when multiple candidates match a hint.
11. **Vision/screenshot-based detection** fallback when DOM detection fails.
12. **Natural-language goals** ("Open GitHub and search for Playwright").

---

## Suggested first slice (if approved)
P1 items #1–#3 only — they remove the false-positive, make the demo inspectable, and make the form look real. Smallest change, biggest demo + resume payoff. Everything else can follow in P2/P3.
