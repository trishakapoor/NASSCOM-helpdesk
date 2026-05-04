# Evaluation Report — AI IT Helpdesk Agent

**Date**: 2026-05-04
**Model**: Llama 3.3 70B Versatile (Groq)
**Embedding Model**: bge-small-en-v1.5 (384-dim)
**Evaluation Sample**: 48 tickets (stratified from 1000 total)

---

## Summary Metrics

| Metric | Score |
|---|---|
| **Overall Accuracy** | 97.9% |
| **Macro F1 Score** | 97.9% |
| **Weighted F1 Score** | 97.9% |
| **Avg Semantic Similarity** | 42.9% |
| **LLM-as-Judge Score** | 3.00 / 5.00 |

## Per-Category Classification Report

| Category | Precision | Recall | F1 Score | Support |
|---|---|---|---|---|
| Infrastructure | 88.9% | 100.0% | 94.1% | 8 |
| Application | 100.0% | 100.0% | 100.0% | 8 |
| Security | 100.0% | 100.0% | 100.0% | 8 |
| Database | 100.0% | 87.5% | 93.3% | 8 |
| Network | 100.0% | 100.0% | 100.0% | 8 |
| Access Management | 100.0% | 100.0% | 100.0% | 8 |

## Semantic Similarity Distribution

| Range | Count | Percentage |
|---|---|---|
| High (≥ 0.80) | 0 | 0.0% |
| Medium (0.50–0.79) | 4 | 8.3% |
| Low (< 0.50) | 44 | 91.7% |

## LLM-as-Judge Results (10 samples)

| # | Score | Reasoning |
|---|---|---|
| 1 | 3/5 | Category correct, but AI-generated resolution not provided for evaluation |
| 2 | 3/5 | Category is correct as Infrastructure, but the AI-generated resolution is not provided for a direct comparison to determine if it's comprehensive or mostly complete. |
| 3 | 3/5 | Category correct, but AI-generated resolution not provided for evaluation |
| 4 | 3/5 | Category correct, resolution addresses WiFi connectivity issues but AI-generated resolution not provided for comparison |
| 5 | 3/5 | Category is correct as Infrastructure, but the AI-generated resolution is not provided for a thorough comparison with the Ground Truth Resolution. |
| 6 | 3/5 | Category is correct as Access Management, but the AI-generated resolution is not provided for a direct comparison to the ground truth resolution. |
| 7 | 3/5 | Category is correct as Security, but the AI-generated resolution is not provided for a complete evaluation. |
| 8 | 3/5 | Category is correct as Access Management, but the AI-generated resolution is not provided for a direct comparison to determine if it covers all necessary steps like the Ground Truth Resolution. |
| 9 | 3/5 | Category is correct as Security, but the AI-generated resolution is not provided for a direct comparison with the ground truth resolution. |
| 10 | 3/5 | Category is correct as Access Management, but the AI-generated resolution is not provided for a direct comparison to the ground truth resolution. |

## Methodology

1. **Classification Accuracy & F1**: Each ticket's text is embedded locally using `bge-small-en-v1.5`. The vector is compared to custom-trained category centroids using Cosine Similarity to mathematically predict the category (No LLM API wrapper used for classification).
2. **Semantic Similarity**: Both the LLM-generated resolution and the ground-truth resolution are embedded. Cosine similarity is computed between the two vectors.
3. **LLM-as-Judge**: A separate LLM call reviews each resolution against the original issue and ground truth, scoring 1–5 on correctness, completeness, and relevance.
4. **Stratified Sampling**: Equal numbers of tickets are drawn from each category to avoid class imbalance bias.
