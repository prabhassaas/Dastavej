'use client';

import Link from 'next/link';
import { PdfProvider, usePdfStore } from '@/lib/store';
import { ThemeProvider, useTheme } from '@/lib/theme';
import type { Tab } from '@/lib/types';
import DropZone from './DropZone';
import Header from './Header';
import Viewer from './Viewer';
import PageOrganizer from './PageOrganizer';
import ConvertPanel from './ConvertPanel';
import FormWizard from './FormWizard';
import CompressPanel from './CompressPanel';
import MarksPanel from './MarksPanel';
import OcrPanel from './OcrPanel';
import AiPanel from './AiPanel';
import ReadAloudPanel from './ReadAloudPanel';
import ErrorToast from './ErrorToast';
import SplashScreen from './SplashScreen';
import { LogoMark } from './Logo';
import {
  IconConvert,
  IconDroplet,
  IconEye,
  IconForm,
  IconGrid,
  IconHighlight,
  IconHome,
  IconMoon,
  IconPencil,
  IconScan,
  IconShield,
  IconShrink,
  IconSparkle,
  IconSun,
  IconVolume,
} from './Icons';

/** Prabhas SaaS's own site — the parent brand behind Dastavej. */
const PARENT_SITE_URL = 'https://prabhassaas.in';

const TABS: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  needsDoc: boolean;
  disabled?: boolean;
  disabledReason?: string;
}[] = [
  { id: 'view', label: 'View', icon: <IconEye className="h-5 w-5" />, needsDoc: true },
  { id: 'organize', label: 'Organize', icon: <IconGrid className="h-5 w-5" />, needsDoc: true },
  { id: 'edit', label: 'Edit', icon: <IconPencil className="h-5 w-5" />, needsDoc: true },
  { id: 'annotate', label: 'Annotate', icon: <IconHighlight className="h-5 w-5" />, needsDoc: true },
  { id: 'marks', label: 'Watermark', icon: <IconDroplet className="h-5 w-5" />, needsDoc: true },
  { id: 'convert', label: 'Convert', icon: <IconConvert className="h-5 w-5" />, needsDoc: true },
  { id: 'form', label: 'Forms', icon: <IconForm className="h-5 w-5" />, needsDoc: false },
  { id: 'ai', label: 'AI', icon: <IconSparkle className="h-5 w-5" />, needsDoc: false },
  { id: 'compress', label: 'Compress', icon: <IconShrink className="h-5 w-5" />, needsDoc: true },
  { id: 'ocr', label: 'OCR', icon: <IconScan className="h-5 w-5" />, needsDoc: false },
  { id: 'voice', label: 'Read aloud', icon: <IconVolume className="h-5 w-5" />, needsDoc: true },
];

function Workspace() {
  const { state, dispatch, clearAll } = usePdfStore();
  const { theme, toggle } = useTheme();
  const hasDocument = state.pages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top navigation bar — brand + external links only; tools live in the side panel */}
      <nav className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white/95 px-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <Link
          href="/"
          onClick={() => clearAll()}
          className="flex items-center gap-2.5 rounded-lg transition hover:opacity-80"
          title="Dastavej — back to home"
        >
          <LogoMark className="h-9 w-9" />
          <span className="hidden text-lg font-bold tracking-tight sm:block">Dastavej</span>
        </Link>

        <span
          className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 md:flex dark:bg-emerald-500/10 dark:text-emerald-400"
          title="All processing happens in your browser — files never leave your device."
        >
          <IconShield className="h-3.5 w-3.5" />
          100% local
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <a
            href={PARENT_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Prabhas SaaS — the team behind Dastavej"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <IconHome className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </a>
          <Link
            href="/developers"
            className="hidden rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:block dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Developers
          </Link>
          <Link
            href="/about"
            className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            About
          </Link>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <button
          onClick={toggle}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-400"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
        </button>
      </nav>

      {/* Side panel (tools) + main content */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[168px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-slate-50/70 p-2.5 sm:w-[184px] dark:border-slate-800 dark:bg-slate-900/40">
          <p className="px-1.5 pt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
            Tools
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {TABS.map((tab) => {
              const active = state.tab === tab.id;
              const disabled = tab.disabled || (tab.needsDoc && !hasDocument);
              return (
                <button
                  key={tab.id}
                  onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                  disabled={disabled}
                  title={tab.disabledReason}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-3 text-center transition
                    ${
                      active
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-400/40 dark:bg-slate-800 dark:text-indigo-300 dark:ring-indigo-500/30'
                        : 'text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'
                    }
                    disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  {tab.icon}
                  <span className="text-[10.5px] leading-tight font-medium">{tab.label}</span>
                  {tab.disabled && (
                    <span className="absolute top-1 right-1 rounded-full bg-slate-200 px-1 text-[7px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {hasDocument && <Header />}
          <main className="min-h-0 flex-1 overflow-hidden">
            {state.tab === 'form' ? (
              <FormWizard />
            ) : state.tab === 'ai' ? (
              <AiPanel />
            ) : state.tab === 'ocr' ? (
              <OcrPanel />
            ) : !hasDocument ? (
              <DropZone fullScreen />
            ) : (
              <>
                {state.tab === 'view' && <Viewer mode="view" />}
                {state.tab === 'edit' && <Viewer mode="edit" />}
                {state.tab === 'annotate' && <Viewer mode="annotate" />}
                {state.tab === 'marks' && <MarksPanel />}
                {state.tab === 'organize' && <PageOrganizer />}
                {state.tab === 'convert' && <ConvertPanel />}
                {state.tab === 'compress' && <CompressPanel />}
                {state.tab === 'voice' && <ReadAloudPanel />}
              </>
            )}
          </main>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-1.5 text-center text-[10px] leading-snug text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-500">
        Dastavej is provided as-is for lawful use only. Any use for fraudulent, deceptive,
        infringing, or otherwise illegal purposes is solely the user&apos;s responsibility and
        discretion — the creators accept no liability for misuse.{' '}
        <Link href="/about#disclaimer" className="underline hover:text-indigo-500">
          Full disclaimer
        </Link>
      </footer>

      <ErrorToast />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PdfProvider>
        <SplashScreen />
        <Workspace />
      </PdfProvider>
    </ThemeProvider>
  );
}
