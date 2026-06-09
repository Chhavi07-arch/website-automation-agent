# 🗺 Future Roadmap — Website Automation Agent

A clear separation of what exists today, what is planned next, and the ambitious stretch goals. This shows examiners and reviewers that the architecture was designed with a growth path in mind.

---

## ✅ Implemented (V1 → V4)

| Capability | Detail |
|------------|--------|
| **OTAV execution loop** | Observe → Think → Act → Verify, surfaced via custom Winston log levels |
| **Layered architecture** | Tools → Services → Agent → Workflows, each depending only on the layer below |
| **Browser lifecycle management** | `BrowserManager` (launch/context/page/close), config-driven engine + headless |
| **Core tools** | Navigation, Click, Input (fill/sendKeys/pressKey), Scroll, Screenshot |
| **Accessibility-first detection** | label → ARIA → placeholder → name → CSS; first *visible* match only |
| **Form/field classification** | `FormDetectionService` scans & labels name / description / search fields |
| **Planning layer** | `Planner` turns a goal into a pure-data, fully-logged `action[]` |
| **Action executor + field registry** | Dispatches actions; caches detected fields by name |
| **Goal routing** | `GoalRouter` registry maps goal keys → workflows; switchable via `.env` |
| **3 working workflows** | `FILL_SHADCN_FORM`, `SEARCH_GOOGLE`, `SEARCH_GITHUB` |
| **Retry with backoff** | `RetryService`, exponential 500→1000→2000 ms, per-action policy, bounded nav retries |
| **Self-healing recovery** | DETECT_FIELD ladder: scroll+rescan → full rescan → diagnostic |
| **Validation actions** | verify value / visible / enabled / URL / page-loaded |
| **Diagnostic mode** | `logs/errors/error_<date>.json` with screenshot, URL, title, failed action |
| **Timestamped screenshots** | At every key step + on failure |
| **Configuration management** | Single validated `.env` loader; `.env.example` template |
| **Deterministic resilience tests** | `tests/resilience.test.mjs` (broken selector / missing field / hidden element) |
| **Portfolio documentation** | README, architecture (V2–V4), test reports, viva & demo guides |

---

## ✅ Delivered after the original roadmap (P1–P3)

- **Honest verification & outcomes** (P1/P2): `q=query` + results checks, CAPTCHA/consent → **BLOCKED**, SUCCESS/BLOCKED/FAILED with exit codes.
- **Multi-step workflow engine** (P3): reusable **JSON task files** run via `GOAL=MULTI_STEP` — generic `navigate/search/submit/open_first_result/…` verbs, no per-task code. *(This delivered the "generic config-driven form filling" and "multi-step workflows" items below.)*

## 🔜 Planned (next, no architecture rewrite needed)

| Feature | Approach | Touches |
|---------|----------|---------|
| **HTML run report** | Render each run's plan, logs, and screenshots into a single `report.html` | new util |
| **More task verbs / per-step retry overrides** | Extend the `_planMultiStep` mapping; allow a task step to set its own retry/fatal | planner + executor policy |
| **HTML run report** | Render each run's plan, logs, and screenshots into a single `report.html` | new util |
| **Retry jitter & per-action overrides** | Add randomised jitter; allow a plan step to specify its own retry count | `RetryService` + executor policy |
| **`SEARCH_BING` / more search engines** | Demonstrates the registry extension pattern | 1 goal + 1 planner method + 1 register |
| **CI workflow (GitHub Actions)** | Run `npm test` headless on push | `.github/workflows` |
| **Dismiss-overlay recovery step** | Add "close cookie/consent banner" as a recovery rung before re-scan | recovery ladder |

---

## 🌟 Stretch Goals (ambitious, research-flavoured)

| Goal | Vision | Why the architecture is ready |
|------|--------|-------------------------------|
| **AI reasoning layer** | Replace `Planner.generatePlan()` with an LLM that produces the same `action[]` format from a goal | The planner is the single seam; executor/tools/workflows stay unchanged |
| **Screenshot-based element understanding** | Use a vision model to locate elements when DOM detection fails | Slots in as a new recovery rung + detection strategy |
| **Natural-language goals** | "Open GitHub and search for Playwright" → LLM classifies the goal + extracts params → `GoalRouter.route()` | Router already maps keys→workflows; only need NL→key + param extraction |
| **Self-correcting recovery** | LLM chooses the recovery strategy per failure instead of a fixed ladder | Recovery already branches on attempt number — swap rules for model calls |
| **Memory / learning** | Persist successful selectors per domain and reuse them to speed up detection | Field registry is the natural cache point |
| **Parallel multi-tab execution** | Run independent workflows concurrently across browser contexts | `BrowserManager` owns context creation |

---

## Design Principle Behind the Roadmap

Every planned and stretch item maps to an **existing seam** in the architecture:

```
New task            → GoalRouter.register()        (one line)
New step sequence   → a Planner._planX() method
New resilience rung → the recovery ladder
AI planning         → swap Planner.generatePlan()
NL goals            → add a classifier before GoalRouter.route()
```

Nothing on this roadmap requires rewriting the execution engine — which is exactly the point of the layered, plan-driven design.
