'use client';

import { useCallback, useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { IconDocument, IconShield, IconSpinner } from './Icons';

export default function DropZone({ fullScreen = false }: { fullScreen?: boolean }) {
  const { addFiles } = usePdfStore();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setLoading(true);
      try {
        await addFiles(files);
      } finally {
        setLoading(false);
      }
    },
    [addFiles],
  );

  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? 'h-full p-8' : 'p-4'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
      }}
    >
      <div
        className={`flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center shadow-sm transition
          ${
            dragging
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-slate-300 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-500'
          }`}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <IconSpinner className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
        ) : (
          <IconDocument className="h-12 w-12 text-indigo-500 dark:text-indigo-400" />
        )}
        <div>
          <p className="text-lg font-semibold">
            {loading ? 'Opening PDF…' : 'Drop PDF files here'}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            or <span className="font-medium text-indigo-500 dark:text-indigo-400">click to browse</span> — drop several
            files to merge them
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <IconShield className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          Processed entirely in your browser. Nothing is uploaded, ever.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
