'use client';

import { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { assemblePdf } from '@/lib/export';
import { downloadBytes } from '@/lib/download';
import { printPdf } from '@/lib/print';
import { IconClock, IconDownload, IconPlus, IconPrinter, IconSpinner, IconTrash } from './Icons';

/** Live date & clock shown next to the print button. */
function DateClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <div
      className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 lg:flex dark:border-slate-700"
      title="Current date & time — stamped on printouts"
    >
      <IconClock className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
      <div className="text-right leading-tight">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {now.toLocaleDateString(undefined, {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <p className="font-mono text-xs tabular-nums">{now.toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

export default function Header() {
  const { state, dispatch, addFiles, clearAll } = usePdfStore();
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sourceList = Object.values(state.sources);
  const title =
    sourceList.length === 1 ? sourceList[0].name : `${sourceList.length} files (merged)`;

  const exportName =
    sourceList.length === 1 ? sourceList[0].name.replace(/\.pdf$/i, '-edited.pdf') : 'merged.pdf';

  const handleExport = async () => {
    setExporting(true);
    try {
      const bytes = await assemblePdf(state.sources, state.pages, state.edits, { annots: state.annots, marks: state.marks });
      downloadBytes(bytes, exportName);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const bytes = await assemblePdf(state.sources, state.pages, state.edits, { annots: state.annots, marks: state.marks });
      await printPdf(bytes, true);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Print failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setPrinting(false);
    }
  };

  const secondaryBtn =
    'flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-500 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {state.pages.length} page{state.pages.length === 1 ? '' : 's'}
        </p>
      </div>

      <DateClock />

      <button
        onClick={() => void handlePrint()}
        disabled={printing || state.pages.length === 0}
        className={secondaryBtn}
        title="Print — each page is stamped with the current date & time"
      >
        {printing ? <IconSpinner className="h-4 w-4" /> : <IconPrinter className="h-4 w-4" />}
        Print
      </button>

      <button
        onClick={() => inputRef.current?.click()}
        className={secondaryBtn}
        title="Add more PDFs — their pages are appended (merge)"
      >
        <IconPlus className="h-4 w-4" />
        Add PDF
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <button
        onClick={clearAll}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-red-400 hover:text-red-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/60 dark:hover:text-red-300"
        title="Close all files and start over"
      >
        <IconTrash className="h-4 w-4" />
        Close
      </button>

      <button
        onClick={() => void handleExport()}
        disabled={exporting || state.pages.length === 0}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-50"
      >
        {exporting ? <IconSpinner className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
    </header>
  );
}
