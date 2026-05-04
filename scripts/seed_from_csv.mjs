import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { pipeline, env } from '@xenova/transformers';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, '..', 'data', 'synthetic_tickets.csv');

env.allowLocalModels = true;
env.useBrowserCache = false;

// How many tickets to seed into historical_tickets (for RAG context)
const SEED_COUNT = parseInt(process.env.SEED_COUNT || '100', 10);

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
  const COLS = 5;
  // Skip header row (first 5 values)
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

async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }
  if (!fs.existsSync(CSV_FILE)) {
    console.error('❌ Dataset not found. Run `node scripts/generate_dataset.mjs` first.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load CSV
  const csvText = fs.readFileSync(CSV_FILE, 'utf-8');
  const allTickets = parseCSV(csvText);
  console.log(`📂 Loaded ${allTickets.length} tickets from CSV`);

  // Pick stratified sample for seeding
  const byCategory = {};
  for (const t of allTickets) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }
  
  const categories = Object.keys(byCategory);
  const perCat = Math.ceil(SEED_COUNT / categories.length);
  const sample = [];
  for (const cat of categories) {
    const tickets = byCategory[cat].sort(() => 0.5 - Math.random());
    sample.push(...tickets.slice(0, perCat));
  }

  console.log(`   Seeding ${sample.length} tickets (${perCat} per category)\n`);

  // Load embedding model
  console.log('🔤 Loading embedding model...');
  const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  console.log('   Model loaded ✓\n');

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < sample.length; i++) {
    const ticket = sample[i];
    const queryText = `${ticket.title}. ${ticket.description}`;
    
    process.stdout.write(`\r   Seeding ${i + 1}/${sample.length}...`);

    try {
      const output = await embedder(queryText, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);

      const { error } = await supabase.from('historical_tickets').insert({
        category: ticket.category,
        sanitized_query: queryText,
        resolution_steps: ticket.resolution,
        embedding: embedding,
      });

      if (error) {
        errors++;
        console.warn(`\n   ⚠ Insert error: ${error.message}`);
      } else {
        inserted++;
      }
    } catch (err) {
      errors++;
      console.warn(`\n   ⚠ Error: ${err.message}`);
    }
  }

  console.log(`\n\n✅ Seeding complete! Inserted: ${inserted}, Errors: ${errors}`);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
