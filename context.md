# Deep-Dive Project Context & Architecture

This document serves as the **exhaustive technical handbook** for the AI Powered Intelligent Ticket Routing & Resolution Agent. It goes beyond a high-level summary, detailing the exact logic, mathematical formulas, and code flows powering every single component in the project.

---

## 1. High-Level Architecture Overview
The system is designed as an enterprise-ready, hybrid Machine Learning architecture. It strictly avoids being a simple "AI API Wrapper" (where text is just blindly sent to ChatGPT) by shifting critical decision-making (Categorization and Anomaly Detection) to **Local Mathematical Classifiers** and **Vector Databases**. 

- **Frontend & API Gateway:** Next.js 14 (App Router, TypeScript).
- **Database & Vector Store:** Supabase PostgreSQL with the `pgvector` extension.
- **Local ML Processing:** Xenova/transformers.js (runs natively inside Node.js using WebAssembly/ONNX).
- **Generative AI (NLG):** Groq API (`llama-3.3-70b-versatile`) used strictly for Natural Language Generation.
- **External ML Microservice (Optional but included):** Python FastAPI + SetFit framework.

---

## 2. The Core Pipeline: `app/api/process-ticket/route.ts`
When a user submits a ticket from the frontend dashboard, the payload hits the `POST` endpoint in `route.ts`. The ticket passes through a rigid, deterministic 7-step pipeline.

### Step 1: Rate Limiting & DoS Protection
```typescript
const { success } = await ratelimit.limit(ip);
```
- **Why:** To prevent API abuse and control external LLM costs.
- **How:** We use Upstash Redis and the `@upstash/ratelimit` library. It uses a **Sliding Window Algorithm** allowing exactly 5 requests per minute per IP address. If exceeded, it immediately halts the pipeline and returns `HTTP 429`.

### Step 2: Zero-Trust PII Redaction
- **Why:** Enterprise compliance (GDPR/HIPAA) demands that no sensitive data (names, IPs, SSNs) leaves the corporate network to hit an external LLM (like Groq).
- **How (Primary):** We use a local AI model: `Xenova/bert-base-NER`. It is a Named Entity Recognition model that scans the text and identifies `PER` (Person), `LOC` (Location), and `ORG` (Organization). It dynamically slices the string and replaces those words with `[REDACTED_NAME]`.
- **How (Fallback):** A strict RegEx filter runs immediately after, catching IP addresses, Emails, Phone Numbers, and SSN formats.
- **Result:** The variable `sanitizedText` is guaranteed safe for processing.

### Step 3: Local Vector Embedding (The Foundation of ML)
```typescript
const embedder = await PipelineSingleton.getEmbedding();
const output = await embedder(sanitizedText, { pooling: 'mean', normalize: true });
```
- **Why:** Computers cannot do math on raw text. Text must be converted into an array of numbers (a vector) where similar meanings have similar numbers.
- **How:** We run `Xenova/bge-small-en-v1.5` locally in Node.js. This is a state-of-the-art dense sentence transformer.
- **Result:** It generates an array of exactly **384 floating-point numbers** (e.g., `[-0.012, 0.443, ... ]`). Because we use `normalize: true`, the vector has a length/magnitude of exactly `1.0`. This is critical for the Cosine Similarity math later.

### Step 4: Hybrid RAG Context Retrieval
- **Why:** We need to know how the IT department historically solved similar issues so the LLM doesn't guess or hallucinate.
- **How:** We pass the 384-dimensional vector to Supabase using a Remote Procedure Call (RPC) named `match_historical_tickets`.
- **Math:** Supabase runs a K-Nearest Neighbors (KNN) search using the inner product operator `<#>` (which is equivalent to Cosine Similarity because our vectors are normalized). It finds the top 3 past tickets where the similarity score is > 0.50.

### Step 5: Dedicated ML Classification (The "Brain")
- **Why:** This is the core requirement to prove the project is not an AI wrapper. An LLM should not guess the category; a trained classifier should mathematically compute it.
- **How:** 
  1. The server loads `data/category_centroids.json`. This file contains 6 arrays (one for Infrastructure, one for Network, etc.). Each array is the exact mathematical center point ("Centroid") of all training tickets belonging to that category.
  2. The pipeline calculates the **Dot Product** (Cosine Similarity) between the new ticket's vector and each of the 6 centroids.
  ```typescript
  // Simplified Math Concept:
  let dotProduct = 0;
  for (let i = 0; i < 384; i++) {
    dotProduct += incomingVector[i] * centroidVector[i];
  }
  ```
- **Result:** The category with the highest similarity score wins. That similarity score directly becomes the system's `confidence_score` (e.g., 0.89). If `confidence_score < 0.75`, the system flags it as `NEEDS_HUMAN`.

### Step 6: Natural Language Generation (NLG)
- **Why:** We now know the Category and we have the Historical Resolutions. Now we need to formulate a polite, markdown-formatted response for the user.
- **How:** We make our *only* external API call to Groq (`llama-3.3-70b-versatile`).
- **Prompting:** The LLM is given strict JSON mode constraints. It is fed the sanitized text, the ML-predicted category, and the RAG context. It is asked to generate `priority` and `resolution` steps. It does **not** decide the category.

### Step 7: Agentic Layer (Autonomous Anomaly Detection)
- **Why:** If the office WiFi goes down, 50 people will submit a ticket. The Helpdesk shouldn't process 50 tickets individually; the system should autonomously detect the pattern and suggest a mass-automation runbook.
- **How:** We call the Supabase RPC `count_similar_live_tickets_vector`. 
- **The Vector Search Logic:** It scans the `live_tickets` table for tickets created in the last 72 hours. It calculates the Cosine Distance `1 - (embedding <=> query_embedding)`. If it finds **3 or more** tickets with a similarity `> 0.85` (meaning they are semantically almost identical, even if phrased differently), it triggers `automation_suggested = true`.

---

## 3. Database Schema: `supabase/schema.sql`
The PostgreSQL schema utilizes the `pgvector` extension to handle advanced vector math directly in the database.

1. **`historical_tickets` Table**
   - Holds approved, resolved tickets. 
   - `embedding vector(384)`: Used by the RAG system to find solutions.
2. **`live_tickets` Table**
   - The active Kanban board.
   - `confidence_score float8`: How sure the local ML model was.
   - `automation_suggested boolean`: Flipped to `true` by the Agentic layer.
   - `embedding vector(384)`: Saved here so the Agentic layer can compare future tickets against it.
3. **RPC `match_historical_tickets`**
   - Returns rows ordering by lowest distance `<=>`.
4. **RPC `count_similar_live_tickets_vector`**
   - Returns an integer `COUNT(*)` of live tickets matching the 0.85 similarity threshold.

---

## 4. Evaluation & Model Training Pipelines (`scripts/`)
These scripts validate the mathematical integrity of the system.

### `train_knn.mjs` (Local ML Training)
- **Purpose:** To train the system on your company's specific data without paying for GPU fine-tuning.
- **Process:** It reads the 1,000 synthetic tickets from the CSV. It embeds every single one using `bge-small`. It groups the 384-dimensional vectors by category. It adds all vectors in a category together and divides by the total count (finding the mean vector, or "Centroid"). It normalizes that centroid to a length of 1.0 and saves it to a JSON file.

### `evaluate.mjs` (Rigorous Testing)
- **Purpose:** To prove the system satisfies enterprise Service Level Agreements (SLAs).
- **Process:**
  1. It takes a stratified random sample (equal amounts from all 6 categories) from the 1,000 tickets.
  2. It runs the text through the Local ML Centroid Classifier and records the predicted category.
  3. It generates a resolution using the LLM.
- **Metrics Calculated:**
  - **Accuracy & F1 Score:** Compares the Local ML's predicted category against the CSV's ground truth.
  - **Semantic Similarity:** Embeds the LLM's generated resolution and the CSV's ground truth resolution, returning the Cosine Similarity (e.g., 0.88 means the LLM's solution is 88% semantically identical to the true solution).
  - **LLM-as-a-Judge:** Passes both resolutions to Groq, asking Groq to act as a harsh critic and score the generated text from 1 to 5.

---

## 5. Alternative External Architecture: `ml_service/`
While the Node.js KNN classifier is brilliant for self-contained apps, enterprise teams often want a standalone Python microservice. This folder contains exactly that.

### The SetFit Framework (Siamese Contrastive Learning)
Instead of just finding the "average" centroid, SetFit actively trains the embedding model.
1. **Contrastive Pairs:** It takes two tickets. If they are both "Network", it penalizes the model until their embeddings are pushed closer together in 384-dimensional space. If one is "Network" and one is "Database", it penalizes the model until they are pushed far apart.
2. **Classification Head:** It trains a Logistic Regression model on top of those perfectly separated embeddings to output precise probability scores (e.g., `92% Network`, `8% Infrastructure`).
3. **Deployment:** The `main.py` file exposes this highly trained model via a FastAPI `/predict` endpoint. The included `Dockerfile` allows for instant deployment to Hugging Face Spaces or Render, completely decoupling the ML Brain from the Next.js frontend.
