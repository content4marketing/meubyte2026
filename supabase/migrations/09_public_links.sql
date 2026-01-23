-- MeuByte MVP - Migration 09: Public Link Access + Org Public Profile
-- Enables public read for link flow without exposing sensitive org data

-- Add establishment identity fields
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS document VARCHAR(20);

-- Public profile table (safe subset for public link flow)
CREATE TABLE IF NOT EXISTS org_public_profiles (
  org_id UUID PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE org_public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view org public profiles" ON org_public_profiles
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert org public profiles" ON org_public_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_public_profiles.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can update org public profiles" ON org_public_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_public_profiles.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete org public profiles" ON org_public_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_public_profiles.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'admin'
    )
  );

-- Public access to active templates and their fields
CREATE POLICY "Public can view active templates" ON templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view fields for active templates" ON template_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM templates t
      WHERE t.id = template_fields.template_id
      AND t.is_active = true
    )
  );

CREATE POLICY "Public can view org fields used in active templates" ON org_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM template_fields tf
      JOIN templates t ON t.id = tf.template_id
      WHERE tf.org_field_id = org_fields.id
      AND t.is_active = true
    )
  );
