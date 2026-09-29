'use client';

import { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { IconLock, IconSpinner, IconX } from './Icons';

/**
 * Asks for the open password of a protected PDF that was just dropped in.
 * The password is used once, to decrypt the file into the workspace — it is
 * never stored, and (like everything else here) never leaves the browser.
 */
export default function PasswordPrompt() {
  const { locked, unlockFile, cancelLocked } = usePdfStore();
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = locked[0] ?? null;
  const pendingName = pending?.name ?? null;

  // Fresh box for each file in the queue.
  useEffect(() => {
    setPassword('');
    setReveal(false);
    setError(null);
    if (pendingName) inputRef.current?.focus();
  }, [pendingName]);

  if (!pending) return null;

  const submit = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    const message = await unlockFile(password);
    setBusy(false);
    if (message) {
      setError(message);
      setPassword('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-indigo-500/10 p-2 text-indigo-500 dark:text-indigo-400">
            <IconLock className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">This PDF is password protected</p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={pending.name}>
              {pending.name}
            </p>
          </div>
          <button
            onClick={cancelLocked}
            disabled={busy}
            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800"
            aria-label="Skip this file"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Password to open
          </span>
          <div className="relative">
            <input
              ref={inputRef}
              autoFocus
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
                if (e.key === 'Escape') cancelLocked();
              }}
              placeholder="Enter the document password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-14 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 transition hover:text-indigo-500"
            >
              {reveal ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => void submit()}
            disabled={busy || !password}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy && <IconSpinner className="h-4 w-4" />}
            {busy ? 'Opening…' : 'Open document'}
          </button>
          <button
            onClick={cancelLocked}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-slate-800 disabled:opacity-40 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          {locked.length > 1 && (
            <span className="ml-auto text-[11px] text-slate-400">
              {locked.length - 1} more waiting
            </span>
          )}
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
          The password is used only to unlock this file in your browser. It is never saved or sent
          anywhere.
        </p>
      </div>
    </div>
  );
}
