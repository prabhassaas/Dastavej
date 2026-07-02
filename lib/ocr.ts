import { getCachedDoc } from './pdfCache';
import type { PageEntry } from './types';

export interface OcrProgress {
  /** index of the page currently being processed (0-based, within the batch) */
  pageIndex: number;
  totalPages: number;
  /** 'render' | 'recognizing' */
  phase: string;
  /** 0..1 progress of the current phase */
  progress: number;
}

export interface OcrResult {
  /** 1-based page number in the working document */
  page: number;
  text: string;
}

/** Render a working-document page to a raster canvas for OCR. */
async function renderEntryToCanvas(entry: PageEntry, scale = 2): Promise<HTMLCanvasElement> {
  const doc = getCachedDoc(entry.sourceId);
  const page = await doc.getPage(entry.pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + entry.rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

/**
 * Run OCR over the given pages, fully client-side. tesseract.js spins up its
 * own Web Worker (and WASM core), so recognition never blocks the UI thread.
 * The English language model is fetched once from a CDN and cached by the
 * browser — no data from the document ever leaves the device.
 */
export async function runOcr(
  entries: { entry: PageEntry; pageNumber: number }[],
  onProgress: (p: OcrProgress) => void,
): Promise<OcrResult[]> {
  const { createWorker } = await import('tesseract.js');

  let current = 0;
  const worker = await createWorker('eng', 1, {
    // Worker script, WASM core and the English model are all self-hosted
    // static assets (copied from node_modules by scripts/copy-tesseract.mjs),
    // so OCR works with no CDN or network access at all.
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath: '/tesseract/lang',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress({
          pageIndex: current,
          totalPages: entries.length,
          phase: 'recognizing',
          progress: m.progress,
        });
      }
    },
  });

  const results: OcrResult[] = [];
  try {
    for (let i = 0; i < entries.length; i++) {
      current = i;
      onProgress({ pageIndex: i, totalPages: entries.length, phase: 'render', progress: 0 });
      const canvas = await renderEntryToCanvas(entries[i].entry);
      const { data } = await worker.recognize(canvas);
      results.push({ page: entries[i].pageNumber, text: data.text.trim() });
      canvas.width = 0; // free the raster
    }
  } finally {
    await worker.terminate();
  }
  return results;
}
