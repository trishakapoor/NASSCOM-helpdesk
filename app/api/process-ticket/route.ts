import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import { supabase } from "@/lib/supabase";
import PipelineSingleton from "@/lib/ml";
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

    const thoughtProcess: string[] = ["Initializing models..."];

    // 2. Local NER Pipeline for PII Redaction
    thoughtProcess.push("Running local zero-trust PII redaction...");
    const ner = await PipelineSingleton.getNER();
    const entities = await ner(fullText, { aggregation_strategy: "simple" });
    
    // Sort entities descending by index so string replacement doesn't shift later indices
    let sanitizedText = fullText;
    const sortedEntities = Array.isArray(entities) ? entities.sort((a, b) => b.start - a.start) : [];
    
    for (const ent of sortedEntities) {
      const entityType = ent.entity_group === 'PER' ? '[REDACTED_NAME]' :
                         ent.entity_group === 'LOC' ? '[REDACTED_LOCATION]' :
                         ent.entity_group === 'ORG' ? '[REDACTED_ORGANIZATION]' : '[REDACTED_ENTITY]';
      
      // We manually handle exact string replacements since NER gives exact matching tokens
      sanitizedText = sanitizedText.slice(0, ent.start) + entityType + sanitizedText.slice(ent.end);
    }

    // Basic regex for extra IP and Email redaction just to be absolutely careful
    sanitizedText = sanitizedText.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
    sanitizedText = sanitizedText.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');

    // 3. Embedding
    thoughtProcess.push("Generating embeddings locally using bge-small...");
    const embedder = await PipelineSingleton.getEmbedding();
    const output = await embedder(sanitizedText, { pooling: 'mean', normalize: true });
    const embeddingArray = Array.from(output.data);

    // 4. RAG / Similarity Search
    thoughtProcess.push("Searching Supabase pgvector for top 3 similar past resolutions...");
    let contextString = "";
    if (supabase) {
      const { data: similarDocs, error: searchError } = await supabase.rpc('match_historical_tickets', {
        query_embedding: embeddingArray,
        match_threshold: 0.5,
        match_count: 3
      });
  
      if (searchError) {
        console.error("Vector search error", searchError);
      } else if (similarDocs && similarDocs.length > 0) {
        contextString = similarDocs.map((doc: any) => `Category: ${doc.category}\nHistorical Issue: ${doc.sanitized_query}\nHistorical Resolution Steps: ${doc.resolution_steps}`).join('\n\n---\n\n');
      }
    } else {
       thoughtProcess.push("Warning: Supabase not configured. Skipping vector search.");
    }

    // 5. Groq LLM Inference
    thoughtProcess.push("Prompting Groq Llama 3 for resolution synthesis and confidence score...");
    let groqResponse = null;
    let fallbackToAdmin = false;

    if (groq) {
      const prompt = `You are an internal L1 IT Helpdesk Agent. Your goal is to analyze the user's issue, categorize it into exactly one of these six categories: 'Infrastructure', 'Application', 'Security', 'Database', 'Network', 'Access Management'. 
Then, using the provided historical issues, formulate a step-by-step markdown resolution.
Finally, return a confidence_score between 0.00 and 1.00 indicating how certain you are that this resolution will solve their specific issue. If the user's issue is absurd, dangerous, or not matching the RAG context, lower the confidence < 0.85.

User Issue:
${sanitizedText}

Historical Past Resolutions to Use as Context:
${contextString}

Return EXACTLY a raw JSON object with no markdown wrappers (like \`\`\`json) with the format:
{
  "category": "String",
  "resolution": "Markdown string of resolution steps, or a simple text saying it requires an expert.",
  "confidenceScore": 0.85
}`;

      try {
        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama3-70b-8192',
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        groqResponse = JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch(e) {
         console.error("Groq inference failed", e);
         fallbackToAdmin = true;
      }
    } else {
      thoughtProcess.push("Warning: Groq not configured. Forcing Admin Escalation.");
      fallbackToAdmin = true;
    }

    const finalCategory = groqResponse?.category || 'Infrastructure';
    const finalResolution = groqResponse?.resolution || 'System requires human escalation.';
    const finalConfidence = fallbackToAdmin ? 0.0 : (groqResponse?.confidenceScore || 0.0);
    const finalStatus = finalConfidence >= 0.85 ? 'AUTO_RESOLVED' : 'NEEDS_HUMAN';

    thoughtProcess.push(`Inference complete! Confidence: ${finalConfidence}. Status: ${finalStatus}`);

    // 6. Push to live_tickets if ESCALATED or if we just want to track everything
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
