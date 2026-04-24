'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/lib/actions/auth';

type AuthUser = {
  email?: string;
  is_anonymous?: boolean;
};

export default function AuthButton() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      console.log('supabase url:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30))
      console.log('supabase key:', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.slice(0, 20))
      const supabase = createClient();

      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        setUser(session?.user ?? null);
      });

      unsubscribe = () => subscription.unsubscribe();
    } catch {
      // Supabase env vars not set in this environment — render unauthenticated state
    }
    return () => unsubscribe?.();
  }, []);

  const handleSignIn = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const redirectTo = `${window.location.origin}/auth/callback`;

    if (session?.user?.is_anonymous) {
      await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
    } else {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const isAuthenticated = user && !user.is_anonymous;

  if (isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
          {user.email}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            fontSize: 12, fontFamily: 'var(--mono)',
            color: 'var(--dim)', background: 'none',
            border: '1px solid var(--border2)', borderRadius: 8,
            padding: '5px 12px', cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      style={{
        fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
        color: 'var(--text)', background: 'var(--surface)',
        border: '1px solid var(--border2)', borderRadius: 8,
        padding: '7px 14px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        letterSpacing: '0.01em',
      }}
    >
      <GoogleIcon />
      Sign in with Google
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
