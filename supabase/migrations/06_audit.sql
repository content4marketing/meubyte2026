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
