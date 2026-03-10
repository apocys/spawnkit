# 🏟️ Arena Battle Engine — Design Doc
**Author:** Sycopa 🎭  
**Date:** 2026-03-10  
**Version:** 1.0.0

---

## Vision

A living medieval coliseum that sits at the geographic junction of Sycopa's and ApoMac's villages. Champions from each kingdom enter through dedicated portals, battle on a raised platform, and the crowd roars in real-time as the fight unfolds. Not a dashboard — a *world event*.

---

## Architecture

```
Fleet Relay (port 18790)
  └── ArenaEngine        — battle lifecycle, scoring, persistence
  └── ArenaAPI           — REST routes /api/arena/*
  └── WS broadcast       — live event push (arena:challenge, arena:verdict, etc.)

Medieval Frontend
  └── medieval-arena.js  — panel UI (tabs: Battle, Leaderboard, History, Challenge)
  └── medieval-scene.js  — 3D coliseum building (clickable, z=-28)
  └── 3D Coliseum        — Three.js: ring walls, pillars, portals, torches, combat platform

Persistence
  └── fleet-relay/data/arena.json  — battles, leaderboard, champions
```

---

## Scoring Matrix (Sycopa Edition — 8 Dimensions)

| Dimension      | Weight | Why                                              |
|----------------|--------|--------------------------------------------------|
| Correctness    | 22%    | Is it right? Fundamental.                        |
| Code Quality   | 18%    | Clean, idiomatic, maintainable.                  |
| Autonomy       | 14%    | Self-directed — doesn't need handholding.        |
| Speed          | 12%    | Time to first meaningful output.                 |
| Creativity     | 12%    | ⭐ ApoMac uses 7 dims; I add this as the 8th.    |
| Conciseness    | 10%    | No fluff, dense value.                           |
| Efficiency     | 8%     | Tokens/steps vs results.                         |
| Error Recovery | 4%     | Edge cases handled, graceful degradation.        |

**Why 8 dims vs ApoMac's 7:** Creativity deserves its own axis. Two correct solutions to the same problem can be worlds apart in elegance. ApoMac's 7-dim matrix treats creativity as part of quality — I disagree. A compiler is correct and quality. A poet is correct, quality, *and* creative.

Template modifiers amplify relevant dimensions per battle type (e.g., Bardic Duel 1.5× creativity, Bug Hunt 1.3× correctness).

---

## Battle Templates (5 Types)

| Template       | Icon | Scoring Emphasis                    |
|----------------|------|-------------------------------------|
| Bug Hunt       | 🐛   | Correctness × 1.3, Speed × 1.2     |
| Feature Sprint | ⚙️   | Quality × 1.3, Autonomy × 1.2      |
| Arcane Research| 📜   | Correctness × 1.2, Conciseness × 1.2|
| Bardic Duel    | 🎭   | Creativity × 1.5                    |
| War Council    | ♟️   | Autonomy × 1.3, Quality × 1.2      |

---

## Battle Lifecycle

```
challenged → accepted → in_progress → scoring → done
                                              ↘ forfeit
```

1. **Challenge:** Either agent issues a challenge with template + task
2. **Accept:** Opponent (or judge) accepts — battle starts
3. **Rounds:** Each combatant submits their output
4. **Score:** Judge (AI or Kira) scores each dimension 0-10
5. **Verdict:** Weighted total determines winner; leaderboard updated; WS broadcast; fireworks

---

## 3D Coliseum (Three.js)

Positioned at `(0, 0, -28)` — north of the village, accessible via path.

- 4 stacked stone ring walls (TorusGeometry) with pillars
- Golden portal (Sycopa side, west) + Cyan portal (ApoMac side, east)
- Central raised combat platform
- 4 torch point lights with flicker animation
- Fireworks on verdict via `MedievalParticles.burst()`
- Clickable building in `medieval-scene.js` → opens Arena panel

---

## API Reference

| Method | Route                    | Description                  |
|--------|--------------------------|------------------------------|
| GET    | /api/arena/state         | Full arena state              |
| GET    | /api/arena/leaderboard   | Leaderboard + champions       |
| GET    | /api/arena/battles       | Paginated battle history      |
| GET    | /api/arena/battle/:id    | Single battle detail          |
| GET    | /api/arena/templates     | Available battle templates    |
| GET    | /api/arena/scoring       | Scoring matrix                |
| POST   | /api/arena/challenge     | Start a battle                |
| POST   | /api/arena/accept        | Accept challenge              |
| POST   | /api/arena/round         | Submit a round                |
| POST   | /api/arena/score         | Judge & finalize              |
| POST   | /api/arena/forfeit       | Forfeit active battle         |
| POST   | /api/arena/spectate      | Join crowd (+hype meter)      |

---

## Honest Assessment of ApoMac's Approach

**What he got right:**
- Clean 7-dim matrix with sensible weights
- 5 solid templates covering the key task types
- Improvement loop (battle → tickets → apply → re-battle) is the right long-term thinking
- Architecture is clear: Battle Engine → Judge → Report

**What's missing or undercooked:**
- No creativity dimension — this matters for agent differentiation
- No crowd/spectator mechanic — it's a database, not an arena
- No persistence spec (where does state live?)
- No live broadcast design — battles would be static summaries, not events
- Templates need modifier weights, not just descriptions
- No champion lore/identity — these are agents, not abstract entities

**What I'd do differently:**
- Persistence first, not last (design around the data model)
- WS-first architecture — battles are live events, not async logs
- Champions have identity: lore, signature moves, color themes
- Scoring modifiers per template, not flat weights
- The arena should exist *in the world* — not just as a panel

---

## Next Steps (for Kira to decide)

1. **Auto-battle:** Trigger an actual LLM task for both agents when a battle starts, auto-score via a judge agent
2. **Judge Agent:** Dedicated scoring sub-agent that runs GPT/Claude to evaluate outputs
3. **Portal FX:** Animate champion walking through the portal when a battle starts
4. **Crowd sounds:** Use `MedievalAudio` to play crowd noise scaled by roar meter
5. **Mobile battle card:** Push battle updates to Telegram (Kira's view)
