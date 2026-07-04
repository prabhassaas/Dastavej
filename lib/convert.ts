import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfjs } from './pdfjs';

/**
 * Client-side PDF → Office conversions. The assembled working document
 * (page order, deletions and text edits included) is parsed with pdf.js and
 * rebuilt with docx / SheetJS; PowerPoint embeds a high-res render of each
 * page. Everything runs in the browser — no conversion service involved.
 */

export interface ConvertProgress {
  pageIndex: number;
  totalPages: number;
  phase: string;
}

/** Parse assembled PDF bytes into a temporary pdf.js document. */
export async function openForConversion(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

interface Line {
  /** dominant font size of the line, PDF units */
  size: number;
  /** items in x order */
  cells: string[];
}

/** Group a page's text items into visual lines (top → bottom, left → right). */
async function extractLines(doc: PDFDocumentProxy, pageIndex: number): Promise<Line[]> {
  const page = await doc.getPage(pageIndex + 1);
  const content = await page.getTextContent();

  const items = content.items
    .filter(
      (it): it is import('pdfjs-dist/types/src/display/api').TextItem =>
        'str' in it && !!it.str.trim(),
    )
    .map((it) => ({
      str: it.str.trim(),
      x: it.transform[4],
      y: it.transform[5],
      size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 12,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: { y: number; size: number; parts: { x: number; str: string }[] }[] = [];
  for (const item of items) {
    const tolerance = Math.max(item.size * 0.5, 3);
    const line = lines.find((l) => Math.abs(l.y - item.y) <= tolerance);
    if (line) {
      line.parts.push({ x: item.x, str: item.str });
      line.size = Math.max(line.size, item.size);
    } else {
      lines.push({ y: item.y, size: item.size, parts: [{ x: item.x, str: item.str }] });
    }
  }
  return lines.map((l) => ({
    size: l.size,
    cells: l.parts.sort((a, b) => a.x - b.x).map((p) => p.str),
  }));
}

/** PDF → Word (.docx): one paragraph per visual line, page breaks preserved. */
export async function convertToWord(
  doc: PDFDocumentProxy,
  onProgress: (p: ConvertProgress) => void,
): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');

  const children: InstanceType<typeof Paragraph>[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    onProgress({ pageIndex: i, totalPages: doc.numPages, phase: 'Extracting text' });
    const lines = await extractLines(doc, i);
    lines.forEach((line, li) => {
      children.push(
        new Paragraph({
          pageBreakBefore: i > 0 && li === 0,
          children: [
            new TextRun({
              text: line.cells.join(' '),
              // docx sizes are half-points; keep the PDF's visual hierarchy.
              size: Math.max(Math.round(line.size) * 2, 16),
              bold: line.size >= 16,
            }),
          ],
        }),
      );
    });
    if (lines.length === 0 && i > 0) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    }
  }

  const out = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(out);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * PDF → Excel (.xlsx): all pages flow into a single worksheet, separated by
 * "Page N" marker rows. Pages used to each get their own worksheet, but most
 * spreadsheet viewers open straight to the first tab without drawing
 * attention to the others, so multi-page PDFs looked like only page 1 had
 * converted. One continuous sheet is visible immediately, no tab-hunting.
 */
export async function convertToExcel(
  doc: PDFDocumentProxy,
  onProgress: (p: ConvertProgress) => void,
): Promise<Uint8Array> {
  const XLSX = await import('xlsx');

  const rows: string[][] = [];
  for (let i = 0; i < doc.numPages; i++) {
    onProgress({ pageIndex: i, totalPages: doc.numPages, phase: 'Extracting text' });
    const lines = await extractLines(doc, i);
    if (i > 0) rows.push([]);
    if (doc.numPages > 1) rows.push([`— Page ${i + 1} of ${doc.numPages} —`]);
    rows.push(...(lines.length ? lines.map((l) => l.cells) : [['(no extractable text on this page)']]));
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PDF Text');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

/** PDF → PowerPoint (.pptx): each page becomes a full-bleed slide image. */
export async function convertToPowerPoint(
  doc: PDFDocumentProxy,
  onProgress: (p: ConvertProgress) => void,
): Promise<Uint8Array> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();

  // Match the slide aspect ratio to the first page so nothing is distorted.
  const firstPage = await doc.getPage(1);
  const firstVp = firstPage.getViewport({ scale: 1 });
  const slideW = 10;
  const slideH = Math.min(Math.max((slideW * firstVp.height) / firstVp.width, 3), 20);
  pptx.defineLayout({ name: 'PDF_PAGE', width: slideW, height: slideH });
  pptx.layout = 'PDF_PAGE';

  for (let i = 0; i < doc.numPages; i++) {
    onProgress({ pageIndex: i, totalPages: doc.numPages, phase: 'Rendering page' });
    const page = await doc.getPage(i + 1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    canvas.width = 0;

    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: slideW, h: slideH });
  }

  const out = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  return new Uint8Array(out);
}

export const CONVERT_MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;
