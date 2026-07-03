'use client';

import { useRef } from 'react';
import { IconPencil, IconPlus, IconX } from './Icons';

/** A handful of premade cursive-style signature marks, drawn as inline SVG paths. */
const PRESET_SIGNATURES: { id: string; name: string; path: string; color: string }[] = [
  {
    id: 'flow',
    name: 'Flow',
    color: '#1e293b',
    path: 'M4 30 C 14 6, 22 6, 26 20 C 30 34, 38 8, 46 18 C 54 28, 60 10, 70 16 C 80 22, 90 30, 96 20',
  },
  {
    id: 'sharp',
    name: 'Sharp',
    color: '#1e293b',
    path: 'M4 26 L18 8 L26 26 L38 8 C 44 22, 50 30, 58 14 L66 26 L78 10 C 84 22, 90 26, 96 16',
  },
  {
    id: 'loop',
    name: 'Loop',
    color: '#1e3a8a',
    path: 'M6 20 C 6 6, 24 6, 20 20 C 16 32, 34 32, 34 18 C 34 6, 50 6, 48 22 C 74 4, 88 30, 96 14',
  },
  {
    id: 'bold',
    name: 'Bold',
    color: '#111827',
    path: 'M4 24 C 10 4, 20 4, 22 20 C 24 34, 40 34, 44 16 C 48 2, 62 2, 64 22 C 68 34, 84 30, 96 12',
  },
];

/** Rasterize a preset signature to a transparent PNG for use as an image annotation. */
async function renderPresetToPng(
  preset: (typeof PRESET_SIGNATURES)[number],
): Promise<{ bytes: Uint8Array; url: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(4, 4);
  ctx.strokeStyle = preset.color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(preset.path));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render signature');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) };
}

interface Props {
  onPickPreset: (bytes: Uint8Array, previewUrl: string) => void;
  onUpload: (file: File) => void;
  onDraw: () => void;
  onClose: () => void;
}

/**
 * Popover offering three ways to add a signature: pick a premade style,
 * upload an image of a real signature, or switch to the Draw tool.
 */
export default function SignatureLibrary({ onPickPreset, onUpload, onDraw, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute top-full left-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Add a signature</p>
        <button onClick={onClose} className="rounded p-0.5 text-slate-400 hover:text-red-500">
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {PRESET_SIGNATURES.map((preset) => (
          <button
            key={preset.id}
            onClick={async () => {
              const { bytes, url } = await renderPresetToPng(preset);
              onPickPreset(bytes, url);
              onClose();
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
            title={`Use "${preset.name}" style`}
          >
            <svg viewBox="0 0 100 36" className="h-8 w-full">
              <path
                d={preset.path}
                fill="none"
                stroke={preset.color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="mt-1 block text-[10px] text-slate-400">{preset.name}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-300"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Upload a photo of your signature
        </button>
        <button
          onClick={() => {
            onDraw();
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-300"
        >
          <IconPencil className="h-3.5 w-3.5" />
          Draw with mouse / touch pen
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onUpload(f);
            onClose();
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
