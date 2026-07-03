'use client';

import { useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { assemblePdf } from '@/lib/export';
import { compressPdf } from '@/lib/compress';
import { downloadBytes, formatBytes } from '@/lib/download';
import { IconDownload, IconShrink, IconSpinner } from './Icons';

interface Result {
  bytes: Uint8Array;
  originalSize: number;
  imagesFound: number;
  imagesRecompressed: number;
}

/**
 * Runs image recompression in a dedicated Web Worker (via lib/compress.ts):
 * embedded JPEGs are decoded, downsampled on an OffscreenCanvas, re-encoded
 * at the chosen quality and swapped back into the PDF with pdf-lib. The UI
 * thread never touches the heavy work.
 */
export default function CompressPanel() {
  const { state, dispatch, replaceWorkspace } = usePdfStore();
  const [quality, setQuality] = useState(0.6);
  const [maxDimension, setMaxDimension] = useState(1600);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setProgress(null);
    try {
      // Compress the assembled working document (order, deletions and edits
      // included), so what you download is exactly what you see.
      const assembled = await assemblePdf(state.sources, state.pages, state.edits, { annots: state.annots, marks: state.marks });
      const originalSize = assembled.byteLength;

      const done = await compressPdf(assembled, {
        quality,
        maxDimension,
        onProgress: (current, total) => setProgress({ current, total }),
      });

      setResult({
        bytes: done.bytes,
        originalSize,
        imagesFound: done.imagesFound,
        imagesRecompressed: done.imagesRecompressed,
      });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Compression failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setRunning(false);
    }
  };

  const savedPct = result
    ? Math.max(0, Math.round((1 - result.bytes.byteLength / result.originalSize) * 100))
    : 0;

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconShrink className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Compress PDF
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Embedded images are downsampled and re-encoded as JPEG in a background Web Worker —
            entirely on this device. Text, fonts and vector graphics are untouched.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>JPEG quality</span>
              <span className="font-mono text-indigo-500 dark:text-indigo-300">{quality.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
              0.6 is a good balance of size and sharpness.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">Max image dimension</span>
            <select
              value={maxDimension}
              onChange={(e) => setMaxDimension(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value={1000}>1000 px — smallest files</option>
              <option value={1600}>1600 px — recommended</option>
              <option value={2400}>2400 px — high quality</option>
              <option value={100000}>Original — re-encode only</option>
            </select>
          </label>

          <button
            onClick={() => void run()}
            disabled={running || state.pages.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {running ? <IconSpinner className="h-4 w-4" /> : <IconShrink className="h-4 w-4" />}
            {running
              ? progress
                ? `Recompressing image ${progress.current} of ${progress.total}…`
                : 'Analyzing document…'
              : 'Compress'}
          </button>

          {running && progress && (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 dark:border-emerald-500/30 dark:bg-emerald-500/5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">−{savedPct}%</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatBytes(result.originalSize)} → {formatBytes(result.bytes.byteLength)}
                </p>
              </div>
              <p className="text-right text-xs text-slate-400 dark:text-slate-500">
                {result.imagesRecompressed} of {result.imagesFound} images recompressed
              </p>
            </div>
            {result.imagesFound === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-300/80">
                No recompressible JPEG images were found in this document — the size change comes
                from restructuring the file only.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => downloadBytes(result.bytes, 'compressed.pdf')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                <IconDownload className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={() => void replaceWorkspace('compressed.pdf', result.bytes)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                title="Continue editing the compressed version"
              >
                Use as working file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
