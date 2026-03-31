'use client';

import { useState, useRef, useEffect } from 'react';
import type { AuditMessage } from '@/lib/audit-types';
import { API_URL } from '@/lib/config';

export default function ChatInterface({ sessionId, repoName }: { sessionId: string; repoName: string }) {
  const [messages, setMessages] = useState<AuditMessage[]>([{
    id: 'init', role: 'assistant',
    content: `Audit complete for ${repoName}. Ask me anything — specific files, how to fix issues, what to prioritise first.`,
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const msg: AuditMessage = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(p => [...p, msg]);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/audit/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg.content, session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setMessages(p => [...p, {
        id: (Date.now()+1).toString(), role: 'assistant',
        content: data.response, timestamp: new Date(),
      }]);
    } catch {
      setMessages(p => [...p, {
        id: (Date.now()+1).toString(), role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--surface2)',
                border: msg.role === 'user' ? '1px solid rgba(212,245,90,0.2)' : '1px solid var(--border)',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
              }}>
                <p style={{
                  fontSize: 14, lineHeight: 1.65,
                  color: msg.role === 'user' ? 'var(--accent)' : 'var(--text)',
                  whiteSpace: 'pre-wrap', fontFamily: 'var(--font)',
                }}>{msg.content}</p>
                <p style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--dim)', marginTop: 5 }}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex' }}>
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '16px 16px 16px 4px', padding: '14px 18px',
                display: 'flex', gap: 6, alignItems: 'center',
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--dim)',
                    animation: 'bounce 1s ease infinite',
                    animationDelay: `${i * 0.15}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px 18px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          borderRadius: 14, padding: '6px 6px 6px 16px',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about the findings…"
            disabled={isLoading}
            autoFocus
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', padding: '8px 0',
            }}
          />
          <button onClick={send} disabled={!input.trim() || isLoading} style={{
            background: !input.trim() || isLoading ? 'rgba(212,245,90,0.15)' : 'var(--accent)',
            border: 'none', borderRadius: 10, padding: '10px 14px',
            cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
            color: !input.trim() || isLoading ? 'var(--dim)' : '#0e0f11',
            fontWeight: 700, fontSize: 15, transition: 'all 0.15s', lineHeight: 1,
          }}>↑</button>
        </div>
      </div>

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}