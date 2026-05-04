# Enterprise Zero-Trust IT Helpdesk

An advanced, privacy-first IT Helpdesk system designed for enterprise environments. This project automates Level-1 (L1) support triage and resolution using a hybrid local-ML and cloud-LLM architecture, specifically engineered to operate in air-gapped or restricted network environments.

## Core Capabilities

1. **Zero-Trust PII Redaction:** Utilizes an embedded WebAssembly (WASM) Named Entity Recognition (NER) model to intercept and mask Personally Identifiable Information (PII) before any data leaves the local server.
2. **Deterministic ML Classification:** Employs a highly calibrated, locally trained Logistic Regression model (running via raw matrix multiplication in Node.js) to accurately classify IT issues into strict enterprise categories.
3. **Air-Gapped Fault Tolerance:** Features a built-in fallback protocol. If cloud connectivity drops or external LLMs fail, the system deterministically retrieves the closest exact match from a local `pgvector` database to ensure zero downtime.
4. **Agentic Outage Detection:** Continuously monitors the incoming stream of vector embeddings. If a statistical cluster of identical issues appears within a defined timeframe, the system autonomously drafts an executive-level Master Incident runbook.

## Tech Stack

*   **Frontend & API:** Next.js 14, React, TailwindCSS, Framer Motion
*   **Database:** Supabase PostgreSQL with `pgvector` extension
*   **Machine Learning (Local):** `Xenova/transformers.js` (WASM), Scikit-Learn (Training)
*   **LLM Synthesis:** Groq API (`llama-3.3-70b-versatile`)
*   **Rate Limiting:** Upstash Redis

## Getting Started

### Prerequisites
*   Node.js (v18+)
*   Supabase Account (with pgvector enabled)
*   Groq API Key

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/bitbroke/Nasscom-R2.git
   cd Nasscom-R2
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env.local` file in the root directory:
   ```env
   GROQ_API_KEY=your_groq_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:3000` to access the portal.

## Deployment

This application is designed for seamless deployment on Vercel or Render. Ensure that all environment variables are securely added to your hosting provider's configuration. Due to the embedded WASM models, no dedicated Python server is required for inference.
