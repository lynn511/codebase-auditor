'use server';

import { createClient } from '@/lib/supabase/server';

export async function verifyTurnstileAndCreateSession(
  turnstileToken: string
): Promise<{ userId: string } | { error: string }> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v1/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });

  const { success } = (await res.json()) as { success: boolean };
  if (!success) {
    return { error: 'Security check failed. Please try again.' };
  }

  const supabase = await createClient();

  // Reuse existing session if one is present (anonymous or authenticated)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return { userId: user.id };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    return { error: error.message };
  }

  return { userId: data.user!.id };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
