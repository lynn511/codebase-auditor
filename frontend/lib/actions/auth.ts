'use server';

import { createClient } from '@/lib/supabase/server';

export async function verifyTurnstileAndCreateSession(
  turnstileToken: string
): Promise<{ userId: string; accessToken: string } | { error: string }> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: turnstileToken,
    }),
  });

  const { success } = (await res.json()) as { success: boolean };
  if (!success) {
    return { error: 'Security check failed. Please try again.' };
  }

  const supabase = await createClient();

  // Reuse existing session if one is present (anonymous or authenticated)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    return { userId: session.user.id, accessToken: session.access_token };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    return { error: error.message };
  }

  return { userId: data.user!.id, accessToken: data.session!.access_token };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}