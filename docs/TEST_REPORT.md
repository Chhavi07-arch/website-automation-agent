# Test Report — Website Automation Agent

Single consolidated report for all automated suites and live validation.
(Supersedes the per-phase TEST_REPORT_V2–V7 and the AI-planner validation notes.)

Run everything: `npm test` → **9 deterministic suites, 49 scenarios, all passing.**
All suites use controlled `data:` URL pages or injected fakes — no network, no API key.

---

## Suite summary

| Suite | Scenarios | Covers |
|-------|-----------|--------|
| `resilience.test.mjs` | 3 | retry + self-healing recovery |
| `github-verification.test.mjs` | 4 | content/query verification, false-positive removal |
| `google-verification.test.mjs` | 5 | SUCCESS / BLOCKED / FAILED classification |
| `multistep.test.mjs` | 5 | task engine: valid / missing / invalid / unsupported / github-like |
| `engine.test.mjs` | 5 | variables + conditionals + continueOnFailure |
| `planner.test.mjs` | 8 | AI planner (mocked network): output + fallback |
| `reviewer.test.mjs` | 7 | plan quality scoring + provider gating |
| `demo.test.mjs` | 5 | Demo Mode lifecycle |
| `benchmark.test.mjs` | 7 | benchmark runner + metrics + reports |

### Resilience (`resilience.test.mjs`)
- **Broken selector** → recovery ladder runs, fails gracefully + diagnostic.
- **Missing field** → distinguishes "no form" vs "wrong field".
- **Hidden initially** → **self-heals**: backoff + re-scan finds a field rendered after a delay.

### GitHub verification (`github-verification.test.mjs`)
Successful search · zero-result search (still "executed") · query-in-URL · failed
submission (no `q=`) → **fails** (the old always-true `/search` false positive is gone).

### Google outcomes (`google-verification.test.mjs`)
Results → SUCCESS · consent wall → BLOCKED · reCAPTCHA → BLOCKED · "unusual
traffic" → BLOCKED · no results & not blocked → FAILED.

### Multi-step engine (`multistep.test.mjs`)
Valid task end-to-end · missing file · invalid schema · unsupported action ·
results + `open_first_result`.

### Engine hardening (`engine.test.mjs`)
Variable substitution (vars + env) · missing-variable error · conditional THEN ·
conditional ELSE · `continueOnFailure` tolerated vs fatal.

### AI planner (`planner.test.mjs`, network mocked)
Valid response · malformed JSON → not executed · unsupported action → not executed ·
missing fields → not executed · timeout fallback → Mock · auth(401) fallback → Mock ·
mock success · validation error not masked by fallback.

### Plan quality review (`reviewer.test.mjs`)
Good task (100) · missing navigate · unsupported action · duplicate actions ·
empty task · provider rejects a low-quality (schema-valid) plan · provider approves a good plan.

### Demo Mode (`demo.test.mjs`)
Browser remains open · pause duration respected · disabled = exactly as before ·
headless+no-pause no-op · success/failure parity.

### Benchmark (`benchmark.test.mjs`)
`runGoal` outcomes (success/blocked/failed/plan-rejected/plan-failed) ·
`computeMetrics` exact rates · JSON + HTML report writers.

---

## Live validation (real browser / real model)

**AI planner, real OpenRouter model (`openai/gpt-4.1-nano`):** 3/3 goals produced
valid plans (reviewer **100/100**) and executed to **SUCCESS** with no Mock fallback:

| Goal | Outcome | Final URL |
|------|---------|-----------|
| search github for playwright | ✅ SUCCESS | `github.com/search?q=playwright` |
| search wikipedia for alan turing | ✅ SUCCESS | `en.wikipedia.org/wiki/Alan_Turing` |
| open the top hacker news story | ✅ SUCCESS | the live #1 story link |

**Benchmark (mock planner, 4 goals):** planning 100% · review-approval 100% ·
execution 100% · avg score 100 — reports written to `reports/`.

> Note: live `SEARCH_GOOGLE` and a real-model run frequently return **BLOCKED**
> (Google CAPTCHA / Stack Overflow human-verification from datacenter IPs). That
> is correct, honest behaviour — captured as BLOCKED (exit 2), not a fake success.

---

## Bugs found & fixed during testing

| Bug | Fix |
|-----|-----|
| Detection matched a hidden GitHub header button | `_firstVisible()` returns first **visible** match across all `findBy*` |
| `VERIFY_URL` couldn't retry (returned a boolean) | `_rawExecute` throws on mismatch; `fatal` override per step |
| GitHub "success" was always true (`/search`) | verify `q=<query>` **and** results rendered (hard gates) |
| Google CAPTCHA `/sorry` URL contains `/search` → false pass | `CHECK_BLOCKED` runs **before** `VERIFY_URL` → BLOCKED |
| `networkidle` hung on pages that never idle (e.g. SO) | tolerant — timeout warns and continues |
| OpenRouter model `…:free` retired → 404 → opaque | log response **body + model slug**; switch model via `.env` |
| Full-page screenshot timed out on huge pages (Alan Turing) | bounded timeout → **viewport fallback** → best-effort |

---

## How to reproduce

```bash
npm test                                            # all 9 deterministic suites
AI_GOAL="search github for playwright" npm run ai   # live AI (mock by default)
BENCHMARK_LIMIT=4 npm run benchmark                 # benchmark subset
PAGE_LOAD_TIMEOUT=1 GOAL=SEARCH_GOOGLE npm start     # force a diagnostic report
```
