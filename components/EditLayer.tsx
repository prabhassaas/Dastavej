'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { getPdfjs } from '@/lib/pdfjs';
import { usePdfStore } from '@/lib/store';
import { uid, type AddedText, type PageEntry, type ViewportLike } from '@/lib/types';
import type { EditTool } from './Viewer';
import { IconMove, IconX } from './Icons';

/** A text block from pdf.js, projected into both screen and PDF space. */
interface DisplayItem {
  index: number;
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontPx: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfSize: number;
}

interface Props {
  pageEntry: PageEntry;
  page: PDFPageProxy;
  viewport: ViewportLike;
  tool: EditTool;
}

/**
 * Sits on top of the rendered canvas. Existing text blocks become clickable
 * regions that turn into textareas; new text boxes can be dropped anywhere.
 * All coordinates are stored in PDF user space so `assemblePdf` can replay
 * them exactly with pdf-lib.
 */
export default function EditLayer({ pageEntry, page, viewport, tool }: Props) {
  const { state, dispatch } = usePdfStore();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const pageEdits = state.edits[pageEntry.id];
  const textEdits = pageEdits?.textEdits ?? {};
  const added = pageEdits?.added ?? [];

  // Project every text item of the page into viewport coordinates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await getPdfjs();
      const content = await page.getTextContent();
      if (cancelled) return;
      const out: DisplayItem[] = [];
      content.items.forEach((item, index) => {
        if (!('str' in item) || !item.str.trim()) return;
        // transform = [a, b, c, d, e, f]; (e, f) is the baseline origin.
        const tr = pdfjs.Util.transform(viewport.transform, item.transform);
        const fontPx = Math.hypot(tr[2], tr[3]) || 12 * viewport.scale;
        const pdfSize = Math.hypot(item.transform[2], item.transform[3]) || item.height || 12;
        out.push({
          index,
          str: item.str,
          left: tr[4],
          top: tr[5] - fontPx,
          width: Math.max(item.width * viewport.scale, fontPx * 0.6),
          height: fontPx * 1.25,
          fontPx,
          pdfX: item.transform[4],
          pdfY: item.transform[5],
          pdfWidth: item.width,
          pdfSize,
        });
      });
      if (!cancelled) setItems(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, viewport]);

  const startEdit = (item: DisplayItem) => {
    dispatch({
      type: 'UPSERT_TEXT_EDIT',
      pageId: pageEntry.id,
      edit: {
        itemIndex: item.index,
        original: item.str,
        text: item.str,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        pdfWidth: item.pdfWidth,
        pdfSize: item.pdfSize,
      },
    });
  };

  const handleAddClick = (e: React.MouseEvent) => {
    if (tool !== 'add-text' || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const [pdfX, pdfY] = viewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
    dispatch({
      type: 'ADD_TEXT',
      pageId: pageEntry.id,
      added: { id: uid(), text: 'New text', pdfX, pdfY, pdfSize: 14 },
    });
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${tool === 'add-text' ? 'cursor-crosshair' : ''}`}
      style={{ width: viewport.width, height: viewport.height }}
      onClick={handleAddClick}
    >
      {/* Existing text blocks */}
      {tool === 'select' &&
        items.map((item) => {
          const edit = textEdits[item.index];
          if (edit) {
            return (
              <div
                key={item.index}
                className="group absolute"
                style={{ left: item.left, top: item.top, minWidth: item.width }}
              >
                <textarea
                  className="pdf-overlay-textarea block rounded-sm bg-white text-black ring-2 ring-indigo-500 outline-none"
                  style={{
                    fontSize: item.fontPx,
                    lineHeight: 1.25,
                    width: Math.max(item.width + 8, 60),
                    height: item.height + 6,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    padding: '0 2px',
                  }}
                  value={edit.text}
                  autoFocus
                  onChange={(e) =>
                    dispatch({
                      type: 'UPSERT_TEXT_EDIT',
                      pageId: pageEntry.id,
                      edit: { ...edit, text: e.target.value },
                    })
                  }
                />
                <button
                  className="absolute -top-2.5 -right-2.5 hidden rounded-full bg-slate-600 p-0.5 text-white shadow group-hover:block hover:bg-red-500 dark:bg-slate-700"
                  title="Revert this edit"
                  onClick={() =>
                    dispatch({
                      type: 'REMOVE_TEXT_EDIT',
                      pageId: pageEntry.id,
                      itemIndex: item.index,
                    })
                  }
                >
                  <IconX className="h-3 w-3" />
                </button>
              </div>
            );
          }
          return (
            <div
              key={item.index}
              className="absolute cursor-text rounded-sm ring-indigo-400/0 transition hover:bg-indigo-400/10 hover:ring-1 hover:ring-indigo-400/70"
              style={{ left: item.left, top: item.top, width: item.width, height: item.height }}
              title="Click to edit this text"
              onClick={() => startEdit(item)}
            />
          );
        })}

      {/* User-added text boxes */}
      {added.map((box) => (
        <AddedTextBox key={box.id} box={box} pageId={pageEntry.id} viewport={viewport} />
      ))}
    </div>
  );
}

function AddedTextBox({
  box,
  pageId,
  viewport,
}: {
  box: AddedText;
  pageId: string;
  viewport: ViewportLike;
}) {
  const { dispatch } = usePdfStore();
  const [vx, vy] = viewport.convertToViewportPoint(box.pdfX, box.pdfY);
  const fontPx = box.pdfSize * viewport.scale;
  // While dragging we keep a local pixel offset for smooth movement and only
  // commit the PDF-space position on pointer-up.
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const left = vx + (dragOffset?.dx ?? 0);
  const top = vy - fontPx + (dragOffset?.dy ?? 0);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ dx: 0, dy: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDragOffset({ dx: e.clientX - dragStart.current.x, dy: e.clientY - dragStart.current.y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = null;
    setDragOffset(null);
    const [pdfX, pdfY] = viewport.convertToPdfPoint(vx + dx, vy + dy);
    dispatch({ type: 'UPDATE_ADDED', pageId, id: box.id, patch: { pdfX, pdfY } });
  };

  return (
    <div className="group absolute" style={{ left, top }} onClick={(e) => e.stopPropagation()}>
      <textarea
        className="pdf-overlay-textarea block min-h-0 rounded-sm bg-transparent text-black ring-1 ring-emerald-500/70 outline-none focus:bg-white/80 focus:ring-2"
        style={{
          fontSize: fontPx,
          lineHeight: 1.2,
          width: Math.max(fontPx * 0.62 * Math.max(...box.text.split('\n').map((l) => l.length), 4) + 12, 60),
          height: fontPx * 1.2 * box.text.split('\n').length + 8,
          fontFamily: 'Helvetica, Arial, sans-serif',
          padding: '0 2px',
        }}
        value={box.text}
        onChange={(e) =>
          dispatch({ type: 'UPDATE_ADDED', pageId, id: box.id, patch: { text: e.target.value } })
        }
      />
      <div className="absolute -top-3 left-0 hidden -translate-y-full items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-lg group-focus-within:flex group-hover:flex dark:border-slate-700 dark:bg-slate-800">
        <button
          className="cursor-move rounded p-0.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          title="Drag to move"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <IconMove className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={6}
          max={96}
          value={Math.round(box.pdfSize)}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_ADDED',
              pageId,
              id: box.id,
              patch: { pdfSize: Number(e.target.value) || 14 },
            })
          }
          className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          title="Font size (pt)"
        />
        <button
          className="rounded p-0.5 text-slate-500 hover:bg-red-500/20 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-300"
          title="Delete text box"
          onClick={() => dispatch({ type: 'REMOVE_ADDED', pageId, id: box.id })}
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
