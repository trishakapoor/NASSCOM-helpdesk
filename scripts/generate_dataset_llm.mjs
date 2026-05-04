import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'synthetic_tickets_llm.csv');
const TOTAL_TICKETS = 1000;
const BATCH_SIZE = 50; // Generate 50 tickets per LLM call

const categories = ['Infrastructure', 'Application', 'Security', 'Database', 'Network', 'Access Management'];

// ─── CSV Escape ──────────────────────────────────
function csvEscape(str) {
  if (!str) return '""';
  const cleaned = String(str).replace(/"/g, '""');
  return `"${cleaned}"`;
}

async function generate() {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error('❌ GROQ_API_KEY not set in .env.local');
    process.exit(1);
  }

  const groq = new Groq({ apiKey: groqKey });
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write header
  fs.writeFileSync(OUTPUT_FILE, 'title,description,category,resolution,priority\n', 'utf-8');

  console.log(`🚀 Starting LLM generation of ${TOTAL_TICKETS} synthetic tickets...`);

  let generatedCount = 0;
  let categoryIndex = 0;

  while (generatedCount < TOTAL_TICKETS) {
    const currentCategory = categories[categoryIndex % categories.length];
    const amountToGenerate = Math.min(BATCH_SIZE, TOTAL_TICKETS - generatedCount);
    
    console.log(`Batch [${generatedCount}/${TOTAL_TICKETS}]: Requesting ${amountToGenerate} tickets for category: ${currentCategory}`);

    const prompt = `You are a data engineer generating synthetic data for an IT Helpdesk system.
Generate exactly ${amountToGenerate} realistic enterprise IT support tickets for the category: "${currentCategory}".

Include varied scenarios, error codes, system names, and tones of voice.

Return ONLY a raw JSON object containing an array of tickets under the key "tickets", with NO markdown wrappers like \`\`\`json. Format:
{
  "tickets": [
    {
      "title": "Short descriptive title",
      "description": "Detailed multi-sentence description including fake IPs, server names, or error messages.",
      "category": "${currentCategory}",
      "resolution": "Step-by-step resolution steps in Markdown format.",
      "priority": "Critical|High|Medium|Low"
    }
  ]
}`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText);
      const tickets = parsed.tickets || [];

      let rows = '';
      for (const t of tickets) {
        rows += [
          csvEscape(t.title),
          csvEscape(t.description),
          csvEscape(t.category),
          csvEscape(t.resolution),
          csvEscape(t.priority)
        ].join(',') + '\n';
      }

      fs.appendFileSync(OUTPUT_FILE, rows, 'utf-8');
      generatedCount += tickets.length;
      categoryIndex++;

      // Prevent rate limits
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.error(`\n   ⚠ LLM generation error: ${err.message}`);
      if (err.status === 429) {
        console.log('   Waiting 20 seconds for rate limit reset...');
        await new Promise(r => setTimeout(r, 20000));
      } else {
        console.log('   Retrying...');
      }
    }
  }

  console.log(`\n✅ Successfully generated ${generatedCount} LLM synthetic tickets → ${OUTPUT_FILE}`);
}

generate().catch(err => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
