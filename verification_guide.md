# The Ultimate Verification Guide

Before your demo, you must verify that every single piece of this architecture works exactly as promised. Follow this checklist step-by-step.

---

## 1. Verify the ML Brain & Offline Metrics
**Goal:** Prove the Logistic Regression model works and is highly accurate.
1. Open your terminal in the project root.
2. Run the evaluation script:
   ```bash
   node scripts/evaluate.mjs
   ```
3. **What to watch for:** You should see it process 48-50 tickets. It will print out Accuracy, F1 Scores, and Groq LLM-as-a-judge scores.
4. **Final Proof:** Open `data/evaluation_report.md` when it finishes. This is your mathematical proof for the judges.

---

## 2. Verify Zero-Trust PII Redaction & Routing
**Goal:** Prove that sensitive data is masked *before* it leaves your server, and test the LLM-bypass logic.
1. Start your Next.js server:
   ```bash
   npm run dev
   ```
2. Open a new terminal and send a raw `curl` request containing PII and a highly confusing issue:
   ```bash
   curl -X POST http://localhost:3000/api/process-ticket \
   -H "Content-Type: application/json" \
   -d '{"rawText": "My name is John Doe, my IP is 192.168.1.5, and the flux capacitor in my keyboard is sparking."}'
   ```
3. **What to watch for:** 
   - Check the `sanitizedText` in the response. It should say something like `"My name is [REDACTED_NAME], my IP is [REDACTED_IP]..."`
   - Check the `confidenceScore`. Because "flux capacitor" is nonsense, the ML model should score it `< 0.75`.
   - Check the `status`. It should immediately say `NEEDS_HUMAN`.
   - Check the `thoughtProcess`. You should see the log: `"⚠ Confidence < 0.75. Agentic Layer: Bypassing LLM..."`

---

## 3. Verify the Autonomous Agent (Master Incidents)
**Goal:** Prove the AI can detect a mass outage and draft a mass-communication autonomously.
1. Keep your Next.js server running.
2. We need to trigger the vector similarity threshold by sending the exact same ticket 3 times in a row.
3. Run this curl command **3 times sequentially**:
   ```bash
   curl -X POST http://localhost:3000/api/process-ticket \
   -H "Content-Type: application/json" \
   -d '{"rawText": "The entire corporate WiFi network is down in Building A. I cannot connect to any internal services."}'
   ```
4. **What to watch for:**
   - On the **1st and 2nd** requests, the response will say: `"📊 Vector search detected X similar tickets..."`
   - On the **3rd** request, the magic happens. The `thoughtProcess` will say `"⚡ Agentic Layer: Halting standard flow to auto-generate Master Incident..."`
   - Open your Supabase Dashboard -> Table Editor -> `master_incidents`. You will see a brand new row containing a drafted Slack message and an executive summary of the WiFi outage!

---

## 4. Verify the 3D Vector Math Visualization
**Goal:** Prove to the judges that the embeddings mathematically separate IT concepts.
1. Open your browser and go to: `http://localhost:3000/vector-space`
2. **What to watch for:** 
   - A dark-themed 3D scatter plot will load. 
   - Hover your mouse over the dots to see the ticket titles. 
   - Rotate the cube. Notice how all the blue dots (Infrastructure) are clumped together on one side, while the red dots (Security) are on the other side. This visually proves your local ML pipeline works!

---

## 5. Verify the Omnichannel Discord Bot
**Goal:** Prove the system works where employees actually work.
1. Ensure your Next.js server (`npm run dev`) is running in one terminal.
2. Make sure you've added `DISCORD_BOT_TOKEN` to `.env.local` and invited the bot to your test server.
3. Open a second terminal and start the bot:
   ```bash
   node bot/discord_bot.mjs
   ```
4. Open Discord and type:
   `!ticket I accidentally deleted the production database table!`
5. **What to watch for:**
   - The bot should instantly reply: *"🧠 Analyzing issue and searching runbooks..."*
   - A second later, it will replace that message with a beautiful Discord Embed showing the category (`Database`), the Priority (`Critical`), and the drafted markdown runbook from Groq.
