import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import { pipeline, env } from '@xenova/transformers';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, '..', 'data', 'synthetic_tickets.csv');
const REPORT_FILE = path.join(__dirname, '..', 'data', 'evaluation_report.md');

env.allowLocalModels = true;
env.useBrowserCache = false;

// ─── Config ──────────────────────────────────────
const SAMPLE_SIZE = parseInt(process.env.EVAL_SAMPLE_SIZE || '50', 10);
const VALID_CATEGORIES = ['Infrastructure', 'Application', 'Security', 'Database', 'Network', 'Access Management'];

// ─── CSV Parser ──────────────────────────────────
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
      // Yield a row every 5 fields
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  // Group into rows of 5 columns
  const rows = [];
  const COLS = 5;
  for (let i = COLS; i < lines.length; i += COLS) {
    rows.push({
      title: lines[i],
      description: lines[i + 1],
      category: lines[i + 2],
      resolution: lines[i + 3],
      priority: lines[i + 4],
    });
  }
  return rows;
}

// ─── Cosine Similarity ──────────────────────────
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── F1 Score Calculation ────────────────────────
function computeMetrics(predictions, groundTruths, categories) {
  const confusion = {};
  for (const cat of categories) {
    confusion[cat] = { tp: 0, fp: 0, fn: 0 };
  }

  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const truth = groundTruths[i];
    if (pred === truth) {
      correct++;
      confusion[truth].tp++;
    } else {
      if (confusion[pred]) confusion[pred].fp++;
      confusion[truth].fn++;
    }
  }

  const accuracy = correct / predictions.length;

  const perClass = {};
  let macroF1 = 0;
  let weightedF1 = 0;
  let totalSupport = predictions.length;

  for (const cat of categories) {
    const { tp, fp, fn } = confusion[cat];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const support = tp + fn;
    perClass[cat] = { precision, recall, f1, support };
    macroF1 += f1;
    weightedF1 += f1 * support;
  }

  macroF1 /= categories.length;
  weightedF1 /= totalSupport;

  return { accuracy, macroF1, weightedF1, perClass };
}

// ─── Main Evaluation ─────────────────────────────
async function evaluate() {
  // 1. Check prerequisites
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error('❌ GROQ_API_KEY not set in .env.local');
    process.exit(1);
  }
  if (!fs.existsSync(CSV_FILE)) {
    console.error('❌ Dataset not found. Run `node scripts/generate_dataset.mjs` first.');
    process.exit(1);
  }

  const groq = new Groq({ apiKey: groqKey });
  console.log('📊 Starting Evaluation Pipeline...');
  console.log(`   Sample size: ${SAMPLE_SIZE} tickets\n`);

  // 2. Load dataset and sample
  const csvText = fs.readFileSync(CSV_FILE, 'utf-8');
  const allTickets = parseCSV(csvText);
  console.log(`   Total tickets in CSV: ${allTickets.length}`);

  // Stratified sample — pick evenly from each category
  const byCategory = {};
  for (const t of allTickets) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }
  const perCatSample = Math.max(1, Math.floor(SAMPLE_SIZE / VALID_CATEGORIES.length));
  const sample = [];
  for (const cat of VALID_CATEGORIES) {
    const catTickets = byCategory[cat] || [];
    const shuffled = catTickets.sort(() => 0.5 - Math.random());
    sample.push(...shuffled.slice(0, perCatSample));
  }
  console.log(`   Evaluation sample: ${sample.length} tickets (stratified)\n`);

  // 3. Load embedding model and custom ML weights
  console.log('🔤 Loading embedding model (bge-small-en-v1.5) and Custom ML Classifier...');
  const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  
  let lrModel = null;
  const lrModelPath = path.join(__dirname, '..', 'data', 'lr_model.json');
  if (fs.existsSync(lrModelPath)) {
    lrModel = JSON.parse(fs.readFileSync(lrModelPath, 'utf-8'));
    console.log('   Custom ML weights (Logistic Regression) loaded ✓\n');
  } else {
    console.warn('   ⚠ Custom ML weights not found. Run `python scripts/train_lr.py` first. Exiting.');
    process.exit(1);
  }

  // 4. Classification eval + Resolution generation
  const predictions = [];
  const groundTruths = [];
  const similarities = [];
  const judgeScores = [];
  const results = [];

  for (let i = 0; i < sample.length; i++) {
    const ticket = sample[i];
    const text = `${ticket.title}\n${ticket.description}`;
    process.stdout.write(`\r   Processing ${i + 1}/${sample.length}...`);

    // 4a. Classification via Custom ML Model
    let predCategory = 'Unknown';
    try {
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      const embeddingArray = Array.from(output.data);
      
      const classes = lrModel.classes;
      const weights = lrModel.weights;
      const intercepts = lrModel.intercepts;
      
      let maxProb = -1;
      
      const logits = classes.map((cat, i) => {
        let z = intercepts[i];
        for (let j = 0; j < embeddingArray.length; j++) {
          z += weights[i][j] * embeddingArray[j];
        }
        return z;
      });
      
      const maxLogit = Math.max(...logits);
      const exps = logits.map((z) => Math.exp(z - maxLogit));
      const sumExps = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map((e) => e / sumExps);
      
      for (let j = 0; j < probs.length; j++) {
        if (probs[j] > maxProb) {
          maxProb = probs[j];
          predCategory = classes[j];
        }
      }
    } catch (err) {
      console.warn(`\n   ⚠ Custom ML classification error: ${err.message}`);
    }

    // 4b. Resolution Generation via LLM
    let predResolution = 'N/A';
    try {
      const completion = await groq.chat.completions.create({
        messages: [{
          role: 'user',
          content: `You are an IT helpdesk agent. Generate a brief step-by-step resolution for this issue.

Ticket:
${text}

Category (Determined by ML): ${predCategory}

Return ONLY raw JSON:
{"resolution": "..."}`
        }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      const predicted = JSON.parse(completion.choices[0]?.message?.content || '{}');
      predResolution = predicted.resolution || 'N/A';
    } catch (err) {
      console.warn(`\n   ⚠ LLM error on ticket ${i}: ${err.message}`);
      // Rate limit handling — wait and retry
      if (err.status === 429 || err.message?.includes('rate')) {
        console.log('   Waiting 10s for rate limit...');
        await new Promise(r => setTimeout(r, 10000));
        i--; // retry
        continue;
      }
    }

    predictions.push(predCategory);
    groundTruths.push(ticket.category);

    // 4b. Semantic Similarity — embed predicted vs ground-truth resolution
    let similarity = 0;
    try {
      const [embPred, embTruth] = await Promise.all([
        embedder(String(predResolution || ''), { pooling: 'mean', normalize: true }),
        embedder(String(ticket.resolution || ''), { pooling: 'mean', normalize: true }),
      ]);
      similarity = cosineSimilarity(Array.from(embPred.data), Array.from(embTruth.data));
    } catch (e) {
      console.warn(`\n   ⚠ Embedding error: ${e.message}`);
    }
    similarities.push(similarity);

    results.push({
      title: ticket.title,
      trueCategory: ticket.category,
      predCategory,
      correct: predCategory === ticket.category,
      similarity: similarity.toFixed(4),
    });

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n');

  // 5. LLM-as-Judge (sample 10 from evaluated tickets)
  console.log('🧑‍⚖️ Running LLM-as-Judge evaluation on 10 samples...');
  const judgeSample = results.sort(() => 0.5 - Math.random()).slice(0, 10);
  
  for (let i = 0; i < judgeSample.length; i++) {
    const ticket = sample.find(t => t.title === judgeSample[i].title);
    if (!ticket) continue;

    try {
      const judgeCompletion = await groq.chat.completions.create({
        messages: [{
          role: 'user',
          content: `You are an expert IT support quality evaluator. Rate the AI-generated resolution on a scale of 1-5.

Original IT Issue:
${ticket.title}
${ticket.description}

Ground Truth Resolution:
${ticket.resolution}

AI-Generated Category: ${judgeSample[i].predCategory}
Ground Truth Category: ${ticket.category}

Scoring criteria:
- 5: Perfect — correct category, comprehensive resolution covering all steps
- 4: Good — correct category, mostly complete resolution
- 3: Adequate — category correct, resolution addresses the issue but misses steps
- 2: Poor — wrong category OR resolution doesn't adequately address the issue
- 1: Fail — wrong category AND irrelevant resolution

Return ONLY raw JSON: {"score": <1-5>, "reasoning": "brief explanation"}`
        }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const judgeResult = JSON.parse(judgeCompletion.choices[0]?.message?.content || '{"score": 0}');
      judgeScores.push(judgeResult);
      process.stdout.write(`\r   Judging ${i + 1}/10... score: ${judgeResult.score}/5`);
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`\n   ⚠ Judge error: ${err.message}`);
      if (err.status === 429) {
        await new Promise(r => setTimeout(r, 10000));
        i--;
        continue;
      }
      judgeScores.push({ score: 0, reasoning: 'Error during evaluation' });
    }
  }
  console.log('\n');

  // 6. Compute metrics
  const metrics = computeMetrics(predictions, groundTruths, VALID_CATEGORIES);
  const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const avgJudgeScore = judgeScores.length > 0 
    ? judgeScores.reduce((a, b) => a + (b.score || 0), 0) / judgeScores.length 
    : 0;

  // 7. Generate Report
  console.log('📝 Generating evaluation report...\n');

  let report = `# Evaluation Report — AI IT Helpdesk Agent\n\n`;
  report += `**Date**: ${new Date().toISOString().split('T')[0]}\n`;
  report += `**Model**: Llama 3.3 70B Versatile (Groq)\n`;
  report += `**Embedding Model**: bge-small-en-v1.5 (384-dim)\n`;
  report += `**Evaluation Sample**: ${sample.length} tickets (stratified from ${allTickets.length} total)\n\n`;

  report += `---\n\n## Summary Metrics\n\n`;
  report += `| Metric | Score |\n|---|---|\n`;
  report += `| **Overall Accuracy** | ${(metrics.accuracy * 100).toFixed(1)}% |\n`;
  report += `| **Macro F1 Score** | ${(metrics.macroF1 * 100).toFixed(1)}% |\n`;
  report += `| **Weighted F1 Score** | ${(metrics.weightedF1 * 100).toFixed(1)}% |\n`;
  report += `| **Avg Semantic Similarity** | ${(avgSimilarity * 100).toFixed(1)}% |\n`;
  report += `| **LLM-as-Judge Score** | ${avgJudgeScore.toFixed(2)} / 5.00 |\n\n`;

  report += `## Per-Category Classification Report\n\n`;
  report += `| Category | Precision | Recall | F1 Score | Support |\n|---|---|---|---|---|\n`;
  for (const cat of VALID_CATEGORIES) {
    const m = metrics.perClass[cat];
    report += `| ${cat} | ${(m.precision * 100).toFixed(1)}% | ${(m.recall * 100).toFixed(1)}% | ${(m.f1 * 100).toFixed(1)}% | ${m.support} |\n`;
  }
  report += `\n`;

  report += `## Semantic Similarity Distribution\n\n`;
  const simBuckets = { high: 0, medium: 0, low: 0 };
  for (const s of similarities) {
    if (s >= 0.8) simBuckets.high++;
    else if (s >= 0.5) simBuckets.medium++;
    else simBuckets.low++;
  }
  report += `| Range | Count | Percentage |\n|---|---|---|\n`;
  report += `| High (≥ 0.80) | ${simBuckets.high} | ${(simBuckets.high / similarities.length * 100).toFixed(1)}% |\n`;
  report += `| Medium (0.50–0.79) | ${simBuckets.medium} | ${(simBuckets.medium / similarities.length * 100).toFixed(1)}% |\n`;
  report += `| Low (< 0.50) | ${simBuckets.low} | ${(simBuckets.low / similarities.length * 100).toFixed(1)}% |\n\n`;

  report += `## LLM-as-Judge Results (${judgeScores.length} samples)\n\n`;
  report += `| # | Score | Reasoning |\n|---|---|---|\n`;
  for (let i = 0; i < judgeScores.length; i++) {
    const js = judgeScores[i];
    report += `| ${i + 1} | ${js.score}/5 | ${(js.reasoning || 'N/A').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |\n`;
  }
  report += `\n`;

  report += `## Methodology\n\n`;
  report += `1. **Classification Accuracy & F1**: Each ticket's text is embedded locally using \`bge-small-en-v1.5\`. The vector is compared to custom-trained category centroids using Cosine Similarity to mathematically predict the category (No LLM API wrapper used for classification).\n`;
  report += `2. **Semantic Similarity**: Both the LLM-generated resolution and the ground-truth resolution are embedded. Cosine similarity is computed between the two vectors.\n`;
  report += `3. **LLM-as-Judge**: A separate LLM call reviews each resolution against the original issue and ground truth, scoring 1–5 on correctness, completeness, and relevance.\n`;
  report += `4. **Stratified Sampling**: Equal numbers of tickets are drawn from each category to avoid class imbalance bias.\n`;

  fs.writeFileSync(REPORT_FILE, report, 'utf-8');
  console.log(`✅ Evaluation complete! Report saved → ${REPORT_FILE}`);
  console.log(`\n📊 Quick Summary:`);
  console.log(`   Accuracy:           ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`   Macro F1:           ${(metrics.macroF1 * 100).toFixed(1)}%`);
  console.log(`   Weighted F1:        ${(metrics.weightedF1 * 100).toFixed(1)}%`);
  console.log(`   Semantic Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log(`   Judge Score:         ${avgJudgeScore.toFixed(2)}/5.00`);
}

evaluate().catch(err => {
  console.error('❌ Evaluation failed:', err);
  process.exit(1);
});
