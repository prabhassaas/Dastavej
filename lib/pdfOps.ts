import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Basic, store-independent PDF page operations built on pdf-lib — the
 * building blocks the Organize tab uses, exposed standalone for the public
 * API so integrators don't need to touch Dastavej's internal workspace model.
 */

/** Merge PDFs in the given order into a single document. */
export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

export interface PageOp {
  /** 0-based index of the page in the source document */
  index: number;
  /** additional clockwise rotation in degrees (0/90/180/270) */
  rotate?: number;
}

/**
 * Rebuild a single PDF with a new page order/subset (omit an index to
 * delete that page) and optional per-page rotation.
 */
export async function reorderPages(bytes: Uint8Array, order: PageOp[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    order.map((o) => o.index),
  );
  copied.forEach((page, i) => {
    const rotate = order[i].rotate ?? 0;
    if (rotate) {
      const base = page.getRotation().angle;
      page.setRotation(degrees((((base + rotate) % 360) + 360) % 360));
    }
    out.addPage(page);
  });
  return out.save();
}

/** Extract a single page as its own standalone PDF. */
export async function extractPage(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  return reorderPages(bytes, [{ index: pageIndex }]);
}

/** A contiguous, 0-based, inclusive page range: [2, 4] = pages 3-5 (1-based). */
export type PageRange = [start: number, end: number];

/** Split a PDF into one output document per page range. */
export async function splitPdfByRanges(bytes: Uint8Array, ranges: PageRange[]): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const outputs: Uint8Array[] = [];
  for (const [start, end] of ranges) {
    const s = Math.max(0, start);
    const e = Math.min(total - 1, end);
    if (s > e) continue;
    const indices = Array.from({ length: e - s + 1 }, (_, i) => s + i);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    copied.forEach((p) => out.addPage(p));
    outputs.push(await out.save());
  }
  return outputs;
}

/** Split a PDF into fixed-size chunks of `pagesPerFile` pages each. */
export async function splitPdfEveryNPages(bytes: Uint8Array, pagesPerFile: number): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const ranges: PageRange[] = [];
  for (let s = 0; s < total; s += pagesPerFile) {
    ranges.push([s, Math.min(total, s + pagesPerFile) - 1]);
  }
  return splitPdfByRanges(bytes, ranges);
}

/**
 * Parse a comma-separated range spec like "1-3, 5, 8-9" (1-based, inclusive)
 * into 0-based PageRange tuples. Throws with a readable message on bad input.
 */
export function parsePageRanges(spec: string, totalPages: number): PageRange[] {
  const ranges: PageRange[] = [];
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`"${part}" isn't a valid page or range (try "1-3" or "5").`);
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end > totalPages || start > end) {
      throw new Error(`"${part}" is out of range — this document has ${totalPages} pages.`);
    }
    ranges.push([start - 1, end - 1]);
  }
  if (!ranges.length) throw new Error('Enter at least one page or range.');
  return ranges;
}
