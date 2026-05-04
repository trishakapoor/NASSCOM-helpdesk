-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop tables if they exist to allow clean runs
DROP TABLE IF EXISTS historical_tickets;
DROP TABLE IF EXISTS live_tickets;
DROP TABLE IF EXISTS master_incidents;

-- Table for RAG Context
CREATE TABLE historical_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  sanitized_query text NOT NULL,
  resolution_steps text NOT NULL,
  embedding vector(384) NOT NULL
);

-- Table for Triage Dashboard
CREATE TABLE live_tickets (
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
CREATE TABLE master_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  category text NOT NULL,
  triggering_ticket_text text NOT NULL,
  incident_summary text NOT NULL,
  mass_communication_draft text NOT NULL,
  remediation_runbook text NOT NULL,
  related_ticket_count int NOT NULL
);

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

-- Function to find similar live tickets (for repeat detection)
CREATE OR REPLACE FUNCTION count_similar_live_tickets (
  target_category text,
  target_text text,
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
    AND similarity(original_redacted_text, target_text) > 0.3;
  RETURN COALESCE(similar_count, 0);
EXCEPTION WHEN OTHERS THEN
  -- If pg_trgm not available, fallback to exact category count
  SELECT COUNT(*) INTO similar_count
  FROM live_tickets
  WHERE category = target_category
    AND created_at > now() - (hours_back || ' hours')::interval;
  RETURN COALESCE(similar_count, 0);
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
