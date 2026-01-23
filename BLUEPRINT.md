# Project Blueprint (MVP)

## 1) Visão do produto
Aplicação para permitir que o titular compartilhe dados pessoais de forma segura e temporária com um estabelecimento, com minimização por template, preenchimento silencioso no celular e trilha de auditoria de acesso por campo. O sistema evita reter dados em claro no servidor sempre que possível. O valor principal é transferência ágil + registro confiável de acesso, não armazenamento central.

## 2) Objetivos do MVP
- Estabelecimento cria conta, unidade, usuários internos e templates.
- Estabelecimento define campos próprios, além do catálogo base.
- Atendimento inicia por QR Code ou token digitável.
- Titular seleciona template, auto preenche, completa e envia para fila.
- Titular exporta e importa backup cifrado da carteira (download/upload) para troca de dispositivo.
- Titular inicia compartilhamento e gera token/link de visualização (copiar/enviar via WhatsApp).
- Acesso público anônimo com registro mínimo do estabelecimento (nome), além do modo logado com logs completos.
- Atendente consome fila, assume item e revela campos sob demanda.
- Auditoria registra "revelou campo X" com contexto.
- Encerramento manual e por expiração, com extensão limitada.
- Titular vê histórico de sessões e campos acessados, e abre DSRs.

## 3) Não objetivos do MVP
- Integrações com prontuário, ERP, LIS, CRM.
- Motor avançado de formulários condicionais.
- Assinatura digital, biometria, KYC.
- E2E completo em todos os fluxos (fase 2).

## 4) Princípios de produto e engenharia
- Minimização: apenas campos do template e aprovados pelo titular.
- Efemeridade: payload expira e é limpo rapidamente.
- Auditoria por desenho: acesso útil sempre gera log.
- Privacidade por padrão: fila sem dados identificáveis.
- Segurança por camadas: RLS forte, tokens robustos, funções sensíveis via service role.
- Transparência: titular vê quem pede, o que pede, finalidade e prazo.
- Reprodutibilidade: eventos relevantes como append only.

## 5) Onboarding do estabelecimento

### Modelo: self-serve com guardrails
Opção de "invite only" disponível por feature flag.

### Fluxo self-serve
1. Admin cria conta via Supabase Auth (email OTP).
2. Wizard cria org, unit padrão, org_member admin.
3. Admin cria 1 template, gera o primeiro QR, já sai operando.

### Guardrails
- Limite de criação de org por domínio e por IP.
- Opcional: exigir email corporativo para liberar templates ilimitados.

Motivo: reduz custo operacional e acelera iteração do produto.

## 6) Personas e permissões
- Titular: cria e gerencia carteira, compartilha, vê histórico, abre DSR.
- Admin do estabelecimento: cria templates e campos, gerencia usuários, vê relatórios e fila.
- Atendente: consome fila, assume sessão, revela campos, encerra sessão.
- Estabelecimento anônimo: acessa página pública com token, informa nome, vê dados com logs mínimos.
- Operação interna (opcional no MVP): suporte e métricas sem acesso a dados em claro.

## 7) Stack e ambientes

### Região e alinhamento de latência
- **Supabase**: South America, São Paulo (AWS `sa-east-1`).
- **Vercel**: funções Next.js fixadas na região São Paulo (`gru1`).
- **Edge Functions**: para funções que falam muito com o Postgres, executar perto do banco via cabeçalho/parâmetro regional.

### Tecnologias
- Frontend: Next.js único repositório, duas experiências: painel e PWA do titular.
- Backend: Supabase (Postgres, Auth, RLS, Realtime, Edge Functions).

### Ambientes
- dev e prod obrigatórios.
- Staging opcional.

## 8) Apps e rotas (Next.js)
- Painel (web): `/org/*`
- Titular (PWA mobile-first): `/subject/*`
- Acesso público (web): `/public/*`
- Shared: componentes de campos, validações e UI de templates.

## 9) Fluxos principais
1. **Criação de template e campos**
   - Admin cria campo personalizado.
   - Admin cria template com base_fields + org_fields.
   - Template recebe code_short (ex: 01, 02).
2. **Início por QR ou token**
   - Painel cria intake com exp. curta.
   - QR contém URL do app do titular com intake_token opaco.
3. **Titular seleciona template e preenche**
   - Lista de templates disponíveis por unidade + org.
   - Auto preenchimento via carteira local + sync opcional cifrada.
   - Draft local no dispositivo; enviar para fila sobe payload.
4. **Compartilhamento iniciado pelo titular (token/link)**
   - Titular gera share_token e link de visualização após preencher.
   - Opções: copiar token/link ou enviar via WhatsApp (abre app com mensagem pré-preenchida; usuário escolhe contato ou digita número).
   - Estabelecimento acessa `/public` ou painel logado e informa o token.
   - Se público, sistema solicita nome do estabelecimento para registro mínimo; se logado, aplica logs completos e controles de acesso.
5. **Fila e consumo**
   - Sessão queued aparece na fila (ticket, template, horário).
   - Atendente faz claim atômico -> in_service.
   - Revelar campo chama Edge Function e registra log.
6. **Encerramento**
   - Manual ou expiração. Limpeza de payload agendada.

## 10) Dados do titular e criptografia

### Carteira local-first
- Armazenada em IndexedDB.
- Sync opcional cifrada no Supabase para titulares logados.
- Export/import de backup cifrado por arquivo (download/upload) para migração de dispositivo.

### KDF da passphrase (PBKDF2)
- **Algoritmo**: PBKDF2-HMAC-SHA-256 via WebCrypto (compatibilidade universal em PWA).
- **Iterações**: 600.000 como alvo de segurança, ajustável para performance em mobile (manter derivação entre 150-400ms por dispositivo). Mínimo hardcoded: 100.000.
- **Salt**: 16-32 bytes randômicos por vault.
- **Key output**: 32 bytes para AES-256-GCM.

### Recuperação
- Modelo "zero knowledge": passphrase perdida = perda do backup cifrado.
- Recovery kit opcional: export local como arquivo cifrado para download e import posterior.
- Aviso claro ao usuário sobre impossibilidade de recuperação server-side.

## 11) Criptografia do session_payload_fields

### MVP: Envelope encryption (seguro, implementável)
1. Gerar uma **data key** por sessão no client do titular.
2. Cifrar os valores com AES-GCM usando essa data key.
3. Cifrar a data key com uma **master key do backend** (secret nas Edge Functions).
4. Salvar o envelope no banco.

**Armazenar:**
- `session_payload_fields.value_ciphertext`
- `sessions.payload_key_encrypted`
- `sessions.payload_key_kms_version`
- `sessions.payload_crypto_version` (facilita rotação de algoritmos)

O Postgres nunca recebe valores em claro, só ciphertext.

### Fase 2: E2E real
- Trocar `payload_key_encrypted` para envelope cifrado com chave pública do estabelecimento.
- `reveal_field` retorna ciphertext e o browser do estabelecimento decifra localmente.

## 12) Identidade do titular
- Sem login para check-in: `subject_anon_id` local em IndexedDB.
- Login opcional via OTP: cria `subject_id` estável.
- Link de identidade:
  - Tabela `subject_identities` (subject_id, anon_id, device_fingerprint opcional).
  - Funções para promover anon -> auth, migrar sessões recentes e subir carteira.

## 13) Modelo de dados (resumo)

**Organização e usuários:**
- orgs, org_units, org_members

**Catálogo de campos:**
- base_fields, org_fields

**Templates:**
- templates, template_fields

**Titular:**
- subjects, subject_values (opcional no MVP, cifrado)

**Intake e sessões:**
- intakes, intake_templates, sessions, share_tokens

**Payload:**
- session_payload_fields (value_ciphertext)

**Auditoria:**
- access_logs (append only; inclui actor_name no modo público), session_events (opcional)

**DSR:**
- dsr_requests, dsr_messages (opcional)

**Outros:**
- subject_identities, rate_limits (se usar tabela)

## 14) RLS e segurança
- org_* e templates: apenas membros da org, por role.
- subjects/subject_values: apenas o próprio titular.
- session_payload_fields: sem SELECT direto; somente via Edge Functions.
- access_logs: escrita via funções; leitura para admin.
- acesso público: somente via Edge Functions com share_token + estabelecimento_nome; logs mínimos e sem SELECT direto.
- Isolamento por org_id e unit_id em todas as tabelas.

## 15) Edge Functions (MVP)
- `create_intake`
- `list_intake_templates`
- `start_session_draft`
- `save_session_draft_fields`
- `submit_session_to_queue`
- `create_share_token`
- `public_view_start` (valida token e registra estabelecimento_nome)
- `public_reveal_field` (loga acesso por campo no modo público)
- `list_queue`
- `claim_session`
- `get_session_overview_for_attendant`
- `reveal_field` (com log, suporta `mode` parameter)
- `extend_session`
- `end_session`
- `dsr_create_request`, `dsr_list`, `dsr_reply`
- `link_identity` (anon -> auth)

### reveal_field: modos de descriptografia
- **MVP**: `mode=edge_decrypt` — autenticação, autorização, valida template, valida claim, registra log, decifra no edge, retorna em claro.
- **Fase 2**: `mode=client_decrypt` — retorna ciphertext e envelope da key para browser do estabelecimento decifrar.

Bloqueio: select direto do payload por RLS; sem rota que bypass logs.

## 16) Tokens, QR e tickets

### Formato
- **intake_token**: Crockford Base32, 128 bits, com 1 check digit no final.
- **share_token**: mesmo formato do intake_token, TTL conforme tabela; armazenar hash.
- **Formato segmentado**: `ABCD-EFGH-IJKL-X` (12 chars + checksum).
- **Equivalências aceitas**: O↔0, I↔1 (reduz suporte).

### URLs e QR
- QR contém apenas URL com intake_token.
- Link de compartilhamento: URL pública com share_token (usado em copiar e WhatsApp).
- TTL curto (10 min) para intake_token/QR.

### ticket_code
- 3-6 chars, não sequencial.

## 17) Rate limit (MVP)

### Token inválido
| Contexto | Limite | Ação |
|----------|--------|------|
| Device | 10/10min | Block 10min |
| IP | 20/10min | Block 10min |
| intake_token | 30/10min | Invalida intake |
| share_token | 30/10min | Invalida share_token |

### Reveal
| Contexto | Limite |
|----------|--------|
| Por atendente por minuto | 30 (burst controlado) |
| Por atendente por sessão | 120 |
| Total por sessão | 200 |

Todos parametrizáveis via env.

## 18) Expiração e limpeza

### TTLs
| Elemento | TTL |
|----------|-----|
| intake | 10 min |
| session draft | local 24h |
| queued | 30 min |
| in_service | 15 min |
| share_token | 30 min (ou até encerramento) |

### Extensão padrão
- 1 vez, +10 min, sem reconsentimento.

### Admin override (exceção)
- Permitir mais uma extensão com:
  - Limite total: +30 min máximo por sessão.
  - Justificativa obrigatória.
  - Log: `action=extend_admin_override`.
  - Notificação ao titular (ideal, não obrigatório no MVP).

### Limpeza de payload
- 5-15 min após ended/expired.
- queued/in_service expirada: até 1h.

## 19) Base fields (seed inicial)

### Não sensíveis por padrão
- full_name
- cpf (alta criticidade, **sempre mascarar na UI**)
- birth_date
- email
- phone
- address_line
- city
- state
- postal_code

### Opcionais
- emergency_contact_name
- emergency_contact_phone

### Sensíveis (usar org_fields, não base)
- medication_in_use
- allergies
- health_notes

## 20) Retenção de logs

| Tipo | Retenção |
|------|----------|
| access_logs | 2 anos |
| session_events | 6-12 meses (opcional) |
| payload | Minutos/horas, limpeza automática, idealmente no mesmo dia |
| dsr_requests | 2 anos ou conforme política |

## 21) Relatórios e export (MVP)

### Consulta
- Tela de consulta filtrável para admin.
- Filtros: período, template, atendente, status.

### Export
- CSV opcional.
- Job assíncrono com limites.
- Apenas admin autorizado.

## 22) Realtime e canais

### Tecnologia
- **Postgres Changes** (não Broadcast no MVP).

### Fila do estabelecimento
- Tabela: `sessions`
- Filtros: `org_id`, `unit_id`, `status=queued`

### Sessão do titular
- Filtro: `session_id`

Broadcast reservado para fase 2 se necessário eventos sem persistência.

## 23) Roadmap fase 2
- E2E completo do payload com chave efêmera do estabelecimento.
- `reveal_field` com `mode=client_decrypt`.
- Recuperação segura de passphrase sem backdoor.
- Regras condicionais de formulário e integrações externas.
- Broadcast para eventos transientes.
