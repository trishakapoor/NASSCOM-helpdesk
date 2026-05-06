-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════

-- Table for RAG Context (with Full-Text Search support)
CREATE TABLE IF NOT EXISTS historical_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  sanitized_query text NOT NULL,
  resolution_steps text NOT NULL,
  embedding vector(384) NOT NULL,
  sanitized_query_fts tsvector GENERATED ALWAYS AS (to_tsvector('english', sanitized_query)) STORED
);

-- GIN index for blazing fast full-text search
CREATE INDEX IF NOT EXISTS historical_tickets_fts_idx 
ON historical_tickets USING GIN (sanitized_query_fts);

-- Table for Triage Dashboard
CREATE TABLE IF NOT EXISTS live_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('AUTO_RESOLVED', 'NEEDS_HUMAN')),
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  original_redacted_text text NOT NULL,
  confidence_score float8 NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  repeat_count int NOT NULL DEFAULT 0,
  automation_suggested boolean NOT NULL DEFAULT false,
  embedding vector(384)
);

-- Table for Master Incidents (Agentic Layer)
CREATE TABLE IF NOT EXISTS master_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  category text NOT NULL,
  triggering_ticket_text text NOT NULL,
  incident_summary text NOT NULL,
  mass_communication_draft text NOT NULL,
  remediation_runbook text NOT NULL,
  related_ticket_count int NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- PROCEDURAL MEMORY: Agentic Skills Table
-- Each row is a deterministic "Skill DAG" that an Agent can execute
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agentic_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  applicability_logic text NOT NULL,
  execution_steps text NOT NULL,
  termination_criteria text NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- HYBRID SEARCH RPC: Reciprocal Rank Fusion (BM25 + pgvector)
-- Combines lexical keyword matching with semantic vector similarity
-- k=60 is the standard RRF constant from the Cormack et al. paper
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION hybrid_search_tickets(
  query_text text,
  query_embedding vector(384)
)
RETURNS TABLE (
  id uuid,
  category text,
  sanitized_query text,
  resolution_steps text,
  rrf_score float
)
LANGUAGE sql
AS $$
  WITH full_text_ranked AS (
    SELECT 
      ht.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ht.sanitized_query_fts, plainto_tsquery('english', query_text)) DESC) AS text_rank
    FROM historical_tickets ht
    WHERE ht.sanitized_query_fts @@ plainto_tsquery('english', query_text)
    LIMIT 20
  ),
  semantic_ranked AS (
    SELECT 
      ht.id,
      ht.category,
      ht.sanitized_query,
      ht.resolution_steps,
      ROW_NUMBER() OVER (ORDER BY ht.embedding <=> query_embedding ASC) AS vector_rank
    FROM historical_tickets ht
    LIMIT 20
  )
  SELECT 
    s.id,
    s.category,
    s.sanitized_query,
    s.resolution_steps,
    (COALESCE(1.0 / (60 + ft.text_rank), 0.0) + COALESCE(1.0 / (60 + s.vector_rank), 0.0)) AS rrf_score
  FROM semantic_ranked s
  LEFT JOIN full_text_ranked ft ON s.id = ft.id
  ORDER BY rrf_score DESC
  LIMIT 5;
$$;

-- ═══════════════════════════════════════════════════════════════
-- LEGACY FUNCTIONS (kept for backward compatibility)
-- ═══════════════════════════════════════════════════════════════

-- Vector Search Function
CREATE OR REPLACE FUNCTION match_historical_tickets (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  category text,
  sanitized_query text,
  resolution_steps text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    historical_tickets.id,
    historical_tickets.category,
    historical_tickets.sanitized_query,
    historical_tickets.resolution_steps,
    1 - (historical_tickets.embedding <=> query_embedding) AS similarity
  FROM historical_tickets
  WHERE 1 - (historical_tickets.embedding <=> query_embedding) > match_threshold
  ORDER BY historical_tickets.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector-based Repeat Detection Function
CREATE OR REPLACE FUNCTION count_similar_live_tickets_vector (
  query_embedding vector(384),
  target_category text,
  match_threshold float DEFAULT 0.85,
  hours_back int DEFAULT 72
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  similar_count int;
BEGIN
  SELECT COUNT(*) INTO similar_count
  FROM live_tickets
  WHERE category = target_category
    AND created_at > now() - (hours_back || ' hours')::interval
    AND 1 - (embedding <=> query_embedding) > match_threshold;
    
  RETURN COALESCE(similar_count, 0);
END;
$$;
