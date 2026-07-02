'use client';

import { memo, useEffect, useRef } from 'react';
import { getCachedDoc } from '@/lib/pdfCache';
import type { PageEntry } from '@/lib/types';

const THUMB_WIDTH = 150;

/** Small canvas preview of one working-document page, rendered via pdf.js. */
function PageThumb({ entry }: { entry: PageEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      try {
        const doc = getCachedDoc(entry.sourceId);
        const page = await doc.getPage(entry.pageIndex + 1);
        if (cancelled) return;
        const rotation = (page.rotate + entry.rotation) % 360;
        const base = page.getViewport({ scale: 1, rotation });
        const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
      } catch {
        // cancelled mid-render or source evicted — nothing to show
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [entry.sourceId, entry.pageIndex, entry.rotation]);

  return <canvas ref={canvasRef} className="block w-full rounded-sm bg-white" />;
}

export default memo(PageThumb);
