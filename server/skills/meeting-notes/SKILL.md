---
name: meeting-notes
description: "Transform meeting recordings or transcripts into structured notes with action items, decisions, and follow-ups. Use when: user shares a meeting transcript, audio file, or asks to summarize a meeting. NOT for: real-time transcription (use whisper skill), scheduling meetings."
metadata: { "openclaw": { "emoji": "📑", "source": "awesome-llm-apps", "category": "productivity" } }
---

# Meeting Notes Skill

Transform meeting transcripts into structured, actionable notes.

## When to Use
- "Summarize this meeting transcript"
- "Extract action items from this meeting"
- "Create meeting notes from this audio"
- User pastes a transcript or shares a file

## Workflow

### Phase 1: Input Processing
- If audio file: use `openai-whisper-api` skill first to transcribe
- If text: parse and identify speakers (Speaker 1, Speaker 2, or names)
- Estimate meeting duration from transcript length

### Phase 2: Analysis
Extract:
1. **Participants** — who was present
2. **Agenda topics** — main subjects discussed
3. **Decisions made** — explicit agreements/approvals
4. **Action items** — tasks assigned, with owner and deadline if mentioned
5. **Key discussion points** — important arguments, concerns raised
6. **Open questions** — unresolved items needing follow-up

### Phase 3: Output
```markdown
# Meeting Notes
**Date:** [date] | **Duration:** ~X min | **Participants:** [names]

## Decisions Made
- ✅ [Decision 1] — agreed by [who]

## Action Items
| # | Task | Owner | Deadline | Status |
|---|------|-------|----------|--------|
| 1 | [task] | [name] | [date] | 🟡 Pending |

## Discussion Summary
### [Topic 1]
- [Key point]
- [Dissenting view if any]

### [Topic 2]
- [Key point]

## Open Questions
- ❓ [Unresolved item]

## Next Steps
- [Follow-up meeting/action]
```
