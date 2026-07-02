'use client';

import { usePdfStore } from '@/lib/store';
import type { DocMarks } from '@/lib/types';
import { IconDroplet } from './Icons';

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

/**
 * Document-level marks: text watermark and header / footer / page numbers.
 * Settings live in the store and are burned into every page on export;
 * the watermark previews live in the viewer.
 */
export default function MarksPanel() {
  const { state, dispatch } = usePdfStore();
  const marks = state.marks;

  const set = (patch: Partial<DocMarks>) =>
    dispatch({ type: 'SET_MARKS', marks: { ...marks, ...patch } });
  const setWm = (patch: Partial<DocMarks['watermark']>) =>
    set({ watermark: { ...marks.watermark, ...patch } });
  const setHf = (patch: Partial<DocMarks['headerFooter']>) =>
    set({ headerFooter: { ...marks.headerFooter, ...patch } });

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconDroplet className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Watermark, header &amp; footer
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Applied to every page when you export or print. The watermark previews live in the
            viewer.
          </p>
        </div>

        {/* Watermark */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <label className="flex items-center justify-between">
            <span className="text-sm font-semibold">Text watermark</span>
            <input
              type="checkbox"
              checked={marks.watermark.enabled}
              onChange={(e) => setWm({ enabled: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
          </label>
          <div className={marks.watermark.enabled ? 'space-y-4' : 'pointer-events-none space-y-4 opacity-40'}>
            <input
              value={marks.watermark.text}
              onChange={(e) => setWm({ text: e.target.value })}
              placeholder="CONFIDENTIAL, DRAFT, APPROVED…"
              className={`w-full ${inputCls}`}
            />
            <div className="grid grid-cols-3 gap-4">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  Opacity — {Math.round(marks.watermark.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.05}
                  value={marks.watermark.opacity}
                  onChange={(e) => setWm({ opacity: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Size</span>
                <select
                  value={marks.watermark.fontSize}
                  onChange={(e) => setWm({ fontSize: Number(e.target.value) })}
                  className={`w-full ${inputCls}`}
                >
                  <option value={40}>Small</option>
                  <option value={64}>Medium</option>
                  <option value={96}>Large</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Color</span>
                <select
                  value={marks.watermark.color}
                  onChange={(e) => setWm({ color: e.target.value as DocMarks['watermark']['color'] })}
                  className={`w-full ${inputCls}`}
                >
                  <option value="gray">Gray</option>
                  <option value="red">Red</option>
                  <option value="indigo">Indigo</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Header / footer */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <label className="flex items-center justify-between">
            <span className="text-sm font-semibold">Header, footer &amp; page numbers</span>
            <input
              type="checkbox"
              checked={marks.headerFooter.enabled}
              onChange={(e) => setHf({ enabled: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
          </label>
          <div className={marks.headerFooter.enabled ? 'space-y-4' : 'pointer-events-none space-y-4 opacity-40'}>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                Header text (top-left) — supports {'{date}'}
              </span>
              <input
                value={marks.headerFooter.headerText}
                onChange={(e) => setHf({ headerText: e.target.value })}
                placeholder="Acme Corp — internal report, {date}"
                className={`w-full ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                Footer text (bottom-left)
              </span>
              <input
                value={marks.headerFooter.footerText}
                onChange={(e) => setHf({ footerText: e.target.value })}
                placeholder="Generated with Dastavej on {date}"
                className={`w-full ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                Page numbers (bottom-center)
              </span>
              <select
                value={marks.headerFooter.pageNumbers}
                onChange={(e) =>
                  setHf({ pageNumbers: e.target.value as DocMarks['headerFooter']['pageNumbers'] })
                }
                className={`w-full ${inputCls}`}
              >
                <option value="">None</option>
                <option value="{page}">1, 2, 3…</option>
                <option value="Page {page}">Page 1</option>
                <option value="{page} of {total}">1 of N</option>
              </select>
            </label>
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Tip: use the <b>Export PDF</b> button (or Print) to bake these marks into the file —
          nothing is changed until then, and everything happens on your device.
        </p>
      </div>
    </div>
  );
}
