---
name: rag-anything
description: "Process and query any document type (PDF, DOCX, XLSX, images, tables, equations) using multimodal RAG. Use when: user uploads mixed documents, needs to extract data from tables/charts, wants to query financial reports or technical docs with visual content. NOT for: plain text files (use lightrag), real-time data, structured databases."
metadata: { "openclaw": { "emoji": "📄", "source": "rag-anything", "category": "knowledge" } }
---

# RAG-Anything Skill

Multimodal document RAG — process any file type (PDF, DOCX, XLSX, PPTX, images) and query the content with structural awareness. Built on LightRAG with multimodal extensions. Tables stay as tables, equations are parsed, images are described via VLM.

## When to Use

✅ **USE when:**
- User uploads mixed document types (PDFs + spreadsheets + images)
- Questions target **tables, charts, or images** inside documents
- Financial reports, technical docs, or due diligence packages with visual content
- Need to extract structured data from scanned or complex-layout PDFs
- "What does the table on page 5 show?" / "Summarize the chart in the annual report"
- Batch-processing a folder of heterogeneous documents into a queryable index

❌ **DON'T USE when:**
- Plain text files or simple markdown — use `lightrag` directly
- Real-time data (stock prices, live feeds) — use APIs
- Structured databases — use SQL/API queries
- Single quick question about one short document — just read the file

## Setup

```bash
# Core install
pip install rag-anything

# MinerU for advanced document parsing (PDF layout, tables, equations)
# Heavy dependency (~2GB) — skip if only processing plain text PDFs
pip install magic-pdf[full]

# VLM support (required for image understanding)
# RAG-Anything uses the configured VLM to describe images/charts
# Ensure your VLM API key is set (OpenAI-compatible endpoint)
```

**Minimum requirements:** Python 3.10+, LLM API key, ~4GB disk for dependencies + index.
**Optional:** VLM API key for image/chart understanding (without it, images are skipped).

## Workflow

### Phase 1: Initialize

Create the RAGAnything instance with LLM and VLM configuration.

```python
import asyncio
from rag_anything import RAGAnything

rag = RAGAnything(
    working_dir="./rag_index",
    # LLM config (for text understanding + query answering)
    llm_model_name="gpt-4o-mini",
    llm_model_api_base="https://api.openai.com/v1",
    llm_model_api_key=os.environ["OPENAI_API_KEY"],
    llm_model_max_async=4,
    # VLM config (for image/chart/table understanding)
    vlm_model_name="gpt-4o",
    vlm_model_api_base="https://api.openai.com/v1",
    vlm_model_api_key=os.environ["OPENAI_API_KEY"],
    vlm_model_max_async=2,
    # Embedding
    embedding_model_name="text-embedding-3-small",
    embedding_model_api_base="https://api.openai.com/v1",
    embedding_model_api_key=os.environ["OPENAI_API_KEY"],
)
```

### Phase 2: Process Documents

Insert files into the index. Supports single or batch processing. **All operations are async.**

```python
# Single document
await rag.process_document(
    file_path="./reports/annual_report_2024.pdf",
    description="Company annual report with financials and charts"
)

# Batch — mixed formats
await rag.process_documents(
    file_paths=[
        "./reports/financials.xlsx",
        "./reports/pitch_deck.pptx",
        "./reports/contract.docx",
        "./photos/whiteboard.jpg",
    ]
)
```

Processing pipeline per file: **Parse → Extract structure → VLM describe visuals → Chunk → Embed → Index**

### Phase 3: Query

Same query modes as LightRAG, with automatic multimodal awareness.

```python
# Hybrid mode (recommended default — combines local + global context)
result = await rag.aquery(
    "What are the key financial metrics in the annual report?",
    param=QueryParam(mode="hybrid")
)

# Global mode — best for cross-document aggregation, table comparisons
result = await rag.aquery(
    "Compare revenue across all quarterly reports",
    param=QueryParam(mode="global")
)

# Local mode — best for specific, localized facts
result = await rag.aquery(
    "What does section 3.2 say about risk factors?",
    param=QueryParam(mode="local")
)

# Naive mode — simple retrieval, fastest
result = await rag.aquery(
    "Find mentions of 'liquidation preference'",
    param=QueryParam(mode="naive")
)
```

**Mode selection guide:**
| Question Type | Mode | Why |
|---|---|---|
| Table/chart data | `global` | Needs structural context across chunks |
| Image content | `hybrid` | VLM descriptions are auto-included |
| Specific clause/section | `local` | Pinpoints exact location |
| Cross-document comparison | `global` | Aggregates across all indexed files |
| Keyword/phrase search | `naive` | Fastest, simple retrieval |

### Phase 4: Deliver

Return structured answers with source attribution.

```markdown
## Answer
[Synthesized answer from indexed documents]

## Sources
| File | Page/Sheet | Relevance |
|------|-----------|-----------|
| annual_report_2024.pdf | p. 12-14 | Revenue table, EBITDA chart |
| financials.xlsx | Sheet "Q4" | Raw quarterly numbers |

## Confidence
🟢 High — multiple corroborating sources with structured data
```

## Format Support

| Format | Parser | VLM Needed | Notes |
|--------|--------|-----------|-------|
| PDF (text) | MinerU / fallback | No | Layout-aware extraction |
| PDF (scanned) | MinerU + OCR | Yes | Needs MinerU[full] install |
| DOCX | python-docx | No | Tables and images extracted |
| XLSX | openpyxl | No | Each sheet processed separately |
| PPTX | python-pptx | Yes | Slides treated as visual + text |
| JPG/PNG | Direct VLM | Yes | Entire image described by VLM |
| Plain text | Native | No | Use `lightrag` instead for better perf |

## Practical Example

**Scenario:** Process a due diligence package (10 PDFs) and answer financial questions.

```python
import os, asyncio, glob
from rag_anything import RAGAnything, QueryParam

async def due_diligence_qa():
    rag = RAGAnything(
        working_dir="./dd_index",
        llm_model_name="gpt-4o-mini",
        llm_model_api_key=os.environ["OPENAI_API_KEY"],
        vlm_model_name="gpt-4o",
        vlm_model_api_key=os.environ["OPENAI_API_KEY"],
        embedding_model_name="text-embedding-3-small",
        embedding_model_api_key=os.environ["OPENAI_API_KEY"],
    )

    # Index all PDFs in the DD folder
    dd_files = glob.glob("./due_diligence/*.pdf")
    await rag.process_documents(file_paths=dd_files)

    # Query financial metrics
    result = await rag.aquery(
        "What are the key financial metrics? Include revenue, EBITDA, "
        "net income, and any projections. Cite specific documents and pages.",
        param=QueryParam(mode="global")
    )
    print(result)

asyncio.run(due_diligence_qa())
```

## SpawnKit Integration

Spawn a sub-agent with Python exec to run RAG-Anything in isolation:

1. **Pass inputs:** file paths array (absolute) + user query string
2. **Agent creates** working dir, initializes RAGAnything, processes files, runs query
3. **Returns:** structured answer with sources as markdown
4. **Index persists** in working dir — subsequent queries skip re-indexing

For multi-turn conversations over the same document set, reuse the same `working_dir` to avoid re-processing.

## Limitations

- **Heavy setup** — MinerU + dependencies ~2-4GB; first install takes several minutes
- **VLM required for images** — without a VLM configured, image/chart content is silently skipped
- **Slow first-time index** — large document sets (50+ files) can take 10-30 minutes on first processing
- **Not real-time** — index is a snapshot; won't reflect changes to source files after indexing
- **API costs** — VLM calls (GPT-4o) for each image/chart add up on visual-heavy documents
- **Memory usage** — large indexes can consume 2-4GB RAM; plan working directory on SSD
- **LightRAG dependency** — inherits LightRAG's graph-based limitations for very short documents
