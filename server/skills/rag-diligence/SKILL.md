---
name: rag-diligence
description: "Document-grounded due diligence: process any mix of PDFs, DOCX, XLSX, images, and scanned documents, then deliver a structured verdict with risk scoring. Use when: user provides actual DD documents (financial reports, regulatory filings, certificates, contracts) and needs a professional verdict. NOT for: company research without documents (use due-diligence), single-question document Q&A (use rag-anything)."
metadata: { "openclaw": { "emoji": "🔬", "source": "rag-diligence", "category": "knowledge" } }
---

# RAG-Diligence Skill

Document-grounded due diligence. Feed it the actual paperwork — financial reports, regulatory filings, contracts, certificates, cap tables — and get a structured verdict with dimension scoring, red flags, and a go/no-go recommendation. Every claim cites the source document and page.

Built on **RAG-Anything** (multimodal document engine) + the **due-diligence** verdict framework.

## When to Use

✅ **USE when:**
- User provides **actual DD documents** (PDFs, DOCX, XLSX, images, scans)
- Financial reports, audit letters, regulatory filings, certificates of deposit, contracts
- "Here are the company's financials — give me a DD verdict"
- "Analyze these 12 PDFs and tell me if I should proceed"
- Mixed document packages with tables, charts, scanned pages, and text
- Need structured scoring across multiple risk dimensions

❌ **DON'T USE when:**
- No documents provided — just a company name → use `due-diligence` (web research)
- Single quick question about one document → use `rag-anything`
- Public stock/market analysis → use `investment-analyst`
- Real-time data or live feeds → use APIs directly

**Hard rule:** You must have actual documents. No docs, no verdict.

## Workflow — 4 Phases

### Phase 1: Document Intake

Accept file paths, URLs, or pasted text. Categorize and process.

```python
import os, asyncio, glob
from rag_anything import RAGAnything, QueryParam

# CLIProxyAPI — OpenAI-compatible proxy at localhost:8317/v1
# Routes to claude-sonnet, gpt-4o, local models etc. No direct OpenAI key needed.
PROXY_BASE_URL = os.environ.get("CLIPROXY_BASE_URL", "http://localhost:8317/v1")
PROXY_API_KEY = os.environ.get("CLIPROXY_API_KEY", "cliproxy")

rag = RAGAnything(
    working_dir="./dd_rag_index",
    llm_model_name=os.environ.get("DD_LLM_MODEL", "gpt-4o-mini"),
    llm_model_api_key=PROXY_API_KEY,
    llm_model_base_url=PROXY_BASE_URL,
    vlm_model_name=os.environ.get("DD_VLM_MODEL", "gpt-4o"),
    vlm_model_api_key=PROXY_API_KEY,
    vlm_model_base_url=PROXY_BASE_URL,
    embedding_model_name=os.environ.get("DD_EMBED_MODEL", "text-embedding-3-small"),
    embedding_model_api_key=PROXY_API_KEY,
    embedding_model_base_url=PROXY_BASE_URL,
)

# Index all documents
dd_files = glob.glob("./dd_package/*")
await rag.process_documents(file_paths=dd_files)
```

**Document categorization** (auto-classify each file on intake):

| Category | Examples |
|----------|----------|
| Financial Statements | Balance sheets, P&L, cash flow, auditor letters |
| Regulatory Filings | Licenses, compliance reports, supervisory letters |
| Legal / Contracts | Shareholder agreements, loan docs, service contracts |
| Certificates | Certificates of deposit, incorporation, good standing |
| Ownership / Structure | Cap tables, org charts, UBO declarations |
| Other | Pitch decks, memos, correspondence |

**Processing pipeline:** Parse → Extract structure → VLM describe visuals → Chunk → Embed → Build knowledge graph with entity/relationship extraction.

### Phase 2: Structured Interrogation

Run targeted queries against the knowledge graph across all DD dimensions. Use the appropriate query mode:

| Query Type | Mode | Example |
|-----------|------|---------|
| Cross-document relationships | `global` | "How do reserve ratios in the audit report relate to obligations in the loan agreement?" |
| Entity deep-dives | `local` | "All claims about reserve composition and backing assets" |
| Standard DD questions | `hybrid` | "What is the company's current cash position and burn rate?" |
| Keyword/clause search | `naive` | "Find all mentions of 'change of control'" |

**Mandatory DD dimensions to interrogate:**

1. **Financial Health** — Revenue, margins, cash position, burn rate, debt structure, projections vs. actuals
2. **Regulatory Compliance** — Licenses held, jurisdictions, compliance history, pending actions, AML/KYC
3. **Ownership & Structure** — UBO chain, cap table, related-party transactions, corporate structure complexity
4. **Risk Factors** — Concentration risk, key-person dependency, market exposure, counterparty risk
5. **Red Flags** — Inconsistencies between documents, missing disclosures, unusual terms, gaps in audit trail

Run at minimum one `global` + one `local` query per dimension. Cross-reference findings between dimensions.

### Phase 3: Verdict Assembly

Score each dimension. Flag problems. Produce the rating.

#### Dimension Scoring Table

| Dimension | Score (1-10) | Weight | Criteria |
|-----------|:---:|:---:|----------|
| **Financial Health** | — | 25% | Revenue quality, cash adequacy, debt sustainability, projection credibility |
| **Regulatory Compliance** | — | 20% | License status, compliance track record, pending actions, jurisdictional risk |
| **Ownership & Structure** | — | 20% | UBO transparency, related-party exposure, structural complexity |
| **Risk Factors** | — | 20% | Concentration, key-person, market, counterparty, operational |
| **Red Flags** | — | 15% | Document inconsistencies, missing items, unusual terms, audit gaps |

**Scoring guide:**
- **8-10:** Strong. Well-documented, no material concerns.
- **5-7:** Adequate. Minor issues, manageable with conditions.
- **3-4:** Weak. Material concerns requiring remediation.
- **1-2:** Critical. Deal-breaking issues present.

**Overall risk rating** (weighted average):
- **🟢 GREEN (≥7.0):** Proceed
- **🟡 YELLOW (5.0–6.9):** Proceed with conditions
- **🔴 RED (<5.0):** Do not proceed

**Red flag protocol:** Any single 🚩 red flag does not auto-trigger RED, but must be explicitly addressed in the recommendation. Three or more 🚩 flags force a minimum YELLOW rating regardless of scores.

### Phase 4: Deliver

Full structured report. Every claim cites source document + page/section.

```markdown
# Due Diligence Verdict: [Subject]
_Generated [date] | Documents reviewed: [count] | Overall: 🟢/🟡/🔴_

## Document Inventory
| # | File | Category | Pages | Key Content |
|---|------|----------|-------|-------------|
| 1 | annual_report_2024.pdf | Financial Statements | 42 | Revenue, EBITDA, balance sheet |
| 2 | license_adgm.pdf | Regulatory Filing | 3 | FSRA license confirmation |

## Executive Summary
[3-5 sentences: what was reviewed, headline findings, overall assessment]

## Dimension Scores
| Dimension | Score | Key Evidence |
|-----------|:-----:|-------------|
| Financial Health | 7/10 | Revenue €12M (+18% YoY) [annual_report p.14]; debt/equity 0.4x [balance_sheet p.3] |
| Regulatory Compliance | 8/10 | FSRA license active [license_adgm p.1]; clean compliance history [audit_letter p.7] |
| Ownership & Structure | 6/10 | UBO disclosed [shareholder_agreement p.2]; related-party loan flagged [note 14, p.28] |
| Risk Factors | 5/10 | 72% revenue from single client [annual_report p.19] 🚩 |
| Red Flags | 6/10 | Auditor qualified opinion on inventory [audit_letter p.12] 🚩 |
| **Overall** | **6.4 — 🟡 YELLOW** | |

## Red Flags 🚩
1. **Revenue concentration** — 72% from single client [annual_report_2024.pdf, p.19]
2. **Qualified audit opinion** — Inventory valuation methodology disputed [audit_letter.pdf, p.12]

## Detailed Findings
### Financial Health
[Detailed analysis with citations...]

### Regulatory Compliance
[Detailed analysis with citations...]

[...continue for each dimension...]

## Recommendation
**🟡 Proceed with conditions:**
1. Require revenue diversification plan with milestones
2. Request unqualified re-audit of inventory within 60 days
3. Cap investment tranche pending resolution of items 1-2
```

## SpawnKit Integration

Spawn a sub-agent with Python exec capability. Pass file paths + optional focus query.

```
Inputs:
  - file_paths: string[]   — absolute paths to DD documents
  - focus: string?          — optional focus area ("regulatory compliance in ADGM")
  - working_dir: string?    — reuse existing index to skip re-processing

Output:
  - Structured verdict as markdown (see Phase 4 template)
```

For multi-turn follow-ups on the same DD package, reuse `working_dir` to avoid re-indexing. Subsequent queries against an existing index return in seconds.

## Limitations

- **Heavy dependencies** — RAG-Anything + MinerU ≈ 2-4GB disk; first install takes minutes
- **VLM required for visual content** — Without a VLM model configured, charts/images/scanned pages are silently skipped. CLIProxyAPI handles routing — no direct OpenAI key needed; set `DD_VLM_MODEL` env var to enable visual analysis.
- **Slow first index** — 10-50 documents can take 5-30 minutes on first processing. Subsequent queries are fast.
- **LLM cost** — VLM calls for each image/chart add up on visual-heavy documents. Budget accordingly.
- **Not real-time** — Index is a snapshot. Won't reflect document changes after indexing.
- **Memory** — Large indexes consume 2-4GB RAM. Use SSD-backed working directory.
- **No substitute for professional advice** — This is an analytical tool, not legal or financial counsel. Always have qualified professionals review material findings.
