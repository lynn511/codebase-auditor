-- audits: one row per repo audit run, owned by a logged-in user
CREATE TABLE public.audits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  repo_url     text        NOT NULL,
  report       jsonb       NOT NULL,
  health_score text        CHECK (health_score IN ('A','B','C','D','F')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own audits"
  ON public.audits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audits"
  ON public.audits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audits"
  ON public.audits FOR DELETE
  USING (auth.uid() = user_id);
