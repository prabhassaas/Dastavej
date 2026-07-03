'use client';

import { useEffect, useRef, useState } from 'react';
import { getPdfjs } from '@/lib/pdfjs';
import { LogoMark } from './Logo';
import { PrabhasSaasLockup } from './PrabhasSaasLogo';
import { MadeInIndia } from './IndiaBadge';

const MIN_VISIBLE_MS = 1100; // don't flash even if everything loads instantly
const MAX_VISIBLE_MS = 6000; // safety net if something hangs
const FADE_MS = 400;

/**
 * Startup splash: Dastavej branding, "Powered by Prabhas SaaS", and a
 * Made-in-India note, in a 2:1 card centered on the page. The progress bar
 * tracks real app-boot work (web fonts + the pdf.js engine loading) rather
 * than a fixed timer — it trickles while waiting on each real milestone and
 * only reaches 100% once the app is actually ready, then fades out.
 */
export default function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');
  const [progress, setProgress] = useState(4);
  const targetRef = useRef(12);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();
    let cancelled = false;
    let raf = 0;

    // Smoothly trickle the displayed value toward whatever real milestone
    // was last reached, instead of jumping in discrete steps.
    const tick = () => {
      setProgress((p) => {
        const target = targetRef.current;
        if (p >= target) return p;
        return Math.min(target, p + Math.max(0.2, (target - p) * 0.06));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      targetRef.current = 100;
      const elapsed = performance.now() - startRef.current;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(() => {
        setProgress(100);
        setPhase('fading');
        setTimeout(() => setPhase('gone'), FADE_MS);
      }, wait);
    };

    (async () => {
      try {
        targetRef.current = 30;
        await document.fonts?.ready?.catch(() => {});
        if (cancelled) return;
        targetRef.current = 75;
        await getPdfjs(); // real work: fetches & initializes the pdf.js engine
        if (cancelled) return;
        targetRef.current = 96;
      } catch {
        // fall through to finish() regardless — never block the app on this
      } finally {
        finish();
      }
    })();

    // Absolute safety net so a hung task can never keep the splash up forever.
    const maxTimer = setTimeout(finish, MAX_VISIBLE_MS);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(maxTimer);
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

        <div className="mt-1 w-full max-w-[220px]">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
