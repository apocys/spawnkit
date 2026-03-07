---
name: blog-to-podcast
description: "Convert blog posts or articles into podcast-style scripts with conversational tone, then generate audio via TTS. Use when: user shares a URL or article and wants it converted to audio content, podcast script, or spoken summary. NOT for: music generation, raw TTS without script conversion."
metadata: { "openclaw": { "emoji": "🎙️", "source": "awesome-llm-apps", "category": "media" } }
---

# Blog to Podcast Skill

Convert written content into engaging podcast-style audio content.

## When to Use
- "Turn this article into a podcast"
- "Create an audio version of this blog post"
- "Make this readable as a podcast script"
- User shares a URL and wants audio content

## Workflow

### Phase 1: Content Extraction
1. Use `web_fetch` to extract the article content (if URL)
2. Or read the provided text directly
3. Identify: title, author, key sections, word count

### Phase 2: Script Conversion
Transform the written content into a conversational podcast script:
1. Add a natural intro: "Welcome to [topic]. Today we're diving into..."
2. Convert formal paragraphs into conversational language
3. Add transitions between sections: "Now here's where it gets interesting..."
4. Include rhetorical questions to maintain engagement
5. Add a conclusion with key takeaways
6. Keep the original facts and data points accurate

### Script Style Guidelines
- First person or host-style narration
- Short sentences (spoken rhythm, not written)
- Explain jargon when first used
- Add emphasis markers: *pause*, *emphasis*
- Target 150 words per minute of audio (a 1000-word article ≈ 7 min podcast)

### Phase 3: Audio Generation (if TTS available)
Use the `tts` tool to generate audio from the script.
If TTS is not available, deliver the script as text for the user to record or use elsewhere.

### Output
1. The podcast script (always delivered)
2. Audio file (if TTS available)
3. Estimated duration
