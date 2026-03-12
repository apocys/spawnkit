---
name: deep-research
description: "Deep web research on any topic — multi-phase search, extract, synthesize, and generate a structured report with citations. Use when: user asks to research a topic in depth, wants a comprehensive analysis, needs a literature review, or asks 'research X for me'. NOT for: simple factual questions (use web_search directly), real-time data (use specific APIs)."
metadata: { "openclaw": { "emoji": "🔍", "source": "awesome-llm-apps", "category": "data" } }
---

# Deep Research Skill

Perform comprehensive multi-phase web research and produce a structured report with citations.

## When to Use

✅ **USE when:**
- "Research [topic] for me"
- "Give me a deep analysis of [subject]"
- "What's the state of [technology/market/field]?"
- "Write a research report on [topic]"
- Competitive analysis, market research, technology assessment

**vs LightRAG:** Use `deep-research` for open-ended research on new topics. Use `lightrag` when the query is about a known regulatory framework, compliance structure, or domain where entity/relationship mapping matters (e.g. "how does X regulation affect Y party under Z condition").

❌ **DON'T USE when:**
- Simple factual questions ("What's the capital of France?")
- Real-time data (stock prices, weather — use specific tools)

## Workflow

### Phase 1: Scope & Plan (30 seconds)
1. Parse the research topic into 3-5 specific sub-questions
2. Identify the key angles: definition, current state, key players, trends, risks, opportunities
3. Present the research plan to the user for confirmation (unless time-pressured)

### Phase 2: Search & Collect (2-5 minutes)
For each sub-question:
1. Run `web_search` with targeted queries (vary phrasing for coverage)
2. For the top 3-5 results per query, use `web_fetch` to extract full content
3. Note the source URL, date, and key claims from each source
4. Look for contradictions between sources — flag them

### Phase 3: Analyze & Synthesize (1-2 minutes)
1. Cross-reference findings across sources
2. Identify consensus views vs. minority opinions
3. Rate confidence for each major claim (high/medium/low based on source agreement)
4. Extract quantitative data points (numbers, percentages, dates)

### Phase 4: Report Generation
Produce a structured report:

```markdown
# Research Report: [Topic]
_Generated [date] | Sources: [count] | Confidence: [overall rating]_

## Executive Summary
[3-5 sentence overview]

## Key Findings
### [Finding 1]
[Detail with evidence]
**Sources:** [citation 1], [citation 2]
**Confidence:** 🟢 High / 🟡 Medium / 🔴 Low

## Data Points
| Metric | Value | Source | Date |
|--------|-------|--------|------|

## Risks & Uncertainties

## Recommendations

## Sources
1. [Title](URL) — accessed [date]
```

## Quality Rules
- Minimum 5 unique sources per report
- Always include access dates on sources
- Flag any claim supported by only 1 source
- Include dissenting views when found
- Quantify where possible (numbers > adjectives)
- Report should be 500-2000 words depending on topic complexity
