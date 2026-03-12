---
name: deepcode-loop
description: "Build features or apps using the DeepCode user-in-loop methodology: analyze → clarify → build → test → surface → iterate. Use when: building any non-trivial feature (>100 lines), refactoring, or when previous attempts have failed. NOT for: simple one-file edits, config changes, hotfixes under 50 lines."
metadata: { "openclaw": { "emoji": "🔄", "source": "deepcode", "category": "dev" } }
---

# DeepCode Loop — User-in-Loop Build Methodology

Understand first. Build second. Verify always.

This skill enforces a disciplined 5-stage loop: **Analyze → Clarify → Build → Test & Surface → Iterate or Ship.** No code is written until you understand the problem. No "done" is declared until tests pass and the user confirms.

Inspired by [DeepCode](https://github.com/HKUDS/DeepCode), which beats Claude Code on PaperBench (84.8%) by refusing to guess — it asks, builds, verifies, and iterates.

## When to Use

✅ **USE when:**
- Building any feature or app >100 lines
- Requirements are ambiguous, incomplete, or contradictory
- A previous "just build it" attempt failed or stalled
- Refactoring existing code that multiple features depend on
- The user says "this didn't work last time" or "I'm not sure what I want yet"
- Multi-file work where wrong assumptions cascade

❌ **DON'T USE when:**
- Single-file edit under 50 lines (just edit it)
- Config changes, env vars, version bumps
- The fix is obvious and isolated (typo, missing import)
- Pure read/review tasks (use code review tools)

## The Core Loop

Five stages. Each is mandatory unless explicitly skipped per the rules below. Stage order is sacred — never jump ahead.

---

### Stage 1 — Analyze (you, before anything else)

**Goal:** Map the terrain before moving through it.

1. **Read broadly** — not just the entry point. Read every file that touches the feature: imports, tests, configs, types, related modules. If it might break, read it.
2. **Map the state:**
   - What exists today? (files, functions, data shapes, tests)
   - What's missing to reach the goal?
   - What could break if you change X? (downstream consumers, shared state, CSS cascades)
3. **Write `ANALYSIS.md`** in the working directory:
   ```markdown
   # Analysis: [Feature Name]
   ## Current State
   [What exists — files, functions, data flow]
   ## Gap to Goal
   [What's missing — new files, new logic, changed interfaces]
   ## Risks
   [What could break — shared dependencies, side effects, untested paths]
   ## Open Questions
   [Things you can't determine from code alone — these feed Stage 2]
   ```
4. **Time budget:** 2–5 minutes. Do not skip. Do not skim.

> **Why this matters:** Most build failures trace back to wrong assumptions made in the first 30 seconds. This stage kills bad assumptions before they become bad code.

---

### Stage 2 — Clarify (you ↔ user)

**Goal:** Eliminate the 2–5 unknowns that would change your approach if answered wrong.

1. **Extract questions from your analysis.** Not generic questions — specific ones where the wrong answer means different architecture, different files, or different tests.
2. **Format: numbered list, max 5 questions.** Each question includes *why it matters* in brackets.
3. **Ask them NOW.** Not after you've started building. Now.
4. **Wait for answers.** Do not proceed to Stage 3 without them.

**Example questions:**
```
1. Should session data persist across restarts (DB) or live in memory only?
   [affects: need ORM + migration vs. simple Map — 3 files difference]
2. Is this endpoint authenticated? 
   [affects: middleware chain, test fixtures, 2 extra files if yes]
3. Target: mobile-first responsive or desktop-only?
   [affects: entire CSS approach, grid vs. fixed layout]
4. Should errors surface as toasts or inline validation?
   [affects: error handling pattern across all form components]
```

**Rules:**
- Max 5 questions. Pick the ones with the highest blast radius.
- Never dump 15 questions. If you have 15, you haven't analyzed enough — go back to Stage 1.
- Each question must change at least 1 file or 1 architectural decision if answered differently.
- If the user already answered something in their request, don't re-ask it.

> **Why this matters:** One wrong assumption in Stage 2 creates 5 wrong files in Stage 3. Five minutes of clarification saves an hour of rework.

---

### Stage 3 — Build (sub-agents, with contract)

**Goal:** Write code that matches what was agreed, not what was assumed.

1. **Write the interface contract FIRST:**
   ```markdown
   # Interface Contract: [Feature]
   ## Files
   - `src/api/sessions.ts` — session CRUD endpoints
   - `src/store/sessionStore.ts` — persistence layer
   - `src/components/SessionPanel.tsx` — UI component
   - `tests/sessions.test.ts` — integration tests

   ## Shared Names
   - Function: `createSession(userId: string): Session`
   - Event: `session:created` with payload `{ sessionId, userId }`
   - DOM: `#session-panel`, `.session-card`, `[data-session-id]`
   - Types: `Session { id, userId, createdAt, data }`

   ## Boundaries
   - sessionStore owns all DB access — no direct DB calls elsewhere
   - SessionPanel calls API only — never imports store directly
   ```

2. **Spawn sub-agents** per the large-build pattern:
   - Max 4 files per sub-agent, max 250 lines per file
   - Each sub-agent gets: exact paths, the interface contract, and a list of what NOT to modify
   - Sub-agents are independent — no circular dependencies between them

3. **Include test requirements** in every sub-agent brief:
   - "Write tests for [function]. Must cover: happy path, error case, edge case."
   - Tests are not optional. They are part of the deliverable.

---

### Stage 4 — Test & Surface (you → user)

**Goal:** Prove it works, then show the user before calling it done.

1. **Run the actual tests:**
   ```bash
   # Whatever the project uses — pytest, jest, cargo test, go test
   npm test          # or
   pytest -v         # or
   cargo test        # or
   go test ./...
   ```
   Not "the code looks correct." Not "it should work." Run them.

2. **If tests fail:**
   - Fix the issue yourself (if small — <20 lines)
   - Re-spawn the sub-agent with the fix context (if large)
   - **Never declare done with failing tests.** Loop here until green.

3. **Surface a checkpoint to the user:**
   ```
   ✅ Built and tested: [feature name]

   What's done:
   - [file 1]: [what it does] — 3/3 tests passing
   - [file 2]: [what it does] — 2/2 tests passing

   Demo: [output, screenshot, curl example, or "run X to see it"]

   Anything to adjust before I finalize?
   ```

4. **Wait for user response.** This is not a rhetorical question. Stop and wait.

> **Why this matters:** Users catch things tests can't — wrong UX, misunderstood requirements, "that's not what I meant." Catching it here costs 5 minutes. Catching it after "done" costs 30.

---

### Stage 5 — Iterate or Ship

**Goal:** Close the loop — either improve or deliver.

**If user has feedback:**
- Loop back to **Stage 2** — clarify the feedback first, then Stage 3
- Don't guess what they meant by "make it better." Ask what specifically.
- Each iteration should be smaller and faster than the last

**If user approves (or has no changes):**
- Commit with a descriptive message
- Clean up temp files (`ANALYSIS.md` can stay as documentation)
- Report: what was built, what was tested, commit hash

**The "Done" checklist — ALL must be true:**
- [ ] Tests green (not "they should pass" — actually green)
- [ ] User checkpoint passed (user saw output and approved)
- [ ] Interface contract honored (no renamed functions, no missing files)
- [ ] No files modified outside the agreed scope

---

## DeepCode-Loop vs Large-Build

| Aspect | Large-Build | DeepCode-Loop |
|---|---|---|
| Pre-build analysis | Decompose into modules | **Deep analysis + ANALYSIS.md** |
| User clarification | None — infer from request | **Mandatory 2–5 questions before code** |
| Interface contract | Yes | Yes (unchanged) |
| Sub-agent pattern | Max 4 files, 250 lines | Same (unchanged) |
| Test requirement | Review-based (two-stage) | **Must run tests — green required** |
| User checkpoint | None — deliver and done | **Mandatory checkpoint before "done"** |
| Iteration loop | None — one-shot delivery | **Explicit loop: feedback → clarify → rebuild** |
| Stall detection | Cron-based monitoring | Same (unchanged) |
| When to use | >500 lines | **>100 lines or unclear requirements** |

**What's new:** Clarify phase, mandatory test execution, user checkpoint, iteration loop.
**What's kept:** Sub-agent decomposition, interface contracts, stall monitoring, incremental commits.

---

## Anti-Patterns (Forbidden)

These are not suggestions. They are rules. Breaking them means you're not using this skill.

| ❌ Forbidden | Why | ✅ Instead |
|---|---|---|
| Starting Stage 3 before Stage 2 answers arrive | Wrong assumptions → wrong code → wasted time | Wait. Literally wait. |
| Declaring "done" without running tests | "Looks correct" is not "is correct" | `npm test` / `pytest -v` / equivalent. Green or not done. |
| Skipping the user checkpoint (Stage 4) | User catches things tests can't | Show output. Ask. Wait. |
| Asking 10+ questions in Stage 2 | Overwhelms user, signals shallow analysis | Max 5. Highest blast radius only. |
| Asking questions at the END of your message | User skims, misses them | Questions go in a dedicated Stage 2 block, clearly numbered. |
| Re-asking what the user already specified | Shows you didn't read the request | Read first. Only ask what's genuinely unclear. |
| Guessing what "make it better" means | Wastes a build cycle on wrong interpretation | Clarify first (loop to Stage 2). |

---

## When to Skip Stages

Stage 2 (Clarify) can be skipped **only** when ALL of these are true:
- Task is purely additive (no existing code is modified)
- Requirements are fully specified in writing (not verbal, not "like X but different")
- User explicitly says "just build it" or "no questions needed"

If even one condition is false, run Stage 2.

**Stage 1 (Analyze) is never skippable.** Even for greenfield projects, you need to understand the project structure, dependencies, and conventions before writing code.

**Stages 4 and 5 are never skippable.** Tests must run. User must see output.

---

## Quick Reference

```
┌─────────────────────────────────────────────┐
│            DeepCode Loop                     │
│                                              │
│  ┌──────────┐                                │
│  │ 1. Analyze│──→ ANALYSIS.md                │
│  └────┬─────┘                                │
│       ▼                                      │
│  ┌──────────┐                                │
│  │ 2. Clarify│──→ 2-5 questions → wait       │
│  └────┬─────┘                                │
│       ▼                                      │
│  ┌──────────┐                                │
│  │ 3. Build  │──→ contract → sub-agents      │
│  └────┬─────┘                                │
│       ▼                                      │
│  ┌──────────┐         ┌──────────┐           │
│  │ 4. Test & │──fail──▶│  Fix /   │──┐       │
│  │  Surface  │         │ Re-spawn │  │       │
│  └────┬─────┘         └──────────┘  │       │
│       │ pass + user sees             │       │
│       ▼                    ◄─────────┘       │
│  ┌──────────┐                                │
│  │ 5. Iterate│──feedback──▶ back to 2        │
│  │  or Ship  │──approved──▶ commit + done    │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

**Remember:** This is a discipline, not a suggestion. The loop exists because "just build it" fails. Follow it.
