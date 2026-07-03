'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePdfStore } from '@/lib/store';
import { getCachedDoc } from '@/lib/pdfCache';
import { ANNOT_COLORS, uid, type ViewportLike } from '@/lib/types';
import EditLayer from './EditLayer';
import AnnotateLayer, { type AnnotTool } from './AnnotateLayer';
import SignatureLibrary from './SignatureLibrary';
import TextLayer from './TextLayer';
import { IconChevronLeft, IconChevronRight, IconRotate, IconSpinner, IconTrash } from './Icons';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export type EditTool = 'select' | 'add-text';
export type ViewerMode = 'view' | 'edit' | 'annotate';

const ANNOT_TOOLS: { id: AnnotTool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'box', label: 'Box' },
  { id: 'ink', label: 'Draw' },
  { id: 'image', label: 'Image / sign' },
  { id: 'grab', label: '✨ Magic grab' },
];

const ANNOT_HINTS: Record<AnnotTool, string> = {
  select:
    'Click any object to select it (Shift-click to add more), drag its body to move it, or use Select all / Delete selected below.',
  highlight: 'Drag across the page to highlight an area. Pick a color on the right.',
  box: 'Drag to draw an outlined box around content.',
  ink: 'Draw freehand with the mouse or a touch pen — great for signatures.',
  image: 'Choose a premade signature, upload one, or draw your own — then drag to position and resize it.',
  grab: 'Drag around a seal, signature or any object to lift it off the page — it becomes a selected, movable object (background removed, original spot cleaned).',
};

/**
 * Single-page viewer with zoom and pagination, rendered via pdf.js.
 * Edit mode overlays editable textareas on text blocks; annotate mode adds
 * highlights, boxes, freehand ink and image stamps.
 */
export default function Viewer({ mode }: { mode: ViewerMode }) {
  const { state, dispatch } = usePdfStore();
  const entry = state.pages[state.currentPage];
  const editMode = mode === 'edit';
  const annotateMode = mode === 'annotate';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = useState<ViewportLike | null>(null);
  const [rendering, setRendering] = useState(false);
  const [tool, setTool] = useState<EditTool>('select');
  const [annotTool, setAnnotTool] = useState<AnnotTool>('select');
  const [annotColor, setAnnotColor] = useState(ANNOT_COLORS.yellow);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sigOpen, setSigOpen] = useState(false);

  // A fresh page means the previous selection no longer applies to anything visible.
  useEffect(() => setSelectedIds(new Set()), [entry?.id]);

  /** Place an image (signature/stamp/photo) centered on the current page, then select it. */
  const placeImageBytes = (bytes: Uint8Array, mime: 'image/png' | 'image/jpeg', previewUrl: string, natural: { w: number; h: number }) => {
    if (!viewport || !entry) return;
    const [pw] = viewport.convertToPdfPoint(viewport.width, 0);
    const w = pw / 3;
    const h = (w * natural.h) / natural.w;
    const [cx, cy] = viewport.convertToPdfPoint(viewport.width / 2, viewport.height / 2);
    const id = uid();
    dispatch({
      type: 'ADD_ANNOT',
      pageId: entry.id,
      annot: { id, kind: 'image', x: cx - w / 2, y: cy - h / 2, w, h, bytes, mime, previewUrl },
    });
    setSelectedIds(new Set([id]));
    setAnnotTool('select');
  };

  /** Place an uploaded image (signature/stamp/photo) on the current page. */
  const placeImage = async (file: File) => {
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      dispatch({ type: 'SET_ERROR', error: 'Please choose a PNG or JPEG image.' });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const previewUrl = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
    const natural = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = previewUrl;
    });
    placeImageBytes(bytes, mime, previewUrl, natural);
  };

  /** Rasterized presets are already PNGs at a known 400x140 canvas size. */
  const placePreset = (bytes: Uint8Array, previewUrl: string) => {
    placeImageBytes(bytes, 'image/png', previewUrl, { w: 400, h: 140 });
  };

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

        {annotateMode && (
          <>
            <div className="mx-3 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs dark:border-slate-700">
              {ANNOT_TOOLS.map((t) => (
                <div key={t.id} className="relative">
                  <button
                    onClick={() => {
                      setAnnotTool(t.id);
                      if (t.id === 'image') setSigOpen((v) => !v);
                      else setSigOpen(false);
                    }}
                    className={`rounded-md px-3 py-1 font-medium transition ${
                      annotTool === t.id
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                  {t.id === 'image' && sigOpen && (
                    <SignatureLibrary
                      onPickPreset={placePreset}
                      onUpload={(f) => void placeImage(f)}
                      onDraw={() => setAnnotTool('ink')}
                      onClose={() => setSigOpen(false)}
                    />
                  )}
                </div>
              ))}
            </div>
            {(annotTool === 'highlight' || annotTool === 'box' || annotTool === 'ink') && (
              <div className="ml-2 flex items-center gap-1.5">
                {Object.entries(ANNOT_COLORS).map(([name, hex]) => (
                  <button
                    key={name}
                    onClick={() => setAnnotColor(hex)}
                    className={`h-5 w-5 rounded-full border-2 transition ${
                      annotColor === hex ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                    }`}
                    style={{ background: hex }}
                    title={name}
                  />
                ))}
              </div>
            )}
            {annotTool === 'select' && (
              <div className="ml-2 flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setSelectedIds(new Set((state.annots[entry.id] ?? []).filter((a) => a.kind !== 'erase').map((a) => a.id)))
                  }
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                >
                  Select all
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                    >
                      Clear ({selectedIds.size})
                    </button>
                    <button
                      onClick={() => {
                        for (const id of selectedIds) dispatch({ type: 'REMOVE_ANNOT', pageId: entry.id, id });
                        setSelectedIds(new Set());
                      }}
                      className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <IconTrash className="h-3 w-3" />
                      Delete selected
                    </button>
                  </>
                )}
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void placeImage(f);
                e.target.value = '';
              }}
            />
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

      {annotateMode && (
        <p className="shrink-0 border-b border-slate-200 bg-indigo-500/10 px-4 py-1.5 text-center text-xs text-indigo-700 dark:border-slate-800 dark:text-indigo-200">
          {ANNOT_HINTS[annotTool]} Annotations are burned into the PDF on export.
        </p>
      )}

      {/* Page */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-slate-200 p-8 dark:bg-slate-950">
        <div className="mx-auto w-fit">
          <div className="relative shadow-2xl shadow-slate-400/50 dark:shadow-black/60">
            <canvas ref={canvasRef} className="block rounded-sm bg-white" />
            {mode === 'view' && page && viewport && <TextLayer page={page} viewport={viewport} />}
            {editMode && page && viewport && (
              <EditLayer key={`${entry.id}-${state.zoom}`} pageEntry={entry} page={page} viewport={viewport} tool={tool} />
            )}
            {annotateMode && viewport && (
              <AnnotateLayer
                key={`annot-${entry.id}-${state.zoom}`}
                pageEntry={entry}
                viewport={viewport}
                tool={annotTool}
                color={annotColor}
                canvas={canvasRef.current}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onAfterGrab={() => setAnnotTool('select')}
              />
            )}
            {/* live preview of document marks (watermark + header/footer) */}
            {viewport && state.marks.watermark.enabled && state.marks.watermark.text.trim() && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ opacity: state.marks.watermark.opacity }}
              >
                <span
                  className="-rotate-45 font-bold whitespace-nowrap"
                  style={{
                    fontSize: state.marks.watermark.fontSize * state.zoom,
                    color:
                      state.marks.watermark.color === 'red'
                        ? '#dc2626'
                        : state.marks.watermark.color === 'indigo'
                          ? '#6366f1'
                          : '#8a919c',
                  }}
                >
                  {state.marks.watermark.text}
                </span>
              </div>
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
