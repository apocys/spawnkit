---
name: cli-anything
description: "Generate an agent-native CLI harness for any software or GitHub repo using the CLI-Anything methodology. Use when: user wants to make a tool/app controllable by AI agents, wants to automate GUI software programmatically, or needs structured JSON output from any application. NOT for: APIs that already have SDKs, simple one-command wrappers."
metadata: { "openclaw": { "emoji": "⚙️", "source": "cli-anything", "category": "dev" } }
---

# CLI-Anything Skill

Transform any software, GUI application, or GitHub repo into an agent-native CLI with structured JSON output, REPL mode, and self-describing help — using the CLI-Anything 7-phase methodology.

## When to Use

✅ **USE when:**
- "Make [software] controllable by AI agents"
- "Generate a CLI for [repo URL]"
- "Wrap [GUI app] so I can script it"
- "I need JSON output from [tool]"
- User wants to automate any software programmatically
- User needs a structured interface for an app that only has a GUI or unstructured API
- Converting desktop/web apps into agent-invocable tools

❌ **DON'T USE when:**
- The software already has a well-documented SDK or CLI (just use it)
- Simple one-command wrappers (a shell alias suffices)
- Pure API integrations with existing OpenAPI specs (use API clients directly)
- The user just wants to run a single command, not build a harness

## Core Design Principles

Every generated CLI **must** follow these agent-first design rules:

1. **`--json` flag on every command** — All output parseable as JSON. Human-readable is default, `--json` switches to structured output.
2. **REPL mode (`repl` subcommand)** — Interactive session for stateful multi-step workflows. Accepts commands line-by-line, returns JSON per response.
3. **Self-describing `--help`** — Every command and subcommand has clear, complete help text. An agent reading `--help` can operate the CLI without docs.
4. **State model** — Commands that modify state return the new state. Stateful operations use explicit session/context IDs.
5. **Exit codes** — 0 = success, 1 = user error, 2 = system error. JSON output includes `"success": true/false` and `"error"` field.
6. **Idempotent where possible** — Same input → same output. Side-effecting commands are clearly marked.

## 7-Phase Workflow

Execute these phases sequentially. Spawn a **Claude Code sub-agent** (via `sessions_spawn`, runtime `acp`, model `claude-sonnet-4-20250514`) to perform phases 2–6. You orchestrate and review.

---

### Phase 1: Analyze (You — the orchestrator)

**Goal:** Understand the target software's capabilities, architecture, and interaction surface.

1. If user provides a GitHub URL → clone the repo, read README, scan source structure
2. If user provides a software name → `web_search` for docs, GitHub repo, API references
3. Identify:
   - **Core capabilities** (what does the software do? list 5-15 key operations)
   - **Interaction surface** (GUI? REST API? library? database? file-based?)
   - **Dependencies** (Python version, system libs, external services)
   - **State model** (stateless per-call? session-based? persistent?)
4. Write a brief capability inventory (store in working dir as `analysis.md`)

**Output:** `analysis.md` with capability list, interaction surface, dependencies, state model.

---

### Phase 2: Design (Sub-agent)

**Goal:** Design the CLI command tree and data models.

Spawn sub-agent with these instructions:

> Read `analysis.md`. Design a Click-based Python CLI with:
> - Top-level group named after the software (e.g., `mytool`)
> - Subcommands for each identified capability
> - `--json` global flag
> - `repl` subcommand for interactive mode
> - Input/output schemas for each command (as Python dataclasses or Pydantic models)
> - Write the design to `design.md` with command tree, argument specs, and example invocations.

**Output:** `design.md` — full CLI blueprint.

---

### Phase 3: Implement (Sub-agent)

**Goal:** Build the CLI package.

Spawn sub-agent with:

> Read `analysis.md` and `design.md`. Implement the CLI as a Python package:
> - Use Click for command routing
> - Structure: `src/<package_name>/cli.py`, `src/<package_name>/core.py`, `src/<package_name>/models.py`
> - `cli.py` — Click commands, `--json` flag handling, REPL subcommand
> - `core.py` — Business logic, wrapping the target software's actual functionality
> - `models.py` — Data models for inputs/outputs
> - `pyproject.toml` with `[project.scripts]` entry point
> - `requirements.txt` with pinned dependencies
> - Every command must support `--json` output
> - REPL mode: readline-based loop, accepts subcommand names, returns JSON
> - `--help` text must be descriptive enough for an agent to self-serve
> - Handle errors gracefully: return JSON error objects, never raw tracebacks

**Output:** Complete Python package in `output/<package_name>/`.

---

### Phase 4: Plan Tests (Sub-agent)

**Goal:** Define test scenarios before writing test code.

Spawn sub-agent with:

> Read `design.md` and the implemented CLI code. Write `TEST.md` with:
> - Test matrix: every command × normal input, edge case, error case
> - Expected JSON output shapes for each command
> - Integration test scenarios (multi-command workflows)
> - REPL mode test scenarios
> - `--help` output verification (ensure all commands self-describe)
> - Place `TEST.md` in `output/<package_name>/TEST.md`

**Output:** `TEST.md` — comprehensive test plan.

---

### Phase 5: Write Tests (Sub-agent)

**Goal:** Implement the test plan as executable pytest tests.

Spawn sub-agent with:

> Read `TEST.md` and the CLI source. Write pytest tests:
> - `tests/test_cli.py` — Click CliRunner-based tests for every command
> - `tests/test_json_output.py` — Verify `--json` produces valid JSON with correct schema
> - `tests/test_repl.py` — REPL mode input/output tests
> - `tests/test_help.py` — Every command's `--help` is non-empty and descriptive
> - `tests/conftest.py` — Shared fixtures
> - Run the tests and fix any failures before delivering

**Output:** Passing test suite in `output/<package_name>/tests/`.

---

### Phase 6: Document (Sub-agent)

**Goal:** Generate complete documentation.

Spawn sub-agent with:

> Read the CLI source and TEST.md. Generate:
> - `README.md` — Installation, quickstart, full command reference with examples
> - `AGENT_GUIDE.md` — Concise guide for AI agents: how to discover commands (`--help`), parse output (`--json`), use REPL mode, handle errors
> - Include example JSON outputs for every command
> - Add a "State Model" section explaining session/context behavior
> - Place docs in `output/<package_name>/`

**Output:** `README.md` + `AGENT_GUIDE.md`.

---

### Phase 7: Publish & Deliver (You — the orchestrator)

**Goal:** Package everything and report to user.

1. Verify the package structure:
   ```
   output/<package_name>/
   ├── src/<package_name>/
   │   ├── __init__.py
   │   ├── cli.py
   │   ├── core.py
   │   └── models.py
   ├── tests/
   ├── pyproject.toml
   ├── requirements.txt
   ├── README.md
   ├── AGENT_GUIDE.md
   └── TEST.md
   ```
2. Run `pip install -e output/<package_name>/` to verify installability
3. Run `<command> --help` to verify self-description
4. Run `<command> --json <sample>` to verify JSON output
5. Report to user with:
   - **Package path** (absolute)
   - **Install command** (`pip install -e <path>`)
   - **3 example invocations** (human-readable + JSON mode)
   - **TEST.md location**
   - **Known limitations** (if any capabilities couldn't be wrapped)

## Sub-Agent Spawn Template

For each sub-agent phase, use this pattern:

```
sessions_spawn:
  runtime: acp
  model: claude-sonnet-4-20250514
  label: cli-anything-phase-{N}
  workdir: <working_directory>
  instructions: |
    [Phase-specific instructions from above]
    Working directory: <path>
    Read these files first: [list]
    Write output to: [target path]
```

Wait for each phase to complete before starting the next. Phases are sequential — each depends on the prior phase's output.

## Quality Checklist (Before Delivering)

- [ ] Every command has `--json` support
- [ ] `--help` is self-describing on all commands and subgroups
- [ ] REPL mode works and returns JSON per line
- [ ] `pip install -e .` succeeds
- [ ] Tests pass (`pytest` green)
- [ ] README has install + quickstart + full command reference
- [ ] AGENT_GUIDE.md exists with agent-specific instructions
- [ ] TEST.md documents all test scenarios
- [ ] Exit codes follow convention (0/1/2)
- [ ] No raw tracebacks leak to user — errors are JSON objects

## Timing Expectations

| Phase | Typical Duration |
|-------|-----------------|
| Analyze | 1-3 min |
| Design | 2-5 min |
| Implement | 5-15 min |
| Plan Tests | 1-3 min |
| Write Tests | 3-8 min |
| Document | 2-5 min |
| Publish | 1-2 min |
| **Total** | **15-40 min** |

Complexity depends on the target software. Simple tools (10 commands) → lower end. Complex GUI apps (50+ operations) → upper end or beyond.
