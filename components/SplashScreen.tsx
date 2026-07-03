'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';
import { PrabhasSaasLockup } from './PrabhasSaasLogo';
import { MadeInIndia } from './IndiaBadge';

const VISIBLE_MS = 4000;
const FADE_MS = 400;

/**
 * Startup splash: Dastavej branding, "Powered by Prabhas SaaS", and a
 * Made-in-India note, shown for ~4 seconds on every load in a 2:1 card
 * centered on the page, then fades out and unmounts.
 */
export default function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fading'), VISIBLE_MS);
    const t2 = setTimeout(() => setPhase('gone'), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity dark:bg-slate-950"
      style={{ opacity: phase === 'fading' ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      <div
        className="mx-6 flex w-full max-w-[480px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        style={{ aspectRatio: '2 / 1' }}
      >
        <div className="flex items-center gap-3">
          <LogoMark className="h-12 w-12" />
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dastavej</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
            Powered by
          </span>
          <PrabhasSaasLockup className="h-8" />
        </div>

        <MadeInIndia className="text-xs font-medium text-slate-500 dark:text-slate-400" />
      </div>
    </div>
  );
}
