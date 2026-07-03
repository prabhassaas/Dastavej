import Link from 'next/link';
import type { Metadata } from 'next';
import CoffeeButton from '@/components/CoffeeButton';
import { LogoMark } from '@/components/Logo';
import { REPO_URL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'About — Dastavej',
  description:
    'Why Dastavej exists: a 100% free, client-side PDF editor. No uploads, no accounts, no servers.',
};

const FEATURES = [
  ['📄', 'View, organize & merge', 'Reorder, rotate, duplicate, extract and merge PDFs.'],
  ['✏️', 'Edit & annotate', 'Rewrite text, highlight, draw, stamp signatures and images.'],
  ['💧', 'Watermark & numbering', 'Watermarks, headers, footers and page numbers.'],
  ['🔁', 'Convert', 'PDF to Word, Excel and PowerPoint — generated in the browser.'],
  ['🧾', 'Forms', '10 templates, logos, photo boxes, and responses exported to Excel.'],
  ['🤖', 'Your own AI', 'Plug in a local open-source model for generation and form filling.'],
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-full overflow-auto bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="text-sm font-medium text-indigo-500 hover:text-indigo-400 dark:text-indigo-400"
        >
          ← Back to the editor
        </Link>

        <div className="mt-8 flex items-center gap-4">
          <LogoMark className="h-14 w-14" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dastavej</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              दस्तावेज़ — "document". A PDF editor that respects yours.
            </p>
          </div>
        </div>

        <div className="prose-sm mt-8 space-y-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            Every popular PDF tool wants your file on their server — uploaded, queued, processed,
            retained who-knows-how-long, and rented back to you as a subscription. Dastavej takes
            the opposite bet: <b>your documents never leave your device</b>. The whole editor is a
            static website; rendering, editing, compression, OCR, conversion and form processing
            all run inside your browser using open-source engines (pdf.js, pdf-lib, Tesseract,
            SheetJS).
          </p>
          <p>
            That design has a happy side effect: with no servers to pay for, the app can be{' '}
            <b>free forever</b>. No accounts, no trials, no upload limits, no watermarks-unless-you-pay.
            It even works offline once loaded.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(([emoji, title, desc]) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <span className="text-xl">{emoji}</span>
              <p className="mt-1 text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-400/40 bg-amber-500/5 p-6">
          <h2 className="text-lg font-semibold">Keep it free ☕</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Dastavej has no ads, no tracking, and no premium tier. If it saved you a subscription,
            you can buy the developer a coffee — it funds domains, and more late-night features.
          </p>
          <div className="mt-4">
            <CoffeeButton />
          </div>
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            Payments are processed by Razorpay on their servers; the editor itself still never
            sees your documents or card details.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <a href={REPO_URL} className="hover:text-indigo-500" target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
          <span>·</span>
          <span>Open source, MIT-spirited</span>
          <span>·</span>
          <span>Made with pdf.js, pdf-lib, Tesseract &amp; Next.js</span>
        </div>
      </div>
    </div>
  );
}
