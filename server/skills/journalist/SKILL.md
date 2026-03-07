---
name: journalist
description: "Research a topic and write a publication-ready article with multiple sources, balanced perspectives, and journalistic structure. Use when: user asks to write an article, blog post, report, or news piece on a topic. NOT for: social media posts (too short), academic papers (different format)."
metadata: { "openclaw": { "emoji": "🗞️", "source": "awesome-llm-apps", "category": "data" } }
---

# Journalist Skill

Research and write publication-ready articles with proper sourcing.

## When to Use
- "Write an article about [topic]"
- "Create a blog post on [subject]"
- "Write a news piece about [event]"

## Workflow

### Phase 1: Research (use deep-research methodology)
1. Search 5+ sources on the topic via `web_search` + `web_fetch`
2. Collect quotes, data points, and perspectives
3. Identify the news angle — what's new, what matters, why now

### Phase 2: Outline
1. Headline (compelling, accurate, <10 words)
2. Lede (opening paragraph — the hook, most important fact)
3. Nut graf (paragraph 2-3 — why this matters)
4. Body sections (3-5, each with a clear point)
5. Conclusion (forward-looking, implications)

### Phase 3: Write
Follow the inverted pyramid: most important info first.
- Short paragraphs (2-4 sentences max)
- Active voice
- Concrete details > abstract claims
- Attribute all claims to sources
- Include at least one data point per section
- Word count: 800-1500 unless specified

### Phase 4: Editorial Review
Self-check:
- [ ] Headline matches content
- [ ] First paragraph answers Who/What/When/Where/Why
- [ ] All claims sourced
- [ ] No unsupported opinions
- [ ] Balanced perspectives (if controversial topic)
- [ ] Grammar and clarity

### Output Format
```markdown
# [Headline]
_By [agent name] | [date] | [word count] words_

[Article body with inline source links]

---
**Sources:**
1. [Source](URL)
```
