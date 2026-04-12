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

import { regexRedact, rerank, checkGrounding } from "@/lib/ticket-utils";
import { parseLogFile } from "@/lib/log-parser";

// ──────────────────────────────────────────────────────────────
// Agentic Tools (ReAct Pattern)
// ──────────────────────────────────────────────────────────────

interface ToolResult {
  tool: string;
  result: any;
  sourceCitations?: SourceCitation[];
}

interface SourceCitation {
  id: string;
  category: string;
  query: string;
  similarity: number;
}

// Tool 1: Document / Knowledge Search (vector RAG)
async function toolDocumentSearch(
  queryText: string,
  embeddingArray: number[] | null,
  thoughtProcess: string[]
): Promise<ToolResult> {
  if (!supabase) {
    thoughtProcess.push("⚠ Tool:DocumentSearch — Supabase not configured.");
    return { tool: "DocumentSearch", result: null };
  }

  if (embeddingArray) {
    thoughtProcess.push("🔍 Tool:DocumentSearch — Performing vector similarity search (top-5)...");
    const { data: similarDocs, error } = await supabase.rpc('match_historical_tickets', {
      query_embedding: embeddingArray,
      match_threshold: 0.4,
      match_count: 5
    });

    if (error) {
      thoughtProcess.push("⚠ Tool:DocumentSearch — Vector search error, falling back to text.");
      return { tool: "DocumentSearch", result: null };
    }

    if (similarDocs && similarDocs.length > 0) {
      // Reranking: score by combination of similarity and category frequency
      const reranked = rerank(similarDocs, queryText);
      thoughtProcess.push(`✓ Tool:DocumentSearch — Found ${reranked.length} similar documents. Applied reranking.`);

      const citations: SourceCitation[] = reranked.map((doc: any) => ({
        id: doc.id,
        category: doc.category,
        query: doc.sanitized_query?.substring(0, 100) + '...',
        similarity: parseFloat(doc.similarity?.toFixed(4) || '0')
      }));

      const contextStr = reranked.map((doc: any) =>
        `[Source: ${doc.id}] Category: ${doc.category}\nHistorical Issue: ${doc.sanitized_query}\nResolution: ${doc.resolution_steps}`
      ).join('\n\n---\n\n');

      return { tool: "DocumentSearch", result: contextStr, sourceCitations: citations };
    }
  }

  // Fallback: text-based retrieval
  thoughtProcess.push("🔍 Tool:DocumentSearch — Using text-based retrieval (no embeddings)...");
  try {
    const { data: recentDocs } = await supabase
      .from('historical_tickets')
      .select('id, category, sanitized_query, resolution_steps')
      .limit(5);

    if (recentDocs && recentDocs.length > 0) {
      const citations: SourceCitation[] = recentDocs.map((doc: any) => ({
        id: doc.id,
        category: doc.category,
        query: doc.sanitized_query?.substring(0, 100) + '...',
        similarity: 0
      }));

      const contextStr = recentDocs.map((doc: any) =>
        `[Source: ${doc.id}] Category: ${doc.category}\nHistorical Issue: ${doc.sanitized_query}\nResolution: ${doc.resolution_steps}`
      ).join('\n\n---\n\n');

      return { tool: "DocumentSearch", result: contextStr, sourceCitations: citations };
    }
  } catch (e) {
    thoughtProcess.push("⚠ Tool:DocumentSearch — Text fallback also failed.");
  }

  return { tool: "DocumentSearch", result: null };
}

// Tool 2: Ticket System Lookup (find repeated issues)
async function toolTicketLookup(
  category: string,
  thoughtProcess: string[]
): Promise<ToolResult> {
  if (!supabase) {
    return { tool: "TicketLookup", result: null };
  }

  thoughtProcess.push(`🎫 Tool:TicketLookup — Searching live tickets for repeated '${category}' issues...`);

  try {
    const { data: recentTickets } = await supabase
      .from('live_tickets')
      .select('id, category, original_redacted_text, confidence_score, created_at')
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentTickets && recentTickets.length > 0) {
      const isRepeated = recentTickets.length >= 3;
      thoughtProcess.push(
        isRepeated
          ? `⚡ Tool:TicketLookup — Found ${recentTickets.length} recent '${category}' tickets → REPEATED ISSUE detected. Suggesting automation.`
          : `✓ Tool:TicketLookup — Found ${recentTickets.length} recent '${category}' tickets. Not yet a repeated pattern.`
      );

      return {
        tool: "TicketLookup",
        result: {
          recentCount: recentTickets.length,
          isRepeatedIssue: isRepeated,
          tickets: recentTickets.slice(0, 3).map((t: any) => ({
            id: t.id,
            text: t.original_redacted_text?.substring(0, 80),
            score: t.confidence_score
          }))
        }
      };
    }
  } catch (e) {
    thoughtProcess.push("⚠ Tool:TicketLookup — Query failed.");
  }

  return { tool: "TicketLookup", result: { recentCount: 0, isRepeatedIssue: false, tickets: [] } };
}

// Tool 3: Summarizer
async function toolSummarize(
  text: string,
  thoughtProcess: string[]
): Promise<ToolResult> {
  if (!groq) {
    return { tool: "Summarizer", result: text };
  }

  thoughtProcess.push("📝 Tool:Summarizer — Generating concise summary of context...");

  try {
    const completion = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: `Summarize the following IT support context in 2-3 bullet points, focusing on the most relevant resolution patterns:\n\n${text.substring(0, 3000)}`
      }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 300
    });

    const summary = completion.choices[0]?.message?.content || text;
    thoughtProcess.push("✓ Tool:Summarizer — Context condensed.");
    return { tool: "Summarizer", result: summary };
  } catch (e) {
    thoughtProcess.push("⚠ Tool:Summarizer — LLM unavailable, using raw context.");
    return { tool: "Summarizer", result: text };
  }
}



// ──────────────────────────────────────────────────────────────
// Main API Handler — ReAct Agentic Pipeline
// ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ① Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    if (ratelimit) {
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }
    }

    const { rawText, logContent } = await req.json();
    let fullText = rawText;
    const thoughtProcess: string[] = ["🚀 Initializing ReAct Agentic Pipeline..."];

    if (logContent) {
      thoughtProcess.push("🔎 [PARSE] Running structured log/trace parsing...");
      const parsedLogs = parseLogFile(logContent);
      if (parsedLogs.summary) {
        thoughtProcess.push(`✓ [PARSE] Log analysis found: ${parsedLogs.summary}`);
      } else {
        thoughtProcess.push(`⚠ [PARSE] No structured patterns found in logs.`);
      }
      fullText = `${rawText}\n\n[Parsed Log Context]\n${parsedLogs.summary}\nRaw Logs:\n${logContent.substring(0, 1000)}`;
    }

    // ② PII Redaction — Try local NER first, fallback to regex
    let sanitizedText = fullText;
    let useLocalEmbeddings = false;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      try {
        thoughtProcess.push("🔒 [REDACT] Loading local NER model (Xenova/bert-base-NER)...");
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

        thoughtProcess.push("✓ [REDACT] Local zero-trust PII redaction complete (NER + Regex).");
        useLocalEmbeddings = true;
      } catch (nerErr) {
        console.warn("Local NER unavailable:", (nerErr as any)?.message || nerErr);
        thoughtProcess.push("⚠ [REDACT] Local NER unavailable — using regex-based PII scrubbing...");
      }
    } else {
      thoughtProcess.push("🔒 [REDACT] Running regex-based PII redaction pipeline...");
    }

    sanitizedText = regexRedact(sanitizedText);

    // ③ Embedding Generation
    let embeddingArray: number[] | null = null;

    if (useLocalEmbeddings && !isProduction) {
      try {
        thoughtProcess.push("🧠 [EMBED] Generating vector embeddings (bge-small-en-v1.5)...");
        const PipelineSingleton = (await import("@/lib/ml")).default;
        const embedder = await PipelineSingleton.getEmbedding();
        const output = await (embedder as any)(sanitizedText, { pooling: 'mean', normalize: true });
        embeddingArray = Array.from(output.data) as number[];
        thoughtProcess.push("✓ [EMBED] 384-dim embedding generated.");
      } catch (embErr) {
        console.warn("Local embeddings unavailable:", (embErr as any)?.message || embErr);
        thoughtProcess.push("⚠ [EMBED] Embeddings unavailable — using text-based retrieval.");
      }
    } else {
      thoughtProcess.push("⚠ [EMBED] Using text-based context retrieval (production fallback).");
    }

    // ───────────────────────────────────────────────────────────
    // ReAct Loop: Think → Act → Observe → Think → Act → Observe
    // ───────────────────────────────────────────────────────────
    thoughtProcess.push("━━━ ReAct Agentic Loop Started ━━━");

    // ═══ STEP 1: Think — What tools do we need?
    thoughtProcess.push("💭 THINK: I need to (1) search knowledge base, (2) check for repeated issues, (3) summarize context.");

    // ═══ STEP 2: Act — Tool 1: Document Search
    const docSearchResult = await toolDocumentSearch(sanitizedText, embeddingArray, thoughtProcess);
    const sourceCitations = docSearchResult.sourceCitations || [];

    // ═══ STEP 3: Observe — Do we have context?
    const hasContext = docSearchResult.result !== null;
    thoughtProcess.push(hasContext
      ? `👁 OBSERVE: DocumentSearch returned context with ${sourceCitations.length} source citations.`
      : "👁 OBSERVE: No context found. Will proceed with general knowledge.");

    // ═══ STEP 4: Think — Do we need a summary? Should we check for repeated issues?
    let contextForLLM = docSearchResult.result || "";

    // ═══ STEP 5: Act — Tool 3: Summarize context if too long
    if (contextForLLM.length > 2000) {
      const summaryResult = await toolSummarize(contextForLLM, thoughtProcess);
      contextForLLM = summaryResult.result;
      thoughtProcess.push("👁 OBSERVE: Context summarized to key patterns.");
    }

    // ═══ STEP 6: Act — Tool 2: LLM Classification and Resolution
    thoughtProcess.push("💭 THINK: Context gathered. Now routing to LLM for final classification and resolution synthesis.");
    thoughtProcess.push("🤖 [LLM] Prompting Groq Llama 3.3 70B for resolution with source grounding...");

    let groqResponse: any = null;
    let fallbackToAdmin = false;

    if (groq) {
      const prompt = `You are an internal L1 IT Helpdesk Agent using a ReAct (Reasoning + Acting) workflow.

TASK: Analyze the user's IT issue and provide a resolution.

STEP 1 — CLASSIFY: Categorize into exactly one of: 'Infrastructure', 'Application', 'Security', 'Database', 'Storage', 'Network', 'Access Management'.

STEP 2 — RESOLVE & CAUSAL ANALYSIS: Using the historical resolutions below (the "sources") AND any provided log context, perform a causal analysis to correlate the user's symptoms with the root cause. Formulate step-by-step resolution instructions grounded in the sources. If no sources match, say so and provide general guidance.

STEP 3 — CITE: Reference which source IDs you used. This is CRITICAL for auditability.

STEP 4 — SCORE: Return a confidence_score (0.00-1.00). Lower confidence (<0.75) if:
- The issue doesn't match any source context
- The issue is ambiguous, dangerous, or out of scope
- You're uncertain about the resolution

STEP 5 — PRIORITY: Assign a priority string ('low', 'medium', 'high', 'critical') based on business impact.

User Issue (PII-redacted):
${sanitizedText}

Historical Sources (use these for grounding your answer):
${contextForLLM || "No historical context available."}

Return EXACTLY a raw JSON object (no markdown wrappers) with this format:
{
  "category": "String",
  "priority": "low | medium | high | critical",
  "resolution": "Markdown string with step-by-step resolution",
  "confidenceScore": 0.85,
  "sourcesUsed": ["source-id-1", "source-id-2"],
  "reasoning": "Brief explanation of your classification and resolution reasoning"
}`;

      try {
        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        groqResponse = JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch (e) {
        console.error("Groq inference failed", e);
        fallbackToAdmin = true;
        thoughtProcess.push("⚠ [LLM] Groq inference failed — escalating to human.");
      }
    } else {
      thoughtProcess.push("⚠ [LLM] Groq not configured. Forcing Admin Escalation.");
      fallbackToAdmin = true;
    }

    const finalCategory = groqResponse?.category || 'Infrastructure';
    const finalPriority = groqResponse?.priority || 'medium';
    const finalResolution = groqResponse?.resolution || 'System requires human escalation.';
    const finalConfidence = fallbackToAdmin ? 0.0 : (groqResponse?.confidenceScore || 0.0);
    const sourcesUsed = groqResponse?.sourcesUsed || [];
    const reasoning = groqResponse?.reasoning || '';

    // ═══ STEP 7: Hallucination Guardrail — Check grounding
    const grounding = checkGrounding(finalResolution, contextForLLM);
    thoughtProcess.push(`🛡 [GUARDRAIL] Grounding check: score=${grounding.groundingScore}, grounded=${grounding.isGrounded}`);

    // Penalize confidence if poorly grounded
    let adjustedConfidence = finalConfidence;
    if (!grounding.isGrounded && finalConfidence > 0.7) {
      adjustedConfidence = finalConfidence * 0.7;
      thoughtProcess.push(`⚠ [GUARDRAIL] Low grounding detected — confidence adjusted: ${finalConfidence.toFixed(2)} → ${adjustedConfidence.toFixed(2)}`);
    }

    const finalStatus = adjustedConfidence >= 0.75 ? 'AUTO_RESOLVED' : 'NEEDS_HUMAN';

    // ═══ STEP 8: Act — Tool 2: Ticket Lookup for repeated issues
    const ticketLookup = await toolTicketLookup(finalCategory, thoughtProcess);
    const isRepeatedIssue = ticketLookup.result?.isRepeatedIssue || false;

    let automationSuggestion: string | null = null;
    if (isRepeatedIssue) {
      automationSuggestion = `⚡ This is a repeated '${finalCategory}' issue (${ticketLookup.result.recentCount} similar tickets recently). Consider creating an automated runbook or self-service workflow for this category.`;
      thoughtProcess.push(`💡 THINK: Repeated issue detected. Suggesting automation for '${finalCategory}'.`);
    }

    thoughtProcess.push(`━━━ ReAct Loop Complete ━━━`);
    thoughtProcess.push(`📊 Final: Category=${finalCategory} | Confidence=${adjustedConfidence.toFixed(2)} | Status=${finalStatus} | Sources=${sourcesUsed.length}`);

    // ⑥ Persist to live_tickets
    if (supabase && finalStatus === 'NEEDS_HUMAN') {
      thoughtProcess.push("📤 Routing to Support Engineers (Needs Human)...");
      await supabase.from('live_tickets').insert({
        category: finalCategory,
        original_redacted_text: sanitizedText,
        confidence_score: adjustedConfidence,
        status: finalStatus,
        priority: finalPriority
      });
    }

    return NextResponse.json({
      status: finalStatus === 'NEEDS_HUMAN' ? 'ESCALATED' : 'SUCCESS',
      category: finalCategory,
      priority: finalPriority,
      sanitizedText: sanitizedText,
      resolution: finalStatus === 'NEEDS_HUMAN' ? null : finalResolution,
      confidenceScore: adjustedConfidence,
      thoughtProcess: thoughtProcess,
      // New fields for hackathon requirements
      sourceCitations: sourceCitations.filter(c =>
        sourcesUsed.includes(c.id) || sourcesUsed.length === 0
      ),
      reasoning: reasoning,
      groundingScore: grounding.groundingScore,
      isRepeatedIssue: isRepeatedIssue,
      automationSuggestion: automationSuggestion,
      agentTools: ['DocumentSearch', 'TicketLookup', 'Summarizer']
    });

  } catch (err: any) {
    console.error("Error processing ticket:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err?.message }, { status: 500 });
  }
}
