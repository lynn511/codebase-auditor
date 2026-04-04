'use client';

import { useState } from 'react';
import type { AuditReport, ArchComponent, AuditIssue, Recommendation } from '@/lib/audit-types';

function scoreColor(s: string) {
  const g = s?.[0]?.toUpperCase();
  if (g === 'A') return '#52d48a';
  if (g === 'B') return '#d4f55a';
  if (g === 'C') return '#f0a832';
  if (g === 'D') return '#ff8c42';
  return '#ff5e5e';
}

function statusStyle(s: string) {
  if (s === 'found')    return { border: 'rgba(82,212,138,0.3)',  left: '#52d48a', label: 'found',   lc: '#52d48a' };
  if (s === 'partial')  return { border: 'rgba(240,168,50,0.3)',  left: '#f0a832', label: 'partial', lc: '#f0a832' };
  return                       { border: 'rgba(255,94,94,0.2)',   left: '#ff5e5e', label: 'missing', lc: '#ff5e5e' };
}

function severityStyle(s: string) {
  if (s === 'critical') return { left: '#ff5e5e', icon: '✕', c: '#ff5e5e', bg: 'rgba(255,94,94,0.08)' };
  if (s === 'warning')  return { left: '#f0a832', icon: '!', c: '#f0a832', bg: 'rgba(240,168,50,0.08)' };
  return                       { left: '#5ab4f5', icon: 'i', c: '#5ab4f5', bg: 'rgba(90,180,245,0.08)' };
}

function impactStyle(i?: string) {
  if (i === 'high')   return { bg: 'var(--red-dim)',   c: 'var(--red)' };
  if (i === 'medium') return { bg: 'var(--amber-dim)', c: 'var(--amber)' };
  return                     { bg: 'var(--green-dim)', c: 'var(--green)' };
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '24px 28px', ...style,
    }}>{children}</div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 18,
    }}>{children}</p>
  );
}

function ArchCard({ comp }: { comp: ArchComponent }) {
  const ss = statusStyle(comp.status);
  const files = comp.key_files ?? [];
  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 12,
      border: `1px solid ${ss.border}`,
      borderLeft: `3px solid ${ss.left}`,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{comp.component}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: ss.lc }}>{ss.label}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{comp.description}</p>
      {files.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {files.slice(0, 3).map((f, i) => (
            <span key={i} style={{
              fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--dim)',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '3px 8px',
            }}>{f.split('/').pop()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueItem({ issue }: { issue: AuditIssue }) {
  const [open, setOpen] = useState(false);
  const ss = severityStyle(issue.severity);
  return (
    <div style={{
      borderLeft: `3px solid ${ss.left}`,
      background: ss.bg,
      borderRadius: '0 12px 12px 0',
      overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        padding: '16px 18px',
      }}>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          background: `${ss.c}18`, border: `1px solid ${ss.c}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: ss.c, marginTop: 1,
          fontFamily: 'var(--mono)',
        }}>{ss.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{issue.title}</p>
          {issue.location && (
            <p style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--dim)' }}>{issue.location}</p>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px 54px' }}>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>{issue.detail}</p>
        </div>
      )}
    </div>
  );
}

function RecItem({ rec, index }: { rec: Recommendation; index: number }) {
  const [open, setOpen] = useState(false);
  const ic = impactStyle(rec.impact);
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        padding: '16px 18px',
      }}>
        <span style={{
          flexShrink: 0, width: 26, height: 26,
          background: 'var(--accent-dim)', border: '1px solid rgba(212,245,90,0.25)',
          borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)', marginTop: 1,
        }}>{rec.priority}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>{rec.title}</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {rec.impact && (
              <span style={{
                fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 10px',
                borderRadius: 10, background: ic.bg, color: ic.c,
              }}>{rec.impact} impact</span>
            )}
            {rec.effort && (
              <span style={{
                fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 10px',
                borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)',
              }}>{rec.effort} effort</span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--dim)', flexShrink: 0, marginTop: 3 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px 58px' }}>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>{rec.detail}</p>
        </div>
      )}
    </div>
  );
}

export default function ReportPanel({ report }: { report: AuditReport }) {
  const score    = report.score;
  const issues   = report.issues ?? [];
  const critical = issues.filter(i => i.severity === 'critical');
  const warnings = issues.filter(i => i.severity === 'warning');
  const info     = issues.filter(i => i.severity === 'info');
  const recs     = report.recommendations ?? [];
  const arch     = report.architecture ?? [];
  const stats    = report.stats;
  const sc       = scoreColor(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Hero */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              fontSize: 96, fontWeight: 800, fontFamily: 'var(--mono)',
              color: sc, lineHeight: 1, letterSpacing: '-0.04em',
            }}>{score}</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--dim)', marginTop: 6, letterSpacing: '0.04em' }}>
              health score
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, paddingTop: 8 }}>
            <p style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 10, letterSpacing: '0.02em' }}>
              {report.repo}
            </p>
            <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.75 }}>{report.summary}</p>
            {report.score_rationale && (
              <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 10, fontStyle: 'italic' }}>{report.score_rationale}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', marginTop: 28, paddingTop: 24,
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { val: stats?.total_files     ?? 0, label: 'files',    c: 'var(--text)' },
            { val: stats?.critical        ?? 0, label: 'critical', c: 'var(--red)' },
            { val: stats?.warnings        ?? 0, label: 'warnings', c: 'var(--amber)' },
            { val: stats?.info            ?? 0, label: 'info',     c: 'var(--blue)' },
            { val: stats?.recommendations ?? 0, label: 'recs',     c: 'var(--accent)' },
          ].map((s, i, arr) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: s.c, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Architecture */}
      {arch.length > 0 && (
        <Card>
          <SectionLabel>Architecture Map</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {arch.map((c, i) => <ArchCard key={i} comp={c} />)}
          </div>
        </Card>
      )}

      {critical.length > 0 && (
        <Card>
          <SectionLabel>Critical Issues ({critical.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {critical.map((issue, i) => <IssueItem key={i} issue={issue} />)}
          </div>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card>
          <SectionLabel>Warnings ({warnings.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {warnings.map((issue, i) => <IssueItem key={i} issue={issue} />)}
          </div>
        </Card>
      )}

      {info.length > 0 && (
        <Card>
          <SectionLabel>Info ({info.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {info.map((issue, i) => <IssueItem key={i} issue={issue} />)}
          </div>
        </Card>
      )}

      {recs.length > 0 && (
        <Card>
          <SectionLabel>Recommendations</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((rec, i) => <RecItem key={i} rec={rec} index={i} />)}
          </div>
        </Card>
      )}
    </div>
  );
}