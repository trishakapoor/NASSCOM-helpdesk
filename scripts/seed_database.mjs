import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline, env } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, '..', 'data', 'synthetic_tickets_llm.csv');
const FALLBACK_CSV = path.join(__dirname, '..', 'data', 'synthetic_tickets.csv');

env.allowLocalModels = true;
env.useBrowserCache = false;

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
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  const rows = [];
  const COLS = 5; // title,description,category,resolution,priority
  for (let i = COLS; i < lines.length; i += COLS) {
    if (lines[i] && lines[i+2]) {
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

async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials missing in .env.local');
    process.exit(1);
  }

  // Pass custom fetch to avoid Node 18+ IPv6 DNS bugs on Windows
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: fetch }
  });

  const targetCsv = fs.existsSync(CSV_FILE) ? CSV_FILE : FALLBACK_CSV;
  console.log(`📊 Loading dataset: ${path.basename(targetCsv)}...`);
  const csvText = fs.readFileSync(targetCsv, 'utf-8');
  const tickets = parseCSV(csvText);
  console.log(`   Found ${tickets.length} tickets to seed.`);

  console.log('\n🔤 Loading embedding model (bge-small-en-v1.5)...');
  const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });

  console.log('\n🌱 Pushing to Supabase `historical_tickets` in batches...');
  const BATCH_SIZE = 50;

  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r   Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(tickets.length/BATCH_SIZE)}...`);

    const insertPayload = [];
    for (const t of batch) {
      const text = `${t.title}\n${t.description}`;
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      const embeddingArray = Array.from(output.data);

      insertPayload.push({
        category: t.category,
        sanitized_query: text,
        resolution_steps: t.resolution || 'Resolved',
        embedding: `[${embeddingArray.join(',')}]`
      });
    }

    const { error } = await supabase.from('historical_tickets').insert(insertPayload);
    if (error) {
      console.error(`\n❌ Error inserting batch:`, error.message);
    }
  }

  console.log('\n\n✅ Database seeding complete! RAG context is fully populated.');
}

seed().catch(err => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
