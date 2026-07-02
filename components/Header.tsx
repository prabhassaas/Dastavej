'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { assemblePdf } from '@/lib/export';
import { downloadBytes } from '@/lib/download';
import { IconDownload, IconPlus, IconSpinner, IconTrash } from './Icons';

export default function Header() {
  const { state, dispatch, addFiles, clearAll } = usePdfStore();
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sourceList = Object.values(state.sources);
  const title =
    sourceList.length === 1 ? sourceList[0].name : `${sourceList.length} files (merged)`;

  const exportName =
    sourceList.length === 1 ? sourceList[0].name.replace(/\.pdf$/i, '-edited.pdf') : 'merged.pdf';

  const handleExport = async () => {
    setExporting(true);
    try {
      const bytes = await assemblePdf(state.sources, state.pages, state.edits);
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

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/60 px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">
          {state.pages.length} page{state.pages.length === 1 ? '' : 's'}
        </p>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
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
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-red-500/60 hover:text-red-300"
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
