---
name: due-diligence
description: "Investment due diligence on a company — financials, team, market, technology, risks, and deal assessment. Use when: user is evaluating a company for investment, acquisition, or partnership. NOT for: public stock analysis (use investment-analyst), personal financial advice."
metadata: { "openclaw": { "emoji": "🔬", "source": "awesome-llm-apps", "category": "data" } }
---

# Due Diligence Skill

Comprehensive company analysis for investment or partnership decisions.

## When to Use
- "Do due diligence on [company]"
- "Evaluate [startup] for investment"
- "Assess [company] as a potential partner"
- "What are the risks of investing in [company]?"

## Workflow

### Phase 1: Company Profile
Research via `web_search` + `web_fetch`:
1. Company basics: founded, HQ, employees, funding stage
2. Product/service: what they sell, to whom
3. Founders/leadership: backgrounds, track record
4. Funding history: rounds, investors, valuation

### Phase 2: Market Analysis
1. Market size (TAM/SAM/SOM)
2. Growth rate of the market
3. Key competitors and market share
4. Regulatory environment

### Phase 3: Financial Assessment
1. Revenue (if available): size, growth rate, recurring %
2. Burn rate and runway (if startup)
3. Unit economics: CAC, LTV, margins
4. Profitability path

### Phase 4: Technology & Moat
1. Technology differentiation
2. IP / patents
3. Switching costs for customers
4. Network effects

### Phase 5: Risk Assessment
| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Market risk | | | |
| Execution risk | | | |
| Regulatory risk | | | |
| Competition risk | | | |
| Key person risk | | | |

### Output
```markdown
# Due Diligence Report: [Company]
_Generated [date] | Confidence: [rating]_

## Investment Thesis (2-3 sentences)
## Company Overview
## Market Opportunity
## Competitive Landscape
## Financial Summary
## Team Assessment
## Technology & Moat
## Risk Matrix
## Verdict
**Rating:** 🟢 Proceed / 🟡 Proceed with caution / 🔴 Pass
**Key condition:** [what would need to be true]
```
