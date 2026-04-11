import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import { supabase } from "@/lib/supabase";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Upstash Redis if possible
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const ratelimit = redis ? new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
}) : null;

// ──────────────────────────────────────────────────────────────
// Regex-only PII redaction fallback (zero external dependencies)
// ──────────────────────────────────────────────────────────────
function regexRedact(text: string): string {
  let out = text;
  // IPs
  out = out.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
  // Emails
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  // Phone numbers (US/IN formats)
  out = out.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  // SSN-like patterns
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  return out;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    if (ratelimit) {
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }
    }

    const { rawText, logContent } = await req.json();
    const fullText = logContent ? `${rawText}\n\nLogs:\n${logContent}` : rawText;

    const thoughtProcess: string[] = ["Initializing pipeline..."];

    // ───────────────────────────────────────────────────────────
    // 2. PII Redaction — Try local NER first, fallback to regex
    // ───────────────────────────────────────────────────────────
    let sanitizedText = fullText;
    let useLocalEmbeddings = false;

    // Only attempt local ML models in development (they need ~600MB RAM)
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      try {
        thoughtProcess.push("Loading local NER model (Xenova/bert-base-NER)...");
        const PipelineSingleton = (await import("@/lib/ml")).default;
        const ner = await PipelineSingleton.getNER();
        const entities = await (ner as any)(fullText, { aggregation_strategy: "simple" });
        
        const sortedEntities = Array.isArray(entities) ? entities.sort((a: any, b: any) => b.start - a.start) : [];
        
        for (const ent of sortedEntities) {
          const entityType = ent.entity_group === 'PER' ? '[REDACTED_NAME]' :
                             ent.entity_group === 'LOC' ? '[REDACTED_LOCATION]' :
                             ent.entity_group === 'ORG' ? '[REDACTED_ORGANIZATION]' : '[REDACTED_ENTITY]';
          sanitizedText = sanitizedText.slice(0, ent.start) + entityType + sanitizedText.slice(ent.end);
        }

        thoughtProcess.push("Running local zero-trust PII redaction... ✓");
        useLocalEmbeddings = true;
      } catch (nerErr) {
        console.warn("Local NER unavailable, falling back to regex redaction:", (nerErr as any)?.message || nerErr);
        thoughtProcess.push("Local NER unavailable — using regex-based PII scrubbing...");
      }
    } else {
      thoughtProcess.push("Running regex-based PII redaction pipeline...");
    }

    // Always apply regex redaction as a safety net
    sanitizedText = regexRedact(sanitizedText);
    thoughtProcess.push("PII redaction complete ✓");

    // ───────────────────────────────────────────────────────────
    // 3. Embedding — Try local model, fallback to text search
    // ───────────────────────────────────────────────────────────
    let embeddingArray: number[] | null = null;

    if (useLocalEmbeddings && !isProduction) {
      try {
        thoughtProcess.push("Generating embeddings locally using bge-small...");
        const PipelineSingleton = (await import("@/lib/ml")).default;
        const embedder = await PipelineSingleton.getEmbedding();
        const output = await (embedder as any)(sanitizedText, { pooling: 'mean', normalize: true });
        embeddingArray = Array.from(output.data) as number[];
      } catch (embErr) {
        console.warn("Local embeddings unavailable:", (embErr as any)?.message || embErr);
        thoughtProcess.push("Local embeddings unavailable — using text-based context retrieval...");
      }
    } else {
      thoughtProcess.push("Using text-based context retrieval...");
    }

    // ───────────────────────────────────────────────────────────
    // 4. RAG / Similarity Search
    // ───────────────────────────────────────────────────────────
    let contextString = "";
    if (supabase && embeddingArray) {
      thoughtProcess.push("Searching Supabase pgvector for top 3 similar past resolutions...");
      const { data: similarDocs, error: searchError } = await supabase.rpc('match_historical_tickets', {
        query_embedding: embeddingArray,
        match_threshold: 0.5,
        match_count: 3
      });
  
      if (searchError) {
        console.error("Vector search error", searchError);
        thoughtProcess.push("Vector search encountered an error — proceeding without RAG context.");
      } else if (similarDocs && similarDocs.length > 0) {
        contextString = similarDocs.map((doc: any) => `Category: ${doc.category}\nHistorical Issue: ${doc.sanitized_query}\nHistorical Resolution Steps: ${doc.resolution_steps}`).join('\n\n---\n\n');
        thoughtProcess.push(`Found ${similarDocs.length} similar historical tickets.`);
      }
    } else if (supabase && !embeddingArray) {
      // Fallback: fetch recent tickets from Supabase as text context
      thoughtProcess.push("Fetching recent historical tickets as text context...");
      try {
        const { data: recentDocs } = await supabase
          .from('historical_tickets')
          .select('category, sanitized_query, resolution_steps')
          .limit(3);
        if (recentDocs && recentDocs.length > 0) {
          contextString = recentDocs.map((doc: any) => `Category: ${doc.category}\nHistorical Issue: ${doc.sanitized_query}\nHistorical Resolution Steps: ${doc.resolution_steps}`).join('\n\n---\n\n');
        }
      } catch (e) {
        console.warn("Text fallback context fetch failed:", e);
      }
    } else {
       thoughtProcess.push("Warning: Supabase not configured. Skipping context retrieval.");
    }

    // ───────────────────────────────────────────────────────────
    // 5. Groq LLM Inference
    // ───────────────────────────────────────────────────────────
    thoughtProcess.push("Prompting Groq Llama 3.3 for resolution synthesis and confidence score...");
    let groqResponse = null;
    let fallbackToAdmin = false;

    if (groq) {
      const prompt = `You are an internal L1 IT Helpdesk Agent. Your goal is to analyze the user's issue, categorize it into exactly one of these six categories: 'Infrastructure', 'Application', 'Security', 'Database', 'Network', 'Access Management'. 
Then, using the provided historical issues, formulate a step-by-step markdown resolution.
Finally, return a confidence_score between 0.00 and 1.00 indicating how certain you are that this resolution will solve their specific issue. If the user's issue is absurd, dangerous, or not matching the RAG context, lower the confidence < 0.75.

User Issue:
${sanitizedText}

Historical Past Resolutions to Use as Context:
${contextString || "No historical context available."}

Return EXACTLY a raw JSON object with no markdown wrappers (like \`\`\`json) with the format:
{
  "category": "String",
  "resolution": "Markdown string of resolution steps, or a simple text saying it requires an expert.",
  "confidenceScore": 0.85
}`;

      try {
        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        groqResponse = JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch(e) {
         console.error("Groq inference failed", e);
         fallbackToAdmin = true;
         thoughtProcess.push("Groq inference failed — escalating to human.");
      }
    } else {
      thoughtProcess.push("Warning: Groq not configured. Forcing Admin Escalation.");
      fallbackToAdmin = true;
    }

    const finalCategory = groqResponse?.category || 'Infrastructure';
    const finalResolution = groqResponse?.resolution || 'System requires human escalation.';
    const finalConfidence = fallbackToAdmin ? 0.0 : (groqResponse?.confidenceScore || 0.0);
    const finalStatus = finalConfidence >= 0.75 ? 'AUTO_RESOLVED' : 'NEEDS_HUMAN';

    thoughtProcess.push(`Inference complete! Confidence: ${finalConfidence}. Status: ${finalStatus}`);

    // 6. Push to live_tickets if ESCALATED
    if (supabase && finalStatus === 'NEEDS_HUMAN') {
       thoughtProcess.push("Routing to Support Engineers (Needs Human)...");
       await supabase.from('live_tickets').insert({
         category: finalCategory,
         original_redacted_text: sanitizedText,
         confidence_score: finalConfidence,
         status: finalStatus
       });
    }

    return NextResponse.json({
      status: finalStatus === 'NEEDS_HUMAN' ? 'ESCALATED' : 'SUCCESS',
      category: finalCategory,
      sanitizedText: sanitizedText,
      resolution: finalStatus === 'NEEDS_HUMAN' ? null : finalResolution,
      confidenceScore: finalConfidence,
      thoughtProcess: thoughtProcess
    });

  } catch (err: any) {
    console.error("Error processing ticket:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err?.message }, { status: 500 });
  }
}
