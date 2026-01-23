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
