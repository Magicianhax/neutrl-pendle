-- TVL Snapshots Table
-- Run this in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS tvl_snapshots (
  id SERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  captured_at_unix BIGINT NOT NULL,
  summary JSONB NOT NULL,
  table_condensed JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for time-based queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at
ON tvl_snapshots(captured_at DESC);

-- Index for unix timestamp queries
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at_unix
ON tvl_snapshots(captured_at_unix DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE tvl_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (anyone can view snapshots)
CREATE POLICY "Allow public read access"
ON tvl_snapshots
FOR SELECT
TO public
USING (true);

-- Policy: Allow service role to insert (for scheduled jobs)
CREATE POLICY "Allow service role insert"
ON tvl_snapshots
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Allow authenticated users to insert (optional, for admin panel)
CREATE POLICY "Allow authenticated insert"
ON tvl_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON tvl_snapshots TO anon;
GRANT SELECT ON tvl_snapshots TO authenticated;
GRANT ALL ON tvl_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE tvl_snapshots_id_seq TO service_role;
