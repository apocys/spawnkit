---
name: web-scraper
description: "Extract structured data from any website — product listings, contact info, prices, reviews, tables, or any repeating data pattern. Use when: user asks to scrape a website, extract data from a page, build a dataset from a URL, or collect information from multiple pages. NOT for: sites requiring login (unless credentials provided), real-time monitoring."
metadata: { "openclaw": { "emoji": "🕸️", "source": "awesome-llm-apps", "category": "automation" } }
---

# Web Scraper Skill

Extract structured data from any website into clean JSON/CSV.

## When to Use
- "Scrape [URL] for product listings"
- "Extract all email addresses from [URL]"
- "Get the pricing table from [page]"
- "Build a dataset from these pages"

## Workflow

### Phase 1: Reconnaissance
1. Use `web_fetch` to get the page content
2. Identify the data structure: tables, lists, cards, repeating elements
3. Determine if pagination exists (page 1, 2, 3... or load-more)
4. Present the identified structure to the user for confirmation

### Phase 2: Extraction
1. Parse the markdown/text output from web_fetch
2. Use pattern matching to extract repeating data items
3. For each item, extract the requested fields
4. If multiple pages: fetch each page and combine results

### Phase 3: Structuring
1. Normalize the data (consistent formats, trim whitespace)
2. Handle missing values (mark as null, not empty string)
3. Remove duplicates

### Phase 4: Output
Deliver data as:
- JSON array (default)
- CSV (if user requests)
- Markdown table (for display)

Write the output file using `write` tool.

```json
{
  "source": "https://example.com",
  "extracted_at": "2026-03-07",
  "count": 25,
  "fields": ["name", "price", "url"],
  "data": [
    {"name": "Item 1", "price": "$29", "url": "/item-1"},
    ...
  ]
}
```

## Limitations
- Respects robots.txt (check before scraping)
- Rate limit: max 1 request per second to same domain
- Cannot bypass JavaScript-rendered content (web_fetch gets static HTML only — use browser tool for JS-heavy sites)
