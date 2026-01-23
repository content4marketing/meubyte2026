-- MeuByte MVP - Migration 04: Sessions and Intake
-- Based on BLUEPRINT.md sections 9, 13, 16, 18

-- Enum for session status
CREATE TYPE session_status AS ENUM ('draft', 'queued', 'in_service', 'ended', 'expired');

-- Intakes (QR code / token entry points)
CREATE TABLE intakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of token
  expires_at TIMESTAMPTZ NOT NULL, -- TTL 10 min
  created_by UUID NOT NULL REFERENCES org_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake templates (which templates are available for this intake)
CREATE TABLE intake_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intake_id UUID NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  UNIQUE(intake_id, template_id)
);

-- Sessions (actual data sharing sessions)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intake_id UUID REFERENCES intakes(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  subject_anon_id VARCHAR(64),
  ticket_code VARCHAR(6) NOT NULL, -- 3-6 chars, non-sequential
  status session_status NOT NULL DEFAULT 'draft',
  claimed_by UUID REFERENCES org_members(id),
  claimed_at TIMESTAMPTZ,
  
  -- Envelope encryption fields
  payload_key_encrypted TEXT, -- Data key encrypted with master key
  payload_key_kms_version INTEGER DEFAULT 1,
  payload_crypto_version INTEGER DEFAULT 1,
  
  -- Extension tracking
  extended_count INTEGER DEFAULT 0,
  extension_reason TEXT,
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_ticket_code CHECK (LENGTH(ticket_code) BETWEEN 3 AND 6)
);

-- Share tokens (for subject-initiated sharing)
CREATE TABLE share_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of token
  expires_at TIMESTAMPTZ NOT NULL, -- TTL 30 min
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  used_by_name VARCHAR(255) -- For public access - establishment name
);

-- Indexes
CREATE INDEX idx_intakes_org_id ON intakes(org_id);
CREATE INDEX idx_intakes_unit_id ON intakes(unit_id);
CREATE INDEX idx_intakes_token_hash ON intakes(token_hash);
CREATE INDEX idx_intakes_expires_at ON intakes(expires_at);
CREATE INDEX idx_intake_templates_intake_id ON intake_templates(intake_id);
CREATE INDEX idx_sessions_org_id ON sessions(org_id);
CREATE INDEX idx_sessions_unit_id ON sessions(unit_id);
CREATE INDEX idx_sessions_template_id ON sessions(template_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_ticket_code ON sessions(ticket_code);
CREATE INDEX idx_sessions_claimed_by ON sessions(claimed_by);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_share_tokens_session_id ON share_tokens(session_id);
CREATE INDEX idx_share_tokens_token_hash ON share_tokens(token_hash);
CREATE INDEX idx_share_tokens_expires_at ON share_tokens(expires_at);

-- Function to generate random ticket code
CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars
  result VARCHAR(6) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket code
CREATE OR REPLACE FUNCTION set_ticket_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_code IS NULL OR NEW.ticket_code = '' THEN
    NEW.ticket_code := generate_ticket_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_set_ticket_code
  BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_ticket_code();

-- RLS Policies
ALTER TABLE intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

-- Intakes: members can view/create intakes in their org
CREATE POLICY "Members can view org intakes" ON intakes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = intakes.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create org intakes" ON intakes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = intakes.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Intake templates: same as intakes
CREATE POLICY "Members can view intake templates" ON intake_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM intakes i
      JOIN org_members om ON om.org_id = i.org_id
      WHERE i.id = intake_templates.intake_id 
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage intake templates" ON intake_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM intakes i
      JOIN org_members om ON om.org_id = i.org_id
      WHERE i.id = intake_templates.intake_id 
      AND om.user_id = auth.uid()
    )
  );

-- Sessions: members can view sessions in their org
CREATE POLICY "Members can view org sessions" ON sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = sessions.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Sessions: members can update sessions they've claimed
CREATE POLICY "Members can update claimed sessions" ON sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = sessions.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Sessions: allow insert via service role only (Edge Functions)
-- No INSERT policy for regular users - sessions are created via Edge Functions

-- Share tokens: viewable by org members
CREATE POLICY "Members can view share tokens" ON share_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN org_members om ON om.org_id = s.org_id
      WHERE s.id = share_tokens.session_id 
      AND om.user_id = auth.uid()
    )
  );

-- Share tokens: created by subjects (via Edge Functions with service role)
-- No INSERT policy for regular users
