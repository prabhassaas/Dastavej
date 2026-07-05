'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { runOcr, ocrImages, type OcrResult } from '@/lib/ocr';
import { buildWordFromPages } from '@/lib/convert';
import { downloadBytes } from '@/lib/download';
import { improveOcrText, isAiConfigured, loadAiSettings } from '@/lib/ai';
import { IconDownload, IconImage, IconPlus, IconScan, IconSparkle, IconSpinner, IconX } from './Icons';

/** Runs the AI cleanup pass over each item's text in turn, reporting progress. */
async function improveAllWithAi<T extends { text: string }>(
  items: T[],
  onProgress: (i: number, total: number) => void,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < items.length; i++) {
    onProgress(i, items.length);
    out.push({ ...items[i], text: await improveOcrText(items[i].text) });
  }
  return out;
}

/**
 * Client-side OCR: pages are rasterized to a canvas with pdf.js and handed to
 * tesseract.js, which does the recognition inside its own Web Worker (WASM).
 * The document never leaves the browser.
 */
export default function OcrPanel() {
  const { state, dispatch } = usePdfStore();
  const hasDocument = state.pages.length > 0;
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<OcrResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [enhance, setEnhance] = useState(false);
  const [improving, setImproving] = useState(false);
  const aiConfigured = isAiConfigured(loadAiSettings());

  const improveWithAi = async () => {
    setImproving(true);
    try {
      const improved = await improveAllWithAi(results, (i, total) =>
        setStatus(`Improving with AI — page ${i + 1}/${total}…`),
      );
      setResults(improved);
      setStatus('');
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `AI cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      setStatus('');
    } finally {
      setImproving(false);
    }
  };

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
      }, { enhance });
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

  const downloadWord = async () => {
    try {
      const bytes = await buildWordFromPages(results.map((r) => r.text));
      downloadBytes(
        bytes,
        'extracted-text.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not build Word document: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-8 overflow-auto p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <IconScan className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              OCR — extract text
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Recognition runs locally in a tesseract.js Web Worker — engine, WASM core and the
              English language model are all served with the app. Your document is never uploaded
              anywhere.
            </p>
          </div>

          {hasDocument && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void run(false)}
                  disabled={running}
                  className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  {running ? <IconSpinner className="h-4 w-4" /> : <IconScan className="h-4 w-4" />}
                  Current page ({state.currentPage + 1})
                </button>
                <button
                  onClick={() => void run(true)}
                  disabled={running}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                >
                  All {state.pages.length} pages
                </button>
                {status && <span className="text-sm text-indigo-500 dark:text-indigo-300">{status}</span>}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={enhance}
                  onChange={(e) => setEnhance(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                Enhance low-quality scan (grayscale + auto-threshold) — turn on for faded
                photocopies and phone photos; leave off for clean digital PDFs
              </label>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Tip for the most accurate result: enable Enhance for photos/faded scans, then run
                the "Improve with AI" pass below to catch remaining recognition errors — no OCR
                engine is 100% precise on its own.
              </p>

              {results.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void copy()}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                    >
                      {copied ? 'Copied!' : 'Copy all'}
                    </button>
                    <button
                      onClick={() => void improveWithAi()}
                      disabled={improving || !aiConfigured}
                      title={aiConfigured ? undefined : 'Configure an AI provider in the AI tab first'}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs text-indigo-600 hover:border-indigo-400 disabled:opacity-40 dark:border-indigo-700 dark:text-indigo-300"
                    >
                      {improving ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSparkle className="h-3.5 w-3.5" />}
                      Improve with AI
                    </button>
                    <button
                      onClick={() =>
                        downloadBytes(new TextEncoder().encode(fullText), 'extracted-text.txt', 'text/plain')
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                    >
                      <IconDownload className="h-3.5 w-3.5" />
                      Download .txt
                    </button>
                    <button
                      onClick={() => void downloadWord()}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                    >
                      <IconDownload className="h-3.5 w-3.5" />
                      Download as Word
                    </button>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {fullText.length.toLocaleString()} characters extracted
                    </span>
                  </div>
                  <textarea
                    readOnly
                    value={fullText}
                    className="min-h-64 flex-1 resize-none rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed outline-none dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
                  />
                </>
              )}
            </>
          )}

          {!hasDocument && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Open a PDF (top-left) to OCR its pages, or use the standalone image tool below —
              neither requires the other.
            </p>
          )}
        </div>

        <ImageOcrTool />
      </div>
    </div>
  );
}

/**
 * Standalone image → editable text/Word, no PDF required first. Handy for a
 * phone photo of a document, a screenshot, or any scan that never went
 * through a PDF at all.
 */
function ImageOcrTool() {
  const { dispatch } = usePdfStore();
  const [files, setFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<{ name: string; text: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [improving, setImproving] = useState(false);
  const aiConfigured = isAiConfigured(loadAiSettings());
  const inputRef = useRef<HTMLInputElement>(null);

  const improveWithAi = async () => {
    setImproving(true);
    try {
      const improved = await improveAllWithAi(results, (i, total) =>
        setStatus(`Improving with AI — ${i + 1}/${total}…`),
      );
      setResults(improved);
      setStatus('');
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `AI cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      setStatus('');
    } finally {
      setImproving(false);
    }
  };

  const addFiles = (list: FileList) => {
    const picked = Array.from(list).filter((f) => f.type === 'image/png' || f.type === 'image/jpeg');
    if (!picked.length) {
      dispatch({ type: 'SET_ERROR', error: 'Please choose PNG or JPEG images.' });
      return;
    }
    setFiles((prev) => [...prev, ...picked.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    setResults([]);
  };

  const run = async () => {
    setRunning(true);
    setResults([]);
    setStatus('Loading OCR engine…');
    try {
      const images = await Promise.all(
        files.map(async ({ file }) => ({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
          mime: file.type,
        })),
      );
      const out = await ocrImages(images, (p) => {
        const label = `image ${p.pageIndex + 1}/${p.totalPages}`;
        setStatus(
          p.phase === 'render'
            ? `Reading ${label}…`
            : `Recognizing text on ${label} — ${Math.round(p.progress * 100)}%`,
        );
      }, { enhance });
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
    .map((r) => (results.length > 1 ? `--- ${r.name} ---\n${r.text}` : r.text))
    .join('\n\n');

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadWord = async () => {
    try {
      const bytes = await buildWordFromPages(results.map((r) => r.text));
      downloadBytes(
        bytes,
        'image-text.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not build Word document: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <IconImage className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
        Extract text from an image
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        A photo, screenshot or scan — straight to editable text or a Word document, no PDF needed.
      </p>

      <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-400"
        >
          <IconPlus className="h-4 w-4" />
          Add photos or scans (PNG/JPEG) — pick several at once
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {files.length > 0 && (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {files.map((f, i) => (
              <div
                key={f.previewUrl}
                className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.previewUrl} alt={f.file.name} className="h-full w-full object-cover" />
                <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
                  {i + 1}
                </span>
                <button
                  onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 hidden rounded-full bg-slate-900/80 p-0.5 text-white group-hover:block"
                  title="Remove"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={enhance}
            onChange={(e) => setEnhance(e.target.checked)}
            className="h-4 w-4 accent-indigo-500"
          />
          Enhance (grayscale + auto-threshold) — recommended for phone photos
        </label>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Tip for the most accurate result: keep Enhance on for phone photos, then run "Improve
          with AI" below to catch remaining recognition errors.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void run()}
            disabled={running || files.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {running ? <IconSpinner className="h-4 w-4" /> : <IconScan className="h-4 w-4" />}
            Extract text
          </button>
          {status && <span className="text-sm text-indigo-500 dark:text-indigo-300">{status}</span>}
        </div>

        {results.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void copy()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
              >
                {copied ? 'Copied!' : 'Copy all'}
              </button>
              <button
                onClick={() => void improveWithAi()}
                disabled={improving || !aiConfigured}
                title={aiConfigured ? undefined : 'Configure an AI provider in the AI tab first'}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs text-indigo-600 hover:border-indigo-400 disabled:opacity-40 dark:border-indigo-700 dark:text-indigo-300"
              >
                {improving ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSparkle className="h-3.5 w-3.5" />}
                Improve with AI
              </button>
              <button
                onClick={() =>
                  downloadBytes(new TextEncoder().encode(fullText), 'image-text.txt', 'text/plain')
                }
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
              >
                <IconDownload className="h-3.5 w-3.5" />
                Download .txt
              </button>
              <button
                onClick={() => void downloadWord()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
              >
                <IconDownload className="h-3.5 w-3.5" />
                Download as Word
              </button>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {fullText.length.toLocaleString()} characters extracted
              </span>
            </div>
            <textarea
              readOnly
              value={fullText}
              className="min-h-48 w-full resize-none rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed outline-none dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </>
        )}
      </div>
    </div>
  );
}
