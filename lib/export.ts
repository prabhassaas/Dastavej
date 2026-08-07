import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { Annotation, DocMarks, FontFamily, PageEdits, PageEntry, SourceFile } from './types';
import { loadPdf } from './pdfLoad';

export interface AssembleExtras {
  annots?: Record<string, Annotation[]>;
  marks?: DocMarks;
}

const MARK_COLORS = {
  gray: rgb(0.55, 0.58, 0.65),
  red: rgb(0.86, 0.2, 0.2),
  indigo: rgb(0.39, 0.4, 0.95),
};

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const FONT_VARIANTS: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  // [regular, bold, italic, bold+italic]
  Helvetica: [
    StandardFonts.Helvetica,
    StandardFonts.HelveticaBold,
    StandardFonts.HelveticaOblique,
    StandardFonts.HelveticaBoldOblique,
  ],
  Times: [
    StandardFonts.TimesRoman,
    StandardFonts.TimesRomanBold,
    StandardFonts.TimesRomanItalic,
    StandardFonts.TimesRomanBoldItalic,
  ],
  Courier: [
    StandardFonts.Courier,
    StandardFonts.CourierBold,
    StandardFonts.CourierOblique,
    StandardFonts.CourierBoldOblique,
  ],
};

/** Lazily embeds and caches the 12 standard-font variants actually used in a document. */
class FontPicker {
  private cache = new Map<string, PDFFont>();
  constructor(private doc: PDFDocument) {}
  async get(family: FontFamily, bold: boolean, italic: boolean): Promise<PDFFont> {
    const key = `${family}-${bold ? 1 : 0}-${italic ? 1 : 0}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const index = (bold ? 1 : 0) | (italic ? 2 : 0);
    const variant = FONT_VARIANTS[family][index];
    const embedded = await this.doc.embedFont(variant);
    this.cache.set(key, embedded);
    return embedded;
  }
}

/** Draws left-aligned text (optionally multi-line, optionally underlined) at a baseline. */
function drawStyledText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  underline: boolean,
) {
  let ly = y;
  for (const line of text.split('\n')) {
    if (line) {
      page.drawText(line, { x, y: ly, size, font, color: rgb(0, 0, 0) });
      if (underline) {
        const lw = font.widthOfTextAtSize(line, size);
        page.drawLine({
          start: { x, y: ly - size * 0.12 },
          end: { x: x + lw, y: ly - size * 0.12 },
          thickness: Math.max(0.6, size * 0.045),
          color: rgb(0, 0, 0),
        });
      }
    }
    ly -= size * 1.2;
  }
}

/**
 * Assemble the working document entirely in the browser with pdf-lib:
 * pages are copied from their source files in the user's order (which also
 * performs merging), then text edits, annotations and document marks
 * (watermark, header/footer, page numbers) are replayed in PDF user space.
 */
/**
 * True when the working document is exactly one untouched source file: same
 * pages, same order, no rotation, no text edits, no annotations, no marks.
 * In that case the original bytes ARE the correct output — skipping the
 * pdf-lib rebuild avoids a real-world pdf-lib limitation where an encrypted
 * source's content streams get corrupted by copyPages/save even after
 * `ignoreEncryption`, and it's strictly more faithful anyway (no lossy
 * re-encoding of an already-correct file).
 */
function isUnmodifiedSingleSource(
  sources: Record<string, SourceFile>,
  pages: PageEntry[],
  edits: Record<string, PageEdits>,
  extras: AssembleExtras,
): SourceFile | null {
  const ids = Object.keys(sources);
  if (ids.length !== 1) return null;
  const source = sources[ids[0]];
  if (pages.length !== source.numPages) return null;
  const inOrder = pages.every(
    (p, i) => p.sourceId === source.id && p.pageIndex === i && p.rotation === 0,
  );
  if (!inOrder) return null;
  const noEdits = pages.every((p) => {
    const e = edits[p.id];
    return !e || (Object.keys(e.textEdits).length === 0 && e.added.length === 0);
  });
  if (!noEdits) return null;
  const noAnnots = !extras.annots || pages.every((p) => !extras.annots![p.id]?.length);
  if (!noAnnots) return null;
  const noMarks = !extras.marks || (!extras.marks.watermark.enabled && !extras.marks.headerFooter.enabled);
  if (!noMarks) return null;
  return source;
}

export async function assemblePdf(
  sources: Record<string, SourceFile>,
  pages: PageEntry[],
  edits: Record<string, PageEdits>,
  extras: AssembleExtras = {},
): Promise<Uint8Array> {
  const untouched = isUnmodifiedSingleSource(sources, pages, edits, extras);
  if (untouched) return untouched.bytes;

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fonts = new FontPicker(out);

  const srcDocs = new Map<string, PDFDocument>();
  for (const entry of pages) {
    if (!srcDocs.has(entry.sourceId)) {
      srcDocs.set(entry.sourceId, await loadPdf(sources[entry.sourceId].bytes));
    }
  }

  for (const entry of pages) {
    const src = srcDocs.get(entry.sourceId)!;
    const [copied] = await out.copyPages(src, [entry.pageIndex]);
    if (entry.rotation) {
      const base = copied.getRotation().angle;
      copied.setRotation(degrees((((base + entry.rotation) % 360) + 360) % 360));
    }
    const page = out.addPage(copied);

    const pageEdits = edits[entry.id];
    if (pageEdits) {
      for (const edit of Object.values(pageEdits.textEdits)) {
        // White-out the original glyphs (the box straddles the baseline to
        // cover both ascenders and descenders), then draw the replacement.
        page.drawRectangle({
          x: edit.pdfX - 1,
          y: edit.pdfY - edit.pdfSize * 0.28,
          width: edit.pdfWidth + 2,
          height: edit.pdfSize * 1.32,
          color: rgb(1, 1, 1),
        });
        if (edit.text.trim()) {
          const f = await fonts.get(edit.fontFamily, edit.bold, edit.italic);
          drawStyledText(page, toWinAnsi(edit.text), edit.pdfX, edit.pdfY, edit.pdfSize, f, edit.underline);
        }
      }

      for (const added of pageEdits.added) {
        if (!added.text.trim()) continue;
        const f = await fonts.get(added.fontFamily, added.bold, added.italic);
        drawStyledText(page, toWinAnsi(added.text), added.pdfX, added.pdfY, added.pdfSize, f, added.underline);
      }
    }

    const annots = extras.annots?.[entry.id];
    if (annots?.length) await drawAnnotations(out, page, annots);
  }

  if (extras.marks) applyMarks(out, font, extras.marks);

  return out.save();
}

async function drawAnnotations(doc: PDFDocument, page: PDFPage, annots: Annotation[]) {
  for (const a of annots) {
    switch (a.kind) {
      case 'highlight':
        page.drawRectangle({
          x: a.x,
          y: a.y,
          width: a.w,
          height: a.h,
          color: hexToRgb(a.color),
          opacity: 0.35,
        });
        break;
      case 'box':
        page.drawRectangle({
          x: a.x,
          y: a.y,
          width: a.w,
          height: a.h,
          borderColor: hexToRgb(a.color),
          borderWidth: 2,
        });
        break;
      case 'erase':
        // opaque patch in the sampled background color (magic grab cleanup)
        page.drawRectangle({ x: a.x, y: a.y, width: a.w, height: a.h, color: hexToRgb(a.color) });
        break;
      case 'ink': {
        if (a.points.length < 2) break;
        // drawSvgPath uses a y-down coordinate system anchored at (x, y).
        const h = page.getHeight();
        const path = a.points
          .map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${(h - py).toFixed(2)}`)
          .join(' ');
        page.drawSvgPath(path, {
          x: 0,
          y: h,
          borderColor: hexToRgb(a.color),
          borderWidth: a.strokeWidth,
        });
        break;
      }
      case 'image': {
        const img =
          a.mime === 'image/png' ? await doc.embedPng(a.bytes) : await doc.embedJpg(a.bytes);
        page.drawImage(img, { x: a.x, y: a.y, width: a.w, height: a.h });
        break;
      }
    }
  }
}

function applyMarks(doc: PDFDocument, font: PDFFont, marks: DocMarks) {
  const pages = doc.getPages();
  const total = pages.length;
  const today = new Date().toLocaleDateString();
  const fill = (template: string, pageNo: number) =>
    toWinAnsi(
      template
        .replaceAll('{date}', today)
        .replaceAll('{page}', String(pageNo))
        .replaceAll('{total}', String(total)),
    );

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();

    if (marks.watermark.enabled && marks.watermark.text.trim()) {
      const text = toWinAnsi(marks.watermark.text);
      const size = marks.watermark.fontSize;
      const tw = font.widthOfTextAtSize(text, size);
      const cos = Math.SQRT1_2; // 45°
      page.drawText(text, {
        x: width / 2 - (tw * cos) / 2,
        y: height / 2 - (tw * cos) / 2,
        size,
        font,
        color: MARK_COLORS[marks.watermark.color],
        opacity: marks.watermark.opacity,
        rotate: degrees(45),
      });
    }

    if (marks.headerFooter.enabled) {
      const { headerText, footerText, pageNumbers } = marks.headerFooter;
      const gray = rgb(0.42, 0.45, 0.5);
      if (headerText.trim()) {
        page.drawText(fill(headerText, i + 1), {
          x: 40,
          y: height - 28,
          size: 9,
          font,
          color: gray,
        });
      }
      if (footerText.trim()) {
        page.drawText(fill(footerText, i + 1), { x: 40, y: 18, size: 9, font, color: gray });
      }
      if (pageNumbers) {
        const label = fill(pageNumbers, i + 1);
        const lw = font.widthOfTextAtSize(label, 9);
        page.drawText(label, { x: (width - lw) / 2, y: 18, size: 9, font, color: gray });
      }
    }
  });
}

const PUNCT_MAP: Record<string, string> = {
  '—': '-', // em dash
  '–': '-', // en dash
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '•': '-',
};

/** Helvetica uses WinAnsi encoding; transliterate or replace what it can't show. */
function toWinAnsi(text: string): string {
  return (
    text
      .replace(/[—–‘’“”…•]/g, (c) => PUNCT_MAP[c])
      // eslint-disable-next-line no-control-regex
      .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?')
  );
}
