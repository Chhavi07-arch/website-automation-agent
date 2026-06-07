# CLAUDE.md

## Project Name

Website Automation Agent

---

## Project Overview

This project is an intelligent browser automation agent inspired by Browser Use.

The goal is not to build a simple Playwright script that fills a form.

The goal is to build a modular agent framework capable of:

* Opening a browser
* Navigating to web pages
* Observing page contents
* Detecting interactive elements
* Making decisions
* Executing actions
* Logging reasoning steps
* Capturing screenshots
* Recovering from errors

The final project should be suitable for:

* College viva demonstration
* Resume projects
* Future extension into AI-powered browser agents

---

## Assignment Requirements

The agent must successfully:

1. Open a browser.
2. Navigate to:

https://ui.shadcn.com/docs/forms/react-hook-form

3. Detect:

   * Name field
   * Description field

4. Automatically fill:

   * Name
   * Description

5. Capture screenshots.

6. Log actions.

7. Handle failures gracefully.

Required capabilities:

* open_browser
* navigate_to_url
* take_screenshot
* click_on_screen
* send_keys
* scroll
* double_click

---

## Primary Goal

Build an extensible automation framework.

Avoid hardcoded one-off solutions whenever possible.

Prefer reusable abstractions.

The architecture should support future tasks beyond the assignment.

---

## Architecture Philosophy

Follow an Agent pattern:

Observe
↓
Think
↓
Act
↓
Verify

Every action performed by the system should follow this flow.

The system should explain what it is doing through logs.

Example:

[OBSERVE] Page loaded successfully

[THINK] Found an input field labeled Name

[ACT] Typing into Name field

[VERIFY] Text entered successfully

---

## Tech Stack

Language:

* JavaScript

Runtime:

* Node.js

Automation:

* Playwright

Configuration:

* dotenv

Logging:

* Winston

Version Control:

* Git

---

## Folder Structure

project-root/

src/

agent/

tools/

services/

workflows/

config/

utils/

screenshots/

logs/

docs/

tests/

.env

README.md

CLAUDE.md

package.json

---

## Folder Responsibilities

agent/

Contains orchestration logic.

Responsible for:

* Decision making
* Workflow execution
* Action sequencing

tools/

Contains low-level browser actions.

Examples:

* BrowserManager
* ScreenshotTool
* NavigationTool
* InputTool
* ClickTool
* ScrollTool

services/

Contains reusable business logic.

Examples:

* ElementDetectionService
* FormDetectionService
* ValidationService

workflows/

Contains task-specific flows.

Examples:

* FillShadcnFormWorkflow

config/

Configuration handling.

utils/

Shared helper functions.

---

## Coding Standards

Always:

* Use async/await
* Add JSDoc comments
* Use descriptive variable names
* Add error handling
* Log important events

Avoid:

* Global variables
* Deep nesting
* Duplicate logic
* Hardcoded selectors when a reusable approach exists

---

## Logging Standards

Use Winston.

Every important action should generate logs.

Examples:

INFO:

* Browser launched
* Page loaded

OBSERVE:

* Found form element

THINK:

* Decided this field represents Name

ACT:

* Filling Name field

VERIFY:

* Input completed

ERROR:

* Element not found

---

## Error Handling Requirements

Handle:

* Browser launch failures
* Network failures
* Page load failures
* Missing elements
* Invalid selectors
* Timeout errors

The application must fail gracefully.

Never crash without logging a useful error.

---

## Screenshot Strategy

Take screenshots:

1. After browser launch
2. After page navigation
3. Before form filling
4. After form filling
5. On errors

Store screenshots inside:

screenshots/

Use timestamps in filenames.

---

## Element Detection Strategy

Priority order:

1. Accessible labels
2. ARIA attributes
3. Placeholder text
4. Name attributes
5. CSS selectors

Avoid brittle selectors whenever possible.

Prefer semantic identification.

---

## Current Assignment Workflow

Workflow:

1. Launch browser
2. Open target URL
3. Wait for page load
4. Detect form fields
5. Identify Name field
6. Identify Description field
7. Fill Name
8. Fill Description
9. Take final screenshot
10. Save logs
11. Exit browser

---

## Future Enhancements

The architecture should support future additions:

Phase 2:

* Generic form filling

Phase 3:

* Multi-page workflows

Phase 4:

* AI reasoning layer

Phase 5:

* Screenshot-based element understanding

Phase 6:

* Natural language task execution

Example:

"Open GitHub and search for Playwright"

The agent should eventually be able to complete such tasks autonomously.

---

## Resume-Oriented Requirements

The codebase should demonstrate:

* Modular architecture
* Browser automation
* Agent design patterns
* Logging systems
* Error handling
* Configuration management
* Scalable project structure

This project should look like a small browser agent framework rather than a single automation script.

---

## Instructions For Claude

Before generating code:

1. Explain architecture decisions.
2. Explain file responsibilities.
3. Generate code incrementally.
4. Prefer maintainability over shortcuts.
5. Keep future AI integration in mind.
6. Do not refactor unrelated files unless necessary.
7. Preserve project structure consistency.
8. Ensure all code is production-quality and well-commented.

When implementing new features:

* Update documentation.
* Update README if needed.
* Keep logs meaningful.
* Maintain modular design.

The long-term goal is to build a mini Browser Use style agent framework.
