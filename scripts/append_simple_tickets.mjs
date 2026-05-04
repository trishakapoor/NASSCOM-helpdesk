import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'synthetic_tickets.csv');
const TOTAL_TICKETS = 300;
const BATCH_SIZE = 50; 

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
  
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error('❌ synthetic_tickets.csv not found! Run the main generation script first.');
    process.exit(1);
  }

  console.log(`🚀 Starting LLM generation of ${TOTAL_TICKETS} SIMPLE / MUNDANE synthetic tickets...`);

  let generatedCount = 0;
  let categoryIndex = 0;

  while (generatedCount < TOTAL_TICKETS) {
    const currentCategory = categories[categoryIndex % categories.length];
    const amountToGenerate = Math.min(BATCH_SIZE, TOTAL_TICKETS - generatedCount);
    
    console.log(`Batch [${generatedCount}/${TOTAL_TICKETS}]: Requesting ${amountToGenerate} SIMPLE tickets for category: ${currentCategory}`);

    const prompt = `You are a data engineer generating synthetic data for an IT Helpdesk system.
Generate exactly ${amountToGenerate} VERY SIMPLE, EVERYDAY, MUNDANE enterprise IT support tickets for the category: "${currentCategory}".

These should NOT be complex server crashes. These should be things like "I forgot my password", "My printer is jammed", "I need a license for Adobe", "My monitor won't turn on", "How do I connect to the guest WiFi?", "Phishing email reported". Use non-technical language from normal end-users.

Return ONLY a raw JSON object containing an array of tickets under the key "tickets", with NO markdown wrappers like \`\`\`json. Format:
{
  "tickets": [
    {
      "title": "Short generic title (e.g., Forgotten Password)",
      "description": "Short 1-2 sentence description from a confused user.",
      "category": "${currentCategory}",
      "resolution": "Step-by-step generic resolution steps in Markdown format.",
      "priority": "Low|Medium"
    }
  ]
}`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8,
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

  console.log(`\n✅ Successfully APPENDED ${generatedCount} simple LLM synthetic tickets → ${OUTPUT_FILE}`);
}

generate().catch(err => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
