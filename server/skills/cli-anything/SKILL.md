---
name: cli-anything
description: "Generate an agent-native CLI harness for any software or GitHub repo using the CLI-Anything methodology. Use when: user wants to make a tool/app controllable by AI agents, wants to automate GUI software programmatically, or needs structured JSON output from any application. NOT for: APIs that already have SDKs, simple one-command wrappers."
metadata: { "openclaw": { "emoji": "⚙️", "source": "cli-anything", "category": "dev" } }
---

# CLI-Anything Skill

Transform any software, GUI application, or GitHub repo into an agent-native CLI with structured JSON output, REPL mode, and self-describing help — using the CLI-Anything 7-phase methodology.

**Example invocation:**
> "Make GIMP controllable by AI agents"
> "Generate a CLI harness for https://github.com/blender/blender"
> "Wrap LibreOffice so I can script exports from the terminal"

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

1. **`--json` flag on every command** — All output parseable as JSON. Human-readable is default, `--json` switches to structured output: `{"success": true, "data": {...}}` or `{"success": false, "error": "...", "code": 1}`.
2. **REPL mode (`repl` subcommand)** — Interactive session for stateful workflows. Entry: `<tool> repl`. Each line = one command string. Response: one JSON object per line. Exit: `exit` or `quit` or Ctrl+D. Error format: `{"success": false, "error": "<message>"}`. Never hangs — invalid commands return error JSON immediately.
3. **Self-describing `--help`** — Every command and subcommand has clear, complete help text. An agent reading `--help` can operate the CLI without external docs.
4. **State model** — Commands that modify state return the new state. Stateful operations use explicit session/context IDs. Stateless by default unless documented otherwise.
5. **Exit codes** — 0 = success, 1 = user/input error, 2 = system/dependency error. JSON output always includes `"success": true/false`.
6. **Idempotent where possible** — Same input → same output. Side-effecting commands are clearly marked in `--help`.

## 7-Phase Workflow

Execute phases sequentially. **You orchestrate phases 1 and 7.** Spawn a Claude Code sub-agent (`runtime: acp`, model alias `sonnet`) for phases 2–6. All file I/O happens in a **working directory** you create upfront.

---

### Setup (Before Phase 1)

Create and record the working directory:

```bash
WORKDIR=$(mktemp -d /tmp/cli-anything-XXXXXX)
echo "Working dir: $WORKDIR"
```

All phases read/write from `$WORKDIR`. Pass `$WORKDIR` explicitly to every sub-agent.

---

### Phase 1: Analyze (You — orchestrator)

**Goal:** Understand the target software's capabilities and interaction surface.

1. If GitHub URL → clone to `$WORKDIR/repo/`, read README, scan source tree
2. If software name → `web_search` for docs + GitHub repo
3. Identify:
   - **Core capabilities** (5–15 key operations users perform)
   - **Interaction surface** (GUI / REST API / Python library / file-based / subprocess)
   - **Dependencies** (Python version, system libs, external services)
   - **State model** (stateless? session-based? persistent files?)
   - **Existing CLI hooks** (many GUI apps ship `--headless` or library APIs — use them)
4. Write `$WORKDIR/analysis.md` with the inventory

**Output:** `$WORKDIR/analysis.md`

---

### Phase 2: Design (Sub-agent)

**Goal:** Design the CLI command tree and data models.

Spawn sub-agent:

```
Read $WORKDIR/analysis.md. Design a Click-based Python CLI:
- Top-level group: cli-anything-<software>
- Subcommand groups matching the software's logical domains
  (project, core-ops, import-export, config, session)
- --json global flag (boolean, default False)
- repl subcommand for interactive mode
  - Entry: <tool> repl
  - Each input line = one command + args (space-separated)
  - Each response = one JSON line
  - Exit commands: exit, quit, Ctrl+D → {"success": true, "message": "Goodbye"}
  - Unknown command → {"success": false, "error": "Unknown command: <cmd>", "hint": "--help"}
- Input/output schemas for each command (Python dataclasses)
- Write design to $WORKDIR/design.md with: command tree, argument specs, example
  invocations (human + --json), REPL example session
```

**Output:** `$WORKDIR/design.md`

---

### Phase 3: Implement (Sub-agent)

**Goal:** Build the installable CLI package.

Spawn sub-agent:

```
Read $WORKDIR/analysis.md and $WORKDIR/design.md.
Implement the CLI as a Python package in $WORKDIR/output/<package_name>/:

Structure:
  src/<package_name>/
    __init__.py
    cli.py       — Click commands, --json handling, repl subcommand
    core.py      — Business logic wrapping the target software's actual APIs/CLI
    models.py    — Dataclasses for inputs/outputs
  pyproject.toml — with [project.scripts] entry point: cli-anything-<name>
  requirements.txt — pinned dependencies

Rules:
- REPL subcommand: readline loop; parse each line as shlex.split(); dispatch to
  Click commands via ctx.invoke(); return JSON per line; handle KeyboardInterrupt
  and EOFError cleanly
- --json flag: all commands check it; output json.dumps(result, indent=2) or
  compact json.dumps(result) if piped
- core.py wraps the real software — use subprocess.run() for CLI-based tools,
  import the library directly for Python packages
- Errors: never let raw tracebacks escape; catch all exceptions, return
  {"success": false, "error": str(e), "code": 2}
- Exit codes: sys.exit(0/1/2) after JSON error output
```

**Output:** `$WORKDIR/output/<package_name>/` — complete package

---

### Phase 4: Plan Tests (Sub-agent)

**Goal:** Define test scenarios before writing test code.

Spawn sub-agent:

```
Read $WORKDIR/design.md and the CLI source in $WORKDIR/output/.
Write $WORKDIR/output/<package_name>/TEST.md with:
- Test matrix: every command × (happy path, edge case, error case)
- Expected JSON output shapes (show actual example JSON)
- REPL session scenarios (multi-turn, exit, invalid input)
- --help verification checklist (what must appear in each command's help)
- Integration workflow scenarios (2–3 multi-command sequences)
```

**Output:** `$WORKDIR/output/<package_name>/TEST.md`

---

### Phase 5: Write Tests (Sub-agent)

**Goal:** Implement the test plan as executable pytest tests.

Spawn sub-agent:

```
Read TEST.md and the CLI source. Write and RUN pytest tests:
  tests/test_cli.py        — Click CliRunner tests for every command
  tests/test_json_output.py — --json produces valid JSON with correct schema
  tests/test_repl.py       — REPL: valid command, invalid command, exit, Ctrl+D
  tests/test_help.py       — every command's --help is non-empty + descriptive
  tests/conftest.py        — shared fixtures

Run: cd $WORKDIR/output/<package_name> && pip install -e . -q && pytest tests/ -v
Fix all failures before delivering. Report final pytest output.
```

**Output:** Passing test suite + pytest output

---

### Phase 6: Document (Sub-agent)

**Goal:** Generate complete documentation for humans and agents.

Spawn sub-agent:

```
Read CLI source and TEST.md. Generate in $WORKDIR/output/<package_name>/:

README.md:
- Install: pip install -e .
- Quickstart: 3 example commands
- Full command reference (every command, args, example human + JSON output)
- REPL usage with example session transcript

AGENT_GUIDE.md:
- How to discover commands: <tool> --help, <tool> <group> --help
- Output format: always use --json for machine parsing
- REPL protocol: entry, command format, response format, exit
- Error handling: check "success" field, use "error" field for message
- State model: is this stateless or session-based? How to manage state?
- 5 example agent workflows (JSON input → JSON output)
```

**Output:** `README.md` + `AGENT_GUIDE.md`

---

### Phase 7: Publish & Deliver (You — orchestrator)

**Goal:** Verify, install, and report to user.

1. Verify package structure is complete (all files present, non-empty)
2. `pip install -e $WORKDIR/output/<package_name>/` — must succeed
3. `cli-anything-<name> --help` — must return structured help
4. `cli-anything-<name> --json <sample-command>` — must return valid JSON
5. Report to user:
   - **Package path:** `$WORKDIR/output/<package_name>/`
   - **Install:** `pip install -e <path>`
   - **3 example invocations** (human + JSON mode + REPL)
   - **TEST.md location**
   - **Known limitations** (capabilities not wrapped, if any)

## Sub-Agent Spawn Template

```
sessions_spawn:
  runtime: acp
  agentId: claude-code   # or whichever coding agent is configured
  model: sonnet          # alias — resolves to current claude-sonnet
  label: cli-anything-phase-{N}-{software}
  task: |
    Working directory: {WORKDIR}
    [Phase-specific instructions]
```

Wait for each phase to complete before spawning the next. Phases are strictly sequential.

## Refine (Post-Publish)

After initial delivery, run gap analysis to expand coverage:

1. List all software capabilities not yet wrapped: `cli-anything-<name> --help` vs capability inventory
2. Ask user: "These capabilities aren't wrapped yet: [list]. Want me to add them?"
3. Spawn Phase 2–6 sub-agents again targeting only the gaps (non-destructive, additive)
4. Re-run tests, re-publish

Repeat until coverage is satisfactory.

## Quality Checklist (Before Delivering)

- [ ] Every command has `--json` support
- [ ] `--help` is self-describing on all commands and subgroups
- [ ] REPL mode: `exit`/`quit`/Ctrl+D work; invalid commands return error JSON; no hangs
- [ ] `pip install -e .` succeeds cleanly
- [ ] `pytest` is green
- [ ] README has install + quickstart + full command reference
- [ ] AGENT_GUIDE.md has agent-specific protocol (JSON, REPL, error handling)
- [ ] TEST.md documents all test scenarios with expected JSON shapes
- [ ] Exit codes follow 0/1/2 convention
- [ ] No raw tracebacks — all errors are JSON objects

## Timing Expectations

| Phase | Typical Duration |
|-------|-----------------|
| Setup + Analyze | 1–3 min |
| Design | 2–5 min |
| Implement | 5–15 min |
| Plan Tests | 1–3 min |
| Write Tests | 3–8 min |
| Document | 2–5 min |
| Publish | 1–2 min |
| **Total** | **15–40 min** |

Simple tools (10 commands) → lower end. Complex GUI apps (50+ operations) → upper end.
