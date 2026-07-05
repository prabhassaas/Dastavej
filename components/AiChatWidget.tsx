'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { aiChat, isAiConfigured, loadAiSettings, PROFESSIONAL_STYLE_INSTRUCTION, type ChatMessage } from '@/lib/ai';
import { buildPdfFromMarkdown } from '@/lib/mdPdf';
import { downloadBytes } from '@/lib/download';
import { IconDownload, IconSparkle, IconSpinner, IconX } from './Icons';

const SYSTEM_PROMPT =
  `You are the in-app assistant for Dastavej, a 100% free, client-side PDF editor — no ` +
  `backend, nothing ever uploaded. You help with two things:\n` +
  `1. Writing/generating content on request (reports, letters, summaries, articles) that the ` +
  `user can download from this chat as a ready-made PDF.\n` +
  `2. Explaining, step by step, how to use Dastavej's own features when asked. Only refer to ` +
  `features that actually exist, using these exact tab names:\n` +
  `- View: open PDFs, zoom, page navigation.\n` +
  `- Organize: reorder/rotate/duplicate/delete pages, merge multiple PDFs, extract a page, ` +
  `Split (custom ranges or every N pages, zipped if multiple outputs).\n` +
  `- Edit: click any text block to rewrite it, or add new text boxes.\n` +
  `- Annotate: highlight, outlined boxes, freehand ink/signatures, image stamps, Magic grab ` +
  `(lift an object off the page), a Select tool to move/resize/delete.\n` +
  `- Watermark: diagonal text watermark, header/footer text with page numbers.\n` +
  `- Convert: PDF -> Word, Excel (with real table-column detection), CSV, PowerPoint, or ` +
  `Images; and Images -> PDF.\n` +
  `- Forms: build fillable forms from templates or from scratch, collect filled copies into ` +
  `Excel/CSV, Flatten & sign (burns values in permanently).\n` +
  `- Compress: shrinks file size by recompressing embedded images in a Web Worker.\n` +
  `- OCR: extract text from scanned pages or a standalone photo/screenshot; "Improve with AI" ` +
  `cleans up recognition errors; download as .txt or Word.\n` +
  `- Read aloud: text-to-speech using the browser's own voices.\n` +
  `Give concise, step-by-step answers that name the actual tab. Ask a clarifying question only ` +
  `if truly necessary. ${PROFESSIONAL_STYLE_INSTRUCTION}`;

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Global floating assistant, present on every page (mounted in the root
 * layout, so it works with no PDF workspace open). Shares the same
 * bring-your-own-AI settings as the AI tab (same localStorage config) — it's
 * a second way to reach the same Ollama/OpenAI-compatible endpoint, for
 * quick chat/generation or "how do I..." feature guidance without leaving
 * whatever page you're on. Conversation is in-memory only; it resets on
 * reload.
 */
export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true); // avoid a flash of the nudge before mount
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setConfigured(isAiConfigured(loadAiSettings()));
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setSending(true);
    try {
      const history: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...next.map((m) => ({ role: m.role, content: m.content })),
      ];
      const reply = await aiChat(history);
      setMessages((cur) => [...cur, { role: 'assistant', content: reply.trim() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const downloadAsPdf = async (content: string, seedTitle: string) => {
    try {
      const title = seedTitle.trim().slice(0, 60) || 'Dastavej AI response';
      const bytes = await buildPdfFromMarkdown(title, content);
      const name = `${title.toLowerCase().replace(/[^\w]+/g, '-').slice(0, 48) || 'document'}.pdf`;
      downloadBytes(bytes, name);
    } catch (err) {
      setError(`Could not build PDF: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[32rem] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <IconSparkle className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              Dastavej Assistant
            </p>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          {!configured ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              <IconSparkle className="h-6 w-6 text-indigo-400" />
              <p>
                Set up a free AI provider first (Ollama, LM Studio, Groq…) in the app's{' '}
                <b>AI tab</b> — this chat shares that same configuration.
              </p>
              <Link
                href="/"
                className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                Open Dastavej
              </Link>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Ask me to write something (I'll offer it as a downloadable PDF), or ask "how do
                    I split a PDF" / "how do I add a watermark" for feature help.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {m.content}
                      {m.role === 'assistant' && (
                        <button
                          onClick={() =>
                            void downloadAsPdf(m.content, messages[i - 1]?.content ?? 'Dastavej AI response')
                          }
                          className="mt-2 flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                        >
                          <IconDownload className="h-3 w-3" />
                          Download as PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <IconSpinner className="h-3.5 w-3.5" />
                    Thinking…
                  </div>
                )}
                {error && <p className="text-xs text-red-500">✗ {error}</p>}
              </div>
              <div className="flex shrink-0 items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Ask or request a document…"
                  className="max-h-24 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  onClick={() => void send()}
                  disabled={sending || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50"
                  aria-label="Send"
                >
                  {sending ? <IconSpinner className="h-4 w-4" /> : <IconSparkle className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 transition hover:bg-indigo-400"
        title="Dastavej Assistant"
        aria-label="Toggle AI assistant"
      >
        {open ? <IconX className="h-5 w-5" /> : <IconSparkle className="h-6 w-6" />}
      </button>
    </div>
  );
}
