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

interface RowItem {
  x: number;
  str: string;
}

interface Row {
  y: number;
  /** dominant font size of the row, PDF units */
  size: number;
  /** items in x order */
  items: RowItem[];
}

/** Extract a page's text items and group them into visual rows (top → bottom, left → right). */
async function extractRows(doc: PDFDocumentProxy, pageIndex: number): Promise<Row[]> {
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

  const rows: Row[] = [];
  for (const item of items) {
    const tolerance = Math.max(item.size * 0.5, 3);
    const row = rows.find((r) => Math.abs(r.y - item.y) <= tolerance);
    if (row) {
      row.items.push({ x: item.x, str: item.str });
      row.size = Math.max(row.size, item.size);
    } else {
      rows.push({ y: item.y, size: item.size, items: [{ x: item.x, str: item.str }] });
    }
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

async function extractLines(doc: PDFDocumentProxy, pageIndex: number): Promise<Line[]> {
  const rows = await extractRows(doc, pageIndex);
  return rows.map((r) => ({ size: r.size, cells: r.items.map((it) => it.str) }));
}

function nearestClusterIndex(value: number, centers: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  centers.forEach((c, i) => {
    const dist = Math.abs(c - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

/**
 * Infer a page's table columns from where text actually starts, then place
 * every row's items into their matching column — so a blank cell in the
 * source table (e.g. an unfilled "Middle name" field) stays blank instead of
 * silently disappearing and shifting every later cell one column to the
 * left (the bug with just joining each row's items left-to-right).
 *
 * A column only counts if its x-position recurs across at least two rows —
 * a position used just once is treated as a stray word (e.g. justified
 * prose, where extra word-spacing can split a line into several text runs),
 * not a real table column, so plain paragraphs aren't shredded into cells.
 */
function buildColumnGrid(rows: Row[]): string[][] {
  const isTabular = rows.filter((r) => r.items.length > 1).length >= 2;
  if (!isTabular) {
    return rows.map((r) => r.items.map((it) => it.str));
  }

  const tolerance = 10;
  const sortedX = rows.flatMap((r) => r.items.map((it) => it.x)).sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of sortedX) {
    const last = clusters[clusters.length - 1];
    if (last && x - last[last.length - 1] <= tolerance) last.push(x);
    else clusters.push([x]);
  }
  let centers = clusters.map((c) => c.reduce((a, b) => a + b, 0) / c.length);

  const rowsPerCenter = centers.map(() => new Set<number>());
  rows.forEach((row, ri) => {
    row.items.forEach((it) => rowsPerCenter[nearestClusterIndex(it.x, centers)].add(ri));
  });
  const recurring = centers.filter((_, i) => rowsPerCenter[i].size >= 2);
  if (recurring.length < 2) {
    return rows.map((r) => r.items.map((it) => it.str));
  }
  centers = recurring;

  return rows.map((row) => {
    const cells = new Array<string>(centers.length).fill('');
    for (const it of row.items) {
      const idx = nearestClusterIndex(it.x, centers);
      cells[idx] = cells[idx] ? `${cells[idx]} ${it.str}` : it.str;
    }
    return cells;
  });
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
    onProgress({ pageIndex: i, totalPages: doc.numPages, phase: 'Detecting table columns' });
    const pageRows = await extractRows(doc, i);
    const grid = buildColumnGrid(pageRows);
    if (i > 0) rows.push([]);
    if (doc.numPages > 1) rows.push([`— Page ${i + 1} of ${doc.numPages} —`]);
    rows.push(...(grid.length ? grid : [['(no extractable text on this page)']]));
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
