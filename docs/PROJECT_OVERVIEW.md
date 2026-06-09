# Project Overview — Website Automation Agent

## What it is

An intelligent, modular **browser-automation agent framework** built with Node.js
and Playwright, inspired by Browser Use. It opens a browser, dynamically detects
page elements, performs actions, verifies results, recovers from failures, and
can turn a **natural-language goal** into a runnable plan via an LLM — all behind
a stable, well-tested execution engine.

The emphasis is the difference between a brittle automation *script* and an
extensible *agent*: layered architecture, observable reasoning, fault tolerance,
honest outcome reporting, and objective quality measurement.

## Why it was built

To demonstrate, in one coherent codebase:
- agent design patterns (Observe → Think → Act → Verify),
- clean layered architecture and separation of concerns,
- resilient automation (retries, self-healing recovery, diagnostics),
- AI integration done safely (LLM as planner only, never executor),
- and engineering rigour (deterministic tests + a benchmark suite).

## How it evolved

| Stage | Capability |
|-------|-----------|
| Foundation | Browser tools, services, OTAV loop, Winston logging, error handling |
| Planning layer | `Planner` turns a goal into a pure-data `action[]` |
| Multi-goal routing | `GoalRouter` registry; switch tasks via config |
| Resilience | `RetryService`, recovery ladder, diagnostics, SUCCESS/BLOCKED/FAILED |
| Multi-step engine | Reusable JSON tasks + variables + conditionals + HTML reports |
| AI planner | OpenRouter / Mock planner → task JSON, with a quality reviewer |
| Benchmark | Objective planner-quality metrics across 20 goals |
| Polish | Consolidated docs, portfolio-ready README, audit |

## Core capabilities

- **Accessibility-first detection** — label → ARIA → placeholder → name → CSS, visible-only.
- **Goal-routed workflows** — pick a task with `GOAL=` in `.env`, no code changes.
- **Reusable JSON tasks** — `MULTI_STEP` runs any task file (variables + conditionals).
- **AI planning** — `AI_PLAN` converts English to task JSON (OpenRouter), reviewed before execution.
- **Resilience** — exponential-backoff retries, self-healing field detection, bounded navigation retries.
- **Honest outcomes** — `SUCCESS` / `BLOCKED` / `FAILED` with distinct exit codes + diagnostics.
- **Reporting** — self-contained HTML run reports + a planner benchmark dashboard.

## Tech stack

Node.js (ESM) · Playwright · Winston · dotenv · OpenRouter (optional). Node 18+.

## Where to go next

- [ARCHITECTURE.md](ARCHITECTURE.md) — full system design + diagrams.
- [TEST_REPORT.md](TEST_REPORT.md) — test suites and results.
- [VIVA_GUIDE.md](VIVA_GUIDE.md) — demo script + Q&A.
- [RESUME_BULLETS.md](RESUME_BULLETS.md) — resume / LinkedIn phrasing.
- [FINAL_PROJECT_AUDIT.md](FINAL_PROJECT_AUDIT.md) — strengths, limitations, roadmap.
