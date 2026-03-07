---
name: investment-analyst
description: "Stock and crypto investment analysis — company fundamentals, technical indicators, news sentiment, and risk assessment. Use when: user asks about a stock, crypto, investment opportunity, portfolio analysis, or market trends. NOT for: real-time trading execution, financial advice disclaimers always included."
metadata: { "openclaw": { "emoji": "📈", "source": "awesome-llm-apps", "category": "data" } }
---

# Investment Analyst Skill

Analyze stocks, crypto, and investment opportunities with structured reports.

## When to Use
- "Analyze [TICKER] stock"
- "Should I invest in [company]?"
- "Compare [STOCK A] vs [STOCK B]"
- "What's happening with [crypto]?"
- Portfolio review, sector analysis

## Workflow

### Phase 1: Data Collection
1. Use `web_search` to find: current price, market cap, P/E ratio, 52-week range
2. Search for recent news (last 7 days) about the company/asset
3. Find analyst ratings and price targets
4. Look for earnings data, revenue growth, margins

### Phase 2: Fundamental Analysis
- Revenue trend (growing/declining/stable)
- Profit margins vs industry average
- Debt levels (debt-to-equity ratio)
- Cash flow health
- Competitive moat assessment

### Phase 3: Sentiment Analysis
- Recent news sentiment (positive/negative/neutral)
- Analyst consensus (buy/hold/sell)
- Social media buzz (if relevant)
- Insider trading activity

### Phase 4: Report
```markdown
# Investment Analysis: [TICKER/Asset]
_Generated [date] | ⚠️ Not financial advice_

## Summary
**Rating:** 🟢 Bullish / 🟡 Neutral / 🔴 Bearish
**Price:** $X | **Market Cap:** $X | **P/E:** X

## Fundamentals
| Metric | Value | Industry Avg | Assessment |
|--------|-------|-------------|------------|

## Recent News & Sentiment
- [News item 1] — [sentiment]

## Bull Case
## Bear Case
## Risk Factors

## Sources
```

## Important
Always include: "⚠️ This is analysis, not financial advice. Do your own research before investing."
