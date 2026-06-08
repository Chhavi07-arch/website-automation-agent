# 📄 Resume & Interview Points — Website Automation Agent

Copy-paste-ready phrasing for resumes, LinkedIn, and interviews. Pick the length that fits the space.

---

## 1-Line Resume Bullet

> Built a modular, fault-tolerant browser-automation **agent** (Node.js, Playwright) with goal-routed workflows, accessibility-first element detection, and a self-healing retry/recovery layer.

**Shorter variant:**
> Designed a resilient browser-automation agent framework in Node.js + Playwright with retry/recovery, diagnostics, and a layered, extensible architecture.

---

## 2-Line Resume Bullet

> Built a modular browser-automation **agent framework** (Node.js, Playwright) implementing an Observe-Think-Act-Verify loop, goal-routed multi-workflow execution, and accessibility-first dynamic element detection.
> Engineered a resilience layer — exponential-backoff retries, a self-healing field-detection recovery ladder, and JSON diagnostic reports — verified with a deterministic test suite; zero hardcoded selectors in the happy path.

---

## 3-Line (impact-focused) Bullet

> • Architected a layered browser-automation agent (Tools → Services → Planner → Executor) in Node.js + Playwright, routing between multiple goal-driven workflows selected via configuration.
> • Implemented fault tolerance: exponential-backoff retries, a recovery ladder that scrolls and re-scans the DOM to self-heal failed detections, and automatic diagnostic reports (screenshot + URL + failed action).
> • Used accessibility-first detection (label → ARIA → placeholder → name → CSS, visible-only) to eliminate brittle selectors; validated resilience with deterministic `data:`-URL test scenarios.

---

## LinkedIn Project Description

**Website Automation Agent** — *Node.js · Playwright · Winston*

An intelligent, modular browser-automation **agent framework** inspired by Browser Use — built to demonstrate the difference between a brittle automation *script* and an extensible *agent*.

Highlights:
- 🧠 **Observe → Think → Act → Verify** execution loop with full, colour-coded reasoning logs.
- 🎯 **Goal-routed workflows** — switch tasks (fill a form, search Google, search GitHub) via a single config value; adding a new workflow is one registration call.
- 🔍 **Accessibility-first element detection** — label → ARIA → placeholder → name → CSS, returning the first *visible* match (no brittle DOM paths).
- 🧩 **Planner / Executor split** — workflows emit pure-data action plans, logged before execution (an AI planner could drop in without changing anything downstream).
- 🔁 **Resilience layer** — exponential-backoff retries, a self-healing recovery ladder for failed detections, and bounded navigation retries.
- 🩺 **Diagnostic mode** — failures produce a dated JSON report with screenshot, URL, page title, and the exact failed action.

Architected in clean layers (Tools → Services → Agent → Workflows) with configuration management, structured logging, robust error handling, and a deterministic resilience test suite. Designed as a foundation that could grow an LLM reasoning layer without rewriting the core.

---

## Internship Interview Explanation (spoken, ~60–90s)

> "One project I'm proud of is a browser-automation agent I built with Node.js and Playwright. I deliberately didn't want a one-off script — those break the moment a page changes — so I designed it as a small agent framework.
>
> It works in layers. Low-level tools wrap Playwright actions like click and type. Services sit on top and add intelligence — for example, an element-detection service that finds fields the way a human does: by their label or ARIA role first, falling back to CSS only as a last resort, and always picking the *visible* element. Above that, a planner turns a high-level goal into a plain list of action steps, and an executor runs them.
>
> The part I learned the most from was resilience. Real web pages are flaky — things load late or render after a delay. So I added a retry service with exponential backoff, and a recovery 'ladder' for detection: if a field isn't found, the agent scrolls and re-scans the page, and only gives up after escalating. When it does give up, it writes a diagnostic JSON with a screenshot, the URL, and the exact action that failed, so failures are debuggable.
>
> I tested all of this deterministically using controlled in-memory pages rather than live sites, including one where a field only appears after a delay — and the agent recovers and completes the task. The whole thing is structured so adding a new task is a single registration call, and I left a clean seam where an AI model could generate the plans later."

**If they ask "what was hardest?"**
> "Designing recovery to be *smarter* than retry. A plain retry repeats the same failing action. Recovery had to change strategy each attempt — scroll, then force a full re-scan — and I had to make the cached field scan invalidate itself so newly-rendered elements could actually be found. I solved it by passing the attempt number into the retry callback so each attempt can behave differently."

---

## Skills Demonstrated (for a skills section)

`Browser Automation` · `Playwright` · `Node.js` · `Async/Await` · `Agent Design Patterns` · `Layered Architecture` · `Fault Tolerance / Retries` · `Structured Logging (Winston)` · `Configuration Management` · `Error Handling & Diagnostics` · `Accessibility-based Selectors` · `Test Design`
