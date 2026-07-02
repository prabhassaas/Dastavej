'use client';

import { useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { runOcr, type OcrResult } from '@/lib/ocr';
import { downloadBytes } from '@/lib/download';
import { IconDownload, IconScan, IconSpinner } from './Icons';

/**
 * Client-side OCR: pages are rasterized to a canvas with pdf.js and handed to
 * tesseract.js, which does the recognition inside its own Web Worker (WASM).
 * The document never leaves the browser.
 */
export default function OcrPanel() {
  const { state, dispatch } = usePdfStore();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<OcrResult[]>([]);
  const [copied, setCopied] = useState(false);

  const run = async (all: boolean) => {
    setRunning(true);
    setResults([]);
    setStatus('Loading OCR engine…');
    try {
      const entries = (all ? state.pages : [state.pages[state.currentPage]]).map((entry) => ({
        entry,
        pageNumber: state.pages.indexOf(entry) + 1,
      }));
      const out = await runOcr(entries, (p) => {
        const label = `page ${p.pageIndex + 1}/${p.totalPages}`;
        setStatus(
          p.phase === 'render'
            ? `Rendering ${label}…`
            : `Recognizing text on ${label} — ${Math.round(p.progress * 100)}%`,
        );
      });
      setResults(out);
      setStatus('');
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `OCR failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      setStatus('');
    } finally {
      setRunning(false);
    }
  };

  const fullText = results
    .map((r) => (results.length > 1 ? `--- Page ${r.page} ---\n${r.text}` : r.text))
    .join('\n\n');

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <IconScan className="h-5 w-5 text-indigo-400" />
            OCR — extract text
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Recognition runs locally in a tesseract.js Web Worker — engine, WASM core and the
            English language model are all served with the app. Your document is never uploaded
            anywhere.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void run(false)}
            disabled={running || state.pages.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {running ? <IconSpinner className="h-4 w-4" /> : <IconScan className="h-4 w-4" />}
            Current page ({state.currentPage + 1})
          </button>
          <button
            onClick={() => void run(true)}
            disabled={running || state.pages.length === 0}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-400 disabled:opacity-50"
          >
            All {state.pages.length} pages
          </button>
          {status && <span className="text-sm text-indigo-300">{status}</span>}
        </div>

        {results.length > 0 && (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void copy()}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
              >
                {copied ? 'Copied!' : 'Copy all'}
              </button>
              <button
                onClick={() =>
                  downloadBytes(new TextEncoder().encode(fullText), 'extracted-text.txt', 'text/plain')
                }
                className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
              >
                <IconDownload className="h-3.5 w-3.5" />
                Download .txt
              </button>
              <span className="text-xs text-slate-500">
                {fullText.length.toLocaleString()} characters extracted
              </span>
            </div>
            <textarea
              readOnly
              value={fullText}
              className="min-h-64 flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900/60 p-4 font-mono text-sm leading-relaxed text-slate-200 outline-none"
            />
          </>
        )}
      </div>
    </div>
  );
}
