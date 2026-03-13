-- ABCAC MEMBER PORTAL — FULL SCHEMA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES (extends auth.users)
CREATE TABLE public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name        TEXT,
  middle_name       TEXT,
  last_name         TEXT,
  email             TEXT UNIQUE NOT NULL,
  phone             TEXT,
  date_of_birth     DATE,
  ssn_last4         TEXT,
  address_line1     TEXT,
  city              TEXT,
  state             TEXT DEFAULT 'Arizona',
  zip_code          TEXT,
  cert_status       TEXT DEFAULT 'applying',
  portal_role       TEXT DEFAULT 'member',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.certifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_type        TEXT NOT NULL,
  cert_number      TEXT UNIQUE,
  issued_date      DATE,
  expiration_date  DATE,
  ic_rc_level      TEXT,
  status           TEXT DEFAULT 'active',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ceu_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_id           UUID REFERENCES public.certifications(id),
  course_name       TEXT NOT NULL,
  provider          TEXT NOT NULL,
  hours             NUMERIC(4,1) NOT NULL,
  category          TEXT NOT NULL,
  completion_date   DATE NOT NULL,
  certificate_url   TEXT,
  status            TEXT DEFAULT 'pending',
  admin_notes       TEXT,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

CREATE TABLE public.documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL,
  related_cert     TEXT,
  file_name        TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  file_size_kb     INTEGER,
  status           TEXT DEFAULT 'pending',
  admin_notes      TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);

CREATE TABLE public.employment_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employer_name    TEXT NOT NULL,
  position_title   TEXT NOT NULL,
  start_date       DATE,
  end_date         DATE,
  is_current       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE public.applications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_type       TEXT NOT NULL,
  cert_type      TEXT,
  status         TEXT DEFAULT 'submitted',
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  admin_notes    TEXT,
  est_completion DATE
);

CREATE TABLE public.name_change_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_name   TEXT NOT NULL,
  new_name       TEXT NOT NULL,
  reason         TEXT NOT NULL,
  doc_path       TEXT,
  status         TEXT DEFAULT 'pending',
  admin_notes    TEXT,
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ
);

CREATE TABLE public.verification_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_id             UUID REFERENCES public.certifications(id),
  purpose             TEXT NOT NULL,
  recipient_name      TEXT NOT NULL,
  recipient_email     TEXT,
  notes               TEXT,
  status              TEXT DEFAULT 'pending',
  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE TABLE public.reciprocity_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL,
  credential    TEXT,
  destination   TEXT,
  reason        TEXT,
  status        TEXT DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_name   TEXT DEFAULT 'ABCAC Admin',
  subject     TEXT NOT NULL,
  body        TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number  TEXT UNIQUE NOT NULL,
  description     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  status          TEXT DEFAULT 'unpaid',
  stripe_payment_intent TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notification_preferences (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id            UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  renewal_reminders    BOOLEAN DEFAULT TRUE,
  ceu_deadline_alerts  BOOLEAN DEFAULT TRUE,
  abcac_announcements  BOOLEAN DEFAULT TRUE,
  icrc_updates         BOOLEAN DEFAULT FALSE,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_certs_member ON public.certifications(member_id);
CREATE INDEX idx_certs_expiration ON public.certifications(expiration_date);
CREATE INDEX idx_ceu_member ON public.ceu_records(member_id);
CREATE INDEX idx_docs_member ON public.documents(member_id);
CREATE INDEX idx_messages_member ON public.messages(member_id);
CREATE INDEX idx_invoices_member ON public.invoices(member_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_certs_updated BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
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

-- ROW LEVEL SECURITY
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

CREATE POLICY "members_own_profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "members_own_certs" ON public.certifications FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_ceu" ON public.ceu_records FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_docs" ON public.documents FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_employment" ON public.employment_records FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_other_certs" ON public.other_certifications FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_supervision" ON public.supervision_records FOR ALL USING (auth.uid() = supervisor_id);
CREATE POLICY "members_own_applications" ON public.applications FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_name_change" ON public.name_change_requests FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_verifications" ON public.verification_requests FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_reciprocity" ON public.reciprocity_requests FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_messages" ON public.messages FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "members_own_invoices" ON public.invoices FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "members_own_prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = member_id);

-- STORAGE POLICIES
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
