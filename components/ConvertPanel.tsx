'use client';

import { useState } from 'react';
import { usePdfStore } from '@/lib/store';
import {
  CONVERT_MIME,
  convertToExcel,
  convertToPowerPoint,
  convertToWord,
  openForConversion,
  type ConvertProgress,
} from '@/lib/convert';
import { assemblePdf } from '@/lib/export';
import { downloadBytes } from '@/lib/download';
import { IconConvert, IconSpinner } from './Icons';

type Format = 'docx' | 'xlsx' | 'pptx';

const FORMATS: {
  id: Format;
  name: string;
  app: string;
  desc: string;
  badge: string;
  badgeClass: string;
}[] = [
  {
    id: 'docx',
    name: 'Word document',
    app: 'Microsoft Word (.docx)',
    desc: 'Extracts the text of every page into an editable document, preserving page breaks and heading sizes.',
    badge: 'W',
    badgeClass: 'bg-blue-600',
  },
  {
    id: 'xlsx',
    name: 'Excel workbook',
    app: 'Microsoft Excel (.xlsx)',
    desc: 'Each page becomes a worksheet; every text fragment becomes a cell — ideal for tabular PDFs.',
    badge: 'X',
    badgeClass: 'bg-emerald-600',
  },
  {
    id: 'pptx',
    name: 'PowerPoint deck',
    app: 'Microsoft PowerPoint (.pptx)',
    desc: 'Each page becomes a full-bleed slide with a crisp render of the original, keeping the exact layout.',
    badge: 'P',
    badgeClass: 'bg-orange-600',
  },
];

/** PDF → Office conversion, all in-browser. */
export default function ConvertPanel() {
  const { state, dispatch } = usePdfStore();
  const [busy, setBusy] = useState<Format | null>(null);
  const [progress, setProgress] = useState<ConvertProgress | null>(null);

  const baseName =
    Object.values(state.sources).length === 1
      ? Object.values(state.sources)[0].name.replace(/\.pdf$/i, '')
      : 'converted';

  const run = async (format: Format) => {
    setBusy(format);
    setProgress(null);
    try {
      const onProgress = (p: ConvertProgress) => setProgress(p);
      // Convert the assembled working document, so page order, deletions
      // and text edits are all reflected in the output.
      const assembled = await assemblePdf(state.sources, state.pages, state.edits, { annots: state.annots, marks: state.marks });
      const doc = await openForConversion(assembled);
      try {
        const bytes =
          format === 'docx'
            ? await convertToWord(doc, onProgress)
            : format === 'xlsx'
              ? await convertToExcel(doc, onProgress)
              : await convertToPowerPoint(doc, onProgress);
        downloadBytes(bytes, `${baseName}.${format}`, CONVERT_MIME[format]);
      } finally {
        void doc.destroy();
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Conversion failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconConvert className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Convert PDF
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Convert the current working document ({state.pages.length} page
            {state.pages.length === 1 ? '' : 's'}) to Office formats — generated locally in your
            browser, never uploaded.
          </p>
        </div>

        <div className="space-y-4">
          {FORMATS.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white ${f.badgeClass}`}
              >
                {f.badge}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{f.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{f.desc}</p>
              </div>
              <button
                onClick={() => void run(f.id)}
                disabled={busy !== null || state.pages.length === 0}
                className="flex w-36 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {busy === f.id ? (
                  <>
                    <IconSpinner className="h-4 w-4" />
                    {progress ? `${progress.pageIndex + 1}/${progress.totalPages}` : '…'}
                  </>
                ) : (
                  <>Convert to {f.id === 'docx' ? 'Word' : f.id === 'xlsx' ? 'Excel' : 'PPT'}</>
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          Note: Word and Excel conversions are text-based — scanned PDFs without a text layer
          should be run through the OCR tab first. PowerPoint keeps the exact visual layout as
          slide images.
        </p>
      </div>
    </div>
  );
}
