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
