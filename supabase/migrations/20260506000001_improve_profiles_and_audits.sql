-- ── Profiles safety ───────────────────────────────────────────────────────────

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Add WITH CHECK so the policy constrains the post-update state, not just the target row
DROP POLICY IF EXISTS "Users can update their own profile"
  ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING   (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- When an anonymous user links a Google identity, Supabase UPDATEs their auth.users
-- row (no new INSERT), so handle_new_user never fires and the profile stays empty.
-- This trigger patches the profile whenever a real email is attached for the first time.
CREATE OR REPLACE FUNCTION public.handle_user_updated()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND (OLD.email IS NULL OR OLD.email != NEW.email) THEN
    UPDATE public.profiles
    SET
      email        = NEW.email,
      display_name = COALESCE(NEW.raw_user_meta_data->>'full_name', display_name),
      avatar_url   = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_updated();

-- ── Audits performance ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS audits_user_id_created_at_idx
  ON public.audits (user_id, created_at DESC);
