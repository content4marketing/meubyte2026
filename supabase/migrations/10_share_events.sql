-- MeuByte MVP - Migration 10: Minimal Share Events (no personal data)
-- Records only metadata about sharing events.

CREATE TABLE share_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  event_type VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_events_org_id ON share_events(org_id);
CREATE INDEX idx_share_events_created_at ON share_events(created_at);
CREATE INDEX idx_share_events_event_type ON share_events(event_type);

ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can insert share events" ON share_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = share_events.org_id
      AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view share events" ON share_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = share_events.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );
