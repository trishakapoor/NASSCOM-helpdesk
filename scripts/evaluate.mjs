/**
 * ═══════════════════════════════════════════════════════════════
 * NASSCOM Helpdesk — Evaluation Pipeline
 * ═══════════════════════════════════════════════════════════════
 * 
 * Measures:
 *  1. Classification Accuracy & F1 Score (per-category + macro)
 *  2. Semantic Similarity (cosine sim between predicted and ground-truth resolutions)
 *  3. LLM-as-Judge (Groq rates resolution quality 1-5)
 * 
 * Usage:
 *   node scripts/evaluate.mjs
 * 
 * Requirements:
 *   - .env.local with GROQ_API_KEY
 *   - Supabase populated with seed data
 *   - @xenova/transformers installed
 */

import { pipeline, env } from '@xenova/transformers';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

env.allowLocalModels = true;
env.useBrowserCache = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ───────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const EVAL_SAMPLE_SIZE = 50; // Number of tickets to evaluate (for speed)
const LLM_JUDGE_BATCH = 10;  // Number of tickets for LLM-as-judge (costs API calls)
const USE_E2E = process.argv.includes('--e2e'); // Flag to use the full API pipeline

// ─── CSV Parser ──────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => row[h.trim()] = values[idx]);
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

// ─── Classification via LLM ─────────────────────────────────
async function classifyTicket(description) {
  if (!GROQ_API_KEY) return { category: 'Unknown', confidence: 0 };

  const prompt = `Classify this IT ticket into exactly one category: 'Infrastructure', 'Application', 'Security', 'Database', 'Storage', 'Network', 'Access Management'.

Ticket: ${description.substring(0, 500)}

Return ONLY a JSON object (no markdown): {"category": "String", "confidenceScore": 0.85, "resolution": "Brief resolution steps"}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch (e) {
    return { category: 'Unknown', confidence: 0 };
  }
}

// ─── End-to-End API Classification ───────────────────────────
async function classifyEndToEnd(description) {
  try {
    const res = await fetch('http://localhost:3000/api/process-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: description })
    });
    const data = await res.json();
    return {
      category: data.category || 'Unknown',
      confidence: data.confidenceScore || 0,
      resolution: data.resolution || ''
    };
  } catch (e) {
    console.error("API error, is the server running on :3000?");
    return { category: 'Unknown', confidence: 0, resolution: '' };
  }
}

// ─── LLM-as-Judge ────────────────────────────────────────────
async function llmJudge(originalIssue, predictedResolution, groundTruthResolution) {
  if (!GROQ_API_KEY) return { score: 0, reasoning: 'No API key' };

  const prompt = `You are an expert IT support quality evaluator. Rate the quality of a predicted resolution compared to the ground truth.

Original Issue: ${originalIssue.substring(0, 300)}

Predicted Resolution: ${(predictedResolution || 'No resolution provided').substring(0, 500)}

Ground Truth Resolution: ${groundTruthResolution.substring(0, 500)}

Rate the prediction on a scale of 1-5:
1 = Completely wrong or irrelevant
2 = Partially relevant but misses key steps
3 = Correct direction but incomplete
4 = Good resolution with minor omissions
5 = Excellent match, covers all key steps

Return ONLY a JSON object (no markdown): {"score": 4, "reasoning": "Brief explanation"}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{"score":0}');
  } catch (e) {
    return { score: 0, reasoning: 'API error' };
  }
}

// ─── Cosine Similarity ──────────────────────────────────────
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── F1 Score Calculation ────────────────────────────────────
function calculateF1(predictions, labels, categories) {
  const metrics = {};
  let totalTP = 0, totalFP = 0, totalFN = 0;

  for (const cat of categories) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === cat && labels[i] === cat) tp++;
      if (predictions[i] === cat && labels[i] !== cat) fp++;
      if (predictions[i] !== cat && labels[i] === cat) fn++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    metrics[cat] = { precision: precision.toFixed(4), recall: recall.toFixed(4), f1: f1.toFixed(4), tp, fp, fn };
    totalTP += tp;
    totalFP += fp;
    totalFN += fn;
  }

  // Macro F1
  const macroF1 = Object.values(metrics).reduce((sum, m) => sum + parseFloat(m.f1), 0) / categories.length;
  
  // Micro F1
  const microPrecision = totalTP / (totalTP + totalFP) || 0;
  const microRecall = totalTP / (totalTP + totalFN) || 0;
  const microF1 = microPrecision + microRecall > 0 ? 2 * (microPrecision * microRecall) / (microPrecision + microRecall) : 0;

  return { perCategory: metrics, macroF1: macroF1.toFixed(4), microF1: microF1.toFixed(4) };
}

// ─── Main Evaluation ─────────────────────────────────────────
async function evaluate() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  NASSCOM Helpdesk — Evaluation Pipeline');
  console.log('═══════════════════════════════════════════════════\n');

  // Load dataset
  const csvPath = join(__dirname, '..', 'data', 'synthetic_tickets.csv');
  const csvText = readFileSync(csvPath, 'utf-8');
  const allTickets = parseCSV(csvText);
  console.log(`📂 Loaded ${allTickets.length} tickets from CSV.\n`);

  // Sample for evaluation
  const shuffled = allTickets.sort(() => Math.random() - 0.5);
  const evalSet = shuffled.slice(0, EVAL_SAMPLE_SIZE);

  const categories = ['Infrastructure', 'Application', 'Security', 'Database', 'Storage', 'Network', 'Access Management'];

  // ═══ METRIC 1: Classification Accuracy & F1 ═══
  console.log('━━━ METRIC 1: Classification Accuracy & F1 Score ━━━\n');

  const predictions = [];
  const labels = [];
  let correct = 0;

  for (let i = 0; i < evalSet.length; i++) {
    const ticket = evalSet[i];
    const result = USE_E2E 
      ? await classifyEndToEnd(ticket.description) 
      : await classifyTicket(ticket.description);
    const predicted = result.category || 'Unknown';
    const actual = ticket.category;

    predictions.push(predicted);
    labels.push(actual);
    if (predicted === actual) correct++;

    // Rate limiting (Groq free tier)
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 1000));
    process.stdout.write(`\r   Classifying: ${i + 1}/${evalSet.length} (${((i + 1) / evalSet.length * 100).toFixed(0)}%)`);
  }

  const accuracy = correct / evalSet.length;
  const f1Results = calculateF1(predictions, labels, categories);

  console.log(`\n\n   ✅ Accuracy: ${(accuracy * 100).toFixed(2)}% (${correct}/${evalSet.length})\n`);
  console.log('   Per-Category Metrics:');
  console.log('   ┌─────────────────────┬──────────┬─────────┬────────┐');
  console.log('   │ Category            │ Precision│ Recall  │ F1     │');
  console.log('   ├─────────────────────┼──────────┼─────────┼────────┤');
  for (const [cat, m] of Object.entries(f1Results.perCategory)) {
    console.log(`   │ ${cat.padEnd(20)}│ ${m.precision.padEnd(9)}│ ${m.recall.padEnd(8)}│ ${m.f1.padEnd(7)}│`);
  }
  console.log('   └─────────────────────┴──────────┴─────────┴────────┘');
  console.log(`\n   Macro F1: ${f1Results.macroF1}`);
  console.log(`   Micro F1: ${f1Results.microF1}`);

  // ═══ METRIC 2: Semantic Similarity ═══
  console.log('\n━━━ METRIC 2: Semantic Similarity Scoring ━━━\n');

  console.log('   Loading embedding model (Xenova/bge-small-en-v1.5)...');
  const embed = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  console.log('   Model loaded.\n');

  const semSimSample = evalSet.slice(0, 20); // Smaller sample for embeddings
  const similarities = [];

  for (let i = 0; i < semSimSample.length; i++) {
    const ticket = semSimSample[i];
    const result = USE_E2E 
      ? await classifyEndToEnd(ticket.description) 
      : await classifyTicket(ticket.description);
    const predictedRes = result.resolution || '';
    const actualRes = ticket.resolution || '';

    if (predictedRes && actualRes) {
      const predEmb = await embed(predictedRes, { pooling: 'mean', normalize: true });
      const actualEmb = await embed(actualRes, { pooling: 'mean', normalize: true });
      const sim = cosineSimilarity(Array.from(predEmb.data), Array.from(actualEmb.data));
      similarities.push(sim);
    }

    if (i % 5 === 4) await new Promise(r => setTimeout(r, 1000));
    process.stdout.write(`\r   Computing similarity: ${i + 1}/${semSimSample.length}`);
  }

  const avgSimilarity = similarities.length > 0 
    ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
    : 0;
  const minSimilarity = similarities.length > 0 ? Math.min(...similarities) : 0;
  const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;

  console.log(`\n\n   ✅ Average Semantic Similarity: ${avgSimilarity.toFixed(4)}`);
  console.log(`   Min: ${minSimilarity.toFixed(4)} | Max: ${maxSimilarity.toFixed(4)}`);
  console.log(`   Samples evaluated: ${similarities.length}`);

  // ═══ METRIC 3: LLM-as-Judge ═══
  console.log('\n━━━ METRIC 3: LLM-as-Judge Evaluation ━━━\n');

  const judgeSample = evalSet.slice(0, LLM_JUDGE_BATCH);
  const judgeScores = [];

  for (let i = 0; i < judgeSample.length; i++) {
    const ticket = judgeSample[i];
    const result = USE_E2E 
      ? await classifyEndToEnd(ticket.description) 
      : await classifyTicket(ticket.description);
    const judgeResult = await llmJudge(ticket.description, result.resolution, ticket.resolution);

    judgeScores.push(judgeResult.score || 0);
    console.log(`   Ticket ${i + 1}: Score=${judgeResult.score}/5 — ${judgeResult.reasoning?.substring(0, 80) || ''}`);

    await new Promise(r => setTimeout(r, 1200)); // Rate limit
  }

  const avgJudgeScore = judgeScores.length > 0
    ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
    : 0;

  console.log(`\n   ✅ Average LLM Judge Score: ${avgJudgeScore.toFixed(2)}/5.00`);
  console.log(`   Samples evaluated: ${judgeScores.length}`);

  // ═══ SUMMARY ═══
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  EVALUATION SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`  📊 Classification Accuracy:    ${(accuracy * 100).toFixed(2)}%`);
  console.log(`  📊 Macro F1 Score:             ${f1Results.macroF1}`);
  console.log(`  📊 Micro F1 Score:             ${f1Results.microF1}`);
  console.log(`  📊 Semantic Similarity (avg):  ${avgSimilarity.toFixed(4)}`);
  console.log(`  📊 LLM-as-Judge Score (avg):   ${avgJudgeScore.toFixed(2)}/5.00`);
  console.log(`\n  Total tickets evaluated:       ${evalSet.length}`);
  console.log(`  Categories:                    ${categories.length}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Write results to file
  const results = {
    timestamp: new Date().toISOString(),
    sampleSize: evalSet.length,
    classification: {
      accuracy: parseFloat((accuracy * 100).toFixed(2)),
      macroF1: parseFloat(f1Results.macroF1),
      microF1: parseFloat(f1Results.microF1),
      perCategory: f1Results.perCategory
    },
    semanticSimilarity: {
      average: parseFloat(avgSimilarity.toFixed(4)),
      min: parseFloat(minSimilarity.toFixed(4)),
      max: parseFloat(maxSimilarity.toFixed(4)),
      samplesEvaluated: similarities.length
    },
    llmJudge: {
      averageScore: parseFloat(avgJudgeScore.toFixed(2)),
      samplesEvaluated: judgeScores.length,
      scores: judgeScores
    }
  };

  const { writeFileSync } = await import('fs');
  const resultsPath = join(__dirname, '..', 'data', 'evaluation_results.json');
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`  📁 Results saved to: data/evaluation_results.json\n`);
}

evaluate().catch(console.error);
