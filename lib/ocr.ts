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

/** Render a working-document page to a raster canvas for OCR (~260 DPI). */
async function renderEntryToCanvas(entry: PageEntry, scale = 3.5): Promise<HTMLCanvasElement> {
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
 * Clean up a low-quality scan before recognition: grayscale + contrast
 * stretch + adaptive-ish threshold (Otsu). Helps faded photocopies and
 * phone photos; can hurt clean digital renders, so it is opt-in.
 */
function binarize(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Array(256).fill(0);
  const grays = new Uint8Array(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    grays[j] = g;
    hist[g]++;
  }
  // Otsu's threshold
  const total = grays.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0,
    wB = 0,
    maxVar = 0,
    threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = i;
    }
  }
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = grays[j] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
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
  options: { enhance?: boolean } = {},
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
      if (options.enhance) binarize(canvas);
      const { data } = await worker.recognize(canvas);
      results.push({ page: entries[i].pageNumber, text: data.text.trim() });
      canvas.width = 0; // free the raster
    }
  } finally {
    await worker.terminate();
  }
  return results;
}
