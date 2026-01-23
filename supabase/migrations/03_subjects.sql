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
