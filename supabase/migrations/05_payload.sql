-- MeuByte MVP - Migration 05: Session Payload (Encrypted Fields)
-- Based on BLUEPRINT.md sections 11, 13

-- Session payload fields (encrypted values per session)
CREATE TABLE session_payload_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  template_field_id UUID NOT NULL REFERENCES template_fields(id),
  field_slug VARCHAR(50) NOT NULL, -- Denormalized for faster lookups
  value_ciphertext TEXT NOT NULL, -- AES-256-GCM encrypted with session's data key
  iv TEXT NOT NULL, -- Initialization vector
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_session_payload_fields_session_id ON session_payload_fields(session_id);
CREATE INDEX idx_session_payload_fields_field_slug ON session_payload_fields(field_slug);

-- RLS Policies - CRITICAL: No direct SELECT allowed
ALTER TABLE session_payload_fields ENABLE ROW LEVEL SECURITY;

-- NO SELECT policy - all access must go through Edge Functions
-- This ensures every field reveal is logged

-- Only service role can insert (via Edge Functions)
-- No INSERT policy for regular users

-- Comment explaining security model
COMMENT ON TABLE session_payload_fields IS 
  'Stores encrypted field values for sessions. 
   Direct SELECT is blocked by RLS. 
   All reads must go through reveal_field Edge Function to ensure audit logging.
   Values are encrypted with session-specific data key (envelope encryption).';
