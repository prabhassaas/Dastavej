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
