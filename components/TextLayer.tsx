'use client';

import { useEffect, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { getPdfjs } from '@/lib/pdfjs';
import type { ViewportLike } from '@/lib/types';

interface Span {
  key: number;
  left: number;
  top: number;
  fontPx: number;
  scaleX: number;
  str: string;
}

/**
 * Invisible, selectable text overlay for the View tab — lets people drag to
 * select and copy text like a native PDF viewer, without touching the
 * visible canvas render underneath. Positioning mirrors pdf.js's own
 * text-layer technique: each item becomes a transparent span placed at its
 * baseline, horizontally scaled so the browser's font metrics line up with
 * the PDF's actual glyph advance width.
 */
export default function TextLayer({ page, viewport }: { page: PDFPageProxy; viewport: ViewportLike }) {
  const [spans, setSpans] = useState<Span[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await getPdfjs();
      const content = await page.getTextContent();
      if (cancelled) return;

      const measurer = document.createElement('canvas').getContext('2d')!;
      const out: Span[] = [];
      content.items.forEach((item, index) => {
        if (!('str' in item) || !item.str) return;
        const tr = pdfjs.Util.transform(viewport.transform, item.transform);
        const fontPx = Math.hypot(tr[2], tr[3]) || 12 * viewport.scale;
        const targetWidth = item.width * viewport.scale;
        measurer.font = `${fontPx}px sans-serif`;
        const measured = measurer.measureText(item.str).width || 1;
        const scaleX = item.str.trim() ? targetWidth / measured : 1;
        out.push({
          key: index,
          left: tr[4],
          top: tr[5] - fontPx,
          fontPx,
          scaleX: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
          str: item.str,
        });
      });
      if (!cancelled) setSpans(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, viewport]);

  return (
    <div
      className="absolute inset-0 [&_span::selection]:bg-indigo-400/40"
      style={{ width: viewport.width, height: viewport.height }}
    >
      {spans.map((s) => (
        <span
          key={s.key}
          className="absolute origin-left cursor-text leading-none whitespace-pre text-transparent select-text"
          style={{
            left: s.left,
            top: s.top,
            fontSize: s.fontPx,
            transform: s.scaleX !== 1 ? `scaleX(${s.scaleX})` : undefined,
          }}
        >
          {s.str}
        </span>
      ))}
    </div>
  );
}
