# Captain Obvious: Enterprise Zero-Trust IT Helpdesk
### Multi-Agent Council Architecture · Triangle-Edge Synthesis

An advanced, privacy-first IT Helpdesk system engineered for enterprise environments. The system automates Level-1 (L1) support triage through a **Multi-Agent "Council"** — a triangle of specialised AI agents that negotiate ticket resolution using local ONNX inference, Hybrid Search (BM25 + pgvector), and Procedural Skill Activation, all without trusting a cloud LLM for classification decisions.

---

## Architecture: The 4-Agent Council

```
[Analyser Agent]  →  PII Scrub + 384d Embedding
      ↓
[Manager Council] →  Hybrid RRF Search (BM25 + pgvector, k=60) → Domain Bids
      ↓
[Triage Decider]  →  ONNX WASM Inference (≥0.70 consensus check vs bids)
      ↓
[Synthesis Layer] →  Skill DAG Activation (agentic_skills table)
      ↓
   Resolution OR NEEDS_HUMAN
```

### Agent Roles

| Agent | Input | Output |
|---|---|---|
| **Analyser** | Raw user text | Sanitized text + 384d vector |
| **Manager Council** | Text + vector | Top-5 RRF results, domain bid scores |
| **Triage Decider** | 384d vector | Category + confidence (ONNX, threshold 0.70) |
| **Synthesis Layer** | Winning category | Procedural Skill DAG (cloud or offline) |

### Fallback Chains (Guaranteed uptime)

| Condition | Fallback |
|---|---|
| ONNX unavailable | JSON Logistic Regression weights |
| Embeddings unavailable | Groq unified call (Path B) |
| Fully offline + no embeddings | BM25 keyword search + Skill DAG (Path C) |

---

## Core Capabilities

1. **Zero-Trust PII Redaction** — Local BERT NER (WASM) intercepts and masks names, IPs, emails before any data leaves the server. Regex pattern matching provides a secondary safety net.
2. **Air-Gapped ONNX Classification** — A Scikit-Learn Logistic Regression model is exported to ONNX via `skl2onnx` and loaded natively by `onnxruntime-web` (WASM). No native C++ binary issues at inference time.
3. **Hybrid Search (BM25 + pgvector)** — The `hybrid_search_tickets` Supabase RPC fuses lexical BM25 rankings with semantic cosine similarity scores using Reciprocal Rank Fusion (k=60), giving the Manager Council richer context than pure vector search.
4. **Procedural Skill DAGs** — The `agentic_skills` table stores 6 deterministic runbooks (one per category). In cloud mode, Groq synthesises these into natural language. In offline mode, they are returned raw with a `[SKILL ACTIVATED: OFFLINE MODE]` badge.
5. **Agentic Outage Detection** — If ≥3 similar tickets arrive within 72 hours, the system auto-drafts a Master Incident Runbook and mass-communication template.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & API | Next.js 16, React 19, TailwindCSS, Framer Motion |
| Database | Supabase PostgreSQL + `pgvector` + GIN FTS index |
| ML (Local NER + Embed) | `@xenova/transformers` (WASM) |
| ML (Classifier) | `onnxruntime-node` (C++ native) + JSON LR fallback |
| LLM Synthesis | Groq API (`llama-3.3-70b-versatile`) |
| Rate Limiting | Upstash Redis |
| Training | Python, Scikit-Learn, SentenceTransformers, skl2onnx |

---

## Getting Started

### Prerequisites
- Node.js v18+
- Python 3.9+ (for training only)
- Supabase project (pgvector enabled)
- Groq API Key

### 1. Clone & Install
```bash
git clone https://github.com/bitbroke/Nasscom-R2.git
cd Nasscom-R2
npm install
```

### 2. Environment Variables
Create `.env.local`:
```env
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### 3. Database Setup
Run both files in your Supabase SQL editor **in order**:
```
supabase/schema.sql      ← creates all tables, FTS index, RRF function
supabase/seed_skills.sql ← seeds 6 procedural Skill DAGs
```

### 4. Train & Export the ONNX Model
```bash
pip install scikit-learn sentence-transformers pandas skl2onnx onnxruntime
cd scripts
python train_lr.py
# Outputs: ../data/lr_model.json AND ../public/models/classifier.onnx
```

### 5. Run Locally
```bash
npm run dev
```
Navigate to `http://localhost:3000`.

---

## Test Cases

| Test | Mode | Expected |
|---|---|---|
| "PostgreSQL deadlock on payroll query" | Cloud | ONNX → Database (>70%), Skill DAG via Groq |
| "VPN keeps disconnecting" | Air-Gapped | ONNX → Network, raw Skill DAG + `[SKILL ACTIVATED: OFFLINE MODE]` |
| "My keyboard feels weird during a picnic" | Cloud | ONNX confidence <70% → NEEDS_HUMAN |
| Submit VPN crash 3× | Cloud | Master Incident auto-triggered on 3rd submission |

---

## Deployment

See [`PROJECT_DESCRIPTION.md`](./PROJECT_DESCRIPTION.md) for the full deployment guide (Vercel + Render).

> **Note on `onnxruntime-node`:** This is a native C++ binary. It works perfectly on localhost and Render. On Vercel serverless functions it may hit the 50MB bundle limit — the system automatically falls back to JSON LR weights in that case, guaranteeing zero downtime.
