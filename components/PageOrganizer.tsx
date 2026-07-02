'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import PageThumb from './PageThumb';
import { IconPlus, IconRotate, IconTrash } from './Icons';

/**
 * Grid of page thumbnails. Drag to reorder, delete or rotate single pages,
 * and add more PDFs (their pages are appended — that is the merge).
 * Everything happens on the in-memory page list; pdf-lib assembles the
 * result on export.
 */
export default function PageOrganizer() {
  const { state, dispatch, addFiles } = usePdfStore();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const multipleSources = Object.keys(state.sources).length > 1;

  const handleDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) {
      dispatch({ type: 'REORDER_PAGES', from: dragIndex, to });
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Drag pages to reorder{multipleSources ? ' — pages from all files can be interleaved' : ''}.
          Deletions and ordering apply on export.
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-600 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-400 hover:text-indigo-300"
        >
          <IconPlus className="h-4 w-4" />
          Add / merge PDFs
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {state.pages.map((entry, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          return (
            <div
              key={entry.id}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex((i) => (i === index ? null : i))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDoubleClick={() => {
                dispatch({ type: 'SET_PAGE', index });
                dispatch({ type: 'SET_TAB', tab: 'view' });
              }}
              className={`group relative cursor-grab rounded-xl border p-2 transition active:cursor-grabbing
                ${isDragging ? 'opacity-40' : ''}
                ${isOver ? 'border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/60' : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'}`}
              title="Drag to reorder — double-click to open in viewer"
            >
              <PageThumb entry={entry} />
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-400">{index + 1}</span>
                {multipleSources && (
                  <span className="max-w-24 truncate text-[10px] text-slate-500">
                    {state.sources[entry.sourceId]?.name}
                  </span>
                )}
              </div>
              {/* Hover actions */}
              <div className="absolute top-3 right-3 hidden gap-1 group-hover:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'ROTATE_PAGE', pageId: entry.id });
                  }}
                  className="rounded-md bg-slate-900/90 p-1.5 text-slate-200 shadow hover:bg-indigo-500"
                  title="Rotate 90°"
                >
                  <IconRotate className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'REMOVE_PAGE', pageId: entry.id });
                  }}
                  className="rounded-md bg-slate-900/90 p-1.5 text-slate-200 shadow hover:bg-red-500"
                  title="Delete page"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
