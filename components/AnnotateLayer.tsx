'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { uid, type Annotation, type PageEntry, type ViewportLike } from '@/lib/types';
import { IconMove, IconX } from './Icons';

export type AnnotTool = 'select' | 'highlight' | 'box' | 'ink' | 'image' | 'grab';

interface Props {
  pageEntry: PageEntry;
  viewport: ViewportLike;
  tool: AnnotTool;
  color: string;
  /** the rendered page canvas — needed by the magic-grab tool */
  canvas?: HTMLCanvasElement | null;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** called right after a magic-grab commits, so the caller can switch to Select */
  onAfterGrab?: () => void;
}

/**
 * "Magic grab": cut the dragged region out of the rendered canvas, make the
 * background transparent (sampled from the region border, like a chroma key),
 * cover the original spot with a background-colored patch, and re-add the
 * cutout as a movable/resizable image object.
 */
async function grabRegion(
  canvas: HTMLCanvasElement,
  viewport: ViewportLike,
  rect: { x: number; y: number; w: number; h: number },
): Promise<{ png: Uint8Array; url: string; bgHex: string } | null> {
  const scale = canvas.width / viewport.width; // device-pixel ratio of the render
  const sx = Math.max(0, Math.round(rect.x * scale));
  const sy = Math.max(0, Math.round(rect.y * scale));
  const sw = Math.min(canvas.width - sx, Math.round(rect.w * scale));
  const sh = Math.min(canvas.height - sy, Math.round(rect.h * scale));
  if (sw < 4 || sh < 4) return null;

  const cut = document.createElement('canvas');
  cut.width = sw;
  cut.height = sh;
  const ctx = cut.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const img = ctx.getImageData(0, 0, sw, sh);
  const d = img.data;

  // Sample the border to find the background color.
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const sample = (x: number, y: number) => {
    const i = (y * sw + x) * 4;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    n++;
  };
  for (let x = 0; x < sw; x += 3) {
    sample(x, 0);
    sample(x, sh - 1);
  }
  for (let y = 0; y < sh; y += 3) {
    sample(0, y);
    sample(sw - 1, y);
  }
  r /= n;
  g /= n;
  b /= n;

  // Knock out pixels close to the background color.
  const THRESHOLD = 60;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);
    if (dist < THRESHOLD) d[i + 3] = 0;
    else if (dist < THRESHOLD * 1.6) d[i + 3] = Math.round(((dist - THRESHOLD) / (THRESHOLD * 0.6)) * 255);
  }
  ctx.putImageData(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => cut.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
    bgHex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
  };
}

/** Annotation kinds a user can select, move and delete (the erase patch is internal plumbing). */
function isSelectable(a: Annotation): boolean {
  return a.kind !== 'erase';
}

/**
 * Interactive annotation overlay: drag to highlight/box/draw, place image
 * stamps, magic-grab objects, and — in the Select tool — click or drag any
 * existing object directly by its body to move it, multi-select with
 * Shift-click, or use the toolbar's Select all / Delete selected actions.
 * Geometry is committed in PDF user space so exports match the screen 1:1.
 */
export default function AnnotateLayer({
  pageEntry,
  viewport,
  tool,
  color,
  canvas,
  selectedIds,
  onSelectionChange,
  onAfterGrab,
}: Props) {
  const { state, dispatch } = usePdfStore();
  const annots = state.annots[pageEntry.id] ?? [];

  // in-progress drag geometry, in viewport px
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const [inkDraft, setInkDraft] = useState<[number, number][]>([]);
  const drawing = useRef(false);

  const toPdf = (vx: number, vy: number) => viewport.convertToPdfPoint(vx, vy);
  const local = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as const;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === 'select') {
      // Clicking empty page background clears the current selection.
      if (e.target === e.currentTarget) onSelectionChange(new Set());
      return;
    }
    if (e.target !== e.currentTarget || tool === 'image') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = local(e);
    if (tool === 'ink') setInkDraft([[x, y]]);
    else setDraft({ x0: x, y0: y, x1: x, y1: y }); // highlight / box / grab all drag a rect
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = local(e);
    if (tool === 'ink') setInkDraft((pts) => [...pts, [x, y]]);
    else setDraft((d) => (d ? { ...d, x1: x, y1: y } : d));
  };

  const onPointerUp = async () => {
    if (!drawing.current) return;
    drawing.current = false;

    if (tool === 'grab' && draft && canvas) {
      const vx = Math.min(draft.x0, draft.x1);
      const vy = Math.min(draft.y0, draft.y1);
      const vw = Math.abs(draft.x1 - draft.x0);
      const vh = Math.abs(draft.y1 - draft.y0);
      setDraft(null);
      if (vw > 6 && vh > 6) {
        const grabbed = await grabRegion(canvas, viewport, { x: vx, y: vy, w: vw, h: vh });
        if (grabbed) {
          const [px0, py1] = toPdf(vx, vy + vh); // bottom-left in PDF space
          const [px1, py0] = toPdf(vx + vw, vy);
          const rect = { x: px0, y: py1, w: px1 - px0, h: py0 - py1 };
          const imageId = uid();
          // 1) hide the original spot with a background-colored patch…
          dispatch({
            type: 'ADD_ANNOT',
            pageId: pageEntry.id,
            annot: { id: uid(), kind: 'erase', ...rect, color: grabbed.bgHex },
          });
          // 2) …then float the cutout on top as an editable, selected object.
          dispatch({
            type: 'ADD_ANNOT',
            pageId: pageEntry.id,
            annot: {
              id: imageId,
              kind: 'image',
              ...rect,
              bytes: grabbed.png,
              mime: 'image/png',
              previewUrl: grabbed.url,
            },
          });
          onSelectionChange(new Set([imageId]));
          onAfterGrab?.();
        }
      }
      setInkDraft([]);
      return;
    }

    if (tool === 'ink' && inkDraft.length > 1) {
      const points = inkDraft.map(([x, y]) => toPdf(x, y) as [number, number]);
      dispatch({
        type: 'ADD_ANNOT',
        pageId: pageEntry.id,
        annot: {
          id: uid(),
          kind: 'ink',
          points,
          color,
          strokeWidth: 2 / viewport.scale,
        },
      });
    } else if (draft && (tool === 'highlight' || tool === 'box')) {
      const [px0, py0] = toPdf(Math.min(draft.x0, draft.x1), Math.max(draft.y0, draft.y1));
      const [px1, py1] = toPdf(Math.max(draft.x0, draft.x1), Math.min(draft.y0, draft.y1));
      const w = px1 - px0;
      const h = py1 - py0;
      if (w > 2 && h > 2) {
        dispatch({
          type: 'ADD_ANNOT',
          pageId: pageEntry.id,
          annot: { id: uid(), kind: tool, x: px0, y: py0, w, h, color },
        });
      }
    }
    setDraft(null);
    setInkDraft([]);
  };

  const toggleSelect = (id: string, additive: boolean) => {
    const next = new Set(additive ? selectedIds : []);
    if (additive && selectedIds.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        width: viewport.width,
        height: viewport.height,
        cursor: tool === 'select' || tool === 'image' ? 'default' : 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* committed annotations */}
      {annots.map((a) => (
        <AnnotView
          key={a.id}
          annot={a}
          pageId={pageEntry.id}
          viewport={viewport}
          selectMode={tool === 'select'}
          selected={selectedIds.has(a.id)}
          onToggleSelect={(additive) => toggleSelect(a.id, additive)}
        />
      ))}

      {/* live drafts */}
      {draft && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: Math.min(draft.x0, draft.x1),
            top: Math.min(draft.y0, draft.y1),
            width: Math.abs(draft.x1 - draft.x0),
            height: Math.abs(draft.y1 - draft.y0),
            background: tool === 'highlight' ? color : 'transparent',
            opacity: tool === 'highlight' ? 0.35 : 1,
            border:
              tool === 'box'
                ? `2px solid ${color}`
                : tool === 'grab'
                  ? '2px dashed #6366f1'
                  : undefined,
          }}
        />
      )}
      {inkDraft.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={viewport.width}
          height={viewport.height}
        >
          <polyline
            points={inkDraft.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

/** Shared drag-by-body logic: press anywhere on the shape, drag, commit on release. */
function useBodyDrag(onCommit: (dx: number, dy: number) => void) {
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setOffset({ dx: 0, dy: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setOffset({ dx, dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    setOffset(null);
    if (moved.current) onCommit(dx, dy);
  };

  return { offset, dragged: moved.current, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}

/** Renders one committed annotation; in Select mode it's draggable-by-body and toggleable. */
function AnnotView({
  annot,
  pageId,
  viewport,
  selectMode,
  selected,
  onToggleSelect,
}: {
  annot: Annotation;
  pageId: string;
  viewport: ViewportLike;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (additive: boolean) => void;
}) {
  const { dispatch } = usePdfStore();
  const remove = () => dispatch({ type: 'REMOVE_ANNOT', pageId, id: annot.id });

  const commitMove = (dx: number, dy: number) => {
    const [x0, y0] = viewport.convertToPdfPoint(0, 0);
    const [x1, y1] = viewport.convertToPdfPoint(dx, dy);
    const pdfDx = x1 - x0;
    const pdfDy = y1 - y0;
    if (annot.kind === 'ink') {
      dispatch({
        type: 'UPDATE_ANNOT',
        pageId,
        id: annot.id,
        patch: { points: annot.points.map(([x, y]) => [x + pdfDx, y + pdfDy]) as [number, number][] },
      });
    } else {
      dispatch({ type: 'UPDATE_ANNOT', pageId, id: annot.id, patch: { x: annot.x + pdfDx, y: annot.y + pdfDy } });
    }
  };

  const { offset, dragged, handlers } = useBodyDrag(commitMove);
  const handleClick = (e: React.MouseEvent) => {
    if (!selectMode || dragged) return;
    e.stopPropagation();
    onToggleSelect(e.shiftKey || e.metaKey || e.ctrlKey);
  };

  if (annot.kind === 'ink') {
    const pts = annot.points.map(([px, py]) => viewport.convertToViewportPoint(px, py));
    const dx = offset?.dx ?? 0;
    const dy = offset?.dy ?? 0;
    return (
      <svg
        className="absolute inset-0"
        width={viewport.width}
        height={viewport.height}
        style={{ pointerEvents: selectMode ? 'auto' : 'none' }}
      >
        <polyline
          points={pts.map(([x, y]) => `${x + dx},${y + dy}`).join(' ')}
          fill="none"
          stroke={selected ? '#6366f1' : annot.color}
          strokeWidth={(annot.strokeWidth * viewport.scale) + (selected ? 1.5 : 0)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={selected ? '6 3' : undefined}
          style={{ cursor: selectMode ? 'move' : 'default' }}
          onPointerDown={selectMode ? handlers.onPointerDown : undefined}
          onPointerMove={selectMode ? handlers.onPointerMove : undefined}
          onPointerUp={(e) => {
            if (selectMode) handlers.onPointerUp(e);
            handleClick(e as unknown as React.MouseEvent);
          }}
        />
        {selected && pts[0] && (
          <foreignObject x={pts[0][0] + dx - 9} y={pts[0][1] + dy - 22} width="20" height="20">
            <DeleteDot onClick={remove} />
          </foreignObject>
        )}
      </svg>
    );
  }

  // rect-shaped annotations: highlight / box / image
  const [vx, vyTop] = viewport.convertToViewportPoint(annot.x, annot.y + annot.h);
  const w = annot.w * viewport.scale;
  const h = annot.h * viewport.scale;
  const left = vx + (offset?.dx ?? 0);
  const top = vyTop + (offset?.dy ?? 0);

  if (annot.kind === 'image') {
    return (
      <ImageAnnotView
        annot={annot}
        pageId={pageId}
        viewport={viewport}
        left={left}
        top={top}
        w={w}
        h={h}
        selectMode={selectMode}
        selected={selected}
        onToggleSelect={onToggleSelect}
        bodyDrag={handlers}
        dragged={dragged}
      />
    );
  }

  return (
    <div
      className="group absolute"
      style={{
        left,
        top,
        width: w,
        height: h,
        background: annot.kind === 'highlight' ? annot.color : 'transparent',
        opacity: annot.kind === 'highlight' ? 0.35 : 1,
        border: annot.kind === 'box' ? `2px solid ${annot.color}` : undefined,
        boxShadow: selected ? '0 0 0 2px #6366f1' : undefined,
        cursor: selectMode ? 'move' : 'default',
        pointerEvents: selectMode ? 'auto' : 'none',
      }}
      onPointerDown={selectMode ? handlers.onPointerDown : undefined}
      onPointerMove={selectMode ? handlers.onPointerMove : undefined}
      onPointerUp={(e) => {
        if (selectMode) handlers.onPointerUp(e);
        handleClick(e);
      }}
    >
      {(selected || selectMode) && (
        <button
          className={`absolute -top-2.5 -right-2.5 rounded-full bg-slate-700 p-0.5 text-white shadow hover:bg-red-500 ${
            selected ? 'block' : 'hidden group-hover:block'
          }`}
          title="Delete annotation"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
        >
          <IconX className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function DeleteDot({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="pointer-events-auto rounded-full bg-slate-700 p-0.5 text-white shadow hover:bg-red-500"
      title="Delete drawing"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <IconX className="h-3 w-3" />
    </button>
  );
}

/** Image stamp: drag its body to move (Select tool), or use the corner handle to resize. */
function ImageAnnotView({
  annot,
  pageId,
  viewport,
  left,
  top,
  w,
  h,
  selectMode,
  selected,
  onToggleSelect,
  bodyDrag,
  dragged,
}: {
  annot: Extract<Annotation, { kind: 'image' }>;
  pageId: string;
  viewport: ViewportLike;
  left: number;
  top: number;
  w: number;
  h: number;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (additive: boolean) => void;
  bodyDrag: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
  dragged: boolean;
}) {
  const { dispatch } = usePdfStore();
  const [resize, setResize] = useState<{ dw: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const beginResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setResize({ dw: 0 });
  };
  const moveResize = (e: React.PointerEvent) => {
    if (!start.current || !resize) return;
    setResize({ dw: e.clientX - start.current.x });
  };
  const endResize = (e: React.PointerEvent) => {
    if (!start.current || !resize) return;
    const dw = e.clientX - start.current.x;
    start.current = null;
    setResize(null);
    const scale = Math.max(0.1, (w + dw) / w);
    const newW = annot.w * scale;
    const newH = annot.h * scale;
    dispatch({
      type: 'UPDATE_ANNOT',
      pageId,
      id: annot.id,
      patch: { w: newW, h: newH, y: annot.y + annot.h - newH },
    });
  };

  const scale = resize ? Math.max(0.1, (w + resize.dw) / w) : 1;

  return (
    <div
      className={`group absolute ${selectMode ? 'ring-1 ring-indigo-400/60 hover:ring-2' : ''}`}
      style={{
        left,
        top,
        width: w * scale,
        height: h * scale,
        boxShadow: selected ? '0 0 0 2px #6366f1' : undefined,
        cursor: selectMode ? 'move' : 'default',
      }}
      onPointerDown={selectMode ? bodyDrag.onPointerDown : undefined}
      onPointerMove={selectMode ? bodyDrag.onPointerMove : undefined}
      onPointerUp={(e) => {
        if (selectMode) bodyDrag.onPointerUp(e);
        if (selectMode && !dragged) {
          e.stopPropagation();
          onToggleSelect(e.shiftKey || e.metaKey || e.ctrlKey);
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={annot.previewUrl}
        alt="stamp"
        className="h-full w-full select-none"
        draggable={false}
      />
      {selectMode && (
        <div
          className={`absolute -top-3 left-0 -translate-y-full items-center gap-1 rounded-md bg-slate-800 p-1 shadow-lg ${
            selected ? 'flex' : 'hidden group-hover:flex'
          }`}
        >
          <span className="flex items-center gap-0.5 rounded p-0.5 text-slate-400" title="Drag the image itself to move">
            <IconMove className="h-3.5 w-3.5" />
          </span>
          <button
            className="rounded p-0.5 text-slate-300 hover:bg-red-500/40 hover:text-red-300"
            title="Delete image"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'REMOVE_ANNOT', pageId, id: annot.id });
            }}
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {selectMode && (
        <div
          className={`absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-indigo-500 ${
            selected ? 'block' : 'hidden group-hover:block'
          }`}
          title="Drag to resize"
          onPointerDown={beginResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
        />
      )}
    </div>
  );
}
