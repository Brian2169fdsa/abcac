# ABCAC Member Portal — End-to-End Build Plan
**Arizona Board for Certification of Addiction Counselors**
Version 1.0 | Stack: GitHub → Vercel | Supabase | n8n Cloud

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [CLI Setup — This Machine](#2-cli-setup--this-machine)
3. [GitHub Repository Setup](#3-github-repository-setup)
4. [Supabase Setup](#4-supabase-setup)
5. [Vercel Deployment](#5-vercel-deployment)
6. [Frontend Integration — HTML → Live Portal](#6-frontend-integration--html--live-portal)
7. [n8n Workflow Specs — All 10 Automations](#7-n8n-workflow-specs--all-10-automations)
8. [Environment Variables Master List](#8-environment-variables-master-list)
9. [Go-Live Checklist](#9-go-live-checklist)

---

## 1. ARCHITECTURE OVERVIEW

```
[abcac.org] ─── "Member Portal" link ──► [portal.abcac.org] (Vercel)
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                        [Supabase]         [n8n Cloud]      [Resend]
                        Auth + DB          Automations      Email
                        Storage            Webhooks
                              │
                        [Supabase Storage]
                        Documents + CEU Certs
```

**Domains**
- Main site: `abcac.org` (existing)
- Member portal: `portal.abcac.org` → Vercel custom domain
- Alternatively: `members.abcac.org`

**Portal Pages (from HTML)**
```
Auth: Login / Sign Up / Forgot Password
Home: Dashboard, stats, quick actions, activity timeline
Profile: Personal Info | Employment | Certificates & Wallet | Other Certs
Certification: Document Upload | CEU Tracker | Renewal | Supervision Auth
Requests: Name Change | Verification of Cert | IC&RC Reciprocity
Other: Messages | Invoices & Receipts | Account Settings
```

**Tech Responsibilities**
| Layer | Tool | Purpose |
|-------|------|---------|
| Frontend | HTML/CSS/JS (existing) + Supabase JS SDK | UI, auth, data binding |
| Auth | Supabase Auth | Email/password login, magic link, password reset |
| Database | Supabase Postgres | All member data |
| File Storage | Supabase Storage | Documents, CEU certs, issued certificates |
| Automation | n8n Cloud | Email triggers, scheduled reminders, admin alerts |
| Email | Resend (via n8n) | Transactional emails |
| Hosting | Vercel | Static hosting, CDN, custom domain |
| Repo | GitHub | Source of truth, Vercel auto-deploy |

---

## 2. CLI SETUP — THIS MACHINE

### 2A. Install Supabase CLI

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux / WSL
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

# Verify install
supabase --version
```

**Login to Supabase CLI**
```bash
supabase login
# Opens browser → sign in → access token stored locally
```

**Link to your project**
```bash
cd /path/to/your/portal-repo
supabase init              # creates supabase/ folder
supabase link --project-ref YOUR_PROJECT_REF
# PROJECT_REF = the string in your Supabase dashboard URL
# e.g. https://supabase.com/dashboard/project/abcxyz123 → ref is "abcxyz123"
```

**Useful Supabase CLI commands**
```bash
supabase db push            # push local migrations to remote
supabase db pull            # pull remote schema to local
supabase db diff            # show schema diff
supabase db reset           # reset local DB to migrations
supabase gen types typescript --project-id YOUR_REF > types/supabase.ts
supabase status             # check local dev stack status
```

---

### 2B. Install n8n CLI (Local Dev / Self-host option)

> NOTE: For production, use n8n Cloud (manageai2026.app.n8n.cloud). 
> For local testing/dev, install the CLI below.

```bash
# Requires Node.js 18+
node --version   # confirm ≥ 18

# Install n8n globally
npm install n8n -g

# Start n8n locally
n8n start

# n8n runs at http://localhost:5678
# Default credentials: set on first launch

# Run with tunnel (for webhook testing from cloud services)
n8n start --tunnel
```

**n8n environment config (local .env)**
```bash
# Create /home/claude/.n8n/.env (or set as shell exports)
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http
WEBHOOK_URL=https://your-tunnel-url.n8n.cloud  # set when using --tunnel
N8N_ENCRYPTION_KEY=your_32char_random_string
DB_TYPE=sqlite   # local dev; use postgresdb for production
```

**Import/Export workflows via CLI**
```bash
# Export all workflows to JSON
n8n export:workflow --all --output=./n8n-workflows/

# Import a workflow
n8n import:workflow --input=./n8n-workflows/workflow-name.json

# List all workflows
n8n list:workflow
```

---

### 2C. Other CLI Tools

**Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel --prod   # deploy from project root
```

**GitHub CLI (optional)**
```bash
# macOS
brew install gh

# Authenticate
gh auth login

# Create repo from local
gh repo create abcac-member-portal --public --source=. --push
```

---

## 3. GITHUB REPOSITORY SETUP

### 3A. Repo Structure

```
abcac-member-portal/
├── index.html                    ← Your existing portal HTML (upload as-is)
├── assets/
│   ├── logo.png                  ← ABCAC logo (add from abcac.org)
│   └── favicon.ico
├── js/
│   └── portal.js                 ← Supabase integration logic (see Section 6)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                  ← Optional test data
├── .env.example                  ← Template for env vars (no secrets)
├── .gitignore
├── vercel.json                   ← Vercel config
└── README.md
```

### 3B. Initial Setup

```bash
mkdir abcac-member-portal
cd abcac-member-portal
git init

# Copy your HTML file
cp /path/to/abcac-member-portal-v2.html index.html

# Create .gitignore
cat > .gitignore << 'EOF'
.env
.env.local
.env.production
node_modules/
.DS_Store
*.log
EOF

# Create vercel.json
cat > vercel.json << 'EOF'
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
EOF

git add .
git commit -m "Initial portal commit"

# Push to GitHub
gh repo create abcac-member-portal --public --source=. --remote=origin --push
# OR
git remote add origin https://github.com/YOUR_ORG/abcac-member-portal.git
git push -u origin main
```

---

## 4. SUPABASE SETUP

### 4A. Create Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Organization: your org
4. Name: `abcac-member-portal`
5. Database Password: generate + save to 1Password
6. Region: `us-west-1` (closest to Phoenix AZ)
7. Click **Create new project** → wait ~2 min

### 4B. Enable Auth Settings

Dashboard → **Authentication** → **Settings**:
- **Site URL**: `https://portal.abcac.org`
- **Redirect URLs**: 
  - `https://portal.abcac.org`
  - `https://portal.abcac.org/auth/callback`
  - `http://localhost:3000` (dev)
- **Email Provider**: Enable
- **Confirm email**: ✅ enabled
- **Custom SMTP**: Configure with Resend or your email provider
  - SMTP Host: `smtp.resend.com`
  - SMTP Port: `465`
  - SMTP User: `resend`
  - SMTP Pass: your Resend API key

---

### 4C. Full Database Schema

Run this in **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
-- ============================================================
-- ABCAC MEMBER PORTAL — FULL SCHEMA
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES (extends auth.users) ───────────────────────────
CREATE TABLE public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name        TEXT,
  middle_name       TEXT,
  last_name         TEXT,
  email             TEXT UNIQUE NOT NULL,
  phone             TEXT,
  date_of_birth     DATE,
  ssn_last4         TEXT,            -- store encrypted or hashed
  address_line1     TEXT,
  city              TEXT,
  state             TEXT DEFAULT 'Arizona',
  zip_code          TEXT,
  cert_status       TEXT DEFAULT 'applying',
    -- 'active_holder' | 'applying' | 'reciprocity_transfer'
  portal_role       TEXT DEFAULT 'member',
    -- 'member' | 'admin'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CERTIFICATIONS ──────────────────────────────────────────
CREATE TABLE public.certifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_type        TEXT NOT NULL,
    -- 'CAC' | 'CADAC' | 'AADC' | 'CCS' | 'CPS' | 'CCJP' | 'CPRS'
  cert_number      TEXT UNIQUE,
  issued_date      DATE,
  expiration_date  DATE,
  ic_rc_level      TEXT,            -- e.g., 'ADC (Reciprocal)', 'PRS (Reciprocal)'
  status           TEXT DEFAULT 'active',
    -- 'active' | 'expired' | 'suspended' | 'pending'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CEU RECORDS ─────────────────────────────────────────────
CREATE TABLE public.ceu_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_id           UUID REFERENCES public.certifications(id),
  course_name       TEXT NOT NULL,
  provider          TEXT NOT NULL,
  hours             NUMERIC(4,1) NOT NULL,
  category          TEXT NOT NULL,
    -- 'General' | 'Ethics' | 'Cultural Diversity' | 'HIV/AIDS'
  completion_date   DATE NOT NULL,
  certificate_url   TEXT,           -- Supabase Storage path
  status            TEXT DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected'
  admin_notes       TEXT,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

-- ─── DOCUMENTS ───────────────────────────────────────────────
CREATE TABLE public.documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL,
    -- 'Education Verification' | 'Experience Documentation' | 'Training Verification'
    -- | 'Supervision Agreement' | 'CEU Certificate of Completion' | 'ID'
    -- | 'IC&RC Reciprocity Documents' | 'Other'
  related_cert     TEXT,            -- cert type this doc supports
  file_name        TEXT NOT NULL,
  file_path        TEXT NOT NULL,   -- Supabase Storage path
  file_size_kb     INTEGER,
  status           TEXT DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'rejected' | 'under_review'
  admin_notes      TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);

-- ─── EMPLOYMENT RECORDS ──────────────────────────────────────
CREATE TABLE public.employment_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employer_name    TEXT NOT NULL,
  position_title   TEXT NOT NULL,
  start_date       DATE,
  end_date         DATE,           -- NULL = current
  is_current       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── OTHER CERTIFICATIONS ────────────────────────────────────
CREATE TABLE public.other_certifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_title  TEXT NOT NULL,
  credential_number TEXT,
  issuing_board     TEXT NOT NULL,
  issued_date       DATE,
  expiration_date   DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUPERVISION RECORDS (CCS) ───────────────────────────────
CREATE TABLE public.supervision_records (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supervisee_name      TEXT NOT NULL,
  supervisee_credential TEXT,
  start_date           DATE,
  end_date             DATE,
  status               TEXT DEFAULT 'active',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── APPLICATIONS ────────────────────────────────────────────
CREATE TABLE public.applications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_type       TEXT NOT NULL,
    -- 'initial_certification' | 'renewal' | 'reciprocity' | 'name_change'
    -- | 'verification' | 'cert_sync'
  cert_type      TEXT,
  status         TEXT DEFAULT 'submitted',
    -- 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'pending_payment'
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  admin_notes    TEXT,
  est_completion DATE
);

-- ─── NAME CHANGE REQUESTS ────────────────────────────────────
CREATE TABLE public.name_change_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_name   TEXT NOT NULL,
  new_name       TEXT NOT NULL,
  reason         TEXT NOT NULL,   -- 'Marriage' | 'Divorce' | 'Court Order' | 'Other'
  doc_path       TEXT,            -- Supabase Storage path to legal doc
  status         TEXT DEFAULT 'pending',
  admin_notes    TEXT,
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ
);

-- ─── VERIFICATION REQUESTS ───────────────────────────────────
CREATE TABLE public.verification_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_id             UUID REFERENCES public.certifications(id),
  purpose             TEXT NOT NULL,
  recipient_name      TEXT NOT NULL,
  recipient_email     TEXT,
  notes               TEXT,
  status              TEXT DEFAULT 'pending',
    -- 'pending' | 'sent' | 'completed'
  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- ─── RECIPROCITY REQUESTS ────────────────────────────────────
CREATE TABLE public.reciprocity_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL,   -- 'out_of_az' | 'into_az' | 'international'
  credential    TEXT,
  destination   TEXT,
  reason        TEXT,
  status        TEXT DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- ─── MESSAGES (PORTAL INBOX) ─────────────────────────────────
CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_name   TEXT DEFAULT 'ABCAC Admin',
  subject     TEXT NOT NULL,
  body        TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICES ────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number  TEXT UNIQUE NOT NULL,
  description     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,   -- store in cents, display as dollars
  status          TEXT DEFAULT 'unpaid',
    -- 'unpaid' | 'paid' | 'refunded'
  stripe_payment_intent TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATION PREFERENCES ────────────────────────────────
CREATE TABLE public.notification_preferences (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id            UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  renewal_reminders    BOOLEAN DEFAULT TRUE,
  ceu_deadline_alerts  BOOLEAN DEFAULT TRUE,
  abcac_announcements  BOOLEAN DEFAULT TRUE,
  icrc_updates         BOOLEAN DEFAULT FALSE,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_certs_member ON public.certifications(member_id);
CREATE INDEX idx_certs_expiration ON public.certifications(expiration_date);
CREATE INDEX idx_ceu_member ON public.ceu_records(member_id);
CREATE INDEX idx_docs_member ON public.documents(member_id);
CREATE INDEX idx_messages_member ON public.messages(member_id);
CREATE INDEX idx_invoices_member ON public.invoices(member_id);

-- ─── TRIGGERS: updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_certs_updated BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.notification_preferences (member_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### 4D. Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceu_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.name_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reciprocity_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Members can only see/edit their own data
CREATE POLICY "members_own_profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "members_own_certs" ON public.certifications
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_ceu" ON public.ceu_records
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_docs" ON public.documents
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_employment" ON public.employment_records
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_other_certs" ON public.other_certifications
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_supervision" ON public.supervision_records
  FOR ALL USING (auth.uid() = supervisor_id);

CREATE POLICY "members_own_applications" ON public.applications
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_name_change" ON public.name_change_requests
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_verifications" ON public.verification_requests
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_reciprocity" ON public.reciprocity_requests
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_messages" ON public.messages
  FOR ALL USING (auth.uid() = member_id);

CREATE POLICY "members_own_invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "members_own_prefs" ON public.notification_preferences
  FOR ALL USING (auth.uid() = member_id);

-- n8n service role bypasses RLS (uses service_role key)
-- No additional policy needed — service_role key skips RLS by default
```

---

### 4E. Supabase Storage Buckets

Dashboard → **Storage** → **New Bucket** — create these:

| Bucket Name | Public? | Max Size | Allowed MIME Types |
|-------------|---------|----------|--------------------|
| `member-documents` | ❌ Private | 10MB | `application/pdf, image/jpeg, image/png` |
| `ceu-certificates` | ❌ Private | 10MB | `application/pdf, image/jpeg, image/png` |
| `issued-certificates` | ❌ Private | 5MB | `application/pdf` |
| `name-change-docs` | ❌ Private | 10MB | `application/pdf, image/jpeg, image/png` |

**Storage RLS Policies** (run in SQL Editor):

```sql
-- Members can upload/read their own docs
CREATE POLICY "member_upload_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "member_read_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'member-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Same pattern for ceu-certificates bucket
CREATE POLICY "member_upload_ceu" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ceu-certificates' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "member_read_ceu" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ceu-certificates' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

### 4F. Supabase Webhooks → n8n

Dashboard → **Database** → **Webhooks** → **Enable webhooks** → Create:

| Webhook Name | Table | Events | n8n URL |
|---|---|---|---|
| `new_member_signup` | `profiles` | INSERT | `https://YOUR_N8N/webhook/member-signup` |
| `document_uploaded` | `documents` | INSERT | `https://YOUR_N8N/webhook/doc-uploaded` |
| `ceu_submitted` | `ceu_records` | INSERT | `https://YOUR_N8N/webhook/ceu-submitted` |
| `application_status_changed` | `applications` | UPDATE | `https://YOUR_N8N/webhook/app-status` |
| `name_change_submitted` | `name_change_requests` | INSERT | `https://YOUR_N8N/webhook/name-change` |
| `verification_submitted` | `verification_requests` | INSERT | `https://YOUR_N8N/webhook/verification` |
| `reciprocity_submitted` | `reciprocity_requests` | INSERT | `https://YOUR_N8N/webhook/reciprocity` |
| `message_sent` | `messages` | INSERT | `https://YOUR_N8N/webhook/message-sent` |

---

## 5. VERCEL DEPLOYMENT

### 5A. Connect GitHub → Vercel

1. Go to https://vercel.com/new
2. **Import Git Repository** → select `abcac-member-portal`
3. Framework Preset: **Other** (static site)
4. Root Directory: `/` (default)
5. Build Command: *(leave empty — static HTML)*
6. Output Directory: `.` (root)
7. Click **Deploy**

### 5B. Add Environment Variables in Vercel

Dashboard → Project → **Settings** → **Environment Variables**:

```
SUPABASE_URL         = https://YOUR_REF.supabase.co
SUPABASE_ANON_KEY    = eyJ...  (anon/public key from Supabase)
N8N_WEBHOOK_BASE     = https://YOUR_N8N_INSTANCE/webhook
```

> For a static HTML site these vars are embedded at build time or
> used inline in your JS. Since this is pure HTML/JS, add them 
> directly to `js/portal.js` or use a build step.

### 5C. Custom Domain

1. Vercel → Project → **Settings** → **Domains**
2. Add: `portal.abcac.org`
3. In your DNS provider (wherever abcac.org is registered):
   - Add CNAME: `portal` → `cname.vercel-dns.com`
   - Or use A record as Vercel instructs
4. SSL is automatic via Vercel

### 5D. Auto-Deploy from GitHub

Every `git push` to `main` triggers automatic Vercel redeploy — no additional config needed.

---

## 6. FRONTEND INTEGRATION — HTML → LIVE PORTAL

### 6A. Add Supabase JS SDK to index.html

Add before closing `</head>` tag in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const SUPABASE_URL = 'https://YOUR_REF.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
<script src="js/portal.js"></script>
```

### 6B. Replace Auth Functions (portal.js)

Create `js/portal.js` and replace the mock `doLogin()` / `doLogout()` functions:

```javascript
// ═══ SUPABASE AUTH ═══

// SIGN IN
async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Login failed: ' + error.message);
    return;
  }

  // Load member profile data
  await loadPortal(data.user);

  // Animate out auth gateway
  const gw = document.getElementById('authGateway');
  gw.classList.add('hidden');
  setTimeout(() => { gw.style.display = 'none'; }, 400);
}

// SIGN UP
async function doSignup() {
  const first = document.querySelector('#formSignup input[placeholder="First name"]').value;
  const last = document.querySelector('#formSignup input[placeholder="Last name"]').value;
  const email = document.querySelector('#formSignup input[placeholder="you@example.com"]').value;
  const password = document.querySelector('#formSignup input[placeholder="Min. 8 characters"]').value;
  const phone = document.querySelector('#formSignup input[placeholder="(480) 555-0123"]').value;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: first, last_name: last, phone }
    }
  });

  if (error) {
    alert('Sign up failed: ' + error.message);
    return;
  }

  alert('Account created! Check your email to confirm your address.');
}

// FORGOT PASSWORD
async function doForgotPassword() {
  const email = document.querySelector('#formForgot input[type="email"]').value;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://portal.abcac.org/reset-password'
  });
  if (error) {
    alert('Error: ' + error.message);
    return;
  }
  alert('Password reset link sent! Check your email.');
}

// SIGN OUT
async function doLogout() {
  await supabase.auth.signOut();
  const gw = document.getElementById('authGateway');
  gw.style.display = 'flex';
  gw.classList.remove('hidden');
  switchAuthTab('login');
}

// CHECK SESSION ON PAGE LOAD
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await loadPortal(session.user);
    document.getElementById('authGateway').style.display = 'none';
  }
});

// ═══ LOAD PORTAL DATA ═══
async function loadPortal(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile) {
    // Update welcome name
    const nameEl = document.querySelector('.welcome-banner h2 span');
    if (nameEl) nameEl.textContent = profile.first_name || 'Member';

    // Update topbar avatar initials
    const avatarEl = document.querySelector('.topbar-avatar');
    if (avatarEl && profile.first_name) {
      avatarEl.textContent = (profile.first_name[0] + (profile.last_name?.[0] || '')).toUpperCase();
    }

    // Populate personal info form
    populatePersonalInfo(profile);
  }

  // Load certifications
  await loadCertifications(user.id);

  // Load CEU records
  await loadCEURecords(user.id);

  // Load documents
  await loadDocuments(user.id);

  // Load messages (unread count)
  await loadMessageCount(user.id);

  // Load invoices
  await loadInvoices(user.id);
}

// ═══ CEU SUBMISSION ═══
async function submitCEU(formData) {
  const { data: { user } } = await supabase.auth.getUser();

  // Upload certificate file if provided
  let certificateUrl = null;
  if (formData.file) {
    const filePath = `${user.id}/${Date.now()}_${formData.file.name}`;
    const { data: upload, error: uploadErr } = await supabase.storage
      .from('ceu-certificates')
      .upload(filePath, formData.file);
    if (!uploadErr) certificateUrl = upload.path;
  }

  const { error } = await supabase.from('ceu_records').insert({
    member_id: user.id,
    course_name: formData.courseName,
    provider: formData.provider,
    hours: parseFloat(formData.hours),
    category: formData.category,
    completion_date: formData.completionDate,
    certificate_url: certificateUrl,
    status: 'pending'
  });

  if (error) throw error;
  document.getElementById('ceuModal').style.display = 'none';
  await loadCEURecords(user.id);
  alert('CEU submission received! ABCAC will review within 5-7 business days.');
}

// ═══ DOCUMENT UPLOAD ═══
async function uploadDocument(formData) {
  const { data: { user } } = await supabase.auth.getUser();

  const filePath = `${user.id}/${Date.now()}_${formData.file.name}`;
  const { data: upload, error: uploadErr } = await supabase.storage
    .from('member-documents')
    .upload(filePath, formData.file);

  if (uploadErr) { alert('Upload failed: ' + uploadErr.message); return; }

  await supabase.from('documents').insert({
    member_id: user.id,
    document_type: formData.documentType,
    related_cert: formData.relatedCert,
    file_name: formData.file.name,
    file_path: upload.path,
    file_size_kb: Math.round(formData.file.size / 1024),
    status: 'pending'
  });

  await loadDocuments(user.id);
  alert('Document uploaded successfully. ABCAC will review it shortly.');
}
```

### 6C. Real-Time Data Binding

All `alert()` modals from the original HTML get replaced with actual Supabase fetch/insert calls. The pattern for every data table in the portal:

```javascript
// Generic pattern for loading any table into an HTML <tbody>
async function loadTableData(tableName, memberId, tbodyId, rowRenderer) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  const tbody = document.getElementById(tbodyId);
  if (error || !data?.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--gray-400);padding:24px;">No records found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(rowRenderer).join('');
}
```

---

## 7. N8N WORKFLOW SPECS — ALL 10 AUTOMATIONS

> Base URL for all webhooks: `https://YOUR_N8N_INSTANCE/webhook/`
> 
> All email sending uses **Resend** node or **SMTP** node in n8n.
> Admin notification email: `abcac@abcac.org`

---

### WORKFLOW 1 — Member Registration Welcome

**Trigger**: Supabase DB Webhook → `profiles` table INSERT
**Webhook path**: `/webhook/member-signup`

```
NODES:
1. Webhook (POST) — receives { record: { id, email, first_name, last_name } }
2. Set Node — extract: email, first_name, last_name
3. Send Email (Resend) — Welcome Email to member
4. Send Email (Resend) — Admin notification: new member registered
5. Respond to Webhook — 200 OK

EMAIL 1 — To Member:
  Subject: Welcome to the ABCAC Member Portal, {{ $json.first_name }}!
  Body:
    Your ABCAC Member Portal account has been created.
    Portal URL: https://portal.abcac.org
    
    Next steps:
    1. Complete your Personal Information profile
    2. Add your employment history
    3. Upload supporting documents for your application
    
    Questions? Email abcac@abcac.org or call 480-980-1770.
    
    — ABCAC Team

EMAIL 2 — To Admin:
  Subject: [Portal] New Member Registration — {{ $json.email }}
  Body: New member registered: {{ $json.first_name }} {{ $json.last_name }} ({{ $json.email }})
        Cert Status: {{ $json.cert_status }}
        Registered At: {{ $json.created_at }}
        View in Supabase Dashboard
```

---

### WORKFLOW 2 — Document Uploaded → Admin Review Queue

**Trigger**: Supabase DB Webhook → `documents` table INSERT
**Webhook path**: `/webhook/doc-uploaded`

```
NODES:
1. Webhook (POST) — receives document record + member_id
2. HTTP Request Node — GET member profile from Supabase
   URL: {{ SUPABASE_URL }}/rest/v1/profiles?id=eq.{{ $json.record.member_id }}&select=*
   Headers: apikey: {{ SERVICE_ROLE_KEY }}, Authorization: Bearer {{ SERVICE_ROLE_KEY }}
3. Set Node — merge document data + member name
4. Send Email — Admin alert
5. Send Email — Member confirmation
6. Respond to Webhook — 200 OK

EMAIL 1 — To Admin:
  Subject: [Portal] Document Uploaded — Review Required
  Body:
    Member: {{ member.first_name }} {{ member.last_name }} ({{ member.email }})
    Document Type: {{ document.document_type }}
    Related Cert: {{ document.related_cert }}
    File: {{ document.file_name }}
    Uploaded: {{ document.uploaded_at }}
    
    Action Required: Review and approve or reject in the admin dashboard.

EMAIL 2 — To Member:
  Subject: Document Received — {{ $json.record.document_type }}
  Body:
    We've received your {{ document_type }} document ({{ file_name }}).
    Status: Under Review
    Our team typically reviews documents within 3-5 business days.
    You'll receive a notification when the status updates.
```

---

### WORKFLOW 3 — CEU Submission → Admin Review

**Trigger**: Supabase DB Webhook → `ceu_records` table INSERT
**Webhook path**: `/webhook/ceu-submitted`

```
NODES:
1. Webhook (POST) — receives CEU record
2. HTTP Request Node — GET member profile
3. Set Node — build notification data
4. Send Email — Admin alert
5. Send Email — Member confirmation
6. Respond to Webhook — 200 OK

EMAIL 1 — To Admin:
  Subject: [Portal] CEU Submission — {{ course_name }} ({{ hours }} hrs)
  Body:
    Member: {{ first_name }} {{ last_name }} ({{ email }})
    Course: {{ course_name }}
    Provider: {{ provider }}
    Hours: {{ hours }}
    Category: {{ category }}
    Completion Date: {{ completion_date }}
    Certificate attached: {{ certificate_url ? 'Yes' : 'No' }}
    
    Review and approve/reject in Supabase dashboard.

EMAIL 2 — To Member:
  Subject: CEU Hours Submission Received — {{ course_name }}
  Body:
    Your CEU submission has been received and is pending review.
    Course: {{ course_name }}
    Hours Claimed: {{ hours }}
    Category: {{ category }}
    
    Review typically takes 5-7 business days.
```

---

### WORKFLOW 4 — Application Status Changed → Member Notification

**Trigger**: Supabase DB Webhook → `applications` table UPDATE
**Webhook path**: `/webhook/app-status`

```
NODES:
1. Webhook (POST) — receives { record, old_record }
2. IF Node — check if status actually changed
   Condition: {{ $json.record.status }} != {{ $json.old_record.status }}
3. HTTP Request Node — GET member profile
4. Switch Node — branch on new status:
   - 'under_review'  → branch A
   - 'approved'      → branch B
   - 'rejected'      → branch C
   - 'pending_payment' → branch D
5. Each branch: Send Email with status-specific content
6. Respond to Webhook — 200 OK

BRANCH A — Under Review:
  Subject: Your {{ cert_type }} Application Is Under Review
  Body: ABCAC has received your application and it is now under review.
        Estimated completion: {{ est_completion }}

BRANCH B — Approved:
  Subject: 🎉 Congratulations — Your {{ cert_type }} Application Has Been Approved!
  Body:  Your {{ cert_type }} certification application has been approved!
         Your certificate will be issued and mailed within 10 business days.
         You can download your digital certificate from the Member Portal.

BRANCH C — Rejected:
  Subject: ABCAC Application Update — Action Required
  Body:  Unfortunately, your {{ cert_type }} application requires attention.
         Reason: {{ admin_notes }}
         Please log in to the portal to review the details and resubmit.

BRANCH D — Pending Payment:
  Subject: Payment Required — {{ cert_type }} Application
  Body:  Your application is approved pending payment of the certification fee.
         Amount Due: ${{ fee_amount }}
         Pay online: https://portal.abcac.org → Invoices & Receipts
```

---

### WORKFLOW 5 — Renewal Reminder (Scheduled)

**Trigger**: Schedule Trigger — runs daily at 8:00 AM MST
**n8n Cron**: `0 8 * * *` (MST = UTC-7, so `0 15 * * *` in UTC)

```
NODES:
1. Schedule Trigger — daily 8 AM MST
2. HTTP Request Node — Query certifications expiring in 90 days
   Supabase REST:
   GET /rest/v1/certifications
     ?status=eq.active
     &expiration_date=gte.{{ today }}
     &expiration_date=lte.{{ today+90days }}
     &select=*,profiles(first_name,last_name,email,notification_preferences(renewal_reminders))

3. Loop Over Items Node — iterate each expiring cert

4. IF Node — check notification_preferences.renewal_reminders = true

5. Calculate days remaining (expiration_date - today)

6. Switch Node — days bucket:
   88-92 days  → "90-day notice"
   58-62 days  → "60-day notice"
   28-32 days  → "30-day notice"

7. Send Email — per bucket

EMAIL — 90-day:
  Subject: Action Required: {{ cert_type }} Renewal Due in 90 Days
  Body:  Your {{ cert_type }} certification expires on {{ expiration_date }}.
         You have 90 days to complete 40 CEU hours and submit your renewal.
         Current CEU progress: {{ ceu_completed }}/40 hours
         
         Log in to begin your renewal: https://portal.abcac.org

EMAIL — 60-day:
  Subject: ⚠️ 60 Days Until {{ cert_type }} Renewal — Don't Lose Your Certification
  Body:  [Urgency-raised version of 90-day message]

EMAIL — 30-day:
  Subject: 🚨 FINAL NOTICE: {{ cert_type }} Expires in 30 Days
  Body:  [Highest urgency — includes phone number 480-980-1770]
```

---

### WORKFLOW 6 — CEU Deadline Alert (Scheduled)

**Trigger**: Schedule Trigger — runs every Monday at 8:00 AM MST
**n8n Cron**: `0 15 * * 1` (UTC)

```
NODES:
1. Schedule Trigger — weekly Monday 8 AM MST
2. HTTP Request — Query members with active certs expiring < 180 days
3. For each member: calculate CEU completion percentage
4. IF Node — CEU completion < 75% AND expiration < 90 days
5. Send Email — CEU alert

EMAIL:
  Subject: CEU Hours Alert — You're Behind Schedule for Renewal
  Body:  You've completed {{ ceu_completed }} of 40 required CEU hours.
         Your {{ cert_type }} expires on {{ expiration_date }} ({{ days_remaining }} days).
         
         You still need:
         - {{ general_remaining }} General hours
         - {{ ethics_remaining }} Ethics hours
         - {{ diversity_remaining }} Cultural Diversity hours
         
         Log in to track and submit CEU hours: https://portal.abcac.org
```

---

### WORKFLOW 7 — Name Change Request → Admin

**Trigger**: Supabase DB Webhook → `name_change_requests` INSERT
**Webhook path**: `/webhook/name-change`

```
NODES:
1. Webhook (POST) — receives name change request record
2. HTTP Request — GET member profile
3. Send Email — Admin alert

EMAIL — To Admin:
  Subject: [Portal] Name Change Request — {{ current_name }} → {{ new_name }}
  Body:
    Member: {{ member.email }}
    Current Name: {{ current_name }}
    Requested New Name: {{ new_name }}
    Reason: {{ reason }}
    Supporting Doc: {{ doc_path ? 'Uploaded' : 'Not provided' }}
    Submitted: {{ submitted_at }}
    
    Review and approve in the Supabase admin dashboard.
    Once approved, update profile.first_name, profile.last_name,
    and reissue all active certificates.

EMAIL 2 — To Member:
  Subject: Name Change Request Received
  Body:
    Your name change request from {{ current_name }} to {{ new_name }} has been received.
    Our team will review within 5-7 business days.
    Updated certificates will be reissued upon approval.
```

---

### WORKFLOW 8 — Verification Request → Generate & Send

**Trigger**: Supabase DB Webhook → `verification_requests` INSERT
**Webhook path**: `/webhook/verification`

```
NODES:
1. Webhook (POST) — receives verification request
2. HTTP Request — GET member profile + their active certifications
3. HTTP Request — GET certification details (cert_number, issued_date, expiration_date)
4. Set Node — build verification letter data
5. Send Email to Admin — inform of new request
6. IF Node — recipient_email is provided?
   YES → Send verification email directly to recipient
   NO  → Admin handles manually
7. HTTP Request — UPDATE verification_requests.status = 'sent'
8. Send Email to Member — confirmation

EMAIL — To Recipient (if email provided):
  Subject: Official ABCAC Certification Verification — {{ member_name }}
  Body:
    This letter serves as official verification that:
    
    Name: {{ first_name }} {{ last_name }}
    Certification: {{ cert_type }} — {{ cert_number }}
    Status: Active
    Issue Date: {{ issued_date }}
    Expiration Date: {{ expiration_date }}
    IC&RC Level: {{ ic_rc_level }}
    
    This certification is issued by the Arizona Board for the Certification 
    of Addiction Counselors (ABCAC), an IC&RC Member Board.
    
    For questions: abcac@abcac.org | 480-980-1770
    
    — ABCAC Verification Office
```

---

### WORKFLOW 9 — IC&RC Reciprocity Request → Admin

**Trigger**: Supabase DB Webhook → `reciprocity_requests` INSERT
**Webhook path**: `/webhook/reciprocity`

```
NODES:
1. Webhook (POST)
2. HTTP Request — GET member profile + certifications
3. Send Email — Admin notification
4. Send Email — Member acknowledgment

EMAIL — To Admin:
  Subject: [Portal] IC&RC Reciprocity Request — {{ direction }}
  Body:
    Member: {{ name }} ({{ email }})
    Direction: {{ direction }}
    Credential: {{ credential }}
    Destination: {{ destination }}
    Reason: {{ reason }}
    
    Next steps:
    - Out of AZ: Contact IC&RC to initiate transfer
    - Into AZ: Await IC&RC to forward application

EMAIL — To Member:
  Subject: IC&RC Reciprocity Request Received
  Body:
    Your reciprocity request has been received.
    
    Request Type: Transfer {{ direction == 'out_of_az' ? 'OUT of Arizona' : 'INTO Arizona' }}
    Credential: {{ credential }}
    
    ABCAC will contact you within 5 business days with next steps.
    Processing fee: $150 (payable directly to IC&RC).
    
    Questions? abcac@abcac.org | 480-980-1770
```

---

### WORKFLOW 10 — Message Sent → Email Notification

**Trigger**: Supabase DB Webhook → `messages` INSERT
**Webhook path**: `/webhook/message-sent`

```
NODES:
1. Webhook (POST) — receives message record
2. HTTP Request — GET member profile (email)
3. Send Email — Notify member of new portal message

EMAIL — To Member:
  Subject: New Message from ABCAC: {{ subject }}
  Body:
    You have a new message in your ABCAC Member Portal.
    
    From: {{ from_name }}
    Subject: {{ subject }}
    
    Log in to read the full message:
    https://portal.abcac.org → Messages
    
    — ABCAC Member Portal
```

---

### WORKFLOW 10B — Invoice Created → Payment Receipt

**Trigger**: HTTP Webhook from Stripe (payment_intent.succeeded) OR Supabase webhook
**Webhook path**: `/webhook/payment-received`

```
NODES:
1. Webhook (POST) — Stripe payment_intent.succeeded event
2. Set Node — extract amount, member email, description from metadata
3. HTTP Request — UPDATE invoices SET status='paid', paid_at=NOW()
   WHERE stripe_payment_intent = {{ payment_intent_id }}
4. HTTP Request — GET invoice + member profile
5. Send Email — Receipt to member

EMAIL — To Member:
  Subject: Payment Confirmation — ABCAC Invoice {{ invoice_number }}
  Body:
    Payment received. Thank you!
    
    Invoice: {{ invoice_number }}
    Description: {{ description }}
    Amount Paid: ${{ amount }}
    Date: {{ paid_at }}
    
    View your invoices: https://portal.abcac.org → Invoices & Receipts
    
    — ABCAC Finance
```

---

### n8n Setup Notes

**Create credentials in n8n (Settings → Credentials):**

1. **Supabase Credential** (HTTP Header Auth)
   - Name: `ABCAC Supabase Service`
   - Header Name: `apikey`
   - Header Value: `YOUR_SERVICE_ROLE_KEY`

2. **Resend SMTP Credential**
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Pass: `re_YOUR_RESEND_API_KEY`
   - From: `noreply@abcac.org`

3. **Authorization header** for all Supabase HTTP Requests:
   - Add header: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

**n8n Workflow Import**: Each workflow above can be built in n8n UI or imported via JSON. To import:
1. n8n → Workflows → Add Workflow → Import from JSON
2. Paste the workflow JSON

---

## 8. ENVIRONMENT VARIABLES MASTER LIST

### `.env.example` (commit this — no secrets)

```bash
# Supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# n8n
N8N_WEBHOOK_BASE=https://YOUR_N8N_INSTANCE/webhook
N8N_ENCRYPTION_KEY=YOUR_32CHAR_KEY

# Email (Resend)
RESEND_API_KEY=re_YOUR_KEY_HERE
RESEND_FROM_EMAIL=noreply@abcac.org
ADMIN_EMAIL=abcac@abcac.org

# Stripe (for payment processing)
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET

# Vercel
VERCEL_URL=https://portal.abcac.org
```

**Where each variable lives:**
| Variable | Supabase Dashboard | Vercel Dashboard | n8n Credentials | Local .env |
|---|---|---|---|---|
| SUPABASE_URL | Source | ✅ | ✅ (in HTTP nodes) | ✅ |
| SUPABASE_ANON_KEY | Source | ✅ | — | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | Source | ❌ never | ✅ | ✅ (dev only) |
| RESEND_API_KEY | — | ❌ | ✅ | ✅ |
| STRIPE_WEBHOOK_SECRET | — | ✅ | ✅ | ✅ |

---

## 9. GO-LIVE CHECKLIST

### Phase 1 — Foundation (Day 1)
- [ ] Supabase project created, region set to us-west-1
- [ ] Full schema SQL run successfully
- [ ] RLS policies applied and tested
- [ ] Storage buckets created with policies
- [ ] Supabase Auth configured (Site URL, redirect URLs, SMTP)
- [ ] GitHub repo created with `index.html` committed
- [ ] Vercel project connected to GitHub
- [ ] Custom domain `portal.abcac.org` configured in Vercel
- [ ] DNS CNAME record added at registrar

### Phase 2 — Auth Integration (Day 2)
- [ ] Supabase JS SDK added to `index.html`
- [ ] `js/portal.js` created with real auth functions
- [ ] `doLogin()` calls `supabase.auth.signInWithPassword()`
- [ ] `doSignup()` calls `supabase.auth.signUp()`
- [ ] `doLogout()` calls `supabase.auth.signOut()`
- [ ] Password reset flow connected to Supabase
- [ ] Session persistence on page reload working
- [ ] Auth tested end-to-end in staging

### Phase 3 — Data Binding (Day 3-4)
- [ ] `loadPortal()` function populating member name, avatar
- [ ] Personal Information form wired to Supabase read/write
- [ ] Employment records table loading from DB
- [ ] Certifications table loaded dynamically
- [ ] CEU Tracker stats calculated from real DB data
- [ ] CEU Log modal submitting to `ceu_records` table
- [ ] Document Upload form writing to `documents` + Storage
- [ ] Messages inbox loading from `messages` table
- [ ] Invoices table loading from `invoices` table
- [ ] All `alert()` calls replaced with real DB operations

### Phase 4 — n8n Automations (Day 4-5)
- [ ] Supabase webhooks enabled in Dashboard
- [ ] All 8 database webhooks configured pointing to n8n URLs
- [ ] Resend credentials configured in n8n
- [ ] Supabase service role credential configured in n8n
- [ ] Workflow 1: Welcome email tested
- [ ] Workflow 2: Document upload notification tested
- [ ] Workflow 3: CEU submission notification tested
- [ ] Workflow 4: Application status change notification tested
- [ ] Workflow 5: Renewal reminder scheduled and tested
- [ ] Workflow 6: CEU deadline alert scheduled and tested
- [ ] Workflow 7: Name change request notification tested
- [ ] Workflow 8: Verification request + auto-send tested
- [ ] Workflow 9: Reciprocity request notification tested
- [ ] Workflow 10: New message email notification tested

### Phase 5 — Go-Live (Day 5)
- [ ] Link added on `abcac.org` pointing to `portal.abcac.org`
- [ ] ABCAC logo added to `assets/logo.png` and referenced in HTML
- [ ] Email domain `abcac.org` verified in Resend for sending
- [ ] Test end-to-end with a real @abcac.org email
- [ ] Confirm renewal reminders fire for a test member
- [ ] Admin notified of all incoming submissions
- [ ] Mobile responsive verified on iOS + Android
- [ ] Supabase backups enabled (Dashboard → Database → Backups)

---

## REFERENCE URLS

| Resource | URL |
|---|---|
| Supabase Dashboard | https://supabase.com/dashboard |
| Supabase Docs | https://supabase.com/docs |
| n8n Cloud | https://manageai2026.app.n8n.cloud |
| n8n Docs | https://docs.n8n.io |
| Vercel Dashboard | https://vercel.com/dashboard |
| Resend | https://resend.com |
| Supabase JS SDK | https://supabase.com/docs/reference/javascript |

---

*Built by ManageAI for ABCAC — Arizona Board for Certification of Addiction Counselors*
*Stack: GitHub → Vercel | Supabase | n8n*
