'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface Message {
  role: 'user' | 'advisor';
  text: string;
}

const SUGGESTIONS = [
  'Where should I film a sci-fi series to maximise my rebate?',
  'What is the finance gap if my budget is $10M?',
  'Compare Ireland vs Hungary incentives for a $5M drama.',
  'Which territories allow loans against the rebate?',
];

export default function SynergyAdvisor() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(text?: string) {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const { answer } = await api.advisor.ask(question);
      setMessages((prev) => [...prev, { role: 'advisor', text: answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Advisor unavailable. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-synergy-cyan to-blue-600 shadow-lg shadow-synergy-cyan/30 transition-transform hover:scale-105 active:scale-95"
        aria-label="Open Synergy Advisor"
      >
        {open ? (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="advisor-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-24 right-5 z-50 flex w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-synergy-border/60 bg-synergy-card/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
            style={{ maxHeight: 'min(580px, calc(100dvh - 120px))' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-synergy-border/40 bg-white/[0.03] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-synergy-cyan to-blue-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Synergy Advisor™</p>
                <p className="text-[10px] text-synergy-text">AI-powered incentive intelligence</p>
              </div>
              <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-synergy-text">
                    Ask me anything about film incentives, territory comparisons, or your financing picture.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-lg border border-synergy-border/50 bg-white/[0.04] px-3 py-2 text-left text-[11px] text-synergy-text transition hover:border-synergy-cyan/40 hover:bg-white/[0.07] hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-synergy-cyan/20 text-white border border-synergy-cyan/30'
                        : 'bg-white/[0.06] text-synergy-text border border-synergy-border/40'
                    }`}
                  >
                    {m.role === 'advisor' && (
                      <p className="mb-1 text-[10px] font-semibold text-synergy-cyan">Synergy Advisor™</p>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-1.5 rounded-xl border border-synergy-border/40 bg-white/[0.06] px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-synergy-cyan"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.1, delay: i * 0.18, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-synergy-border/40 p-3">
              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about incentives, territories, financing…"
                  className="flex-1 rounded-lg border border-synergy-border/50 bg-white/[0.05] px-3 py-2 text-xs text-white placeholder:text-synergy-text/60 outline-none focus:border-synergy-cyan/50 focus:ring-1 focus:ring-synergy-cyan/20"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-synergy-cyan text-white transition hover:bg-cyan-400 disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </form>
              <p className="mt-1.5 text-center text-[9px] text-synergy-text/40">
                Powered by Mistral-7B via HuggingFace · Synergy Net™
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
