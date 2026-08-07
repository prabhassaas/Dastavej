import { PDFDocument } from '@cantoo/pdf-lib';

export type PageFit = 'fit' | 'fill' | 'actual-size';

const A4: [number, number] = [595.28, 841.89];
const LETTER: [number, number] = [612, 792];

/**
 * Combine images (PNG/JPEG) into a new PDF, one image per page. `fit`
 * letterboxes the image inside a fixed page size, `fill` crops to cover it,
 * `actual-size` makes each page exactly the image's pixel dimensions (at
 * 96 DPI) so nothing is resized at all.
 */
export async function imagesToPdf(
  images: { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' }[],
  options: { pageSize?: 'A4' | 'Letter'; orientation?: 'portrait' | 'landscape'; fit?: PageFit } = {},
): Promise<Uint8Array> {
  const { pageSize = 'A4', orientation = 'portrait', fit = 'fit' } = options;
  const doc = await PDFDocument.create();
  const base = pageSize === 'A4' ? A4 : LETTER;
  const [pw, ph] = orientation === 'landscape' ? [base[1], base[0]] : base;

  for (const img of images) {
    const embedded = img.mime === 'image/png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const { width: iw, height: ih } = embedded;

    if (fit === 'actual-size') {
      const scale = 72 / 96; // treat image pixels as 96 DPI
      const w = iw * scale;
      const h = ih * scale;
      const page = doc.addPage([w, h]);
      page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
      continue;
    }

    const page = doc.addPage([pw, ph]);
    const scaleFit = Math.min(pw / iw, ph / ih);
    const scaleFill = Math.max(pw / iw, ph / ih);
    const scale = fit === 'fill' ? scaleFill : scaleFit;
    const w = iw * scale;
    const h = ih * scale;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }

  return doc.save();
}
