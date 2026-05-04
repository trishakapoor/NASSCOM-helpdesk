import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline, env } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, '..', 'data', 'synthetic_tickets_llm.csv');
const FALLBACK_CSV = path.join(__dirname, '..', 'data', 'synthetic_tickets.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'category_centroids.json');

env.allowLocalModels = true;
env.useBrowserCache = false;

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
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  const rows = [];
  const COLS = 5;
  for (let i = COLS; i < lines.length; i += COLS) {
    if (lines[i]) {
      rows.push({
        title: lines[i],
        description: lines[i + 1],
        category: lines[i + 2],
        resolution: lines[i + 3],
        priority: lines[i + 4],
      });
    }
  }
  return rows;
}

async function train() {
  const targetCsv = fs.existsSync(CSV_FILE) ? CSV_FILE : FALLBACK_CSV;
  if (!fs.existsSync(targetCsv)) {
    console.error(`❌ Dataset not found at ${targetCsv}`);
    process.exit(1);
  }

  console.log(`📊 Loading dataset: ${path.basename(targetCsv)}...`);
  const csvText = fs.readFileSync(targetCsv, 'utf-8');
  const tickets = parseCSV(csvText);
  console.log(`   Found ${tickets.length} tickets.`);

  console.log('\n🔤 Loading embedding model (bge-small-en-v1.5)...');
  const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });

  const categoryEmbeddings = {};

  console.log('\n🧠 Computing embeddings and centroids...');
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    process.stdout.write(`\r   Processing ${i + 1}/${tickets.length}...`);
    
    const text = `${t.title}\n${t.description}`;
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    const vec = Array.from(output.data);

    if (!categoryEmbeddings[t.category]) {
      categoryEmbeddings[t.category] = [];
    }
    categoryEmbeddings[t.category].push(vec);
  }

  console.log('\n\n🎯 Calculating centroids...');
  const centroids = {};
  const DIMENSIONS = 384;

  for (const [category, vectors] of Object.entries(categoryEmbeddings)) {
    const centroid = new Array(DIMENSIONS).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < DIMENSIONS; i++) {
        centroid[i] += vec[i];
      }
    }
    
    // Average and normalize
    let magnitude = 0;
    for (let i = 0; i < DIMENSIONS; i++) {
      centroid[i] /= vectors.length;
      magnitude += centroid[i] * centroid[i];
    }
    magnitude = Math.sqrt(magnitude);
    for (let i = 0; i < DIMENSIONS; i++) {
      centroid[i] /= magnitude;
    }

    centroids[category] = centroid;
    console.log(`   ✅ Computed centroid for ${category} (${vectors.length} samples)`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(centroids, null, 2), 'utf-8');
  console.log(`\n🎉 Training complete! Centroids saved to ${OUTPUT_FILE}`);
}

train().catch(console.error);
