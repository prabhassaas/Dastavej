'use client';

import { useState } from 'react';
import { usePdfStore } from '@/lib/store';
import {
  FIELD_TYPES,
  PAGE_SIZES,
  buildFormPdf,
  type FormFieldSpec,
  type FormFieldType,
  type Orientation,
} from '@/lib/formBuilder';
import { downloadBytes } from '@/lib/download';
import { uid } from '@/lib/types';
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconForm,
  IconPlus,
  IconSpinner,
  IconTrash,
} from './Icons';

const needsOptions = (t: FormFieldType) => t === 'dropdown' || t === 'radio';

function newField(): FormFieldSpec {
  return { id: uid(), label: '', type: 'text', required: false, defaultValue: '', options: [] };
}

const INITIAL_FIELDS = (): FormFieldSpec[] => [
  { ...newField(), label: 'Full name', type: 'text' },
  { ...newField(), label: 'Date of birth', type: 'date' },
];

/**
 * Wizard that builds a fillable AcroForm PDF from scratch, fully client-side.
 * Saved forms can be opened in any PDF viewer; data entered there is stored
 * inside the PDF itself when the user saves it.
 */
export default function FormWizard() {
  const { dispatch, addGeneratedPdf } = usePdfStore();

  const [title, setTitle] = useState('My Form');
  const [fileName, setFileName] = useState('my-form');
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [fields, setFields] = useState<FormFieldSpec[]>(INITIAL_FIELDS);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const patchField = (id: string, patch: Partial<FormFieldSpec>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const moveField = (index: number, dir: -1 | 1) =>
    setFields((fs) => {
      const to = index + dir;
      if (to < 0 || to >= fs.length) return fs;
      const next = [...fs];
      const [f] = next.splice(index, 1);
      next.splice(to, 0, f);
      return next;
    });

  const build = () =>
    buildFormPdf({
      title,
      fields: fields.filter((f) => f.label.trim() || f.options.length),
      pageSize,
      orientation,
    });

  const handleSave = async (openInEditor: boolean) => {
    if (!fields.some((f) => f.label.trim())) {
      dispatch({ type: 'SET_ERROR', error: 'Add at least one field with a name before saving.' });
      return;
    }
    setSaving(true);
    setSavedMsg(null);
    try {
      const bytes = await build();
      const name = `${(fileName.trim() || 'form').replace(/\.pdf$/i, '')}.pdf`;
      if (openInEditor) {
        await addGeneratedPdf(name, bytes);
        dispatch({ type: 'SET_TAB', tab: 'view' });
      } else {
        downloadBytes(bytes, name);
        setSavedMsg(`Saved "${name}" to your downloads — entirely on your device.`);
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not build the form: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle('My Form');
    setFileName('my-form');
    setPageSize('A4');
    setOrientation('portrait');
    setFields(INITIAL_FIELDS());
    setSavedMsg(null);
  };

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconForm className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Create a fillable form
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Design a form with real interactive fields (AcroForm). Anyone can open the PDF, fill
            it in, and the entered data is saved inside the PDF file itself.
          </p>
        </div>

        {/* Document settings */}
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/60">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Form title (printed at the top)
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              File name
            </span>
            <div className="flex items-center gap-1">
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className={`w-full ${inputCls}`}
              />
              <span className="text-sm text-slate-400">.pdf</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Page size
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as keyof typeof PAGE_SIZES)}
              className={`w-full ${inputCls}`}
            >
              {Object.keys(PAGE_SIZES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Orientation
            </span>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as Orientation)}
              className={`w-full ${inputCls}`}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        </div>

        {/* Field list */}
        <div className="space-y-3">
          {fields.map((field, index) => {
            const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
            return (
              <div
                key={field.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <span className="pb-2 text-xs font-semibold text-slate-400">{index + 1}.</span>
                  <label className="min-w-40 flex-1">
                    <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Field name
                    </span>
                    <input
                      value={field.label}
                      placeholder="e.g. Full name"
                      onChange={(e) => patchField(field.id, { label: e.target.value })}
                      className={`w-full ${inputCls}`}
                    />
                  </label>
                  <label className="w-44">
                    <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Type
                    </span>
                    <select
                      value={field.type}
                      onChange={(e) => patchField(field.id, { type: e.target.value as FormFieldType })}
                      className={`w-full ${inputCls}`}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!needsOptions(field.type) && field.type !== 'checkbox' && (
                    <label className="w-40">
                      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Default value
                      </span>
                      <input
                        value={field.defaultValue}
                        placeholder={typeInfo?.hint}
                        onChange={(e) => patchField(field.id, { defaultValue: e.target.value })}
                        className={`w-full ${inputCls}`}
                      />
                    </label>
                  )}
                  {needsOptions(field.type) && (
                    <label className="min-w-48 flex-1">
                      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Options (comma-separated)
                      </span>
                      <input
                        value={field.options.join(', ')}
                        placeholder="Option A, Option B, Option C"
                        onChange={(e) =>
                          patchField(field.id, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className={`w-full ${inputCls}`}
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 pb-2.5 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => patchField(field.id, { required: e.target.checked })}
                      className="accent-indigo-500"
                    />
                    Required
                  </label>
                  <div className="flex items-center gap-1 pb-1.5">
                    <button
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      title="Move up"
                    >
                      <IconArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      title="Move down"
                    >
                      <IconArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setFields((fs) => fs.filter((f) => f.id !== field.id))}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      title="Remove field"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {typeInfo && (
                  <p className="mt-1 pl-6 text-[11px] text-slate-400 dark:text-slate-500">
                    {typeInfo.hint}
                  </p>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setFields((fs) => [...fs, newField()])}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-400"
          >
            <IconPlus className="h-4 w-4" />
            Add field
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <button
            onClick={() => void handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? <IconSpinner className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}
            Save as PDF
          </button>
          <button
            onClick={() => void handleSave(true)}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition hover:border-indigo-400 disabled:opacity-50 dark:border-slate-700"
          >
            Save &amp; open in editor
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-500 transition hover:border-red-400 hover:text-red-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400"
          >
            Cancel / reset
          </button>
          {savedMsg && <span className="text-sm text-emerald-600 dark:text-emerald-400">{savedMsg}</span>}
        </div>
      </div>
    </div>
  );
}
