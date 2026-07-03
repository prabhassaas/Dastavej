'use client';

import { useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import {
  FIELD_TYPES,
  PAGE_SIZES,
  buildFormPdf,
  type FormFieldSpec,
  type FormFieldType,
  type FormLogo,
  type Orientation,
} from '@/lib/formBuilder';
import { FORM_TEMPLATES, type FormTemplate } from '@/lib/formTemplates';
import {
  collectColumns,
  exportRowsToCsv,
  exportRowsToXlsx,
  extractFormData,
  type FormRow,
} from '@/lib/formData';
import { downloadBytes } from '@/lib/download';
import { uid } from '@/lib/types';
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconForm,
  IconImage,
  IconPlus,
  IconSpinner,
  IconTable,
  IconTrash,
  IconX,
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

  const [mode, setMode] = useState<'design' | 'responses'>('design');
  const [title, setTitle] = useState('My Form');
  const [fileName, setFileName] = useState('my-form');
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [fields, setFields] = useState<FormFieldSpec[]>(INITIAL_FIELDS);
  const [photoBox, setPhotoBox] = useState(false);
  const [logo, setLogo] = useState<(FormLogo & { previewUrl: string }) | null>(null);
  const [photo, setPhoto] = useState<(FormLogo & { previewUrl: string }) | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadTemplate = (t: FormTemplate) => {
    setTemplateId(t.id);
    setTitle(t.title);
    setFileName(t.fileName);
    setPhotoBox(t.photoBox);
    setFields(t.fields.map((tf) => ({ ...tf, id: uid() })));
    setSavedMsg(null);
  };

  const readImage = async (file: File) => {
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      dispatch({ type: 'SET_ERROR', error: 'Please choose a PNG or JPEG image.' });
      return null;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type as FormLogo['mime'];
    return {
      bytes,
      mime,
      previewUrl: URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime })),
    };
  };

  const pickLogo = async (file: File) => {
    const img = await readImage(file);
    if (img) setLogo(img);
  };

  const pickPhoto = async (file: File) => {
    const img = await readImage(file);
    if (img) setPhoto(img);
  };

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
      logo,
      photoBox,
      photo: photoBox ? photo : null,
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
    setPhotoBox(false);
    setLogo(null);
    setTemplateId(null);
    setSavedMsg(null);
  };

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <IconForm className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              Form wizard
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Design a fillable PDF (AcroForm), share it, then import the filled copies and export
              every response to Excel — all on your device.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs dark:border-slate-700">
            <button
              onClick={() => setMode('design')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                mode === 'design'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              1 · Design
            </button>
            <button
              onClick={() => setMode('responses')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                mode === 'responses'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <IconTable className="h-3.5 w-3.5" />
              2 · Responses → Excel
            </button>
          </div>
        </div>

        {mode === 'responses' ? (
          <ResponsesView />
        ) : (
          <>
        {/* Templates */}
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
            Start from a template
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {FORM_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className={`rounded-xl border p-3 text-left transition ${
                  templateId === t.id
                    ? 'border-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-400/60'
                    : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-600'
                }`}
                title={`${t.fields.length} fields — ${t.audience}`}
              >
                <span className="text-lg">{t.emoji}</span>
                <span className="mt-1 block text-xs font-semibold leading-tight">{t.name}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
                  {t.audience}
                </span>
              </button>
            ))}
          </div>
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

          {/* Branding: logo + applicant photo box */}
          <div className="flex items-center gap-3">
            {logo ? (
              <span className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.previewUrl} alt="logo" className="h-7 max-w-24 object-contain" />
                <button
                  onClick={() => setLogo(null)}
                  className="rounded p-0.5 text-slate-400 hover:text-red-500"
                  title="Remove logo"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-600 dark:text-slate-400"
              >
                <IconImage className="h-4 w-4" />
                Add organization logo
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickLogo(f);
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={photoBox}
                onChange={(e) => setPhotoBox(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Applicant photo box (35 × 45 mm, top-right)
            </label>
            {photoBox &&
              (photo ? (
                <span className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt="applicant" className="h-8 w-6 rounded-sm object-cover" />
                  <button
                    onClick={() => setPhoto(null)}
                    className="rounded p-0.5 text-slate-400 hover:text-red-500"
                    title="Remove photo"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-lg border border-dashed border-slate-400 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-600 dark:text-slate-400"
                >
                  Upload photo now (optional)
                </button>
              ))}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickPhoto(f);
                e.target.value = '';
              }}
            />
          </div>
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
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Step 2 of the flow: collect filled forms back and turn them into a
 * spreadsheet. Each imported PDF becomes one row; export as .xlsx or .csv.
 */
function ResponsesView() {
  const { dispatch } = usePdfStore();
  const [rows, setRows] = useState<FormRow[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const importFiles = async (files: FileList) => {
    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const row = await extractFormData(file.name, new Uint8Array(await file.arrayBuffer()));
          setRows((rs) => [...rs, row]);
        } catch (err) {
          dispatch({
            type: 'SET_ERROR',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      setImporting(false);
    }
  };

  const columns = collectColumns(rows);
  const shownCols = columns.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* The flow, spelled out */}
      <ol className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
        {[
          ['1', 'Design your form and Save as PDF (previous step).'],
          ['2', 'Share it — email, WhatsApp, print… People fill it in any PDF viewer and save.'],
          ['3', 'Drop the filled PDFs below. Each file becomes one row — nothing is uploaded.'],
          ['4', 'Export to Excel (.xlsx) or CSV and analyse anywhere.'],
        ].map(([n, text]) => (
          <li key={n} className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">
              {n}
            </span>
            {text}
          </li>
        ))}
      </ol>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400"
      >
        {importing ? <IconSpinner className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
        {importing ? 'Reading form data…' : 'Import filled PDF forms (you can pick many at once)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">File</th>
                  {shownCols.map((c) => (
                    <th key={c} className="px-3 py-2 font-semibold">
                      {c.replaceAll('_', ' ')}
                    </th>
                  ))}
                  {columns.length > shownCols.length && (
                    <th className="px-3 py-2 font-semibold text-slate-400">
                      +{columns.length - shownCols.length} more
                    </th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.file}-${i}`} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="max-w-40 truncate px-3 py-2 font-medium">{row.file}</td>
                    {shownCols.map((c) => (
                      <td key={c} className="max-w-48 truncate px-3 py-2">
                        {row.values[c] ?? ''}
                      </td>
                    ))}
                    {columns.length > shownCols.length && <td className="px-3 py-2 text-slate-400">…</td>}
                    <td className="px-2 py-2">
                      <button
                        onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        className="rounded p-0.5 text-slate-400 hover:text-red-500"
                        title="Remove row"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void exportRowsToXlsx(rows)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
            >
              <IconDownload className="h-4 w-4" />
              Export to Excel (.xlsx)
            </button>
            <button
              onClick={async () => downloadBytes(await exportRowsToCsv(rows), 'form-responses.csv', 'text/csv')}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition hover:border-emerald-400 dark:border-slate-700"
            >
              Export CSV
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {rows.length} response{rows.length === 1 ? '' : 's'}, {columns.length} fields
            </span>
            <button
              onClick={() => setRows([])}
              className="ml-auto rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-red-500"
            >
              Clear all
            </button>
          </div>
        </>
      )}
    </div>
  );
}
