'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePdfStore } from '@/lib/store';
import { getCachedDoc } from '@/lib/pdfCache';
import type { ViewportLike } from '@/lib/types';
import EditLayer from './EditLayer';
import { IconChevronLeft, IconChevronRight, IconRotate, IconSpinner } from './Icons';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export type EditTool = 'select' | 'add-text';

/**
 * Single-page viewer with zoom and pagination, rendered via pdf.js.
 * In edit mode, an HTML overlay maps PDF text blocks to editable textareas.
 */
export default function Viewer({ editMode }: { editMode: boolean }) {
  const { state, dispatch } = usePdfStore();
  const entry = state.pages[state.currentPage];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = useState<ViewportLike | null>(null);
  const [rendering, setRendering] = useState(false);
  const [tool, setTool] = useState<EditTool>('select');

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    (async () => {
      setRendering(true);
      try {
        const doc = getCachedDoc(entry.sourceId);
        const pdfPage = await doc.getPage(entry.pageIndex + 1);
        if (cancelled) return;
        const vp = pdfPage.getViewport({
          scale: state.zoom,
          rotation: (pdfPage.rotate + entry.rotation) % 360,
        });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        renderTask = pdfPage.render({
          canvas,
          viewport: vp,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (!cancelled) {
          setPage(pdfPage);
          setViewport(vp as unknown as ViewportLike);
        }
      } catch (err) {
        // RenderingCancelledException is expected when zoom/page changes fast
        if (!cancelled && !(err instanceof Error && err.name === 'RenderingCancelledException')) {
          dispatch({
            type: 'SET_ERROR',
            error: `Could not render page: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [entry?.id, entry?.rotation, entry?.sourceId, entry?.pageIndex, state.zoom, dispatch, entry]);

  if (!entry) return null;

  const zoomTo = (z: number) => dispatch({ type: 'SET_ZOOM', zoom: z });
  const zoomIndex = ZOOM_STEPS.findIndex((z) => z >= state.zoom);

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex h-12 shrink-0 items-center justify-center gap-2 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900/40">
        <button
          onClick={() => dispatch({ type: 'SET_PAGE', index: state.currentPage - 1 })}
          disabled={state.currentPage === 0}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Previous page"
        >
          <IconChevronLeft />
        </button>
        <span className="min-w-24 text-center text-sm text-slate-600 dark:text-slate-300">
          Page{' '}
          <input
            type="number"
            min={1}
            max={state.pages.length}
            value={state.currentPage + 1}
            onChange={(e) => dispatch({ type: 'SET_PAGE', index: Number(e.target.value) - 1 })}
            className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
          />{' '}
          / {state.pages.length}
        </span>
        <button
          onClick={() => dispatch({ type: 'SET_PAGE', index: state.currentPage + 1 })}
          disabled={state.currentPage >= state.pages.length - 1}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Next page"
        >
          <IconChevronRight />
        </button>

        <div className="mx-3 h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <button
          onClick={() => zoomTo(ZOOM_STEPS[Math.max(0, (zoomIndex === -1 ? ZOOM_STEPS.length : zoomIndex) - 1)])}
          className="rounded-lg px-2.5 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="w-14 text-center text-sm text-slate-600 dark:text-slate-300">
          {Math.round(state.zoom * 100)}%
        </span>
        <button
          onClick={() => zoomTo(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)])}
          className="rounded-lg px-2.5 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Zoom in"
        >
          +
        </button>

        <div className="mx-3 h-6 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={() => dispatch({ type: 'ROTATE_PAGE', pageId: entry.id })}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Rotate page 90°"
        >
          <IconRotate className="h-4 w-4" />
        </button>

        {editMode && (
          <>
            <div className="mx-3 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs dark:border-slate-700">
              <button
                onClick={() => setTool('select')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  tool === 'select' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Edit text
              </button>
              <button
                onClick={() => setTool('add-text')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  tool === 'add-text' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                + Add text
              </button>
            </div>
          </>
        )}
      </div>

      {editMode && (
        <p className="shrink-0 border-b border-slate-200 bg-indigo-500/10 px-4 py-1.5 text-center text-xs text-indigo-700 dark:border-slate-800 dark:text-indigo-200">
          {tool === 'select'
            ? 'Click any text block on the page to edit it. Changes are burned into the PDF on export.'
            : 'Click anywhere on the page to place a new text box. Drag the handle to move it.'}
        </p>
      )}

      {/* Page */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-slate-200 p-8 dark:bg-slate-950">
        <div className="mx-auto w-fit">
          <div className="relative shadow-2xl shadow-slate-400/50 dark:shadow-black/60">
            <canvas ref={canvasRef} className="block rounded-sm bg-white" />
            {editMode && page && viewport && (
              <EditLayer key={`${entry.id}-${state.zoom}`} pageEntry={entry} page={page} viewport={viewport} tool={tool} />
            )}
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-500/10 dark:bg-slate-950/30">
                <IconSpinner className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
