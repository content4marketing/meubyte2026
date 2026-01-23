-- MeuByte MVP - Migration 01: Organizations
-- Based on BLUEPRINT.md section 13

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for member roles
CREATE TYPE org_member_role AS ENUM ('admin', 'attendant');

-- Organizations table
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization units (locations/branches)
CREATE TABLE org_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (users with roles)
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'attendant',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_units_org_id ON org_units(org_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orgs_updated_at
  BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- Orgs: members can read their own org
CREATE POLICY "Members can view their org" ON orgs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = orgs.id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Orgs: admins can update their org
CREATE POLICY "Admins can update their org" ON orgs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = orgs.id 
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

-- Orgs: authenticated users can create orgs (onboarding)
CREATE POLICY "Authenticated users can create orgs" ON orgs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Units: members can view units in their org
CREATE POLICY "Members can view org units" ON org_units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = org_units.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Units: admins can manage units
CREATE POLICY "Admins can manage org units" ON org_units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = org_units.org_id 
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

-- Members: members can view other members in their org
CREATE POLICY "Members can view org members" ON org_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members AS om
      WHERE om.org_id = org_members.org_id 
      AND om.user_id = auth.uid()
    )
  );

-- Members: admins can manage members
CREATE POLICY "Admins can manage org members" ON org_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members AS om
      WHERE om.org_id = org_members.org_id 
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Members: users can insert themselves during onboarding
CREATE POLICY "Users can create their own membership" ON org_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- MeuByte MVP - Migration 02: Fields and Templates
-- Based on BLUEPRINT.md sections 13, 19

-- Enum for field types
CREATE TYPE field_type AS ENUM ('text', 'email', 'phone', 'date', 'cpf', 'address', 'select', 'textarea');

-- Base fields catalog (system-wide)
CREATE TABLE base_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  type field_type NOT NULL,
  is_sensitive BOOLEAN DEFAULT FALSE,
  mask_pattern VARCHAR(50), -- e.g., '###.###.###-##' for CPF
  validation_regex VARCHAR(255),
  placeholder VARCHAR(255),
  help_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization custom fields
CREATE TABLE org_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  slug VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  type field_type NOT NULL,
  is_sensitive BOOLEAN DEFAULT FALSE,
  options JSONB, -- For select type: ["option1", "option2"]
  placeholder VARCHAR(255),
  help_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

-- Templates
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  code_short VARCHAR(10) NOT NULL, -- e.g., "01", "02"
  description TEXT,
  purpose TEXT, -- Why data is being collected (transparency)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code_short)
);

-- Template fields (linking templates to base/org fields)
CREATE TABLE template_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  base_field_id UUID REFERENCES base_fields(id),
  org_field_id UUID REFERENCES org_fields(id),
  is_required BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  purpose TEXT, -- Why this specific field is needed
  CONSTRAINT one_field_type CHECK (
    (base_field_id IS NOT NULL AND org_field_id IS NULL) OR
    (base_field_id IS NULL AND org_field_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_org_fields_org_id ON org_fields(org_id);
CREATE INDEX idx_templates_org_id ON templates(org_id);
CREATE INDEX idx_templates_unit_id ON templates(unit_id);
CREATE INDEX idx_template_fields_template_id ON template_fields(template_id);

-- Updated at trigger for templates
CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE base_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_fields ENABLE ROW LEVEL SECURITY;

-- Base fields: everyone can read (public catalog)
CREATE POLICY "Anyone can view base fields" ON base_fields
  FOR SELECT USING (true);

-- Org fields: members can view their org's fields
CREATE POLICY "Members can view org fields" ON org_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = org_fields.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Org fields: admins can manage
CREATE POLICY "Admins can manage org fields" ON org_fields
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = org_fields.org_id 
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

-- Templates: members can view their org's templates
CREATE POLICY "Members can view templates" ON templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = templates.org_id 
      AND org_members.user_id = auth.uid()
    )
  );

-- Templates: admins can manage
CREATE POLICY "Admins can manage templates" ON templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = templates.org_id 
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

-- Template fields: same as templates
CREATE POLICY "Members can view template fields" ON template_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM templates t
      JOIN org_members om ON om.org_id = t.org_id
      WHERE t.id = template_fields.template_id 
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage template fields" ON template_fields
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM templates t
      JOIN org_members om ON om.org_id = t.org_id
      WHERE t.id = template_fields.template_id 
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );
-- MeuByte MVP - Migration 03: Subjects (Data Holders)
-- Based on BLUEPRINT.md sections 12, 13

-- Subjects table (data holders/titulares)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional for logged in subjects
  anon_id VARCHAR(64) NOT NULL, -- Local anonymous ID from IndexedDB
  email VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subject values (encrypted local wallet sync)
CREATE TABLE subject_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  field_slug VARCHAR(50) NOT NULL,
  value_encrypted TEXT NOT NULL, -- Encrypted with subject's passphrase (PBKDF2 + AES-GCM)
  iv TEXT NOT NULL, -- Initialization vector for decryption
  salt TEXT NOT NULL, -- Salt for PBKDF2
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, field_slug)
);

-- Subject identities (linking anonymous to authenticated)
CREATE TABLE subject_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  anon_id VARCHAR(64) NOT NULL,
  device_fingerprint VARCHAR(255),
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, anon_id)
);

-- Indexes
CREATE INDEX idx_subjects_user_id ON subjects(user_id);
CREATE INDEX idx_subjects_anon_id ON subjects(anon_id);
CREATE INDEX idx_subject_values_subject_id ON subject_values(subject_id);
CREATE INDEX idx_subject_identities_subject_id ON subject_identities(subject_id);
CREATE INDEX idx_subject_identities_anon_id ON subject_identities(anon_id);

-- Updated at trigger for subject_values
CREATE TRIGGER subject_values_updated_at
  BEFORE UPDATE ON subject_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_identities ENABLE ROW LEVEL SECURITY;

-- Subjects: users can only view/manage their own data
CREATE POLICY "Users can view their own subject" ON subjects
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own subject" ON subjects
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subject" ON subjects
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Subject values: users can only access their own values
CREATE POLICY "Users can view their own values" ON subject_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subjects 
      WHERE subjects.id = subject_values.subject_id 
      AND subjects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own values" ON subject_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM subjects 
      WHERE subjects.id = subject_values.subject_id 
      AND subjects.user_id = auth.uid()
    )
  );

-- Subject identities: users can only access their own identities
CREATE POLICY "Users can view their own identities" ON subject_identities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subjects 
      WHERE subjects.id = subject_identities.subject_id 
      AND subjects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own identities" ON subject_identities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM subjects 
      WHERE subjects.id = subject_identities.subject_id 
      AND subjects.user_id = auth.uid()
    )
  );
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
-- MeuByte MVP - Migration 06: Audit Logs
-- Based on BLUEPRINT.md sections 14, 20

-- Access logs (append-only audit trail)
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  field_slug VARCHAR(50), -- NULL for non-field actions like 'view_overview'
  action VARCHAR(50) NOT NULL, -- 'reveal', 'extend', 'end', 'view_overview', 'extend_admin_override'
  actor_type VARCHAR(20) NOT NULL, -- 'member' or 'public'
  actor_id UUID REFERENCES org_members(id), -- For logged users
  actor_name VARCHAR(255), -- For public access (establishment name)
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}', -- Extra context (e.g., extension reason)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session events (optional, more granular events)
CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'submitted', 'claimed', 'extended', 'ended', 'expired'
  actor_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_access_logs_session_id ON access_logs(session_id);
CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX idx_access_logs_actor_id ON access_logs(actor_id);
CREATE INDEX idx_access_logs_action ON access_logs(action);
CREATE INDEX idx_session_events_session_id ON session_events(session_id);
CREATE INDEX idx_session_events_created_at ON session_events(created_at);
CREATE INDEX idx_session_events_event_type ON session_events(event_type);

-- RLS Policies
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

-- Access logs: admins can view logs for their org's sessions
CREATE POLICY "Admins can view access logs" ON access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN org_members om ON om.org_id = s.org_id
      WHERE s.id = access_logs.session_id 
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Access logs: subjects can view logs for their sessions
CREATE POLICY "Subjects can view their access logs" ON access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN subjects sub ON sub.id = s.subject_id
      WHERE s.id = access_logs.session_id 
      AND sub.user_id = auth.uid()
    )
  );

-- Access logs: NO UPDATE/DELETE - append only
-- Inserts only via service role (Edge Functions)

-- Session events: similar to access logs
CREATE POLICY "Admins can view session events" ON session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN org_members om ON om.org_id = s.org_id
      WHERE s.id = session_events.session_id 
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

CREATE POLICY "Subjects can view their session events" ON session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN subjects sub ON sub.id = s.subject_id
      WHERE s.id = session_events.session_id 
      AND sub.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE access_logs IS 
  'Append-only audit trail for field access and session actions.
   Retention: 2 years per BLUEPRINT.md section 20.
   All writes via Edge Functions with service role.';

COMMENT ON TABLE session_events IS 
  'Optional granular session lifecycle events.
   Retention: 6-12 months per BLUEPRINT.md section 20.';

-- Function to prevent updates/deletes on audit tables
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit tables are append-only. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_logs_prevent_update
  BEFORE UPDATE ON access_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER access_logs_prevent_delete
  BEFORE DELETE ON access_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER session_events_prevent_update
  BEFORE UPDATE ON session_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER session_events_prevent_delete
  BEFORE DELETE ON session_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
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
-- MeuByte MVP - Seed Data
-- Based on BLUEPRINT.md section 19

-- Base fields catalog (system-wide standard fields)
INSERT INTO base_fields (slug, label, type, is_sensitive, mask_pattern, validation_regex, placeholder, help_text) VALUES
  -- Non-sensitive by default
  ('full_name', 'Nome Completo', 'text', FALSE, NULL, '^[A-Za-zÀ-ÿ\s]{2,100}$', 'Digite seu nome completo', 'Nome conforme documento de identidade'),
  
  ('cpf', 'CPF', 'cpf', FALSE, '###.###.###-##', '^\d{11}$', '000.000.000-00', 'CPF do titular - sempre mascarado na visualização'),
  
  ('birth_date', 'Data de Nascimento', 'date', FALSE, NULL, NULL, 'DD/MM/AAAA', 'Data de nascimento completa'),
  
  ('email', 'E-mail', 'email', FALSE, NULL, '^[^\s@]+@[^\s@]+\.[^\s@]+$', 'seu@email.com', 'E-mail para contato'),
  
  ('phone', 'Telefone', 'phone', FALSE, '(##) #####-####', '^\d{10,11}$', '(11) 99999-9999', 'Telefone celular com DDD'),
  
  ('address_line', 'Endereço', 'address', FALSE, NULL, NULL, 'Rua, número, complemento', 'Endereço completo'),
  
  ('city', 'Cidade', 'text', FALSE, NULL, NULL, 'São Paulo', 'Nome da cidade'),
  
  ('state', 'Estado', 'select', FALSE, NULL, NULL, NULL, 'Estado (UF)'),
  
  ('postal_code', 'CEP', 'text', FALSE, '#####-###', '^\d{8}$', '00000-000', 'Código de Endereçamento Postal'),

  -- Optional fields
  ('emergency_contact_name', 'Contato de Emergência - Nome', 'text', FALSE, NULL, NULL, 'Nome do contato', 'Pessoa para contato em caso de emergência'),
  
  ('emergency_contact_phone', 'Contato de Emergência - Telefone', 'phone', FALSE, '(##) #####-####', '^\d{10,11}$', '(11) 99999-9999', 'Telefone do contato de emergência');

-- Note: Sensitive fields (medication_in_use, allergies, health_notes) 
-- should be created as org_fields by each organization, not as base_fields
-- This follows BLUEPRINT.md section 19 guidelines

-- State options (for select field)
-- This would typically be stored in the field's options JSON
-- Example: UPDATE base_fields SET options = '["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]' WHERE slug = 'state';

COMMENT ON TABLE base_fields IS 
  'System-wide base fields catalog.
   Non-sensitive fields per BLUEPRINT.md section 19.
   Sensitive health fields should be org_fields, not base_fields.';
