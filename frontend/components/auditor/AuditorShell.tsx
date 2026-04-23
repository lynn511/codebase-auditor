'use client';

import { useState } from 'react';
import { ingestRepo, type ScanStage } from '@/lib/github';
import type { AuditReport } from '@/lib/audit-types';
import { API_URL } from '@/lib/config';
import { verifyTurnstileAndCreateSession } from '@/lib/actions/auth';
import type { ScanPhase } from './ScanProgress';
import RepoInput from './RepoInput';
import ScanProgress from './ScanProgress';
import ReportPanel from './ReportPanel';
import ChatInterface from './ChatInterface';

type AppPhase = 'idle' | 'scanning' | 'done' | 'error';

function toScanPhase(s: ScanStage): ScanPhase {
  if (s === 'fetching-tree')  return 'fetching-tree';
  if (s === 'sampling-files') return 'sampling-files';
  return 'analyzing';
}

export default function AuditorShell() {
  const [appPhase, setAppPhase]         = useState<AppPhase>('idle');
  const [scanPhase, setScanPhase]       = useState<ScanPhase>('fetching-tree');
  const [currentRepo, setCurrentRepo]   = useState('');
  const [report, setReport]             = useState<AuditReport | null>(null);
  const [sessionId, setSessionId]       = useState('');
  const [error, setError]               = useState('');
  const [chatOpen, setChatOpen]         = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const runAudit = async (repo: string, turnstileToken: string) => {
    setCurrentRepo(repo);
    setAppPhase('scanning');
    setError(''); setReport(null); setSessionId(''); setChatOpen(false);
    try {
      const authResult = await verifyTurnstileAndCreateSession(turnstileToken);
      if ('error' in authResult) throw new Error(authResult.error);

      const ingestion = await ingestRepo(repo, (s: ScanStage) => setScanPhase(toScanPhase(s)));
      setScanPhase('analyzing');
      const res = await fetch(`${API_URL}/audit/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: ingestion.repo,
          total_files: ingestion.totalFiles,
          file_tree: ingestion.fileTree,
          sampled_files: ingestion.sampledFiles,
          user_id: authResult.userId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(d.detail || `API error ${res.status}`);
      }
      const data = await res.json();
      setReport(data.report);
      setSessionId(data.session_id);
      setScanPhase('done');
      setAppPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAppPhase('error');
      setTurnstileKey(k => k + 1);
    }
  };

  const reset = () => {
    setAppPhase('idle'); setReport(null);
    setSessionId(''); setError(''); setCurrentRepo(''); setChatOpen(false);
    setTurnstileKey(k => k + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>

      {/* Input bar */}
      <div style={{
        flexShrink: 0, padding: '28px 40px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'radial-gradient(ellipse 80% 120% at 50% 0%, rgba(212,245,90,0.03) 0%, transparent 70%)',
      }}>
        <RepoInput key={turnstileKey} onSubmit={runAudit} isLoading={appPhase === 'scanning'} />
      </div>

      {/* Idle */}
      {appPhase === 'idle' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 500 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, margin: '0 auto 24px',
              background: 'var(--accent-dim)', border: '1px solid rgba(212,245,90,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" stroke="#d4f55a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Audit any GitHub repository
            </p>
            <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.75 }}>
              Paste a public repository above to map its architecture, identify MLOps issues, and get actionable recommendations — instantly.
            </p>
          </div>
        </div>
      )}

      {/* Scanning */}
      {appPhase === 'scanning' && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px', overflowY: 'auto',
        }}>
          <ScanProgress phase={scanPhase} repo={currentRepo} />
        </div>
      )}

      {/* Error */}
      {appPhase === 'error' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: '100%', maxWidth: 560 }}>
            <div style={{
              background: 'var(--red-dim)', border: '1px solid rgba(255,94,94,0.2)',
              borderRadius: 14, padding: '20px 24px',
            }}>
              <p style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{error}</p>
              <button onClick={reset} style={{
                marginTop: 12, fontSize: 13, fontFamily: 'var(--mono)',
                color: 'var(--red)', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', padding: 0,
              }}>Try again</button>
            </div>
          </div>
        </div>
      )}

      {/* Done — full width report */}
      {appPhase === 'done' && report && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px 80px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <p style={{
                fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--dim)',
              }}>Audit Report</p>
              <button onClick={reset} style={{
                fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--dim)',
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}>← new audit</button>
            </div>
            <ReportPanel report={report} />
          </div>
        </div>
      )}

      {/* ── Floating chat button ── */}
      {appPhase === 'done' && sessionId && (
        <>
          <button
            onClick={() => setChatOpen(o => !o)}
            style={{
              position: 'fixed', bottom: 32, right: 32, zIndex: 50,
              width: 56, height: 56, borderRadius: '50%',
              background: chatOpen ? 'var(--surface2)' : 'var(--accent)',
              border: chatOpen ? '1px solid var(--border2)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: chatOpen ? 'none' : '0 4px 24px rgba(212,245,90,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {chatOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 4l10 10M14 4L4 14" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#0e0f11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Chat panel — slides in from right */}
          {chatOpen && (
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40,
              width: 460,
              background: '#0e0f11',
              borderLeft: '1px solid rgba(255,255,255,0.09)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
              animation: 'slideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}>
              {/* Chat header */}
              <div style={{
                flexShrink: 0, padding: '20px 24px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Ask the auditor</p>
                  <p style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--dim)', marginTop: 3 }}>
                    {currentRepo}
                  </p>
                </div>
                <button onClick={() => setChatOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--dim)', fontSize: 20, lineHeight: 1, padding: 4,
                }}>×</button>
              </div>

              {/* Chat body */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <ChatInterface sessionId={sessionId} repoName={currentRepo} />
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
