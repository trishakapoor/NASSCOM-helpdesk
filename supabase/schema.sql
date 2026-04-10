-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop tables if they exist to allow clean runs
DROP TABLE IF EXISTS historical_tickets;
DROP TABLE IF EXISTS live_tickets;

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
  original_redacted_text text NOT NULL,
  confidence_score float8 NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
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
