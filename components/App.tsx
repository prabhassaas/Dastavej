'use client';

import { PdfProvider, usePdfStore } from '@/lib/store';
import type { Tab } from '@/lib/types';
import DropZone from './DropZone';
import Header from './Header';
import Viewer from './Viewer';
import PageOrganizer from './PageOrganizer';
import CompressPanel from './CompressPanel';
import OcrPanel from './OcrPanel';
import ErrorToast from './ErrorToast';
import { IconEye, IconGrid, IconPencil, IconScan, IconShield, IconShrink } from './Icons';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'view', label: 'View', icon: <IconEye /> },
  { id: 'organize', label: 'Organize', icon: <IconGrid /> },
  { id: 'edit', label: 'Edit', icon: <IconPencil /> },
  { id: 'compress', label: 'Compress', icon: <IconShrink /> },
  { id: 'ocr', label: 'OCR', icon: <IconScan /> },
];

function Workspace() {
  const { state, dispatch } = usePdfStore();
  const hasDocument = state.pages.length > 0;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav className="flex w-20 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900/60 py-4">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-500/30">
          Dv
        </div>
        <div className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const active = state.tab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                disabled={!hasDocument}
                className={`flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition
                  ${active ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                  disabled:cursor-not-allowed disabled:opacity-30`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1 px-2 text-center text-[10px] leading-tight text-slate-500">
          <IconShield className="h-4 w-4 text-emerald-400" />
          <span>
            100% local.
            <br />
            Files never leave
            <br />
            your device.
          </span>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {hasDocument ? (
          <>
            <Header />
            <main className="min-h-0 flex-1 overflow-hidden">
              {state.tab === 'view' && <Viewer editMode={false} />}
              {state.tab === 'edit' && <Viewer editMode />}
              {state.tab === 'organize' && <PageOrganizer />}
              {state.tab === 'compress' && <CompressPanel />}
              {state.tab === 'ocr' && <OcrPanel />}
            </main>
          </>
        ) : (
          <DropZone fullScreen />
        )}
      </div>

      <ErrorToast />
    </div>
  );
}

export default function App() {
  return (
    <PdfProvider>
      <Workspace />
    </PdfProvider>
  );
}
