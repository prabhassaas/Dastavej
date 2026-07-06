'use client';

import { useState } from 'react';
import { aiChat } from '@/lib/ai';
import { buildRagIndex, searchRagIndex, formatContext, type RagChunk } from '@/lib/rag';
import { API_FUNCTIONS, API_EXAMPLES } from '@/lib/apiDocs';
import { IconSparkle, IconSpinner } from './Icons';

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

/**
 * Self-contained RAG chat over the public API reference on this page — no
 * PDF workspace involved, so it works standalone on a static page. The
 * corpus (function reference + code examples) is embedded once per visit
 * and searched locally; the model only sees the few most relevant excerpts,
 * so answers quote real signatures instead of guessing from memory.
 */
export default function ApiDocChat() {
  const [index, setIndex] = useState<RagChunk[] | null>(null);
  const [building, setBuilding] = useState(false);
  const [status, setStatus] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<{ question: string; answer: string; sources: string[] }[]>([]);
  const [error, setError] = useState('');

  const buildIndex = async () => {
    setBuilding(true);
    setError('');
    setStatus('Embedding API reference…');
    try {
      const items = [
        ...API_FUNCTIONS.map((f) => ({ text: `${f.name} (lib/${f.from}.ts): ${f.desc}`, source: f.name })),
        ...API_EXAMPLES.map((e) => ({ text: `Example — ${e.title}:\n${e.code}`, source: e.title })),
      ];
      const built = await buildRagIndex(items, (done, total) => setStatus(`Embedding… ${done}/${total}`));
      setIndex(built);
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    } finally {
      setBuilding(false);
    }
  };

  const ask = async () => {
    if (!index || !question.trim() || asking) return;
    const q = question.trim();
    setQuestion('');
    setAsking(true);
    setError('');
    try {
      const top = await searchRagIndex(index, q, 5);
      const context = formatContext(top);
      const answer = await aiChat([
        {
          role: 'system',
          content:
            "Answer the developer's question about the Dastavej Core API using ONLY the " +
            'provided reference excerpts. Quote exact function names/signatures from the ' +
            "excerpts — don't invent parameters. If the excerpts don't cover it, say so plainly.",
        },
        { role: 'user', content: `API reference excerpts:\n${context}\n\nQuestion: ${q}` },
      ]);
      setHistory((h) => [
        ...h,
        { question: q, answer: answer.trim(), sources: [...new Set(top.map((c) => c.source ?? '').filter(Boolean))] },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      {!index ? (
        <button
          onClick={() => void buildIndex()}
          disabled={building}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {building ? <IconSpinner className="h-4 w-4" /> : <IconSparkle className="h-4 w-4" />}
          {building ? status || 'Indexing…' : 'Index the API reference & ask a question'}
        </button>
      ) : (
        <>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ Indexed {index.length} reference chunk{index.length === 1 ? '' : 's'} — ask away.
          </p>
          {history.length > 0 && (
            <div className="space-y-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              {history.map((h, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Q: {h.question}</p>
                  <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200">{h.answer}</p>
                  {h.sources.length > 0 && (
                    <p className="font-mono text-[11px] text-slate-400">{h.sources.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {asking && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <IconSpinner className="h-3.5 w-3.5" />
              Thinking…
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask();
              }}
              placeholder='e.g. "how do I split a PDF by page ranges?"'
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={() => void ask()}
              disabled={asking || !question.trim()}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-500">✗ {error}</p>}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Uses whatever AI provider is configured in the app's AI tab (shared browser storage) —
        needs a provider with an embeddings endpoint, e.g. Ollama with{' '}
        <code className="rounded bg-black/5 px-1 dark:bg-white/10">ollama pull nomic-embed-text</code>.
      </p>
    </div>
  );
}
