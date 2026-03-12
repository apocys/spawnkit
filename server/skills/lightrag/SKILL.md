---
name: lightrag
description: "Index documents into a knowledge graph and query them with graph intelligence using LightRAG. Use when: user wants to search across a large document set, needs entity/relationship extraction, wants to understand connections between concepts across multiple files. NOT for: single-document Q&A (use web_fetch), real-time data, structured databases."
metadata: { "openclaw": { "emoji": "🧠", "source": "lightrag", "category": "knowledge" } }
---

# LightRAG Skill

Build a knowledge graph from documents and query it with graph intelligence — entity extraction, relationship mapping, and multi-mode retrieval.

## When to Use

✅ **USE when:**
- "Search across these documents for [topic]"
- "What entities and relationships exist in this corpus?"
- "How does X relate to Y across these files?"
- "Index these docs and make them queryable"
- User has 10+ documents and needs cross-document insights
- Entity/relationship extraction from unstructured text
- Building a persistent knowledge base from a document set

**vs deep-research:** Use `lightrag` when you have a document corpus to index OR when the query involves regulatory/compliance structures where entity/relationship graphs add value. Use `deep-research` for open-ended web research without a pre-existing document set.

❌ **DON'T USE when:**
- Single-document Q&A (use `web_fetch` or direct read)
- Real-time data queries (use `web_search`)
- Structured database queries (use SQL/API tools)
- Simple keyword search (use `grep`/`rg`)
- Documents under 3 — overhead isn't worth it

## Setup

Install LightRAG and its dependencies:

```bash
pip install lightrag-hku nano-vectordb tiktoken
```

Each knowledge graph needs a **working directory** to store the graph, embeddings, and metadata. Create one per project/corpus:

```bash
mkdir -p /tmp/lightrag_workdir
```

## Workflow

### Phase 1: Initialize

Create a LightRAG instance with a working directory, LLM config, and embedding model.

```python
import os
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed

WORKING_DIR = "/tmp/lightrag_workdir"
os.makedirs(WORKING_DIR, exist_ok=True)

rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func=openai_complete_if_cache,
    llm_model_name=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
    llm_model_max_async=4,
    embedding_func=openai_embed,
    embedding_model_name="text-embedding-3-small",
)
```

**LLM config:** LightRAG uses the LLM for entity extraction during indexing. Set `OPENAI_API_KEY` in env (or configure a custom model func for other providers). The embedding model handles vector similarity for naive/hybrid modes.

### Phase 2: Index Documents

Insert documents as text strings. LightRAG will extract entities and relationships using the configured LLM.

**Single document:**
```python
with open("document.txt", "r") as f:
    rag.insert(f.read())
```

**Batch insert (multiple files):**
```python
import glob

docs = []
for path in glob.glob("corpus/*.txt"):
    with open(path, "r") as f:
        docs.append(f.read())

# Batch insert — more efficient than one-by-one
for doc in docs:
    rag.insert(doc)
```

**From fetched URLs:**
```python
# Fetch content first (via web_fetch or requests), then insert the text
rag.insert(fetched_page_content)
```

> ⚠️ **Indexing is LLM-intensive.** Each document triggers entity extraction calls. First index of a large corpus (50+ docs) can take several minutes and consume significant tokens. Plan accordingly.

### Phase 3: Query

Query the knowledge graph using the appropriate mode. Always use `QueryParam` to set the mode.

```python
# Hybrid mode (recommended default)
result = rag.query(
    "What are the key relationships between these organizations?",
    param=QueryParam(mode="hybrid")
)
print(result)
```

**All four modes:**
```python
# Naive — simple vector similarity, no graph (fastest)
r1 = rag.query("What is LightRAG?", param=QueryParam(mode="naive"))

# Local — entity-centric, follows entity neighborhoods
r2 = rag.query("Tell me about Company X", param=QueryParam(mode="local"))

# Global — relationship-centric, cross-document connections
r3 = rag.query("How does A relate to B?", param=QueryParam(mode="global"))

# Hybrid — combines local + global (best quality, recommended)
r4 = rag.query("Summarize the key themes", param=QueryParam(mode="hybrid"))
```

### Phase 4: Deliver

Format the response with the answer and source attribution:

```markdown
## Answer
[LightRAG response text]

## Query Mode Used
hybrid — combines entity-centric and relationship-centric retrieval

## Knowledge Graph Stats
- Documents indexed: [count]
- Working directory: [path]

## Notes
- Graph can be re-queried without re-indexing
- Add more documents with `rag.insert()` to expand the graph
```

## Query Mode Decision Table

| Mode     | Best For                                    | Speed  | Quality | Example Query                              |
|----------|---------------------------------------------|--------|---------|--------------------------------------------|
| `naive`  | Simple similarity lookup, quick answers     | ⚡ Fast | ★★☆☆   | "What does the report say about revenue?"  |
| `local`  | Entity-focused questions, "tell me about X" | 🔄 Med  | ★★★☆   | "What is Entity X's role?"                 |
| `global` | Cross-doc relationships, "how X relates to Y" | 🔄 Med | ★★★☆   | "How do these companies interact?"         |
| `hybrid` | General queries, comprehensive answers      | 🐢 Slow | ★★★★   | "Summarize the key findings across all docs" |

**Default to `hybrid`** unless the user explicitly needs speed (`naive`) or has a specific entity/relationship question (`local`/`global`).

## SpawnKit Integration

A SpawnKit agent invokes this skill by spawning a sub-agent with Python exec capability:

1. **Spawn sub-agent** with shell/Python access
2. **Pass inputs:** document paths/URLs + query string + preferred mode
3. **Sub-agent executes:** install → init → index → query → return result
4. **Result format:** structured answer with mode used and doc count

```
Sub-agent task example:
"Install lightrag-hku, index all .txt files in /data/corpus/,
 then query: 'What are the main regulatory themes?' using hybrid mode.
 Return the answer with document count."
```

The knowledge graph persists in the working directory — subsequent queries on the same corpus skip re-indexing. Point multiple queries at the same `WORKING_DIR` to reuse an existing graph.

## Limitations

- **LLM API required** — entity extraction during indexing makes LLM calls (no offline-only mode)
- **First index is slow** — large corpora (50+ docs) can take minutes; subsequent queries are fast
- **Token-intensive** — indexing 100 documents can use 100k+ tokens for entity extraction
- **Best for 10+ documents** — below that, the graph overhead isn't justified vs. simple retrieval
- **Text-only** — PDFs/images must be converted to text before indexing
- **No incremental delete** — removing a document requires re-indexing (insert is append-only)
- **Embedding model needed** — requires an embedding API alongside the LLM for vector operations
