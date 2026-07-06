'use client';

import { useEffect, useRef, useState } from 'react';
import { PDFDocument, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { usePdfStore } from '@/lib/store';
import {
  AI_PRESETS,
  aiChat,
  isAiConfigured,
  isDefaultAiSettings,
  loadAiSettings,
  parseAiSettingsFile,
  parseJsonReply,
  PROFESSIONAL_STYLE_INSTRUCTION,
  saveAiSettings,
  serializeAiSettings,
  type AiSettings,
} from '@/lib/ai';
import { buildPdfFromMarkdown } from '@/lib/mdPdf';
import { assemblePdf } from '@/lib/export';
import { extractAllText } from '@/lib/tts';
import { buildRagIndex, searchRagIndex, formatContext, type RagChunk } from '@/lib/rag';
import { downloadBytes } from '@/lib/download';
import { IconDownload, IconSparkle, IconSpinner } from './Icons';

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800';

/**
 * Bring-your-own-AI workbench. The app never ships or proxies a model:
 * users point it at an open-source model they run locally (unlimited, free,
 * private) or at any OpenAI-compatible provider. Features: topic → styled
 * PDF (with a multi-pass "deep research" mode) and AI form filling.
 */
export default function AiPanel() {
  const { state, dispatch, addGeneratedPdf } = usePdfStore();

  // ── provider settings ────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AiSettings>({ endpoint: '', apiKey: '', model: '', embedModel: '' });
  const [settingsMsg, setSettingsMsg] = useState('');
  const [testing, setTesting] = useState(false);
  // Collapsed by default once a config already exists, so daily use doesn't
  // show the endpoint/key fields on every visit — expand any time via "Edit".
  const [settingsOpen, setSettingsOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const loaded = loadAiSettings();
    setSettings(loaded);
    setSettingsOpen(!isAiConfigured(loaded));
  }, []);

  const persist = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

  const exportConfig = () => {
    downloadBytes(
      new TextEncoder().encode(serializeAiSettings(settings)),
      'dastavej-ai-config.json',
      'application/json',
    );
  };

  const importConfig = async (file: File) => {
    try {
      const next = parseAiSettingsFile(await file.text());
      setSettings(next);
      saveAiSettings(next);
      setSettingsMsg('✓ Config imported.');
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'That file is not a valid Dastavej AI config export.' });
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setSettingsMsg('');
    try {
      const reply = await aiChat([
        { role: 'user', content: 'Reply with the single word: ready' },
      ]);
      setSettingsMsg(`✓ Connected — model replied: "${reply.trim().slice(0, 40)}"`);
    } catch (err) {
      setSettingsMsg(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  // ── topic → PDF ──────────────────────────────────────────────────────────
  const [topic, setTopic] = useState('');
  const [deep, setDeep] = useState(true);
  const [genStatus, setGenStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenResult(null);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    try {
      let markdown: string;
      if (deep) {
        setGenStatus('Pass 1/2 — researching and outlining…');
        const outlineReply = await aiChat(
          [
            {
              role: 'system',
              content:
                'You are a meticulous researcher. Reply ONLY with JSON: {"title": string, "sections": string[]} — 5 to 8 section titles that together cover the topic deeply (fundamentals, current state, data/examples, controversies, practical guidance, outlook).' +
                ` ${PROFESSIONAL_STYLE_INSTRUCTION}`,
            },
            { role: 'user', content: `Topic: ${topic}` },
          ],
          signal,
        );
        const outline = parseJsonReply(outlineReply) as { title?: string; sections?: string[] };
        const sections = (outline.sections ?? []).slice(0, 8);
        if (!sections.length) throw new Error('The model returned no outline sections.');
        const parts: string[] = [];
        for (let i = 0; i < sections.length; i++) {
          setGenStatus(`Pass 2/2 — writing section ${i + 1} of ${sections.length}: ${sections[i]}`);
          const section = await aiChat(
            [
              {
                role: 'system',
                content:
                  'Write one section of a professional report in Markdown. Start with "## <section title>". 250–450 words. Use concrete facts, numbers and examples where possible; bullet lists where they help. No preamble, no closing remarks about the report itself.' +
                  ` ${PROFESSIONAL_STYLE_INSTRUCTION}`,
              },
              {
                role: 'user',
                content: `Report topic: ${topic}\nSection to write: ${sections[i]}\nOther sections (do not repeat their content): ${sections.filter((_, j) => j !== i).join('; ')}`,
              },
            ],
            signal,
          );
          parts.push(section.trim());
        }
        markdown = parts.join('\n\n');
      } else {
        setGenStatus('Generating document…');
        markdown = await aiChat(
          [
            {
              role: 'system',
              content:
                'Write a well-structured, factual document in Markdown with ## section headings and bullet lists where useful. 600–900 words. No preamble.' +
                ` ${PROFESSIONAL_STYLE_INSTRUCTION}`,
            },
            { role: 'user', content: `Topic: ${topic}` },
          ],
          signal,
        );
      }
      setGenStatus('Rendering PDF…');
      const bytes = await buildPdfFromMarkdown(topic.trim(), markdown);
      const name = `${topic.trim().toLowerCase().replace(/[^\w]+/g, '-').slice(0, 48) || 'document'}.pdf`;
      setGenResult({ bytes, name });
      setGenStatus('');
    } catch (err) {
      setGenStatus('');
      dispatch({
        type: 'SET_ERROR',
        error: `Generation failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  // ── Chat with this document (RAG) ────────────────────────────────────────
  const [ragIndex, setRagIndex] = useState<RagChunk[] | null>(null);
  const [ragBuilding, setRagBuilding] = useState(false);
  const [ragStatus, setRagStatus] = useState('');
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragAsking, setRagAsking] = useState(false);
  const [ragHistory, setRagHistory] = useState<{ question: string; answer: string; sources: string[] }[]>([]);

  const buildDocIndex = async () => {
    setRagBuilding(true);
    setRagStatus('Reading document text…');
    setRagIndex(null);
    setRagHistory([]);
    try {
      const bytes = await assemblePdf(state.sources, state.pages, state.edits, {
        annots: state.annots,
        marks: state.marks,
      });
      const pages = await extractAllText(bytes);
      const nonEmpty = pages
        .map((text, i) => ({ text, source: `Page ${i + 1}` }))
        .filter((p) => p.text.trim());
      if (!nonEmpty.length) {
        throw new Error(
          'No extractable text found — this looks like a scanned document. Run it through the OCR tab first.',
        );
      }
      const index = await buildRagIndex(nonEmpty, (done, total) =>
        setRagStatus(`Embedding chunks… ${done}/${total}`),
      );
      setRagIndex(index);
      setRagStatus('');
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not index the document: ${err instanceof Error ? err.message : String(err)}`,
      });
      setRagStatus('');
    } finally {
      setRagBuilding(false);
    }
  };

  const askDoc = async () => {
    if (!ragIndex || !ragQuestion.trim() || ragAsking) return;
    const question = ragQuestion.trim();
    setRagQuestion('');
    setRagAsking(true);
    try {
      const top = await searchRagIndex(ragIndex, question, 5);
      const context = formatContext(top);
      const answer = await aiChat([
        {
          role: 'system',
          content:
            "Answer the user's question using ONLY the provided document excerpts. If the " +
            "answer isn't in the excerpts, say so plainly rather than guessing or using outside " +
            'knowledge. Cite excerpt numbers like [1] where relevant.',
        },
        { role: 'user', content: `Document excerpts:\n${context}\n\nQuestion: ${question}` },
      ]);
      setRagHistory((h) => [
        ...h,
        { question, answer: answer.trim(), sources: [...new Set(top.map((c) => c.source ?? '').filter(Boolean))] },
      ]);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Question failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setRagAsking(false);
    }
  };

  // ── AI form fill ─────────────────────────────────────────────────────────
  const [fillData, setFillData] = useState('');
  const [filling, setFilling] = useState(false);
  const [fillStatus, setFillStatus] = useState('');
  const formInputRef = useRef<HTMLInputElement>(null);
  const [formSource, setFormSource] = useState<{ name: string; bytes: Uint8Array } | null>(null);

  const useWorkspaceForm = async () => {
    const bytes = await assemblePdf(state.sources, state.pages, state.edits, {
      annots: state.annots,
      marks: state.marks,
    });
    setFormSource({ name: 'current-document.pdf', bytes });
  };

  const fillForm = async () => {
    if (!formSource) return;
    setFilling(true);
    setFillStatus('Reading form fields…');
    try {
      const doc = await PDFDocument.load(formSource.bytes);
      const form = doc.getForm();
      const specs = form.getFields().map((f) => {
        const name = f.getName();
        if (f instanceof PDFCheckBox) return { name, type: 'checkbox' };
        if (f instanceof PDFRadioGroup) return { name, type: 'radio', options: f.getOptions() };
        if (f instanceof PDFDropdown) return { name, type: 'dropdown', options: f.getOptions() };
        return { name, type: 'text' };
      });
      if (!specs.length) throw new Error('This PDF has no fillable form fields.');

      setFillStatus('Asking the AI to map your data to the fields…');
      const reply = await aiChat([
        {
          role: 'system',
          content:
            'You fill PDF forms. Given form field definitions and unstructured user data, reply ONLY with a JSON object mapping field names to values. For checkbox fields use "Yes" or "No". For radio/dropdown fields pick EXACTLY one of the given options. Leave out fields you cannot infer.',
        },
        {
          role: 'user',
          content: `Fields:\n${JSON.stringify(specs, null, 1)}\n\nUser data:\n${fillData}`,
        },
      ]);
      const values = parseJsonReply(reply);

      setFillStatus('Writing values into the PDF…');
      let applied = 0;
      for (const [name, value] of Object.entries(values)) {
        const v = String(value ?? '');
        try {
          const field = form.getField(name);
          if (field instanceof PDFTextField) field.setText(v);
          else if (field instanceof PDFCheckBox) {
            if (/^(yes|true|1)$/i.test(v)) field.check();
            else field.uncheck();
          } else if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
            const match = field.getOptions().find((o) => o.toLowerCase() === v.toLowerCase());
            if (match) field.select(match);
          }
          applied++;
        } catch {
          // unknown field name from the model — skip
        }
      }
      const outBytes = await doc.save();
      downloadBytes(outBytes, formSource.name.replace(/\.pdf$/i, '-filled.pdf'));
      setFillStatus(`✓ Filled ${applied} fields — the PDF was downloaded.`);
    } catch (err) {
      setFillStatus('');
      dispatch({
        type: 'SET_ERROR',
        error: `Form fill failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setFilling(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconSparkle className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            AI workbench — bring your own open-source model
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Dastavej has no server, so AI runs on an endpoint <i>you</i> control. Run an
            open-source model locally with <b>Ollama</b> for unlimited free use (100% private), or
            plug in any OpenAI-compatible provider. Your key stays in this browser.
          </p>
        </div>

        {/* Provider settings — collapsed to a one-line summary once configured,
            so the endpoint/key fields aren't on display every visit. */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {!settingsOpen && isAiConfigured(settings) ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">
                  ✓ {isDefaultAiSettings(settings) ? 'AI ready (built-in default)' : 'AI configured'}
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  {settings.model} @ {settings.endpoint}
                  {isDefaultAiSettings(settings) && ' — install Ollama locally to use this'}
                </span>
              </p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-indigo-400 dark:border-slate-700"
              >
                Edit
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Provider settings</p>
                {isAiConfigured(settings) && (
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Collapse
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => persist({ endpoint: p.endpoint })}
                    title={p.note}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      settings.endpoint === p.endpoint
                        ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                        : 'border-slate-300 text-slate-500 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    Endpoint (OpenAI-compatible, ends in /v1)
                  </span>
                  <input
                    value={settings.endpoint}
                    onChange={(e) => persist({ endpoint: e.target.value })}
                    placeholder="http://localhost:11434/v1"
                    className={`w-full ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Model</span>
                  <input
                    value={settings.model}
                    onChange={(e) => persist({ model: e.target.value })}
                    placeholder="llama3.1"
                    className={`w-full ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    API key (leave empty for local models)
                  </span>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => persist({ apiKey: e.target.value })}
                    placeholder="sk-…"
                    className={`w-full ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    Embedding model (for "chat with your PDF")
                  </span>
                  <input
                    value={settings.embedModel}
                    onChange={(e) => persist({ embedModel: e.target.value })}
                    placeholder="nomic-embed-text"
                    className={`w-full ${inputCls}`}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    onClick={() => void testConnection()}
                    disabled={testing}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm transition hover:border-indigo-400 disabled:opacity-50 dark:border-slate-700"
                  >
                    {testing && <IconSpinner className="h-4 w-4" />}
                    Test connection
                  </button>
                </div>
              </div>
              {settingsMsg && (
                <p className={`text-xs ${settingsMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {settingsMsg}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={exportConfig}
                  disabled={!isAiConfigured(settings)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-indigo-400 disabled:opacity-40 dark:border-slate-700"
                >
                  Export config (backup)
                </button>
                <button
                  onClick={() => importRef.current?.click()}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-indigo-400 dark:border-slate-700"
                >
                  Import config
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importConfig(f);
                    e.target.value = '';
                  }}
                />
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Settings (including the key) live only in this browser's storage — export a
                  backup before clearing site data, since that wipes it for good.
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Using a local model? The server must allow requests from this page's origin
                (CORS), or the browser will silently block the call. For Ollama, start it with{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
                  OLLAMA_ORIGINS=* ollama serve
                </code>
                .
              </p>
            </>
          )}
        </div>

        {/* Topic → PDF */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-sm font-semibold">Generate a PDF from any topic</p>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "The economics of rooftop solar in India"'
            className={`w-full ${inputCls}`}
          />
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
              className="h-4 w-4 accent-indigo-500"
            />
            Deep research mode — the AI first builds an outline, then writes each section
            separately (longer, richer document; more model calls)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void generate()}
              disabled={generating || !topic.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {generating ? <IconSpinner className="h-4 w-4" /> : <IconSparkle className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate PDF'}
            </button>
            {generating && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700"
              >
                Cancel
              </button>
            )}
            {genStatus && <span className="text-xs text-indigo-500 dark:text-indigo-300">{genStatus}</span>}
          </div>
          {genResult && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/5">
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                ✓ {genResult.name} is ready
              </span>
              <button
                onClick={() => downloadBytes(genResult.bytes, genResult.name)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                <IconDownload className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={async () => {
                  await addGeneratedPdf(genResult.name, genResult.bytes);
                  dispatch({ type: 'SET_TAB', tab: 'view' });
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
              >
                Open in editor
              </button>
            </div>
          )}
        </div>

        {/* Chat with this document (RAG) */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-sm font-semibold">Chat with this document</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Retrieval-augmented generation (RAG): the document's text is embedded and searched
            locally first, then the AI answers only from the relevant excerpts — grounded in what
            the document actually says, instead of guessing.
          </p>
          {state.pages.length === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400/80">Open a PDF first.</p>
          ) : !ragIndex ? (
            <button
              onClick={() => void buildDocIndex()}
              disabled={ragBuilding}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {ragBuilding ? <IconSpinner className="h-4 w-4" /> : <IconSparkle className="h-4 w-4" />}
              {ragBuilding ? ragStatus || 'Indexing…' : 'Index this document'}
            </button>
          ) : (
            <>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Indexed {ragIndex.length} chunk{ragIndex.length === 1 ? '' : 's'} — ask away.
              </p>
              {ragHistory.length > 0 && (
                <div className="space-y-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  {ragHistory.map((h, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Q: {h.question}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{h.answer}</p>
                      {h.sources.length > 0 && (
                        <p className="text-[11px] text-slate-400">Sources: {h.sources.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {ragAsking && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <IconSpinner className="h-3.5 w-3.5" />
                  Thinking…
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void askDoc();
                  }}
                  placeholder="Ask something about this document…"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  onClick={() => void askDoc()}
                  disabled={ragAsking || !ragQuestion.trim()}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
              <button
                onClick={() => {
                  setRagIndex(null);
                  setRagHistory([]);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Re-index (if you edited the document)
              </button>
            </>
          )}
        </div>

        {/* AI form fill */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-sm font-semibold">Fill a form with AI</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paste unstructured data (an email, a bio, notes…) and the AI maps it onto the form's
            fields — then the filled PDF downloads instantly.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => formInputRef.current?.click()}
              className="rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-600 dark:text-slate-400"
            >
              Upload a form PDF
            </button>
            {state.pages.length > 0 && (
              <button
                onClick={() => void useWorkspaceForm()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-400"
              >
                Use the open document
              </button>
            )}
            {formSource && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ {formSource.name}</span>
            )}
          </div>
          <input
            ref={formInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setFormSource({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
              e.target.value = '';
            }}
          />
          <textarea
            value={fillData}
            onChange={(e) => setFillData(e.target.value)}
            rows={4}
            placeholder={'e.g. "Applicant: Aarav Kumar, born 12 June 2015, applying for class 5, father Ramesh (+91 90000 00000), lives at 12 MG Road, needs school transport."'}
            className={`w-full resize-y ${inputCls}`}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => void fillForm()}
              disabled={filling || !formSource || !fillData.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {filling ? <IconSpinner className="h-4 w-4" /> : <IconSparkle className="h-4 w-4" />}
              Fill &amp; download
            </button>
            {fillStatus && <span className="text-xs text-indigo-500 dark:text-indigo-300">{fillStatus}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
