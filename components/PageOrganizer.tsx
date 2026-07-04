'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { assemblePdf } from '@/lib/export';
import { downloadBytes } from '@/lib/download';
import { parsePageRanges, splitPdfByRanges, splitPdfEveryNPages } from '@/lib/pdfOps';
import { createZip } from '@/lib/zip';
import type { PageEntry } from '@/lib/types';
import PageThumb from './PageThumb';
import { IconCopy, IconExtract, IconPlus, IconRotate, IconSplit, IconSpinner, IconTrash } from './Icons';

/**
 * Grid of page thumbnails. Drag to reorder, delete or rotate single pages,
 * and add more PDFs (their pages are appended — that is the merge).
 * Everything happens on the in-memory page list; pdf-lib assembles the
 * result on export.
 */
export default function PageOrganizer() {
  const { state, dispatch, addFiles } = usePdfStore();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [splitOpen, setSplitOpen] = useState(false);

  const multipleSources = Object.keys(state.sources).length > 1;

  const handleDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) {
      dispatch({ type: 'REORDER_PAGES', from: dragIndex, to });
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  /** Download a single page as its own PDF (Foxit-style "Extract"). */
  const extractPage = async (entry: PageEntry, index: number) => {
    try {
      const bytes = await assemblePdf(state.sources, [entry], state.edits, {
        annots: state.annots,
      });
      downloadBytes(bytes, `page-${index + 1}.pdf`);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not extract page: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Drag pages to reorder{multipleSources ? ' — pages from all files can be interleaved' : ''}.
          Deletions and ordering apply on export.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'REVERSE_PAGES' })}
            disabled={state.pages.length < 2}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:text-indigo-300"
            title="Reverse the page order"
          >
            Reverse order
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-600 dark:text-slate-300 dark:hover:text-indigo-300"
          >
            <IconPlus className="h-4 w-4" />
            Add / merge PDFs
          </button>
          <button
            onClick={() => setSplitOpen((v) => !v)}
            disabled={state.pages.length < 2}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
              splitOpen
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <IconSplit className="h-4 w-4" />
            Split…
          </button>
        </div>
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
      </div>

      {splitOpen && <SplitPanel onClose={() => setSplitOpen(false)} />}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {state.pages.map((entry, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          return (
            <div
              key={entry.id}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex((i) => (i === index ? null : i))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDoubleClick={() => {
                dispatch({ type: 'SET_PAGE', index });
                dispatch({ type: 'SET_TAB', tab: 'view' });
              }}
              className={`group relative cursor-grab rounded-xl border p-2 transition active:cursor-grabbing
                ${isDragging ? 'opacity-40' : ''}
                ${isOver ? 'border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/60' : 'border-slate-200 bg-white shadow-sm hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-600'}`}
              title="Drag to reorder — double-click to open in viewer"
            >
              <PageThumb entry={entry} />
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{index + 1}</span>
                {multipleSources && (
                  <span className="max-w-24 truncate text-[10px] text-slate-400 dark:text-slate-500">
                    {state.sources[entry.sourceId]?.name}
                  </span>
                )}
              </div>
              {/* Hover actions */}
              <div className="absolute top-3 right-3 hidden gap-1 group-hover:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'ROTATE_PAGE', pageId: entry.id });
                  }}
                  className="rounded-md bg-slate-700/90 p-1.5 text-white shadow hover:bg-indigo-500 dark:bg-slate-900/90"
                  title="Rotate 90°"
                >
                  <IconRotate className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'DUPLICATE_PAGE', pageId: entry.id });
                  }}
                  className="rounded-md bg-slate-700/90 p-1.5 text-white shadow hover:bg-indigo-500 dark:bg-slate-900/90"
                  title="Duplicate page"
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void extractPage(entry, index);
                  }}
                  className="rounded-md bg-slate-700/90 p-1.5 text-white shadow hover:bg-indigo-500 dark:bg-slate-900/90"
                  title="Extract page as its own PDF"
                >
                  <IconExtract className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'REMOVE_PAGE', pageId: entry.id });
                  }}
                  className="rounded-md bg-slate-700/90 p-1.5 text-white shadow hover:bg-red-500 dark:bg-slate-900/90"
                  title="Delete page"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Split the current working document (in its current order, with edits and
 * annotations applied) into multiple PDFs — either every N pages, or by a
 * custom comma-separated list of page ranges — bundled into one ZIP.
 */
function SplitPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = usePdfStore();
  const [mode, setMode] = useState<'every-n' | 'ranges'>('every-n');
  const [everyN, setEveryN] = useState(1);
  const [rangeSpec, setRangeSpec] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const bytes = await assemblePdf(state.sources, state.pages, state.edits, {
        annots: state.annots,
        marks: state.marks,
      });
      const parts =
        mode === 'every-n'
          ? await splitPdfEveryNPages(bytes, Math.max(1, everyN))
          : await (async () => {
              const ranges = parsePageRanges(rangeSpec, state.pages.length);
              return splitPdfByRanges(bytes, ranges);
            })();

      if (parts.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'Nothing to split — check the page ranges.' });
        return;
      }
      if (parts.length === 1) {
        downloadBytes(parts[0], 'split-1.pdf');
      } else {
        const zip = createZip(parts.map((p, i) => ({ name: `split-${i + 1}.pdf`, data: p })));
        downloadBytes(zip, 'split.zip', 'application/zip');
      }
      onClose();
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs dark:border-slate-700">
          <button
            onClick={() => setMode('every-n')}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === 'every-n' ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            Every N pages
          </button>
          <button
            onClick={() => setMode('ranges')}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === 'ranges' ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            Custom ranges
          </button>
        </div>

        {mode === 'every-n' ? (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Pages per file</span>
            <input
              type="number"
              min={1}
              max={state.pages.length}
              value={everyN}
              onChange={(e) => setEveryN(Number(e.target.value) || 1)}
              className={`w-24 ${inputCls}`}
            />
          </label>
        ) : (
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Ranges (1-based, e.g. "1-3, 5, 8-9")
            </span>
            <input
              value={rangeSpec}
              onChange={(e) => setRangeSpec(e.target.value)}
              placeholder={`1-${Math.min(3, state.pages.length)}, ${Math.min(state.pages.length, 4)}-${state.pages.length}`}
              className={`w-full ${inputCls}`}
            />
          </label>
        )}

        <button
          onClick={() => void run()}
          disabled={busy || (mode === 'ranges' && !rangeSpec.trim())}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? <IconSpinner className="h-4 w-4" /> : <IconSplit className="h-4 w-4" />}
          Split &amp; download
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Splits the document as it looks now (current order, edits and annotations included). One
        output file downloads directly; two or more are bundled into a single <code>.zip</code>.
      </p>
    </div>
  );
}
