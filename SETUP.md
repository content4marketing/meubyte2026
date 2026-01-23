# MeuByte - Guia de Configuração e Deploy

## 1. Configurar Email no Supabase (Autenticação OTP)

### Opção A: Email Padrão do Supabase (Desenvolvimento)
Por padrão, o Supabase já envia emails de verificação usando o serviço interno. Porém:
- **Limite**: 4 emails/hora em projetos gratuitos
- **Remetente**: `noreply@mail.app.supabase.io`

Para testar localmente, isso já funciona!

### Opção B: SMTP Personalizado (Produção)

1. Acesse o **Supabase Dashboard** → **Project Settings** → **Authentication**
2. Role até **SMTP Settings**
3. Ative **Enable Custom SMTP**
4. Configure com seu provedor de email:

**Exemplo com Gmail:**
```
Host: smtp.gmail.com
Port: 587
Username: seu-email@gmail.com
Password: (criar uma App Password em https://myaccount.google.com/apppasswords)
Sender email: seu-email@gmail.com
Sender name: MeuByte
```

**Exemplo com Resend (recomendado):**
```
Host: smtp.resend.com
Port: 587
Username: resend
Password: re_xxxxx (sua API key)
Sender email: noreply@seu-dominio.com
Sender name: MeuByte
```

5. Clique **Save**

### Personalizar Template de Email
1. Em **Authentication** → **Email Templates**
2. Edite os templates (Confirm signup, Magic link, etc.)
3. Use variáveis como `{{ .Token }}` e `{{ .SiteURL }}`

---

## 2. Configurar .env.local

Crie o arquivo `.env.local` na raiz do projeto:

```bash
# Copiar o exemplo
cp .env.example .env.local
```

Edite com suas credenciais (encontre em Supabase Dashboard → Project Settings → API):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tkkgqutsivtseksdcnxa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encryption Master Key
ENCRYPTION_MASTER_KEY=$(openssl rand -base64 32)

# App URL (atualizar após deploy)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Deploy na Vercel

### Passo 1: Criar Repositório no GitHub

```bash
# Na pasta do projeto
cd /Users/juliocesargarcia/Library/Mobile\ Documents/com~apple~CloudDocs/meubyte

# Inicializar Git (se ainda não fez)
git init

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "Initial commit - MeuByte MVP"

# Criar repositório no GitHub (via CLI ou website)
# Se tiver GitHub CLI:
gh repo create meubyte --public --source=. --push

# Ou manual:
# 1. Vá em github.com/new
# 2. Crie o repositório "meubyte"
# 3. Execute:
git remote add origin https://github.com/SEU_USERNAME/meubyte.git
git branch -M main
git push -u origin main
```

### Passo 2: Conectar à Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique **Add New Project**
3. Selecione o repositório `meubyte`
4. Clique **Import**

### Passo 3: Configurar Variáveis de Ambiente

Na tela de deploy, antes de clicar Deploy:

1. Expanda **Environment Variables**
2. Adicione cada variável:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://tkkgqutsivtseksdcnxa.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (sua anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (sua service role key) |
| `ENCRYPTION_MASTER_KEY` | (gerar com openssl rand -base64 32) |
| `NEXT_PUBLIC_APP_URL` | (será preenchido após deploy) |

3. Clique **Deploy**

### Passo 4: Atualizar URL no Supabase

Após o deploy, você terá uma URL como `https://meubyte.vercel.app`.

1. Volte ao **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Atualize:
   - **Site URL**: `https://meubyte.vercel.app`
   - **Redirect URLs**: Adicione `https://meubyte.vercel.app/**`

3. Na Vercel, atualize a variável:
   - `NEXT_PUBLIC_APP_URL` = `https://meubyte.vercel.app`
   - Redeploy

---

## 4. Executar Migrations no Supabase

As migrations ainda precisam ser aplicadas no banco. Existem duas formas:

### Opção A: Via SQL Editor (Mais Simples)

1. Acesse **Supabase Dashboard** → **SQL Editor**
2. Cole o conteúdo de cada arquivo em `supabase/migrations/` em ordem:
   - `01_organizations.sql`
   - `02_fields_templates.sql`
   - `03_subjects.sql`
   - `04_sessions.sql`
   - `05_payload.sql`
   - `06_audit.sql`
   - `07_dsr.sql`
3. Execute cada um

4. Por fim, execute o `supabase/seed.sql` para criar os campos base

### Opção B: Via Supabase CLI

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref tkkgqutsivtseksdcnxa

# Aplicar migrations
supabase db push
```

---

## 5. Verificar Deploy

Após tudo configurado:

1. Acesse `https://meubyte.vercel.app`
2. Teste o login com seu email
3. Verifique se recebeu o código OTP
4. Crie uma organização e teste o fluxo completo

---

## Problemas Comuns

### Email não chega
- Verifique spam/lixo eletrônico
- Confira configuração SMTP no Supabase
- Em projetos free, há limite de 4 emails/hora

### Erro de autenticação
- Verifique se as variáveis de ambiente estão corretas
- Confirme que o Site URL no Supabase bate com a URL do deploy

### 404 em rotas
- Verifique se o build passou sem erros
- Faça um redeploy após adicionar novas rotas
