-- profiles: one row per authenticated user, created automatically on signup
CREATE TABLE public.profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email               text,
  display_name        text,
  avatar_url          text,
  github_username     text,
  github_access_token text,              -- TODO (Step 5): stored plaintext; encrypt or move to a secrets store when GitHub OAuth is implemented
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- trigger function: fires after a new auth.users row is created (e.g. OAuth signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
