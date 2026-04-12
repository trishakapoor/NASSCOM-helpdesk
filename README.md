# 🧠 AI IT Helpdesk Agent — Enterprise Knowledge Copilot

> AI-powered, privacy-first IT Helpdesk Agent with RAG-based resolution, PII redaction, confidence-scored routing, and agentic workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 🎯 Problem Statement

Enterprise IT helpdesks are overwhelmed with thousands of daily support tickets — password resets, VPN issues, access requests — each containing sensitive employee PII that gets exposed to third-party platforms. Engineers waste 60–70% of their time on repetitive L1 issues while employees wait 12–24 hours for fixes that should take seconds.

## ✨ Solution

A **6-stage agentic pipeline** that autonomously resolves L1 IT tickets in under 5 seconds:

```
Employee Submits Ticket
    ↓
① Rate Limiting (Upstash Redis)
    ↓
② Local PII Redaction (BERT NER + Regex)
    ↓
③ Vector Embedding (bge-small-en-v1.5)
    ↓
④ RAG Similarity Search (Supabase pgvector)
    ↓
⑤ Agentic ReAct Resolution (Groq Llama 3.3 70B)
   Tools: DocumentSearch | TicketLookup | Summarizer
    ↓
⑥ Confidence-Based Routing
   ├── Score ≥ 0.75 → AUTO RESOLVED (with source citations)
   └── Score < 0.75 → ESCALATED (routed to Admin Dashboard)
```

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | Next.js API Routes (Serverless), `@xenova/transformers` (Local ML) |
| **Database** | Supabase PostgreSQL + pgvector (384-dim embeddings) |
| **AI/LLM** | Groq Cloud (Llama 3.3 70B Versatile) |
| **Security** | Upstash Redis (Rate Limiting), Local BERT NER (PII Redaction) |
| **Evaluation** | Custom F1/Accuracy pipeline, Semantic Similarity, LLM-as-Judge |

### Key Features

- **🔒 Zero-Trust Privacy**: PII redacted locally via BERT NER + regex *before* any external API call
- **🧠 RAG-Powered Resolution**: Retrieves past resolutions via cosine similarity vector search + reranking
- **🤖 Agentic Workflow**: ReAct pattern with 3 discrete tools (Document Search, Ticket Lookup, Summarizer)
- **🔍 Causal Analysis**: Structured log parser extracts stack traces from user logs and the LLM explicitly correlates these root-causes to the reported symptoms.
- **📊 Confidence Scoring**: Self-assessed confidence with threshold-based routing
- **📝 Source Citations**: Every resolution cites the historical tickets used as context
- **👁️ Full Observability**: Real-time agent thought process streamed to the UI
- **📈 Evaluation Pipeline**: Automated accuracy, F1, semantic similarity, and LLM-as-judge scoring

### Categories Supported

Infrastructure · Application · Security · Database · Storage · Network · Access Management

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (free tier)
- Groq API key (free tier)
- Upstash Redis (free tier, optional)

### Installation

```bash
# Clone the repo
git clone https://github.com/bitbroke/NASSCOM-helpdesk.git
cd NASSCOM-helpdesk

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your keys
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### Database Setup

Run the SQL schema in your Supabase SQL Editor:

```bash
# The schema file is at supabase/schema.sql
```

### Seed Data

```bash
# Seed 1000 synthetic enterprise tickets
node scripts/seed_data.mjs
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

### Run Evaluation

```bash
# Run the full evaluation pipeline (accuracy, F1, semantic similarity, LLM-as-judge)
node scripts/evaluate.mjs
```

## 📁 Project Structure

```
NASSCOM-helpdesk/
├── app/
│   ├── page.tsx                    # Ticket submission portal
│   ├── admin/page.tsx              # Admin triage dashboard
│   ├── layout.tsx                  # Root layout with metadata
│   └── api/
│       ├── process-ticket/route.ts # Core agentic pipeline
│       └── admin/tickets/route.ts  # Admin tickets API
├── lib/
│   ├── ml.ts                       # ML model singletons (NER + Embeddings)
│   ├── groq.ts                     # Groq LLM client
│   ├── supabase.ts                 # Supabase client
│   └── utils.ts                    # Utility functions
├── scripts/
│   ├── seed_data.mjs               # Dataset generation + seeding
│   └── evaluate.mjs                # Evaluation pipeline (F1, Accuracy, Semantic Sim)
├── data/
│   └── synthetic_tickets.csv       # 1000 synthetic enterprise tickets
├── supabase/
│   └── schema.sql                  # Database schema with pgvector
├── LICENSE                         # MIT License
└── README.md
```

## 📊 Evaluation

The evaluation pipeline measures:

| Metric | Description |
|---|---|
| **Accuracy** | Exact match on ticket categories |
| **F1 Score** | Per-category and macro-averaged F1 |
| **Semantic Similarity** | Cosine similarity between predicted and ground-truth resolutions |
| **LLM-as-Judge** | Groq LLM rates resolution quality on a 1-5 scale |

Run: `node scripts/evaluate.mjs`

## 🔐 Security & Privacy

- **DPDP Act / GDPR / HIPAA Aligned**: PII never leaves the server perimeter
- **Dual-Layer Redaction**: BERT NER (semantic) + Regex (pattern-based)
- **Rate Limiting**: 5 req/min per IP via Upstash Redis
- **Server-Side Only Keys**: Supabase admin keys never exposed to client

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🌐 Cross-Domain Applications (Transfer Learning)

This architecture is deliberately generalized and can be applied beyond internal IT Helpdesk support. 

- **Healthcare**: Redacting Patient Health Information (PHI) to triage medical inquiries or analyze historical diagnosis reports automatically.
- **Human Resources**: Processing sensitive employee grievance records, payroll inquiries, and parsing performance logs to provide anonymized summaries.
- **Legal & Finance**: Sanitizing financial audits or legal contracts to allow LLM summarization without risking breaches of non-disclosure agreements.

To adapt the project:
1. Replace `data/synthetic_tickets.csv` with a domain-specific dataset (Optionally using models fine-tuned on medical/legal text).
2. Adjust the NER model to detect domain-specific PII/PHI.
3. Update categories within `app/api/process-ticket/route.ts`.

## 🤔 Ethical Awareness & Limitations

While designing this system, we carefully considered the ethical implications of AI deployment:
- **Bias In Historical Data**: RAG retrieves past resolutions. If past engineers demonstrated systemic biases in issue prioritization, the AI may replicate these. We mitigate this by giving engineers the transparency of a realtime "thought process" logs and the original text snippets.
- **NER Limitations**: The `Xenova/bert-base-NER` pipeline works exceptionally well for Western names, addresses, and organizations but may struggle with non-English or highly localized entities natively without specific fine-tuning. We augmented this with aggressive local regex targeting Indian/global structural PII (e.g. Aadhaar).
- **False Confidence**: Large Language Models can hallucinate with high conviction. We counteract this using a grounding guardrail calculation that penalizes the `confidenceScore` if the model's text generation drifts from the retrieved semantic context.

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🏆 NASSCOM Hackathon 2026

Built for the NASSCOM AI Hackathon — Use Case 1 (Intelligent Ticket Routing) + Use Case 2 (Enterprise Knowledge Assistant).
