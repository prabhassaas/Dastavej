'use client';

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
import OcrPanel from './OcrPanel';
import ErrorToast from './ErrorToast';
import { LogoMark } from './Logo';
import {
  IconConvert,
  IconEye,
  IconForm,
  IconGrid,
  IconMoon,
  IconPencil,
  IconScan,
  IconShield,
  IconShrink,
  IconSun,
} from './Icons';

const TABS: { id: Tab; label: string; icon: React.ReactNode; needsDoc: boolean }[] = [
  { id: 'view', label: 'View', icon: <IconEye />, needsDoc: true },
  { id: 'organize', label: 'Organize', icon: <IconGrid />, needsDoc: true },
  { id: 'edit', label: 'Edit', icon: <IconPencil />, needsDoc: true },
  { id: 'convert', label: 'Convert', icon: <IconConvert />, needsDoc: true },
  { id: 'form', label: 'Forms', icon: <IconForm />, needsDoc: false },
  { id: 'compress', label: 'Compress', icon: <IconShrink />, needsDoc: true },
  { id: 'ocr', label: 'OCR', icon: <IconScan />, needsDoc: true },
];

function Workspace() {
  const { state, dispatch } = usePdfStore();
  const { theme, toggle } = useTheme();
  const hasDocument = state.pages.length > 0;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav className="flex w-20 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-6 rounded-xl shadow-lg shadow-indigo-500/30" title="Dastavej">
          <LogoMark className="h-10 w-10" />
        </div>
        <div className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const active = state.tab === tab.id;
            const disabled = tab.needsDoc && !hasDocument;
            return (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                disabled={disabled}
                className={`flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition
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

        <div className="mt-auto flex flex-col items-center gap-4">
          <button
            onClick={toggle}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-400"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </button>
          <div className="flex flex-col items-center gap-1 px-2 text-center text-[10px] leading-tight text-slate-400 dark:text-slate-500">
            <IconShield className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>
              100% local.
              <br />
              Files never leave
              <br />
              your device.
            </span>
          </div>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {hasDocument && <Header />}
        <main className="min-h-0 flex-1 overflow-hidden">
          {state.tab === 'form' ? (
            <FormWizard />
          ) : !hasDocument ? (
            <DropZone fullScreen />
          ) : (
            <>
              {state.tab === 'view' && <Viewer editMode={false} />}
              {state.tab === 'edit' && <Viewer editMode />}
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
