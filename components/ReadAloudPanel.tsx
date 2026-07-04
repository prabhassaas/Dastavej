'use client';

import { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '@/lib/store';
import { assemblePdf } from '@/lib/export';
import { extractAllText, getVoices, isIndicVoice, speak } from '@/lib/tts';
import { IconPause, IconPlay, IconStop, IconVolume } from './Icons';

/**
 * Reads the document aloud using the browser's built-in Web Speech API
 * (speechSynthesis) — no server, no API key, no cost. Available voices
 * (and Indic-language coverage) depend entirely on the user's OS/browser;
 * we surface what's actually installed rather than promising more.
 */
export default function ReadAloudPanel() {
  const { state, dispatch } = usePdfStore();
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  const [pages, setPages] = useState<string[] | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!supported) return;
    void getVoices().then((v) => {
      setVoices(v);
      const indic = v.find(isIndicVoice);
      setVoiceURI((indic ?? v[0])?.voiceURI ?? '');
    });
    return () => speechSynthesis.cancel();
  }, [supported]);

  const loadText = async () => {
    setLoadingText(true);
    try {
      const bytes = await assemblePdf(state.sources, state.pages, state.edits, {
        annots: state.annots,
        marks: state.marks,
      });
      const extracted = await extractAllText(bytes);
      setPages(extracted);
      return extracted;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: `Could not read the document: ${err instanceof Error ? err.message : String(err)}`,
      });
      return null;
    } finally {
      setLoadingText(false);
    }
  };

  const playFrom = (pageIndex: number, allPages: string[]) => {
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
    const text = allPages[pageIndex];
    if (!text || !text.trim()) {
      // skip empty pages (e.g. image-only) automatically
      if (pageIndex + 1 < allPages.length) playFrom(pageIndex + 1, allPages);
      else setStatus('idle');
      return;
    }
    setCurrent(pageIndex);
    utterRef.current = speak(text, {
      voice,
      rate,
      onEnd: () => {
        if (pageIndex + 1 < allPages.length) playFrom(pageIndex + 1, allPages);
        else setStatus('idle');
      },
    });
  };

  const handlePlay = async () => {
    if (status === 'paused') {
      speechSynthesis.resume();
      setStatus('playing');
      return;
    }
    const allPages = pages ?? (await loadText());
    if (!allPages) return;
    speechSynthesis.cancel();
    setStatus('playing');
    playFrom(current, allPages);
  };

  const handlePause = () => {
    speechSynthesis.pause();
    setStatus('paused');
  };

  const handleStop = () => {
    speechSynthesis.cancel();
    setStatus('idle');
    setCurrent(0);
  };

  const jumpTo = (index: number) => {
    speechSynthesis.cancel();
    setCurrent(index);
    if (status === 'playing' && pages) {
      playFrom(index, pages);
    }
  };

  const indicVoices = voices.filter(isIndicVoice);
  const otherVoices = voices.filter((v) => !isIndicVoice(v));

  if (!supported) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Your browser doesn't support the Web Speech API, so read-aloud isn't available here. Try
          a recent version of Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconVolume className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Read aloud
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Uses your browser's built-in text-to-speech — free, offline-capable and 100% local; no
            audio ever leaves your device. Voice choice (including Indic languages) depends on
            what's installed on your OS/browser.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Voice</span>
            <select
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {indicVoices.length > 0 && (
                <optgroup label="Indic languages">
                  {indicVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Other languages">
                {otherVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </optgroup>
            </select>
            {indicVoices.length === 0 && voices.length > 0 && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400/80">
                No Indic-language voices were found on this device/browser — install one in your OS
                language settings, or try Chrome on Android where Hindi, Tamil, Bengali and others
                are commonly bundled.
              </p>
            )}
            {voices.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">Loading available voices…</p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Speed</span>
              <span>{rate.toFixed(1)}×</span>
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handlePlay()}
              disabled={loadingText || status === 'playing'}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              <IconPlay className="h-4 w-4" />
              {loadingText ? 'Reading document…' : status === 'paused' ? 'Resume' : 'Play'}
            </button>
            <button
              onClick={handlePause}
              disabled={status !== 'playing'}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition hover:border-indigo-400 disabled:opacity-40 dark:border-slate-700"
            >
              <IconPause className="h-4 w-4" />
              Pause
            </button>
            <button
              onClick={handleStop}
              disabled={status === 'idle'}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition hover:border-red-400 hover:text-red-500 disabled:opacity-40 dark:border-slate-700"
            >
              <IconStop className="h-4 w-4" />
              Stop
            </button>
            {pages && (
              <span className="ml-auto text-xs text-slate-400">
                Page {current + 1} / {pages.length}
              </span>
            )}
          </div>
        </div>

        {pages && (
          <div className="flex flex-wrap gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className={`h-8 w-8 rounded-lg border text-xs font-medium transition ${
                  i === current
                    ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    : 'border-slate-300 text-slate-500 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-400'
                }`}
                title={`Jump to page ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}

        {pages && !pages.some((p) => p.trim()) && (
          <p className="text-xs text-amber-600 dark:text-amber-400/80">
            No extractable text was found — this looks like a scanned/image-only document. Run it
            through the <b>OCR</b> tab first, then come back here.
          </p>
        )}
      </div>
    </div>
  );
}
