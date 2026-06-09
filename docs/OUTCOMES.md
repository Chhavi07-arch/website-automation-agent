# 🎯 Outcome Classification — SUCCESS / BLOCKED / FAILED

Every workflow run ends in exactly one **execution outcome**. This is a result
category, **not an architectural layer** — it's how `index.js` reports what
happened so a viewer can instantly tell *the agent worked*, *the website
stopped it*, or *there's a bug* — without reading any source code.

---

## The three outcomes

| Outcome | Meaning | Console banner | Exit code |
|---------|---------|----------------|-----------|
| **SUCCESS** | Task completed and verified | `✅ OUTCOME: SUCCESS — workflow completed and verified.` | `0` |
| **BLOCKED** | The website blocked automation (CAPTCHA / consent / unusual traffic) — **not our bug** | `🛑 OUTCOME: BLOCKED — Workflow blocked by anti-bot protection.` + reason | `2` |
| **FAILED** | A genuine failure (navigation exhausted, field never found, verification failed, bug) | `❌ OUTCOME: FAILED — <error>` | `1` |

The distinct **exit codes** (0 / 2 / 1) let CI and scripts distinguish the three
without parsing logs.

---

## How each outcome is produced

```
workflow.run()
   │
   ├── completes normally ............................→ SUCCESS  (exit 0)
   │
   ├── throws BlockedError ...........................→ BLOCKED  (exit 2)
   │      (raised by the CHECK_BLOCKED action when
   │       verifyBlockedState() finds CAPTCHA/consent)
   │
   └── throws any other Error ........................→ FAILED   (exit 1)
          (NAVIGATE retries exhausted, DETECT_FIELD
           recovery exhausted, fatal VERIFY_* gate, …)
```

`index.js` is the single place that classifies: it checks `error instanceof
BlockedError` to separate BLOCKED from FAILED. The typed error lives in
`src/utils/errors.js`.

---

## Where each outcome is used (examples)

| Situation | Outcome |
|-----------|---------|
| Shadcn form filled and both fields verified | **SUCCESS** |
| GitHub search runs, `q=…` in URL + results rendered | **SUCCESS** |
| Google search returns a real results page | **SUCCESS** |
| Google shows a reCAPTCHA / `/sorry/` page | **BLOCKED** (reason: `CAPTCHA`) |
| Google shows "unusual traffic" | **BLOCKED** (reason: `unusual traffic`) |
| Google/EU consent wall on landing | **BLOCKED** (reason: `consent wall`) |
| `NAVIGATE` fails after its bounded retries | **FAILED** |
| A required field is never found after the recovery ladder | **FAILED** |
| A hard-gate verification (`q=query`, results) never passes | **FAILED** |

---

## What gets recorded

On **BLOCKED** and **FAILED**, Diagnostic Mode writes
`logs/errors/error_<date>.json` including:

```json
{
  "goal": "SEARCH_GOOGLE",
  "workflow": "SearchGoogleWorkflow",
  "outcome": "BLOCKED",
  "blockedReason": "CAPTCHA",
  "url": "https://www.google.com/sorry/index?continue=…",
  "pageTitle": "…",
  "timestamp": "…",
  "errorMessage": "Workflow blocked by anti-bot protection: CAPTCHA",
  "screenshot": "…/screenshot_…_diagnostic-failure.png"
}
```

On **BLOCKED** a `blocked-state` screenshot is also captured, and (in Demo Mode)
the browser is left open so the CAPTCHA itself is visible.

---

## Why this matters

Before P2, a Google CAPTCHA could be reported as **success** (the `/sorry/` URL
contains `google.com/search`). Now:

- A CAPTCHA is **BLOCKED**, never SUCCESS.
- A CAPTCHA is **BLOCKED**, never a generic FAILED/crash.
- A recruiter watching the demo sees a clear banner and knows the difference
  between "the site blocked us" and "the code is broken."
