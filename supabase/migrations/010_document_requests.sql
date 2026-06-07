CREATE TABLE IF NOT EXISTS public.document_requests (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  note text,
  status text not null default 'open',   -- open | fulfilled
  created_at timestamptz default now(),
  fulfilled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_docreq_member ON public.document_requests(member_id);
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read_docreq" ON public.document_requests FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "members_update_docreq" ON public.document_requests FOR UPDATE USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "admin_all_docreq" ON public.document_requests FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
