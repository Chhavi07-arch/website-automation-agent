# Test Report V2 — Multi-Workflow Agent

Date: 2026-06-07  
Agent version: V3 (GoalRouter + Planner + ActionExecutor)  
Platform: macOS Darwin 25.3.0, Node.js 18+, Playwright 1.44, Chromium headless=false

---

## Summary

| Workflow | Goal Key | Steps | Result | VERIFY_URL |
|----------|----------|-------|--------|-----------|
| FillShadcnFormWorkflow | FILL_SHADCN_FORM | 15/15 | ✅ PASS | N/A |
| SearchGoogleWorkflow | SEARCH_GOOGLE | 12/12 | ✅ PASS | ✅ google.com/search |
| SearchGitHubWorkflow | SEARCH_GITHUB | 12/12 | ✅ PASS | ✅ github.com/search |

---

## Test 1 — FILL_SHADCN_FORM

**Command:** `npm start` (GOAL=FILL_SHADCN_FORM)  
**Target:** https://ui.shadcn.com/docs/forms/react-hook-form

### Expected
- Browser opens and navigates to the shadcn form demo page
- Name field detected via accessible label "name"
- Description field detected via accessible label "description"
- Both fields filled with values from .env
- Both values verified via ValidationService.fieldHasValue()
- 4 screenshots captured

### Actual
- ✅ Page loaded — title: "React Hook Form - shadcn/ui"
- ✅ Name field: detected via `getByLabel(/name/i)` → Strategy 1 (label)
- ✅ Description field: detected via `getByLabel(/description/i)` → Strategy 1 (label)
- ✅ Name filled: "Jane Doe" — VERIFY_FIELD → "Field value matches"
- ✅ Description filled: "This is an automated description filled by the Website Automation Agent."
- ✅ Screenshots: browser-launched, after-navigation, before-form-fill, after-form-fill
- ✅ Exit code: 0

### Plan logged (15 steps)
```
Step 01: Navigate → https://ui.shadcn.com/docs/forms/react-hook-form
Step 02: Screenshot [after-navigation]
Step 03: Wait for network idle
Step 04: Wait 1500ms
Step 05: Scroll down 600px
Step 06: Screenshot [before-form-fill]
Step 07: Detect field "name"
Step 08: Detect field "description"
Step 09: Click field "name"
Step 10: Fill "name" → "Jane Doe"
Step 11: Verify "name" === "Jane Doe"
Step 12: Click field "description"
Step 13: Fill "description" → "This is an automated description..."
Step 14: Verify "description" === "..."
Step 15: Screenshot [after-form-fill]
```

---

## Test 2 — SEARCH_GOOGLE

**Command:** `GOAL=SEARCH_GOOGLE node src/index.js`  
**Query:** "Playwright browser automation" (from GOOGLE_QUERY in .env)  
**Target:** https://www.google.com

### Expected
- Browser navigates to google.com
- Search box detected dynamically (name="q" → 'q' hint in SEARCH_FIELD_HINTS)
- Query typed and submitted via Enter key
- Results page verified via URL fragment check
- 4 screenshots captured

### Actual
- ✅ Page loaded — title: "Google"
- ✅ Search field detected via `getByLabel(/search/i)` → first VISIBLE match (Google's textarea)
  - Note: `getByLabel(/search/i)` returned multiple elements; `_firstVisible()` found the visible one
- ✅ Filled with: "Playwright browser automation"
- ✅ Screenshot captured before submit (google-query-typed)
- ✅ Enter key pressed → navigation to results page
- ✅ VERIFY_URL → "URL contains expected fragment: google.com/search"
- ✅ Exit code: 0

### Detection path
```
Strategy 1 (label: "search") → getByLabel(/search/i) → _firstVisible() → textarea[aria-label="Search"]
```

### Plan logged (12 steps)
```
Step 01: Navigate → https://www.google.com
Step 02: Screenshot [google-loaded]
Step 03: Wait for network idle
Step 04: Detect field "search"
Step 05: Click field "search"
Step 06: Fill "search" → "Playwright browser automation"
Step 07: Screenshot [google-query-typed]
Step 08: Press key [Enter]
Step 09: Wait 1000ms
Step 10: Wait for network idle
Step 11: Screenshot [google-results]
Step 12: Verify URL contains "google.com/search"
```

---

## Test 3 — SEARCH_GITHUB

**Command:** `GOAL=SEARCH_GITHUB node src/index.js`  
**Query:** "playwright" (from GITHUB_QUERY in .env)  
**Target:** https://github.com/search

### Expected
- Browser navigates to github.com/search
- Search input detected dynamically
- Query typed and submitted via Enter key
- Results page verified via URL fragment check
- 4 screenshots captured

### Actual
- ✅ Page loaded — title: "Search · GitHub"
- ✅ Search field detected via `getByLabel(/search/i)` → `_firstVisible()` → visible search input
  - The page header has a hidden `<button aria-label="Search or jump to…">`. The `_firstVisible()` fix
    skipped the hidden button and found the visible search input.
- ✅ Filled with: "playwright"
- ✅ Screenshot captured before submit (github-query-typed)
- ✅ Enter key pressed → navigation to results page
- ✅ VERIFY_URL → "URL contains expected fragment: github.com/search"
- ✅ Exit code: 0

### Detection path
```
Strategy 1 (label: "search") → getByLabel(/search/i) → _firstVisible() → skipped hidden button → found visible input
Field registry populated: [search]
```

### Plan logged (12 steps)
```
Step 01: Navigate → https://github.com/search
Step 02: Screenshot [github-search-page]
Step 03: Wait for network idle
Step 04: Detect field "search"
Step 05: Click field "search"
Step 06: Fill "search" → "playwright"
Step 07: Screenshot [github-query-typed]
Step 08: Press key [Enter]
Step 09: Wait 1500ms
Step 10: Wait for network idle
Step 11: Screenshot [github-results]
Step 12: Verify URL contains "github.com/search"
```

---

## Bugs Found and Fixed During Testing

### Bug 1 — ElementDetectionService: hidden element priority
**Symptom:** `getByLabel(/search/i).first()` resolved to a hidden `<button>` in GitHub's header,
causing the FILL action to throw and the CLICK action to time out.

**Root cause:** `.first()` picks by DOM order, not by visibility. The search button in the
header is present in the DOM but visually hidden on the `/search` page.

**Fix:** Replaced `.first()` with `_firstVisible()` across all `findBy*` methods in
`ElementDetectionService`. This iterates all matches and returns the first one where
`.isVisible()` returns true.

**Impact:** Prevents false-positive element detection on all pages that have hidden
header/sidebar inputs alongside the visible ones.

---

## Screenshots Generated

Each run produces a set of timestamped PNGs in `screenshots/`:

| Label | Timing |
|-------|--------|
| `browser-launched` | Immediately after browser opens |
| `after-navigation` / `google-loaded` / `github-search-page` | After page loads |
| `before-form-fill` / `google-query-typed` / `github-query-typed` | Before or after input filled |
| `after-form-fill` / `google-results` / `github-results` | Final state |
| `error-state` | Only on failure (auto-captured by index.js catch block) |

---

## Architecture Components Used

All three workflows exercised the full stack:

```
GoalRouter.route()
  → WorkflowClass.run()
    → Planner.generatePlan()     (pure data plan, logged before execution)
    → ActionExecutor.executeAll()
      → NavigationTool            (NAVIGATE, WAIT_FOR_IDLE)
      → ScreenshotTool            (SCREENSHOT)
      → ScrollTool                (SCROLL)
      → ElementDetectionService   (findByLabel, findByName, _firstVisible)
      → FormDetectionService      (detectFields — all 4 strategies)
      → ClickTool                 (CLICK)
      → InputTool                 (FILL, PRESS_KEY)
      → ValidationService         (VERIFY_FIELD, VERIFY_URL)
```
