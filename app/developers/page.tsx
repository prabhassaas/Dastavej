import Link from 'next/link';
import type { Metadata } from 'next';
import { LogoMark } from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Developers — Dastavej Core',
  description: 'Embed Dastavej\'s client-side PDF engine in your own app — a headless, framework-free JS module.',
};

const FUNCTIONS: { name: string; from: string; desc: string }[] = [
  { name: 'mergePdfs(files)', from: 'pdfOps', desc: 'Merge PDF byte arrays, in order, into one document.' },
  { name: 'reorderPages(bytes, order)', from: 'pdfOps', desc: 'Rebuild a PDF with a new page order/subset and per-page rotation.' },
  { name: 'extractPage(bytes, index)', from: 'pdfOps', desc: 'Pull one page out as its own standalone PDF.' },
  { name: 'compressPdf(bytes, opts)', from: 'compress', desc: 'Downsample & re-encode embedded JPEGs in a Web Worker.' },
  { name: 'assemblePdf(sources, pages, edits, extras)', from: 'export', desc: 'Build a document from sources + apply text edits, annotations, watermark/header/footer.' },
  { name: 'printPdf(bytes)', from: 'print', desc: 'Open the browser print dialog with a date/time-stamped copy.' },
  { name: 'openForConversion(bytes)', from: 'convert', desc: 'Parse bytes into a pdf.js document for the convert* functions.' },
  { name: 'convertToWord(doc, onProgress)', from: 'convert', desc: 'PDF → .docx (paragraphs, page breaks, heading sizes).' },
  { name: 'convertToExcel(doc, onProgress)', from: 'convert', desc: 'PDF → .xlsx (one worksheet per page).' },
  { name: 'convertToPowerPoint(doc, onProgress)', from: 'convert', desc: 'PDF → .pptx (each page as a full-bleed slide image).' },
  { name: 'buildFormPdf(options)', from: 'formBuilder', desc: 'Generate a fillable AcroForm PDF from a field spec, with logo/photo box.' },
  { name: 'FORM_TEMPLATES', from: 'formTemplates', desc: '10 ready-made professional form field sets.' },
  { name: 'extractFormData(name, bytes)', from: 'formData', desc: 'Read AcroForm field values out of a filled PDF.' },
  { name: 'exportRowsToXlsx(rows)', from: 'formData', desc: 'Write form responses to a real .xlsx (SheetJS).' },
  { name: 'ocrPdfBytes(bytes, onProgress, opts)', from: 'ocr', desc: 'Run Tesseract.js OCR over a PDF\'s pages, fully client-side.' },
  { name: 'buildPdfFromMarkdown(title, markdown)', from: 'mdPdf', desc: 'Render Markdown into a clean, styled PDF report.' },
];

export default function DevelopersPage() {
  return (
    <div className="min-h-full overflow-auto bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm font-medium text-indigo-500 hover:text-indigo-400 dark:text-indigo-400">
          ← Back to the editor
        </Link>

        <div className="mt-8 flex items-center gap-4">
          <Link href="/" title="Dastavej — back to home" className="transition hover:opacity-80">
            <LogoMark className="h-14 w-14" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dastavej Core, for developers</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The same headless PDF engine that powers the app — embed it in yours.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            Every panel in Dastavej — compress, convert, forms, OCR, watermark — is backed by a
            plain async function that takes and returns <code>Uint8Array</code> bytes, with zero
            dependency on React or Dastavej&apos;s UI. That whole layer lives in{' '}
            <code>lib/</code> and is re-exported from a single entry point,{' '}
            <code>lib/publicApi.ts</code>, so you can pull it into your own app.
          </p>
          <p className="rounded-lg border border-amber-400/40 bg-amber-500/5 p-3 text-sm">
            <b>No AI included.</b> AI-powered features (topic → PDF generation, AI form fill) are
            deliberately left out of this API while we build a local, on-device AI story — see the
            AI tab in the app for status.
          </p>
        </div>

        <h2 className="mt-10 text-lg font-semibold">Installing</h2>
        <div className="mt-3 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="font-semibold">Option A — copy the source (simplest, works anywhere)</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Copy the <code>lib/</code> and <code>workers/</code> folders from the repository into
              your project and import from <code>./lib/publicApi</code>. No build-step surprises
              since it&apos;s just TypeScript you compile with your own toolchain.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="font-semibold">Option B — git dependency</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              npm install github:prabhassaas/dastavej
            </pre>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Then <code>import {'{'} compressPdf {'}'} from &apos;dastavej&apos;</code>. This
              package ships TypeScript source (not precompiled JS) via its{' '}
              <code>exports</code> field — works out of the box with bundlers that transpile
              dependencies (Vite, esbuild-based setups); with Next.js/webpack you may need to add
              it to <code>transpilePackages</code>. A precompiled npm package is on the roadmap.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="font-semibold">Some functions need a Web Worker file</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              <code>compressPdf</code> loads <code>workers/compress.worker.ts</code> via{' '}
              <code>new URL(..., import.meta.url)</code> — make sure your bundler supports that
              pattern (Next.js, Vite and webpack 5 all do) and that the file is included wherever
              you copy <code>lib/</code> to.
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-lg font-semibold">Quick examples</h2>
        <div className="mt-3 space-y-4">
          <CodeBlock
            title="Merge PDFs"
            code={`import { mergePdfs } from 'dastavej';

const merged = await mergePdfs([bytesA, bytesB, bytesC]);`}
          />
          <CodeBlock
            title="Compress"
            code={`import { compressPdf } from 'dastavej';

const { bytes, imagesRecompressed } = await compressPdf(pdfBytes, {
  quality: 0.6,
  maxDimension: 1600,
  onProgress: (done, total) => console.log(\`\${done}/\${total}\`),
});`}
          />
          <CodeBlock
            title="Build a fillable form"
            code={`import { buildFormPdf, FORM_TEMPLATES } from 'dastavej';

const template = FORM_TEMPLATES.find((t) => t.id === 'job-application')!;
const pdf = await buildFormPdf({
  title: template.title,
  fields: template.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
  pageSize: 'A4',
  orientation: 'portrait',
  photoBox: template.photoBox,
});`}
          />
          <CodeBlock
            title="Convert to Word"
            code={`import { openForConversion, convertToWord } from 'dastavej';

const doc = await openForConversion(pdfBytes);
const docxBytes = await convertToWord(doc, (p) => console.log(p));`}
          />
          <CodeBlock
            title="Collect filled forms into Excel"
            code={`import { extractFormData, exportRowsToXlsx } from 'dastavej';

const rows = await Promise.all(
  files.map((f) => f.arrayBuffer().then((buf) => extractFormData(f.name, new Uint8Array(buf)))),
);
await exportRowsToXlsx(rows, 'responses.xlsx');`}
          />
          <CodeBlock
            title="OCR a scanned PDF"
            code={`import { ocrPdfBytes } from 'dastavej';

const results = await ocrPdfBytes(pdfBytes, (p) => console.log(p.phase, p.progress), {
  enhance: true, // grayscale + auto-threshold for faded scans
});
console.log(results.map((r) => r.text).join('\\n\\n'));`}
          />
        </div>

        <h2 className="mt-10 text-lg font-semibold">Function reference</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Function</th>
                <th className="px-3 py-2 font-semibold">Module</th>
                <th className="px-3 py-2 font-semibold">What it does</th>
              </tr>
            </thead>
            <tbody>
              {FUNCTIONS.map((f) => (
                <tr key={f.name} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{f.name}</td>
                  <td className="px-3 py-2 text-slate-400">lib/{f.from}.ts</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <Link href="/about" className="hover:text-indigo-500">
            About Dastavej
          </Link>
          <span>·</span>
          <a href="https://github.com/prabhassaas/dastavej" className="hover:text-indigo-500" target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <p className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {title}
      </p>
      <pre className="overflow-x-auto bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
