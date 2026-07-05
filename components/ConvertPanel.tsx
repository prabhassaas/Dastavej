'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import {
  CONVERT_MIME,
  convertToCsv,
  convertToExcel,
  convertToPowerPoint,
  convertToWord,
  openForConversion,
  type ConvertProgress,
} from '@/lib/convert';
import { assemblePdf } from '@/lib/export';
import { downloadBytes } from '@/lib/download';
import { pdfToImages, type PdfToImagesProgress } from '@/lib/pdfToImages';
import { imagesToPdf } from '@/lib/imageToPdf';
import { createZip } from '@/lib/zip';
import { IconConvert, IconImage, IconPlus, IconSpinner, IconX } from './Icons';

type Format = 'docx' | 'xlsx' | 'csv' | 'pptx' | 'images';

const FORMATS: {
  id: Format;
  name: string;
  desc: string;
  badge: string;
  badgeClass: string;
}[] = [
  {
    id: 'docx',
    name: 'Word document',
    desc: 'Extracts the text of every page into an editable document, preserving page breaks and heading sizes.',
    badge: 'W',
    badgeClass: 'bg-blue-600',
  },
  {
    id: 'xlsx',
    name: 'Excel workbook',
    desc: 'Detects real table columns from text position and keeps blank cells blank, so nothing shifts left. Every page flows into one worksheet, separated by "Page N" markers.',
    badge: 'X',
    badgeClass: 'bg-emerald-600',
  },
  {
    id: 'csv',
    name: 'CSV file',
    desc: 'Same column-aware table detection as Excel, written as a single plain-text .csv — quick to import anywhere.',
    badge: 'CSV',
    badgeClass: 'bg-teal-600',
  },
  {
    id: 'pptx',
    name: 'PowerPoint deck',
    desc: 'Each page becomes a full-bleed slide with a crisp render of the original, keeping the exact layout.',
    badge: 'P',
    badgeClass: 'bg-orange-600',
  },
  {
    id: 'images',
    name: 'Images (PNG/JPEG)',
    desc: 'Renders each page to a high-resolution image — one file per page, bundled as a .zip.',
    badge: 'IMG',
    badgeClass: 'bg-pink-600',
  },
];

const FORMAT_LABELS: Record<Format, string> = {
  docx: 'Word',
  xlsx: 'Excel',
  csv: 'CSV',
  pptx: 'PPT',
  images: 'Images',
};

/** PDF ↔ Office/Images conversion, all in-browser. */
export default function ConvertPanel() {
  const { state, dispatch } = usePdfStore();
  const [busy, setBusy] = useState<Format | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; phase?: string } | null>(null);
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');

  const baseName =
    Object.values(state.sources).length === 1
      ? Object.values(state.sources)[0].name.replace(/\.pdf$/i, '')
      : 'converted';

  const run = async (format: Format) => {
    setBusy(format);
    setProgress(null);
    try {
      // Convert the assembled working document, so page order, deletions,
      // text edits and annotations are all reflected in the output.
      const assembled = await assemblePdf(state.sources, state.pages, state.edits, {
        annots: state.annots,
        marks: state.marks,
      });

      if (format === 'images') {
        const pages = await pdfToImages(assembled, {
          format: imgFormat,
          scale: 2.5,
          onProgress: (p: PdfToImagesProgress) => setProgress({ current: p.page, total: p.totalPages }),
        });
        if (pages.length === 1) {
          downloadBytes(pages[0].bytes, pages[0].name, imgFormat === 'png' ? 'image/png' : 'image/jpeg');
        } else {
          const zip = createZip(pages.map((p) => ({ name: p.name, data: p.bytes })));
          downloadBytes(zip, `${baseName}-images.zip`, 'application/zip');
        }
        return;
      }

      const onProgress = (p: ConvertProgress) =>
        setProgress({ current: p.pageIndex + 1, total: p.totalPages, phase: p.phase });
      const doc = await openForConversion(assembled);
      try {
        const bytes =
          format === 'docx'
            ? await convertToWord(doc, onProgress)
            : format === 'xlsx'
              ? await convertToExcel(doc, onProgress)
              : format === 'csv'
                ? await convertToCsv(doc, onProgress)
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
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <IconConvert className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              Convert PDF
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Convert the current working document ({state.pages.length} page
              {state.pages.length === 1 ? '' : 's'}) — generated locally in your browser, never
              uploaded. Scanned pages with no text layer are OCR'd automatically.
            </p>
            {busy && progress?.phase && (
              <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-300">
                {progress.phase} ({progress.current}/{progress.total})…
              </p>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {FORMATS.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${f.badgeClass}`}
                >
                  {f.badge}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{f.desc}</p>
                  {f.id === 'images' && (
                    <div className="mt-2 flex gap-3 text-xs">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={imgFormat === 'png'}
                          onChange={() => setImgFormat('png')}
                          className="accent-indigo-500"
                        />
                        PNG
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={imgFormat === 'jpeg'}
                          onChange={() => setImgFormat('jpeg')}
                          className="accent-indigo-500"
                        />
                        JPEG
                      </label>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void run(f.id)}
                  disabled={busy !== null || state.pages.length === 0}
                  className="flex w-36 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  {busy === f.id ? (
                    <>
                      <IconSpinner className="h-4 w-4" />
                      {progress ? `${progress.current}/${progress.total}` : '…'}
                    </>
                  ) : (
                    <>
                      Convert to{' '}
                      {FORMAT_LABELS[f.id]}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
            Note: Word and Excel conversions are text-based — scanned PDFs without a text layer
            should be run through the OCR tab first. PowerPoint and Images keep the exact visual
            layout as renders.
          </p>
        </div>

        <ImagesToPdfTool />
      </div>
    </div>
  );
}

/** The reverse direction: combine uploaded images into a brand-new PDF. */
function ImagesToPdfTool() {
  const { dispatch, addGeneratedPdf } = usePdfStore();
  const [files, setFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [fit, setFit] = useState<'fit' | 'fill' | 'actual-size'>('fit');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList) => {
    const picked = Array.from(list).filter((f) => f.type === 'image/png' || f.type === 'image/jpeg');
    if (!picked.length) {
      dispatch({ type: 'SET_ERROR', error: 'Please choose PNG or JPEG images.' });
      return;
    }
    setFiles((prev) => [...prev, ...picked.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  };

  const build = async () => {
    setBusy(true);
    try {
      const images = await Promise.all(
        files.map(async ({ file }) => ({
          bytes: new Uint8Array(await file.arrayBuffer()),
          mime: (file.type === 'image/png' ? 'image/png' : 'image/jpeg') as 'image/png' | 'image/jpeg',
        })),
      );
      const bytes = await imagesToPdf(images, { pageSize, orientation, fit });
      return bytes;
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    try {
      const bytes = await build();
      downloadBytes(bytes, 'images.pdf');
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not build PDF: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleOpenInEditor = async () => {
    try {
      const bytes = await build();
      await addGeneratedPdf('images.pdf', bytes);
      dispatch({ type: 'SET_TAB', tab: 'view' });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not build PDF: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <IconImage className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
        Images to PDF
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Combine photos or scans into a new PDF — one image per page.
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
              <div key={f.previewUrl} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
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

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Page size</span>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value as 'A4' | 'Letter')} className={`w-full ${inputCls}`}>
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Orientation</span>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
              className={`w-full ${inputCls}`}
              disabled={fit === 'actual-size'}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Fit</span>
            <select value={fit} onChange={(e) => setFit(e.target.value as typeof fit)} className={`w-full ${inputCls}`}>
              <option value="fit">Fit page (letterbox)</option>
              <option value="fill">Fill page (crop)</option>
              <option value="actual-size">Actual size (no page)</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => void handleDownload()}
            disabled={busy || files.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy ? <IconSpinner className="h-4 w-4" /> : <IconImage className="h-4 w-4" />}
            Download PDF
          </button>
          <button
            onClick={() => void handleOpenInEditor()}
            disabled={busy || files.length === 0}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition hover:border-indigo-400 disabled:opacity-50 dark:border-slate-700"
          >
            Open in editor
          </button>
        </div>
      </div>
    </div>
  );
}
