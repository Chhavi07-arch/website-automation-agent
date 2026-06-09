# 🎓 Viva Guide — Website Automation Agent

A complete kit for demonstrating and defending the project. (Consolidates the
earlier viva guide and demo script.)

---

## 1. Live demo (5 minutes)

> Keep `HEADLESS=false` so the browser is visible. For a paced demo:
> `KEEP_BROWSER_OPEN=true DEMO_PAUSE_MS=15000`.

1. **Show the layers** — `src/`: `tools/ → services/ → agent/ → workflows/`, plus
   `planners/` and `benchmark/`. "Each layer depends only on the one below."
2. **Run a workflow:** `npm run github` — narrate the `[PLAN]` block, then the
   `OBSERVE/THINK/ACT/VERIFY` loop; it verifies `q=playwright` **and** results.
3. **Switch goals via config:** `npm run shadcn` — same engine, different goal.
4. **AI planning:** `AI_GOAL="search wikipedia for alan turing" npm run ai` — English
   → task JSON → `[REVIEW] approved 100/100` → executes.
5. **Resilience:** `npm test` — point to `[RETRY]` backoff and bold-red `[RECOVERY]`;
   Scenario E *self-heals* on a late-rendered field.
6. **Honest failure:** `GOAL=SEARCH_GOOGLE npm start` → `🛑 OUTCOME: BLOCKED` (CAPTCHA),
   not a fake success or a crash.
7. **Benchmark:** `BENCHMARK_LIMIT=4 npm run benchmark` → open `reports/benchmark_report.html`.

**Best moment to land:** the BLOCKED outcome and the self-healing recovery — they
separate an *agent* from a *script*.

---

## 2. Architecture questions

**Q: Is this just a Playwright script?**
> No. A goal router selects a workflow, a planner produces a pure-data action plan,
> an executor runs it with retries and self-healing recovery, and failures produce
> structured diagnostics. It's layered and extensible to new tasks and to an AI planner.

**Q: Walk me through one run.**
> `index.js` initialises the Agent, reads `GOAL`, the `GoalRouter` picks the workflow,
> the workflow asks the `Planner` for a logged `action[]`, the `ActionExecutor` runs
> each action via tools (with retry/recovery), and the outcome is classified
> SUCCESS/BLOCKED/FAILED with a screenshot, diagnostic JSON, and HTML report.

**Q: Why separate Planner and Executor?**
> The planner decides *what* (pure-data steps); the executor decides *how* (tool calls).
> That seam means an LLM can emit the same plan format without touching the executor.

**Q: How does element detection work / why first *visible*?**
> Accessibility-first: label → ARIA → placeholder → name → CSS. It returns the first
> **visible** match — a real bug fix: GitHub's homepage has a hidden header search
> *button* sharing the "search" label; `.first()` matched it and clicks timed out.

---

## 3. AI planner questions

**Q: Does the AI control the browser?**
> No — the AI is **planner-only**. It emits task JSON and never touches Playwright,
> the executor, or validation. The worst a bad model can do is produce JSON that
> fails validation/review and is discarded.

**Q: What stops a bad LLM plan from running?**
> Two gates. (1) `validateGeneratedTask` — schema + an action allow-list reusing the
> real translator. (2) `TaskReviewer` scores it 0–100; only ≥ 80 executes. Rejected
> plans are saved to `reports/planner_review_<ts>.json` and skipped.

**Q: What if OpenRouter is down / rate-limited?**
> Transport errors (timeout / 429 / auth) → automatic fallback to the offline
> `MockPlanner`, with a warning. Bad *output* is different — it's never executed.

**Q: How is the model configured?**
> `PLANNER_MODE` + `OPENROUTER_MODEL` in `.env`. Switching models is a config change;
> no code edit. The system prompt is versioned in `src/prompts/`.

---

## 4. Recovery / resilience questions

**Q: How do retries work?**
> `RetryService` retries on throw with exponential backoff (500→1000→2000 ms). The
> executor has a per-action policy; navigation retries are **bounded** (never infinite);
> verifications retry but stay non-fatal.

**Q: What's the difference between retry and recovery?**
> Retry repeats the same action. Recovery *changes strategy* per attempt: for
> `DETECT_FIELD` it goes normal → scroll + re-scan → force full re-scan → diagnostic.
> Scenario E proves it heals a field that renders after a delay.

**Q: What happens when a site blocks you?**
> A `CHECK_BLOCKED` action detects CAPTCHA/consent/"unusual traffic" and throws a
> typed `BlockedError`; the run ends as **BLOCKED** (exit 2) with a screenshot — not
> a false success, not a generic crash.

---

## 5. Benchmark questions

**Q: How do you measure planner quality?**
> `npm run benchmark` runs 20 NL goals through plan → review → execute and reports
> planning success rate, review-approval rate, execution success rate, average review
> score, and average execution time (JSON + HTML).

**Q: Is it just success/fail?**
> No — five outcomes: SUCCESS / BLOCKED / FAILED / PLAN_REJECTED / PLAN_FAILED, so
> "site blocked us" is distinct from "low-quality plan" and "bug".

**Q: Does the benchmark change the engine?**
> No — it's dependency-injected evaluation infrastructure reusing the real
> planner/executor; it's unit-tested with fakes.

---

## 6. Design tradeoffs

| Decision | Why |
|----------|-----|
| Rule-based recovery, not AI | Deterministic, explainable; AI seam left for later |
| AI = planner only | Tiny blast radius; executor stays the trusted runtime |
| Pure-data plans | Inspectable, loggable, LLM-emittable; one stable executor |
| Bounded navigation retries | Nav failures are usually real; don't loop forever |
| Tolerant `networkidle` / screenshots | Many real pages never idle; evidence shouldn't crash a run |
| Verifications non-fatal by default | A verify shouldn't fail a task that otherwise succeeded |
| GitHub via `/search` URL | Homepage search is a dialog button, not a text input |
| No TypeScript | Assignment specified JS; JSDoc gives types without a build step |

---

## 7. Scalability questions

**Q: How do you add a new task/site?**
> Usually zero code — write a JSON task file and run `MULTI_STEP`. A new *goal type*
> is one `GoalRouter.register()` call + a `Planner` method.

**Q: How would this scale to many runs / CI?**
> Headless mode, deterministic exit codes (0/2/1) for CI gating, the benchmark for
> regression tracking, and per-run HTML/JSON reports as artifacts. Browser contexts
> are created per run in `BrowserManager`, so parallel contexts are a natural extension.

**Q: Biggest limitation?**
> Anti-bot walls (Google/SO) block datacenter IPs — handled honestly as BLOCKED, but
> not bypassed (by design). Detection is DOM/accessibility-based; a vision fallback
> is a future option. See [FINAL_PROJECT_AUDIT.md](FINAL_PROJECT_AUDIT.md).

---

## 8. 30-second elevator pitch

> "A modular browser-automation **agent** in Node.js + Playwright. It detects
> elements by accessibility, follows an Observe-Think-Act-Verify loop, and routes
> between goal-driven workflows. It retries with backoff, *self-heals* when an element
> isn't ready, and reports honest outcomes — SUCCESS, BLOCKED-by-site, or FAILED —
> with diagnostics and HTML reports. It even turns an English goal into a runnable
> plan via an LLM that acts as a *planner only*, gated by a quality reviewer, and I
> measure planner quality with a 20-goal benchmark. The architecture is layered so a
> new task is just a JSON file."
