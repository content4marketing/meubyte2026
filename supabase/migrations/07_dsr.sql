-- MeuByte MVP - Migration 07: DSR and Rate Limits
-- Based on BLUEPRINT.md sections 13, 17

-- Enum for DSR types
CREATE TYPE dsr_type AS ENUM ('access', 'correction', 'deletion', 'portability');
CREATE TYPE dsr_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected');

-- DSR Requests (Data Subject Rights)
CREATE TABLE dsr_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type dsr_type NOT NULL,
  status dsr_status NOT NULL DEFAULT 'pending',
  description TEXT,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES org_members(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DSR Messages (communication thread)
CREATE TABLE dsr_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dsr_request_id UUID NOT NULL REFERENCES dsr_requests(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL, -- 'subject' or 'org'
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limits (for token validation and reveal actions)
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL, -- e.g., "ip:1.2.3.4", "device:xyz", "token:abc"
  context VARCHAR(50) NOT NULL, -- 'token_invalid', 'reveal'
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(key, context)
);

-- Indexes
CREATE INDEX idx_dsr_requests_subject_id ON dsr_requests(subject_id);
CREATE INDEX idx_dsr_requests_org_id ON dsr_requests(org_id);
CREATE INDEX idx_dsr_requests_status ON dsr_requests(status);
CREATE INDEX idx_dsr_requests_created_at ON dsr_requests(created_at);
CREATE INDEX idx_dsr_messages_dsr_request_id ON dsr_messages(dsr_request_id);
CREATE INDEX idx_rate_limits_key_context ON rate_limits(key, context);
CREATE INDEX idx_rate_limits_blocked_until ON rate_limits(blocked_until);

-- Updated at trigger for dsr_requests
CREATE TRIGGER dsr_requests_updated_at
  BEFORE UPDATE ON dsr_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE dsr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- DSR Requests: subjects can view their own requests
CREATE POLICY "Subjects can view their DSR requests" ON dsr_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subjects 
      WHERE subjects.id = dsr_requests.subject_id 
      AND subjects.user_id = auth.uid()
    )
  );

-- DSR Requests: subjects can create requests
CREATE POLICY "Subjects can create DSR requests" ON dsr_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM subjects 
      WHERE subjects.id = dsr_requests.subject_id 
      AND subjects.user_id = auth.uid()
    )
  );

-- DSR Requests: admins can view/manage requests for their org
CREATE POLICY "Admins can view org DSR requests" ON dsr_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = dsr_requests.org_id 
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can update org DSR requests" ON dsr_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = dsr_requests.org_id 
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

-- DSR Messages: can be viewed by request participants
CREATE POLICY "Participants can view DSR messages" ON dsr_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dsr_requests dr
      LEFT JOIN subjects s ON s.id = dr.subject_id
      LEFT JOIN org_members om ON om.org_id = dr.org_id
      WHERE dr.id = dsr_messages.dsr_request_id
      AND (s.user_id = auth.uid() OR (om.user_id = auth.uid() AND om.role = 'admin'))
    )
  );

-- DSR Messages: participants can add messages
CREATE POLICY "Participants can add DSR messages" ON dsr_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dsr_requests dr
      LEFT JOIN subjects s ON s.id = dr.subject_id
      LEFT JOIN org_members om ON om.org_id = dr.org_id
      WHERE dr.id = dsr_messages.dsr_request_id
      AND (s.user_id = auth.uid() OR (om.user_id = auth.uid() AND om.role = 'admin'))
    )
  );

-- Rate limits: no direct access - managed by Edge Functions with service role
-- No policies = no access for regular users

-- Comments
COMMENT ON TABLE dsr_requests IS 
  'Data Subject Rights requests per LGPD/GDPR.
   Retention: 2 years per BLUEPRINT.md section 20.';

COMMENT ON TABLE rate_limits IS 
  'Rate limiting storage per BLUEPRINT.md section 17.
   Managed exclusively by Edge Functions with service role.';
