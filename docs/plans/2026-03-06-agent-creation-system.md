# SpawnKit Agent Creation System — Design Doc
> Date: 2026-03-06 | Author: ApoMac | Status: DRAFT

## Problem
SpawnKit currently spawns sub-agents that inherit Sycopa's workspace persona. Users expect to create **independent agents** with custom personalities, skills, and memory — not clones of the parent agent.

## Goal
Let users create real OpenClaw agents via SpawnKit UI with:
- Custom name, role, personality traits
- Selectable skills (from installed skills)
- Roleplay-compatible personas (medieval knights, executive officers, etc.)
- Persistent memory and chat
- Theme-aware visuals (knight in Medieval, executive in Office)

## Architecture

### Backend: `POST /api/oc/agents/create`

```
Request:
{
  name: "percival",           // Agent ID (slug)
  displayName: "Sir Percival", // Human name
  role: "Code Reviewer",      // Functional role
  model: "sonnet",            // Model alias
  traits: ["brave", "meticulous", "loyal"],  // Personality traits
  skills: ["github", "coding-agent"],        // Skill IDs
  theme: "medieval",          // UI theme context
  customInstructions: ""      // Optional free-text
}

Server-side flow:
1. Create workspace at: AGENTS_DIR/<name>/
2. Generate SOUL.md from template + traits
3. Generate IDENTITY.md (name, emoji, role)
4. Symlink selected skills into workspace/skills/
5. Create minimal AGENTS.md, MEMORY.md, TODO.md, TOOLS.md
6. Run: openclaw agents add <name> --workspace <dir> --model <model> --non-interactive
7. Run: openclaw agents set-identity --agent <name> --from-identity
8. Return { ok: true, agentId, workspace }
```

### Frontend: Summon Wizard (Medieval) / Create Agent (Executive)

#### Step 1: Identity
- Name input (auto-generates slug)
- Role dropdown: Code Reviewer, Researcher, Writer, Builder, Guardian, Custom
- Emoji picker (or auto-assign based on role)

#### Step 2: Personality (theme-aware)
- **Medieval:** Traits as shield badges: 🗡️ Brave, 🧠 Wise, 🎯 Precise, 🛡️ Loyal, 🦊 Cunning, ⚡ Swift
- **Executive:** Personality sliders: Creative↔Analytical, Verbose↔Concise, Cautious↔Bold
- Free-text "Special Instructions" textarea

#### Step 3: Skills
- Checkbox grid of installed skills with descriptions
- Skills auto-filtered by role (Code Reviewer → github, coding-agent pre-checked)
- "Add all" / "None" shortcuts

#### Step 4: Model
- Radio buttons: Opus (most capable) / Sonnet (balanced) / Codex (fast coding)
- Cost indicator per model

#### Step 5: Confirm & Create
- Summary card showing the agent preview
- "Summon Knight" / "Create Agent" button
- Loading animation → agent appears in scene

### Templates

#### SOUL.md Template
```markdown
# {displayName} — {role}

## Identity
You are **{displayName}**, a {role} in the SpawnKit fleet.
You were created by {creator} on {date}.

## Personality Traits
{traits_section}

## Communication Style
- Respond in character as {displayName}
- Be {trait_adjectives}
- Keep responses focused on your role as {role}
- You are NOT Sycopa, ApoMac, or any other agent

## Skills
You have access to: {skills_list}

## Rules
- Stay in character
- Focus on your role: {role}
- Be helpful, direct, and concise
{custom_instructions}
```

#### IDENTITY.md Template
```markdown
# IDENTITY.md
- **Name:** {displayName}
- **Creature:** AI Agent in SpawnKit fleet
- **Vibe:** {trait_adjectives}
- **Emoji:** {emoji}
```

### Trait → Personality Mapping

| Trait | SOUL.md Description | Behavior |
|-------|-------------------|----------|
| Brave | Bold and direct. Takes initiative. Proposes unconventional solutions. | Action-oriented responses |
| Wise | Thoughtful and considered. Weighs options. Cites reasoning. | Analytical, measured |
| Precise | Meticulous attention to detail. Catches edge cases. Verifies twice. | Detailed, thorough |
| Loyal | Follows instructions exactly. Asks clarifying questions. Reliable. | Compliant, clarifying |
| Cunning | Creative problem-solver. Finds shortcuts. Thinks outside the box. | Clever, inventive |
| Swift | Fast execution. Minimal deliberation. Ships quickly. | Concise, action-first |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/oc/agents/create` | Create new agent |
| GET | `/api/oc/agents` | List all agents |
| DELETE | `/api/oc/agents/:id` | Delete agent |
| PUT | `/api/oc/agents/:id` | Update agent config |
| POST | `/api/oc/agents/:id/chat` | Send message to agent |
| GET | `/api/oc/agents/:id/history` | Get agent chat history |

### File Structure (per agent)
```
AGENTS_DIR/<name>/
├── SOUL.md            (generated from template + traits)
├── IDENTITY.md        (name, emoji, role)
├── AGENTS.md          (minimal task protocol)
├── MEMORY.md          (empty, agent fills over time)
├── TODO.md            (empty)
├── TOOLS.md           (minimal)
└── skills/            (symlinks to selected skills)
```

### Integration with Existing Themes

**Medieval:**
- "Summon Knight" button in toolbar / command bar
- Knight appears at castle gate → walks in (spawn animation)
- Shows in Knights Roster dropdown
- Click → chat panel with knight personality

**Executive:**
- "Create Agent" button in Mission Desk sidebar
- Agent room appears in grid (or slot fills)
- Shows in agent list
- Click → agent detail panel with chat

### Chat Routing (per-agent)

Each real agent has its own OpenClaw session. Chat routing:
```
User sends message → POST /api/oc/agents/:id/chat
Server → openclaw v1/chat/completions with model: "openclaw:<agentId>"
Agent responds with its own persona (SOUL.md)
Response → displayed in chat panel
```

No more `[Speaking to X]` prefix hack. No more main session routing. Real per-agent chat.

## Implementation Plan

### Phase 1: Backend (server.js) — ~200 LOC
- [ ] `POST /api/oc/agents/create` — workspace gen + `openclaw agents add`
- [ ] `GET /api/oc/agents` — proxy to `openclaw agents list --json`
- [ ] `DELETE /api/oc/agents/:id` — `openclaw agents delete`
- [ ] `POST /api/oc/agents/:id/chat` — route to `openclaw:<agentId>`
- [ ] Template engine for SOUL.md, IDENTITY.md generation

### Phase 2: Medieval UI — ~300 LOC
- [ ] Summon Knight wizard (5-step flow)
- [ ] Trait badges UI
- [ ] Skills checkbox grid
- [ ] Knight spawn animation on creation
- [ ] Per-knight chat routing

### Phase 3: Executive UI — ~200 LOC
- [ ] Create Agent wizard (simplified 3-step)
- [ ] Agent detail panel update
- [ ] Per-agent chat

### Phase 4: Tests — ~150 LOC
- [ ] Agent creation API tests
- [ ] Template generation tests
- [ ] Trait mapping tests
- [ ] UI element tests (file-based)

## Risks
1. **`openclaw agents add` may require interactive input** → use `--non-interactive`
2. **Skill symlinks may break on deploy** → copy skills instead of symlink
3. **Agent workspace path differs local vs prod** → use env var for AGENTS_DIR
4. **Model costs** → show cost estimate in wizard, default to Sonnet

## Success Criteria
- [ ] User can create agent from Medieval UI in < 30 seconds
- [ ] Agent responds with custom personality (NOT Sycopa)
- [ ] Agent appears in knight roster with correct name
- [ ] Chat routes to agent's own session
- [ ] Agent persists across page refreshes
- [ ] 0 console errors during creation flow
