import { getCachedDoc } from './pdfCache';
import { getPdfjs } from './pdfjs';
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

/** Decode an arbitrary image file (PNG/JPEG/etc.) onto a raster canvas for OCR. */
async function imageToCanvas(bytes: Uint8Array, mime: string): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
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

export interface OcrEngine {
  recognize(canvas: HTMLCanvasElement, enhance?: boolean): Promise<string>;
  terminate(): Promise<void>;
}

/**
 * Spin up a tesseract.js Web Worker (WASM core + English model, all
 * self-hosted static assets — no CDN). Shared by every OCR entry point below
 * so the ~expensive worker/model load happens once per batch, not once per
 * page/image. `onRecognizing` gets tesseract's own 0..1 progress per call.
 */
export async function createOcrEngine(onRecognizing?: (progress: number) => void): Promise<OcrEngine> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath: '/tesseract/lang',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onRecognizing) onRecognizing(m.progress);
    },
  });
  return {
    async recognize(canvas, enhance) {
      if (enhance) binarize(canvas);
      const { data } = await worker.recognize(canvas);
      return data.text.trim();
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

/**
 * Run OCR over the given working-document pages, fully client-side. Your
 * document is never uploaded anywhere.
 */
export async function runOcr(
  entries: { entry: PageEntry; pageNumber: number }[],
  onProgress: (p: OcrProgress) => void,
  options: { enhance?: boolean } = {},
): Promise<OcrResult[]> {
  let current = 0;
  const engine = await createOcrEngine((progress) =>
    onProgress({ pageIndex: current, totalPages: entries.length, phase: 'recognizing', progress }),
  );

  const results: OcrResult[] = [];
  try {
    for (let i = 0; i < entries.length; i++) {
      current = i;
      onProgress({ pageIndex: i, totalPages: entries.length, phase: 'render', progress: 0 });
      const canvas = await renderEntryToCanvas(entries[i].entry);
      const text = await engine.recognize(canvas, options.enhance);
      results.push({ page: entries[i].pageNumber, text });
      canvas.width = 0; // free the raster
    }
  } finally {
    await engine.terminate();
  }
  return results;
}

/**
 * OCR a raw PDF's bytes directly — no workspace/store dependency, so this is
 * the entry point for the public API. Defaults to every page.
 */
export async function ocrPdfBytes(
  bytes: Uint8Array,
  onProgress: (p: OcrProgress) => void = () => {},
  options: { enhance?: boolean; pageNumbers?: number[] } = {},
): Promise<OcrResult[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pageNumbers = options.pageNumbers ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);

  let current = 0;
  const engine = await createOcrEngine((progress) =>
    onProgress({ pageIndex: current, totalPages: pageNumbers.length, phase: 'recognizing', progress }),
  );

  const results: OcrResult[] = [];
  try {
    for (let i = 0; i < pageNumbers.length; i++) {
      current = i;
      onProgress({ pageIndex: i, totalPages: pageNumbers.length, phase: 'render', progress: 0 });
      const page = await doc.getPage(pageNumbers[i]);
      const viewport = page.getViewport({ scale: 3.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const text = await engine.recognize(canvas, options.enhance);
      results.push({ page: pageNumbers[i], text });
      canvas.width = 0;
    }
  } finally {
    await engine.terminate();
    await doc.destroy();
  }
  return results;
}

/**
 * OCR one or more standalone image files (photos of documents, screenshots,
 * scans) directly — no PDF wrapping step required first.
 */
export async function ocrImages(
  images: { name: string; bytes: Uint8Array; mime: string }[],
  onProgress: (p: OcrProgress) => void = () => {},
  options: { enhance?: boolean } = {},
): Promise<{ name: string; text: string }[]> {
  let current = 0;
  const engine = await createOcrEngine((progress) =>
    onProgress({ pageIndex: current, totalPages: images.length, phase: 'recognizing', progress }),
  );

  const results: { name: string; text: string }[] = [];
  try {
    for (let i = 0; i < images.length; i++) {
      current = i;
      onProgress({ pageIndex: i, totalPages: images.length, phase: 'render', progress: 0 });
      const canvas = await imageToCanvas(images[i].bytes, images[i].mime);
      const text = await engine.recognize(canvas, options.enhance);
      results.push({ name: images[i].name, text });
      canvas.width = 0;
    }
  } finally {
    await engine.terminate();
  }
  return results;
}
