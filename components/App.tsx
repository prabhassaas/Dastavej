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
import ErrorToast from './ErrorToast';
import { LogoMark } from './Logo';
import {
  IconConvert,
  IconDroplet,
  IconEye,
  IconForm,
  IconGrid,
  IconHighlight,
  IconMoon,
  IconPencil,
  IconScan,
  IconShield,
  IconShrink,
  IconSparkle,
  IconSun,
} from './Icons';

const TABS: { id: Tab; label: string; icon: React.ReactNode; needsDoc: boolean }[] = [
  { id: 'view', label: 'View', icon: <IconEye className="h-4 w-4" />, needsDoc: true },
  { id: 'organize', label: 'Organize', icon: <IconGrid className="h-4 w-4" />, needsDoc: true },
  { id: 'edit', label: 'Edit', icon: <IconPencil className="h-4 w-4" />, needsDoc: true },
  { id: 'annotate', label: 'Annotate', icon: <IconHighlight className="h-4 w-4" />, needsDoc: true },
  { id: 'marks', label: 'Watermark', icon: <IconDroplet className="h-4 w-4" />, needsDoc: true },
  { id: 'convert', label: 'Convert', icon: <IconConvert className="h-4 w-4" />, needsDoc: true },
  { id: 'form', label: 'Forms', icon: <IconForm className="h-4 w-4" />, needsDoc: false },
  { id: 'ai', label: 'AI', icon: <IconSparkle className="h-4 w-4" />, needsDoc: false },
  { id: 'compress', label: 'Compress', icon: <IconShrink className="h-4 w-4" />, needsDoc: true },
  { id: 'ocr', label: 'OCR', icon: <IconScan className="h-4 w-4" />, needsDoc: true },
];

function Workspace() {
  const { state, dispatch } = usePdfStore();
  const { theme, toggle } = useTheme();
  const hasDocument = state.pages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top navigation bar */}
      <nav className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-2.5" title="Dastavej">
          <LogoMark className="h-8 w-8" />
          <span className="hidden text-base font-bold tracking-tight lg:block">Dastavej</span>
        </div>

        <div className="mx-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {TABS.map((tab) => {
            const active = state.tab === tab.id;
            const disabled = tab.needsDoc && !hasDocument;
            return (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                disabled={disabled}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition
                  ${
                    active
                      ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  }
                  disabled:cursor-not-allowed disabled:opacity-30`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <span
          className="hidden items-center gap-1.5 text-[11px] text-slate-400 md:flex dark:text-slate-500"
          title="All processing happens in your browser — files never leave your device."
        >
          <IconShield className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          100% local
        </span>
        <Link
          href="/about"
          className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          About
        </Link>
        <button
          onClick={toggle}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-400"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
        </button>
      </nav>

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {hasDocument && <Header />}
        <main className="min-h-0 flex-1 overflow-hidden">
          {state.tab === 'form' ? (
            <FormWizard />
          ) : state.tab === 'ai' ? (
            <AiPanel />
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
              {state.tab === 'ocr' && <OcrPanel />}
            </>
          )}
        </main>
      </div>

      <ErrorToast />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PdfProvider>
        <Workspace />
      </PdfProvider>
    </ThemeProvider>
  );
}
