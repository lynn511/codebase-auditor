import type { Metadata } from 'next';
import AuditorShell from '@/components/auditor/AuditorShell';
import AuthButton from '@/components/auth/AuthButton';

export const metadata: Metadata = {
  title: 'Codebase Auditor',
  description: 'Analyze any GitHub repository for architecture, MLOps health, and improvement opportunities.',
};

export default function AuditorPage() {
  return (
    <main className="flex flex-col h-screen overflow-hidden" style={{
      background: '#0e0f11',
      fontFamily: "'Syne', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '18px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e0f11',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--accent-dim)',
            border: '1px solid rgba(212,245,90,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 15l4-12 4 12M3 9h12" stroke="#d4f55a" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 800,
              color: 'var(--text)', letterSpacing: '-0.01em',
              lineHeight: 1,
            }}>
              codebase<span style={{ color: 'var(--accent)' }}>auditor</span>
            </div>
            <div style={{
              fontSize: 11, color: 'var(--dim)',
              fontFamily: 'var(--mono)', marginTop: 3,
              letterSpacing: '0.06em',
            }}>
              architecture · mlops · health scoring
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: 32 }}>
          <AuthButton />
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AuditorShell />
      </div>
    </main>
  );
}
