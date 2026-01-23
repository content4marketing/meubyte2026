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
