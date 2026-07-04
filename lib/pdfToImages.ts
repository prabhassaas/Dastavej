import { getPdfjs } from './pdfjs';

export interface PdfToImagesProgress {
  page: number;
  totalPages: number;
}

/**
 * Render every page of a PDF to a raster image (PNG or JPEG), fully
 * client-side via pdf.js + canvas. Returns one entry per page, ready to be
 * downloaded individually or zipped together.
 */
export async function pdfToImages(
  bytes: Uint8Array,
  options: {
    format?: 'png' | 'jpeg';
    scale?: number; // 2 ≈ 144 DPI, 3 ≈ 216 DPI
    quality?: number; // JPEG only
    onProgress?: (p: PdfToImagesProgress) => void;
  } = {},
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const { format = 'png', scale = 2, quality = 0.9, onProgress } = options;
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';
  const digits = String(doc.numPages).length;

  const out: { name: string; bytes: Uint8Array }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.({ page: i, totalPages: doc.numPages });
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, format === 'jpeg' ? quality : undefined),
      );
      if (blob) {
        out.push({
          name: `page-${String(i).padStart(digits, '0')}.${ext}`,
          bytes: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      canvas.width = 0;
    }
  } finally {
    await doc.destroy();
  }
  return out;
}
