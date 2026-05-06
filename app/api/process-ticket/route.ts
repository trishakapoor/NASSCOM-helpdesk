import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import { supabase } from "@/lib/supabase";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import lrModelData from "@/data/lr_model.json";

// ── Rate Limiting ────────────────────────────────────────────────
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m") })
  : null;

// ── Regex PII fallback ───────────────────────────────────────────
function regexRedact(text: string): string {
  let out = text;
  out = out.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[REDACTED_IP]");
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]");
  out = out.replace(/(\+?\d{1,3}[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}\b/g, "[REDACTED_PHONE]");
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
  return out;
}

// ── JSON LR fallback classifier ──────────────────────────────────
function jsonLRClassify(
  embeddingArray: number[]
): { category: string; confidence: number } {
  try {
    const lrModel = lrModelData as any;
    const { classes, weights, intercepts } = lrModel;
    const logits = classes.map((cat: string, i: number) => {
      let z = intercepts[i];
      for (let j = 0; j < embeddingArray.length; j++) z += weights[i][j] * embeddingArray[j];
      return z;
    });
    const maxLogit = Math.max(...logits);
    const exps = logits.map((z: number) => Math.exp(z - maxLogit));
    const sum = exps.reduce((a: number, b: number) => a + b, 0);
    const probs = exps.map((e: number) => e / sum);
    let maxProb = -1, bestCat = "Infrastructure";
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > maxProb) { maxProb = probs[i]; bestCat = classes[i]; }
    }
    return { category: bestCat, confidence: maxProb };
  } catch {
    return { category: "Infrastructure", confidence: 0.5 };
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Rate Limiting ─────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    if (ratelimit) {
      const { success } = await ratelimit.limit(ip);
      if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { rawText, logContent, useLLM = true } = await req.json();
    const fullText = logContent ? `${rawText}\n\nLogs:\n${logContent}` : rawText;
    const thoughtProcess: string[] = [];

    // ════════════════════════════════════════════════════════════
    // AGENT 1 — ANALYSER AGENT
    // Role: PII scrubbing + local embedding generation
    // ════════════════════════════════════════════════════════════
    thoughtProcess.push("🔍 [Analyser Agent] Initialising — PII scrub & embedding pipeline...");

    let sanitizedText = fullText;
    let useLocalEmbeddings = false;

    try {
      thoughtProcess.push("[Analyser Agent] Loading BERT NER (Xenova/bert-base-NER)...");
      const PipelineSingleton = (await import("@/lib/ml")).default;
      const ner = await PipelineSingleton.getNER();
      const entities = await (ner as any)(fullText, { aggregation_strategy: "simple" });
      const sorted = Array.isArray(entities)
        ? entities.sort((a: any, b: any) => b.start - a.start)
        : [];
      for (const ent of sorted) {
        const tag =
          ent.entity_group === "PER" ? "[REDACTED_NAME]" :
          ent.entity_group === "LOC" ? "[REDACTED_LOCATION]" :
          ent.entity_group === "ORG" ? "[REDACTED_ORGANIZATION]" : "[REDACTED_ENTITY]";
        sanitizedText = sanitizedText.slice(0, ent.start) + tag + sanitizedText.slice(ent.end);
      }
      thoughtProcess.push("[Analyser Agent] Zero-trust NER redaction complete ✓");
      useLocalEmbeddings = true;
    } catch {
      thoughtProcess.push("[Analyser Agent] NER unavailable — regex PII fallback active.");
    }

    sanitizedText = regexRedact(sanitizedText);
    thoughtProcess.push("[Analyser Agent] Sanitized text ready ✓");

    // Embedding
    let embeddingArray: number[] | null = null;
    if (useLocalEmbeddings) {
      try {
        thoughtProcess.push("[Analyser Agent] Generating 384d embedding (bge-small-en-v1.5)...");
        const PipelineSingleton = (await import("@/lib/ml")).default;
        const embedder = await PipelineSingleton.getEmbedding();
        const out = await (embedder as any)(sanitizedText, { pooling: "mean", normalize: true });
        embeddingArray = Array.from(out.data) as number[];
        thoughtProcess.push("[Analyser Agent] 384-dimensional vector generated ✓");
      } catch {
        thoughtProcess.push("[Analyser Agent] Embedding failed — text retrieval fallback.");
      }
    }

    // ════════════════════════════════════════════════════════════
    // AGENT 2 — MANAGER COUNCIL
    // Role: Hybrid Search (BM25 + pgvector RRF), domain bidding
    // ════════════════════════════════════════════════════════════
    thoughtProcess.push("🏛️ [Manager Council] Convening — initiating Hybrid Search (BM25 + pgvector RRF, k=60)...");

    let similarDocs: any[] = [];
    let contextString = "";
    let domainBids: Record<string, number> = {};
    let winningBidCategory = "Infrastructure";

    if (supabase && embeddingArray) {
      try {
        // Primary: Hybrid RRF search
        const { data: rrfData, error: rrfErr } = await supabase.rpc("hybrid_search_tickets", {
          query_text: sanitizedText,
          query_embedding: embeddingArray,
        });
        if (rrfErr) throw rrfErr;

        similarDocs = rrfData || [];
        thoughtProcess.push(`[Manager Council] RRF retrieved ${similarDocs.length} top candidates.`);

        // Compute domain bid scores: sum RRF scores per category
        for (const doc of similarDocs) {
          domainBids[doc.category] = (domainBids[doc.category] || 0) + (doc.rrf_score || 0);
        }

        const topBid = Object.entries(domainBids).sort((a, b) => b[1] - a[1]);
        if (topBid.length > 0) {
          winningBidCategory = topBid[0][0];
          thoughtProcess.push(
            `[Manager Council] Domain bids: ${topBid.map(([cat, sc]) => `${cat}(${sc.toFixed(3)})`).join(" | ")}`
          );
          thoughtProcess.push(`[Manager Council] Winning bid: ${winningBidCategory} ✓`);
        }

        if (similarDocs.length > 0) {
          contextString = similarDocs
            .map((d: any) => `Category: ${d.category}\nIssue: ${d.sanitized_query}\nResolution: ${d.resolution_steps}`)
            .join("\n\n---\n\n");
        }
      } catch (rrfErr) {
        // Fallback to legacy vector search
        thoughtProcess.push("[Manager Council] RRF unavailable — falling back to pgvector search.");
        const { data, error } = await supabase.rpc("match_historical_tickets", {
          query_embedding: embeddingArray,
          match_threshold: 0.5,
          match_count: 5,
        });
        if (!error) {
          similarDocs = data || [];
          for (const doc of similarDocs) {
            domainBids[doc.category] = (domainBids[doc.category] || 0) + (doc.similarity || 0);
          }
          const topBid = Object.entries(domainBids).sort((a, b) => b[1] - a[1]);
          if (topBid.length > 0) winningBidCategory = topBid[0][0];
          
          if (similarDocs.length > 0) {
            contextString = similarDocs
              .map((d: any) => `Category: ${d.category}\nIssue: ${d.sanitized_query}\nResolution: ${d.resolution_steps}`)
              .join("\n\n---\n\n");
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════════
    // AGENT 3 — TRIAGE DECIDER
    // Role: ONNX inference, consensus check vs Manager bids (0.70 threshold)
    // ════════════════════════════════════════════════════════════
    thoughtProcess.push("⚖️ [Triage Decider] Running ONNX C++ inference engine...");

    let finalCategory = "Infrastructure";
    let finalConfidence = 0.5;
    let finalResolution = "System requires human escalation.";
    let finalPriority = "Medium";
    let onnxActive = false;

    if (embeddingArray) {
      // ── PATH A: Try ONNX first ───────────────────────────────
      let onnxResult: { category: string; confidence: number; allProbs: Record<string, number> } | null = null;
      try {
        const PipelineSingleton = (await import("@/lib/ml")).default;
        onnxResult = await PipelineSingleton.runONNXClassifier(embeddingArray);
      } catch { /* handled below */ }

      if (onnxResult) {
        onnxActive = true;
        finalCategory = onnxResult.category;
        finalConfidence = onnxResult.confidence;
        thoughtProcess.push(
          `[Triage Decider] ONNX classified: ${finalCategory} (confidence: ${(finalConfidence * 100).toFixed(1)}%)`
        );
      } else {
        // ONNX fallback: JSON LR weights
        thoughtProcess.push("[Triage Decider] ONNX unavailable — falling back to JSON LR weights.");
        const lrModel = lrModelData as any;
        const embedding = embeddingArray;
        const logits = lrModel.classes.map((cat: string, i: number) => {
          let z = lrModel.intercepts[i];
          for (let j = 0; j < embedding.length; j++) z += lrModel.weights[i][j] * embedding[j];
          return z;
        });
        const maxLogit = Math.max(...logits);
        const exps = logits.map((z: number) => Math.exp(z - maxLogit));
        const sum = exps.reduce((a: number, b: number) => a + b, 0);
        const probs = exps.map((e: number) => e / sum);
        
        finalConfidence = Math.max(...probs);
        finalCategory = lrModel.classes[probs.indexOf(finalConfidence)];
      }
    }

    // ════════════════════════════════════════════════════════════
    // AGENT 4 — SYNTHESIS LAYER & CONSENSUS GATE (0.70 Threshold)
    // ════════════════════════════════════════════════════════════
    let finalStatus = 'NEEDS_HUMAN';
    
    // Check if ONNX/Math confidence is high enough AND matches the DB's best guess
    if (finalConfidence >= 0.70 && finalCategory === winningBidCategory) {
      finalStatus = 'AUTO_RESOLVED';
      thoughtProcess.push(`🚀 [Synthesis Layer] Category approved. Retrieving Skill DAG for ${finalCategory}...`);
      
      let skillSteps = "No procedural skill found.";
      if (supabase) {
        const { data: skill } = await supabase.from('agentic_skills').select('*').eq('category', finalCategory).single();
        if (skill) skillSteps = `\n${skill.execution_steps}\n\n**Termination Criteria:** ${skill.termination_criteria}`;
      }

      if (useLLM && groq) {
        thoughtProcess.push("[Synthesis Layer] Cloud Mode Active: Groq Llama 3.3 dynamically formatting DAG...");
        try {
          const prompt = `You are the Synthesis Agent for an IT Helpdesk.
          User Issue: "${sanitizedText}"
          
          Format the following mandatory runbook steps to specifically address the user's issue. Do NOT invent new technical steps.
          Mandatory Runbook: ${skillSteps}
          
          Return EXACTLY a raw JSON object:
          {
            "priority": "Critical|High|Medium|Low",
            "resolution": "Markdown string of the tailored runbook"
          }`;

          const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: "json_object" }
          });
          const resp = JSON.parse(completion.choices[0]?.message?.content || '{}');
          finalResolution = resp.resolution || skillSteps;
          finalPriority = resp.priority || 'Medium';
          thoughtProcess.push("[Synthesis Layer] Resolution perfectly tailored via Cloud LLM ✓");
        } catch (e) {
           thoughtProcess.push("⚠ [Synthesis Layer] Groq API failed. Falling back to Air-Gapped output.");
           finalResolution = `**[SKILL ACTIVATED: OFFLINE MODE]**\n${skillSteps}`;
        }
      } else {
        thoughtProcess.push("[Synthesis Layer] Air-Gapped Mode Active: Executing deterministic DAG...");
        finalResolution = `**[SKILL ACTIVATED: OFFLINE MODE]**\n${skillSteps}`;
      }
    } else {
      thoughtProcess.push(`🛑 [Triage Decider] VETO. Confidence too low (${(finalConfidence * 100).toFixed(1)}%) or Bidding Mismatch. Escalating to Human L2.`);
    }

    // ════════════════════════════════════════════════════════════
    // OUTAGE DETECTION & DATABASE LOGGING
    // ════════════════════════════════════════════════════════════
    let repeatCount = 0;
    let automationSuggested = false;

    if (supabase && embeddingArray) {
      try {
        const { data: similarCountData } = await supabase.rpc('count_similar_live_tickets_vector', {
          query_embedding: `[${embeddingArray.join(',')}]`,
          target_category: finalCategory,
          match_threshold: 0.85,
          hours_back: 72
        });
        
        repeatCount = similarCountData || 0;
        
        if (repeatCount >= 3) {
          automationSuggested = true;
          thoughtProcess.push(`⚡ [Overwatch] Anomaly detected: ${repeatCount} similar ${finalCategory} tickets in 72h.`);
          thoughtProcess.push("⚡ [Overwatch] Halting queue. Auto-drafting Master Incident Report...");
          
          // Basic insertion for the Master Incident
          await supabase.from('master_incidents').insert({
            category: finalCategory,
            triggering_ticket_text: sanitizedText,
            incident_summary: `Widespread ${finalCategory} anomaly detected based on vector clustering.`,
            mass_communication_draft: "We are currently experiencing an issue. Engineering is investigating.",
            remediation_runbook: finalResolution,
            related_ticket_count: repeatCount
          });
        }
      } catch (e) {
         console.warn("Outage detection failed", e);
      }
    }

    if (supabase) {
      await supabase.from('live_tickets').insert({
        category: finalCategory,
        priority: finalPriority,
        original_redacted_text: sanitizedText,
        confidence_score: finalConfidence,
        status: finalStatus,
        repeat_count: repeatCount,
        automation_suggested: automationSuggested,
        embedding: embeddingArray ? `[${embeddingArray.join(',')}]` : null
      });
    }

    return NextResponse.json({
      status: finalStatus === 'NEEDS_HUMAN' ? 'ESCALATED' : 'SUCCESS',
      category: finalCategory,
      priority: finalPriority,
      sanitizedText: sanitizedText,
      resolution: finalStatus === 'NEEDS_HUMAN' ? null : finalResolution,
      confidenceScore: finalConfidence,
      repeatCount: repeatCount,
      automationSuggested: automationSuggested,
      thoughtProcess: thoughtProcess
    });

  } catch (err: any) {
    console.error("Council orchestration error:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err?.message }, { status: 500 });
  }
}
