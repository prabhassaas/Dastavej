'use client';

import { useEffect } from 'react';
import { usePdfStore } from '@/lib/store';
import { IconX } from './Icons';

export default function ErrorToast() {
  const { state, dispatch } = usePdfStore();

  useEffect(() => {
    if (!state.error) return;
    const t = setTimeout(() => dispatch({ type: 'SET_ERROR', error: null }), 8000);
    return () => clearTimeout(t);
  }, [state.error, dispatch]);

  if (!state.error) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-xl backdrop-blur dark:border-red-500/40 dark:bg-red-950/90 dark:text-red-200">
      <span className="min-w-0 break-words">{state.error}</span>
      <button
        onClick={() => dispatch({ type: 'SET_ERROR', error: null })}
        className="shrink-0 rounded p-0.5 text-red-400 hover:bg-red-500/20 dark:text-red-300"
        aria-label="Dismiss"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
