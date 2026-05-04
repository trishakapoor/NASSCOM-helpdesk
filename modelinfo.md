# AI Helpdesk Platform — Model & Data Architecture

This document details the exact datasets, machine learning models, and architectural decisions powering the Intelligent Ticket Routing & Resolution Agent.

## 1. The Dataset
The system was trained and evaluated on a highly realistic **Synthetic Enterprise Helpdesk Dataset**.

- **Volume:** 1,000 synthetic tickets.
- **Generation Method:** Generated programmatically and via LLM (`Llama 3.3 70B`) to simulate complex, real-world enterprise IT scenarios (including network topology references, error codes, and varying user tones).
- **Schema:** 
  - `title`: Short descriptive issue title.
  - `description`: Detailed, multi-sentence issue context.
  - `category`: Ground-truth label.
  - `resolution`: Step-by-step markdown runbook.
  - `priority`: Critical, High, Medium, or Low.
- **Classes (6):** Infrastructure, Application, Security, Database, Network, Access Management.

---

## 2. The Core Classification Model (The "Brain")
To ensure this system is an enterprise-grade ML platform and **not** an "AI API Wrapper," the core categorization logic relies on a mathematically driven, custom-trained local classifier.

### Architecture: Embedding-based Centroid Classifier (K-NN variant)
- **Base Model:** `BAAI/bge-small-en-v1.5` (A 384-dimensional dense sentence transformer).
- **Execution:** Runs 100% locally and securely on the Node.js backend using `Xenova/transformers`. Data never leaves your servers during classification.
- **Training Process:** 
  1. The 1,000 tickets in the training set were embedded into 384-dimensional vector space.
  2. We computed the mathematical "Centroid" (average vector position) for each of the 6 categories.
- **Inference Pipeline:** When a new ticket arrives, it is embedded locally. The system computes the **Cosine Similarity** between the new ticket's vector and the 6 trained category centroids. The highest mathematical match dictates the category, and the similarity distance determines the **Confidence Score**.

### Alternative External Microservice: SetFit (Siamese Network)
*Note: The project also includes source code (`ml_service/`) for an advanced external Python microservice implementation.*
- **Methodology:** Contrastive Learning using the SetFit framework (Tunstall et al., 2022).
- **Process:** The sentence transformer is fine-tuned to push embeddings of the same category closer together and pull different categories apart, followed by a differentiable logistic regression head.

---

## 3. The Agentic Layer (Pattern Detection)
The system features an autonomous agentic layer that identifies widespread outages or repeated issues without human intervention.

- **Technology:** Supabase `pgvector`.
- **Logic:** Instead of relying on naive text-matching, the system stores the 384-dimensional embedding of every incoming live ticket. A Vector RPC function compares the incoming ticket against all tickets from the last 72 hours.
- **Threshold:** If the agent finds 3 or more tickets with a **Cosine Similarity > 0.85** (indicating high semantic overlap despite different phrasing), it automatically flags the cluster for runbook automation.

---

## 4. The NLG & RAG Layer (Resolution Synthesis)
While the custom ML model handles routing, we use a Generative Large Language Model strictly for Natural Language Generation (typing out the response).

- **LLM Engine:** Llama 3.3 70B Versatile (via Groq API).
- **RAG Implementation:** The system queries `pgvector` for the top 3 historical resolutions with a similarity `> 0.50`. 
- **Synthesis:** The LLM is injected with the predicted category and the historical RAG context, and is prompted *only* to synthesize a polite, step-by-step markdown resolution. 

---

## 5. PII Redaction (Zero-Trust Security)
Before a ticket is embedded or sent to any external system, it passes through a local ML security layer.

- **Model:** `Xenova/bert-base-NER` (Named Entity Recognition).
- **Function:** Scans the raw text and locally redacts names, organizations, and locations into safe tokens (e.g., `[REDACTED_NAME]`). Fallback regex captures IPs, SSNs, and Emails.

---

## Summary
By isolating the decision-making logic (Local Embeddings + Centroid Classification) from the text-generation logic (Llama 3), this architecture achieves the low latency, high security, and deterministic routing required by enterprise IT compliance standards.
