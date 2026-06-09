# Final Project Audit — Website Automation Agent

Date: 2026-06-09 · Status: feature-complete, portfolio-polished.

---

## 1. Repository audit findings

### Cleaned up in this pass
- **Duplicate architecture docs** — `ARCHITECTURE_V2…V6` + `ARCHITECTURE_V5_AI_PLANNER`
  → merged into one [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Duplicate test reports** — `TEST_REPORT_V2…V7` + `AI_PLANNER_VALIDATION`
  → merged into one [`TEST_REPORT.md`](TEST_REPORT.md).
- **Investigation / research / intermediate notes** — `INVESTIGATION_REPORT`,
  `INVESTIGATION_REPORT_P2`, `OPENROUTER_MODEL_RESEARCH`, `MIGRATION_P3`,
  `OUTCOMES`, `DEMO_SCRIPT`, `FUTURE_ROADMAP`, `RESUME_POINTS` → folded into the
  consolidated docs (architecture, test report, viva guide, resume bullets, this audit).
- **Generated outputs** — `screenshots/`, `reports/`, `logs/`, `tasks/generated/`
  are git-ignored (verified: 0 tracked) and were cleared from the working tree;
  they regenerate on each run.

### Verified healthy
- `.env` is **not** tracked (API key safe); `.env.example` documents all variables.
- No generated artifacts committed; `node_modules/` ignored.
- 9 test suites pass; `npm test`, `npm run ai`, `npm run benchmark` all work.

### Final documentation set (single source of truth)
`README.md` · `docs/PROJECT_OVERVIEW.md` · `docs/ARCHITECTURE.md` ·
`docs/TEST_REPORT.md` · `docs/VIVA_GUIDE.md` · `docs/RESUME_BULLETS.md` ·
`docs/FINAL_PROJECT_AUDIT.md`.

---

## 2. Strengths

- **Clean layered architecture** — Tools → Services → Agent → Workflows; each layer
  depends only on the one below; the executor is a single stable runtime.
- **Pure-data plans** — serialisable `action[]`; the same format a human, the Mock
  planner, or an LLM produces — the executor can't tell the difference.
- **Resilience** — exponential-backoff retries, a self-healing detection recovery
  ladder, bounded navigation retries, tolerant waits/screenshots.
- **Honest outcomes** — SUCCESS / BLOCKED / FAILED with distinct exit codes,
  diagnostic JSON, and self-contained HTML reports — no false positives.
- **Safe AI integration** — LLM as planner only, schema- and quality-gated, with
  offline fallback; tiny blast radius.
- **Measurable quality** — a 20-goal benchmark + 49 deterministic tests (no network/keys).
- **Extensible** — new task = a JSON file; new goal = one `register()` call.

## 3. Weaknesses

- **Loose semantic field matching** — `/name/i` also matches "username"; works by
  accessibility heuristics, not exact intent. Acceptable but occasionally surprising.
- **Conditionals are minimal** — `selector_exists` / `selector_missing` /
  `url_contains` only; no loops or data flow between steps (deliberate).
- **AI planner re-review for score** — the benchmark re-runs the reviewer to read the
  numeric score (cheap, deterministic) because the provider returns only approved tasks.
- **Single browser context** — runs are sequential; no built-in parallelism yet.

## 4. Limitations

- **Anti-bot walls** — Google and Stack Overflow block datacenter IPs (CAPTCHA /
  human-verification). These are reported honestly as **BLOCKED**, not bypassed (by design).
- **Free LLM tiers are rate-limited** — the default free model frequently returns 429
  and falls back to Mock; a paid model (e.g. `openai/gpt-4.1-nano`) is reliable.
- **Detection is DOM/accessibility-based** — no vision; sites that hide structure can defeat it.
- **No persistent state/auth** — fresh context each run; no login flows.

## 5. Technical debt

- Supported task verbs exist both in `Planner.translateTaskStep` and a
  `SUPPORTED_TASK_ACTIONS` list (reviewer) — kept in sync by comment; could be unified.
- The benchmark classifies plan-rejection by parsing the error message; a structured
  result object would be cleaner.
- A couple of unused legacy constants remain (e.g. `MAX_RETRIES`, `SCREENSHOT_TIMESTAMP_FORMAT`).
- No CI workflow committed (tests are CI-ready via exit codes).

## 6. Future roadmap

**Planned (no architecture rewrite):**
- GitHub Actions CI running `npm test` headless.
- URL allow-listing / domain policy for AI-generated `navigate` steps.
- Per-step retry overrides and richer conditions in task JSON.
- Generated-task caching keyed by goal.

**Stretch:**
- Vision/screenshot-based element understanding as a recovery rung.
- Self-correcting recovery (LLM picks the recovery strategy).
- Parallel multi-context execution.
- Memory of successful selectors per domain.

Every roadmap item maps to an existing seam — the executor stays frozen.
