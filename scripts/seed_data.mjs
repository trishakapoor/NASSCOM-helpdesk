import { createClient } from '@supabase/supabase-js';
import { pipeline, env } from '@xenova/transformers';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

env.allowLocalModels = true;
env.useBrowserCache = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── CSV Parser (no dependency) ──────────────────────────────
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
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── Variation Generator removed as CSV now has 1000 items ───────────

// ─── Main Seed Function ──────────────────────────────────────
async function seed() {
  console.log("📂 Loading synthetic tickets from CSV...");
  const csvPath = join(__dirname, '..', 'data', 'synthetic_tickets.csv');
  const csvText = readFileSync(csvPath, 'utf-8');
  const baseTickets = parseCSV(csvText);
  console.log(`   Parsed ${baseTickets.length} base tickets from CSV.`);

  const allTickets = baseTickets;
  console.log(`   Found ${allTickets.length} total tickets.`);

  console.log("🧠 Loading embedding model (Xenova/bge-small-en-v1.5)...");
  const embed = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  console.log("   Model loaded.");

  // Clear existing data
  console.log("🗑️  Clearing existing historical_tickets...");
  const { error: delError } = await supabase.from('historical_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) console.warn("   Warning during delete:", delError.message);

  // Process in batches of 25
  const BATCH_SIZE = 25;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < allTickets.length; i += BATCH_SIZE) {
    const batch = allTickets.slice(i, i + BATCH_SIZE);
    const rows = [];

    for (const ticket of batch) {
      const textToEmbed = `${ticket.title}. ${ticket.description}`;
      try {
        const output = await embed(textToEmbed, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        rows.push({
          category: ticket.category,
          sanitized_query: textToEmbed,
          resolution_steps: ticket.resolution,
          embedding: embedding,
          priority: ticket.priority
        });
      } catch (err) {
        console.error(`   ⚠ Embedding failed for: ${ticket.title}`, err.message);
        failed++;
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('historical_tickets').insert(rows);
      if (error) {
        console.error(`   ⚠ Batch insert error:`, error.message);
        failed += rows.length;
      } else {
        inserted += rows.length;
      }
    }

    // Progress
    const progress = Math.round(((i + batch.length) / allTickets.length) * 100);
    process.stdout.write(`\r   📊 Progress: ${progress}% (${inserted} inserted, ${failed} failed)`);
  }

  console.log(`\n\n✅ Seeding complete!`);
  console.log(`   Total inserted:  ${inserted}`);
  console.log(`   Total failed:    ${failed}`);
  console.log(`   Total attempted: ${allTickets.length}`);
}

seed().catch(console.error);
