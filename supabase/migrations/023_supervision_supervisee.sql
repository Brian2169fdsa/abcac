-- ABCAC — 023_supervision_supervisee.sql
-- MEMBER-AS-SUPERVISEE MODELING (gap #6).
--
-- supervision_records (001) is keyed on supervisor_id only, with a free-text
-- supervisee_name. A *supervised* member therefore never sees the record, and
-- the admin 360° view's `supervisionAsMember` query (`.eq("member_id", …)`) is
-- always empty because no such column exists.
--
-- This migration is ADDITIVE and idempotent — it does not drop/rename anything:
--
--   * supervisee_member_id — NULLABLE FK to profiles(id). When a supervisor
--     links a supervisee who is also an ABCAC member, this points at that
--     member's profile so the supervisee can SEE the record and the admin can
--     show the relationship in both directions. Left NULL for off-platform
--     supervisees (the existing supervisee_name free-text path is unchanged).
--
-- RLS — TIGHT:
--   * The existing supervisor policy (`auth.uid() = supervisor_id`, 001) and the
--     admin override (002) are LEFT INTACT.
--   * We ADD a read-only policy so a member who is the linked supervisee can
--     SELECT the rows where they are the supervisee — and nothing more (no
--     INSERT/UPDATE/DELETE for the supervisee).
--   * A BEFORE INSERT/UPDATE guard prevents a supervisor from pointing
--     supervisee_member_id at *themselves* (no self-supervision) and keeps the
--     existing pin (the supervisor can only write rows where supervisor_id is
--     their own uid — already enforced by the 001 USING clause; we additionally
--     pin it WITH CHECK for non-admins).
--
-- Existing rows and the existing supervisor INSERT path keep working unchanged.

ALTER TABLE public.supervision_records
  ADD COLUMN IF NOT EXISTS supervisee_member_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Lookup index for the supervisee's own view + the admin "as supervisee" query.
CREATE INDEX IF NOT EXISTS idx_supervision_supervisee_member
  ON public.supervision_records (supervisee_member_id);

-- ───────────────────────────────────────────────────────────
-- RLS. The 001 supervisor policy lacked a WITH CHECK, so we re-create it with
-- one (pins supervisor_id to the caller) and add a supervisee read policy.
-- The 002 admin FOR ALL policy is unaffected.
-- ───────────────────────────────────────────────────────────

-- Re-create the supervisor policy with an explicit WITH CHECK pinning supervisor_id.
DROP POLICY IF EXISTS "members_own_supervision" ON public.supervision_records;
CREATE POLICY "members_own_supervision" ON public.supervision_records
  FOR ALL
  USING (auth.uid() = supervisor_id)
  WITH CHECK (auth.uid() = supervisor_id);

-- The linked supervisee may READ (only) the rows where they are the supervisee.
DROP POLICY IF EXISTS "supervisee_read_supervision" ON public.supervision_records;
CREATE POLICY "supervisee_read_supervision" ON public.supervision_records
  FOR SELECT
  USING (auth.uid() = supervisee_member_id);

-- BEFORE INSERT/UPDATE guard: for non-admin / non-service-role callers, pin the
-- supervisor identity and forbid linking a supervisee_member_id that equals the
-- supervisor (a member cannot supervise themselves).
CREATE OR REPLACE FUNCTION public.guard_supervision_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the service role may write anything.
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Member (supervisor) write: pin the supervisor to the caller.
  NEW.supervisor_id := auth.uid();

  -- No self-supervision: a member cannot list themselves as their supervisee.
  IF NEW.supervisee_member_id IS NOT NULL AND NEW.supervisee_member_id = auth.uid() THEN
    NEW.supervisee_member_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_supervision_write ON public.supervision_records;
CREATE TRIGGER tr_guard_supervision_write
  BEFORE INSERT OR UPDATE ON public.supervision_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_supervision_write();

-- ───────────────────────────────────────────────────────────
-- Supervisee lookup RPC.
--
-- A member (the supervisor) can only read their OWN profile under RLS, so a
-- client-side lookup of another member's id-by-email is blocked. This tightly
-- scoped SECURITY DEFINER function lets an authenticated caller resolve an
-- ABCAC member's email to *only* their profile id — it exposes no other profile
-- data, requires an exact (case-insensitive) email match, and returns NULL when
-- the supervisee isn't an ABCAC member (off-platform supervision stays valid via
-- the free-text supervisee_name path).
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.find_member_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Only authenticated users may resolve a member id.
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  RETURN v_id;  -- NULL if not an ABCAC member
END;
$$;

REVOKE ALL ON FUNCTION public.find_member_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_member_id_by_email(TEXT) TO authenticated;
