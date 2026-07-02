import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { PageEdits, PageEntry, SourceFile } from './types';

/**
 * Assemble the working document entirely in the browser with pdf-lib:
 * pages are copied from their source files in the user's order (which also
 * performs merging), then text edits are replayed in PDF user space.
 */
export async function assemblePdf(
  sources: Record<string, SourceFile>,
  pages: PageEntry[],
  edits: Record<string, PageEdits>,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);

  const srcDocs = new Map<string, PDFDocument>();
  for (const entry of pages) {
    if (!srcDocs.has(entry.sourceId)) {
      srcDocs.set(entry.sourceId, await PDFDocument.load(sources[entry.sourceId].bytes));
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
    if (!pageEdits) continue;

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
        page.drawText(toWinAnsi(edit.text), {
          x: edit.pdfX,
          y: edit.pdfY,
          size: edit.pdfSize,
          font,
          color: rgb(0, 0, 0),
          lineHeight: edit.pdfSize * 1.2,
        });
      }
    }

    for (const added of pageEdits.added) {
      if (!added.text.trim()) continue;
      page.drawText(toWinAnsi(added.text), {
        x: added.pdfX,
        y: added.pdfY,
        size: added.pdfSize,
        font,
        color: rgb(0, 0, 0),
        lineHeight: added.pdfSize * 1.2,
      });
    }
  }

  return out.save();
}

/** Helvetica uses WinAnsi encoding; replace characters it cannot represent. */
function toWinAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?');
}
