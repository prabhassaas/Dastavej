import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

/**
 * Renders a limited-but-useful subset of Markdown (headings, paragraphs,
 * bullet/numbered lists, horizontal rules) into a clean, styled PDF —
 * used by the AI "topic → PDF" generator. Pure pdf-lib, fully client-side.
 */

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 60;
const BODY_SIZE = 11;
const LINE_GAP = 1.45;

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'hr';
  text: string;
  ordinal?: string;
}

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) continue;
    const clean = (s: string) =>
      s
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
        .trim();
    if (/^#{1}\s/.test(t)) blocks.push({ kind: 'h1', text: clean(t.replace(/^#\s*/, '')) });
    else if (/^#{2}\s/.test(t)) blocks.push({ kind: 'h2', text: clean(t.replace(/^##\s*/, '')) });
    else if (/^#{3,}\s/.test(t)) blocks.push({ kind: 'h3', text: clean(t.replace(/^#{3,}\s*/, '')) });
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) blocks.push({ kind: 'hr', text: '' });
    else if (/^[-*+]\s+/.test(t)) blocks.push({ kind: 'li', text: clean(t.replace(/^[-*+]\s+/, '')) });
    else if (/^\d+[.)]\s+/.test(t)) {
      const m = t.match(/^(\d+)[.)]\s+(.*)$/)!;
      blocks.push({ kind: 'li', text: clean(m[2]), ordinal: `${m[1]}.` });
    } else blocks.push({ kind: 'p', text: clean(t) });
  }
  return blocks;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(probe, size) <= maxWidth || !line) line = probe;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function sanitize(text: string): string {
  return (
    text
      .replace(/[—–]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, '...')
      .replace(/[•·]/g, '-')
      // eslint-disable-next-line no-control-regex
      .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?')
  );
}

export async function buildPdfFromMarkdown(title: string, markdown: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('Dastavej AI — generated locally in the browser');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const indigo = rgb(0.35, 0.4, 0.95);
  const body = rgb(0.13, 0.15, 0.2);
  const gray = rgb(0.45, 0.48, 0.55);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const maxW = PAGE_W - MARGIN * 2;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 20) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Title block
  for (const line of wrap(sanitize(title), bold, 24, maxW)) {
    ensure(30);
    page.drawText(line, { x: MARGIN, y: y - 24, size: 24, font: bold, color: body });
    y -= 32;
  }
  const dateLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  page.drawText(dateLabel, { x: MARGIN, y: y - 8, size: 9.5, font, color: gray });
  y -= 18;
  page.drawLine({
    start: { x: MARGIN, y: y - 4 },
    end: { x: PAGE_W - MARGIN, y: y - 4 },
    thickness: 1.5,
    color: indigo,
  });
  y -= 28;

  for (const block of parseMarkdown(markdown)) {
    const text = sanitize(block.text);
    switch (block.kind) {
      case 'h1':
      case 'h2': {
        const size = block.kind === 'h1' ? 17 : 14;
        ensure(size * 2.6);
        y -= 10;
        for (const line of wrap(text, bold, size, maxW)) {
          ensure(size * LINE_GAP);
          page.drawText(line, { x: MARGIN, y: y - size, size, font: bold, color: indigo });
          y -= size * LINE_GAP;
        }
        y -= 4;
        break;
      }
      case 'h3': {
        ensure(30);
        y -= 6;
        for (const line of wrap(text, bold, 12, maxW)) {
          ensure(12 * LINE_GAP);
          page.drawText(line, { x: MARGIN, y: y - 12, size: 12, font: bold, color: body });
          y -= 12 * LINE_GAP;
        }
        break;
      }
      case 'hr':
        ensure(20);
        y -= 8;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_W - MARGIN, y },
          thickness: 0.75,
          color: gray,
        });
        y -= 12;
        break;
      case 'li': {
        const bulletIndent = 16;
        const lines = wrap(text, font, BODY_SIZE, maxW - bulletIndent);
        ensure(BODY_SIZE * LINE_GAP);
        page.drawText(block.ordinal ?? '-', {
          x: MARGIN + 2,
          y: y - BODY_SIZE,
          size: BODY_SIZE,
          font: bold,
          color: indigo,
        });
        lines.forEach((line) => {
          ensure(BODY_SIZE * LINE_GAP);
          page.drawText(line, {
            x: MARGIN + bulletIndent,
            y: y - BODY_SIZE,
            size: BODY_SIZE,
            font,
            color: body,
          });
          y -= BODY_SIZE * LINE_GAP;
        });
        y -= 2;
        break;
      }
      default: {
        for (const line of wrap(text, font, BODY_SIZE, maxW)) {
          ensure(BODY_SIZE * LINE_GAP);
          page.drawText(line, { x: MARGIN, y: y - BODY_SIZE, size: BODY_SIZE, font, color: body });
          y -= BODY_SIZE * LINE_GAP;
        }
        y -= 6;
      }
    }
  }

  // footer
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, {
      x: (PAGE_W - font.widthOfTextAtSize(label, 8.5)) / 2,
      y: 24,
      size: 8.5,
      font,
      color: gray,
    });
    p.drawText(sanitize(title).slice(0, 60), { x: MARGIN, y: 24, size: 8, font, color: gray });
  });

  return doc.save();
}
