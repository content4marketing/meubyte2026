-- MeuByte MVP - Migration 08: Subject Self-Shares
-- For subject-initiated sharing without organization involvement

-- Subject shares (direct sharing from subject to public)
CREATE TABLE subject_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of token
  subject_anon_id VARCHAR(64) NOT NULL, -- Anonymous ID of subject
  data_encrypted TEXT NOT NULL, -- JSON wallet data encrypted with token
  expires_at TIMESTAMPTZ NOT NULL, -- TTL 30 min
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accessed_at TIMESTAMPTZ, -- When first accessed
  access_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_subject_shares_token_hash ON subject_shares(token_hash);
CREATE INDEX idx_subject_shares_expires_at ON subject_shares(expires_at);
CREATE INDEX idx_subject_shares_anon_id ON subject_shares(subject_anon_id);

-- RLS - Public can read by token, anyone can insert (anonymous)
ALTER TABLE subject_shares ENABLE ROW LEVEL SECURITY;

-- Anyone can read (need token hash to access)
CREATE POLICY "Public can view shares by token" ON subject_shares
  FOR SELECT USING (true);

-- Anyone can insert (anonymous sharing)
CREATE POLICY "Anyone can create shares" ON subject_shares
  FOR INSERT WITH CHECK (true);

-- Anyone can update (to mark as accessed)
CREATE POLICY "Anyone can update shares" ON subject_shares
  FOR UPDATE USING (true);

-- Cleanup function for expired shares (call via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM subject_shares WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE subject_shares IS 
  'Direct subject-to-public shares. Data is encrypted client-side before storage.
   Auto-cleanup of expired records should be scheduled via pg_cron or Edge Function.';
