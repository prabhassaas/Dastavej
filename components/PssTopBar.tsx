'use client';

/**
 * The shared Prabhas SaaS top bar, as a React component.
 *
 * Same markup, class names and metrics as the plain-HTML version the other
 * Prabhas apps use (see PrabhasSaaS-Website/docs/TOPBAR.md) — styling comes
 * from the same pss-topbar.css, imported once in globals.css. Only the
 * behaviour is reimplemented here in React rather than the shared script, so
 * it plays properly with hydration instead of mutating the DOM underneath it.
 *
 * Dastavej has no accounts by design — the whole point is that nothing leaves
 * the device — so this renders the signed-out arrangement and omits the
 * "Sign in" link the spec allows apps with auth to show.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';

const NAV = [
  { href: '/', label: 'Editor' },
  { href: '/developers', label: 'Developers' },
  { href: '/about', label: 'About' },
];

const APPS = [
  { href: 'https://seedhabill.prabhassaas.in/', label: 'Seedha Bill' },
  { href: 'https://lekhya.prabhassaas.in/', label: 'Lekhya AI' },
  { href: 'https://shilp3d.prabhassaas.in/', label: 'Shilp3D' },
];

function Caret() {
  return (
    <svg className="pss-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function PssTopBar({ current }: { current?: string }) {
  const [apps, setApps] = useState(false);
  const [mobile, setMobile] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!apps) return;
    function onDown(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setApps(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setApps(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [apps]);

  return (
    <header className="pss-topbar" style={{ ['--pss-accent' as string]: '#6366f1' }} ref={barRef}>
      <div className="pss-topbar__in">
        <div className="pss-topbar__left">
          <a className="pss-home" href="https://prabhassaas.in">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
              <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
            </svg>
            <span>Prabhas SaaS</span>
          </a>
          <Link className="pss-brand" href="/">
            <span className="pss-brand__mark pss-brand__mark--bare">
              <LogoMark className="h-8 w-8" />
            </span>
            <span className="pss-brand__name">Dastavej</span>
          </Link>
        </div>

        <nav className="pss-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
                  aria-current={current === n.href ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="pss-actions">
          <div className="pss-menu">
            <button className="pss-switch" type="button"
                    aria-expanded={apps} aria-controls="pssApps"
                    onClick={() => setApps((v) => !v)}>
              <span className="pss-switch__mark pss-switch__mark--bare">
                <LogoMark className="h-5 w-5" />
              </span>
              <span>Dastavej</span>
              <Caret />
            </button>
            <div className="pss-pop" id="pssApps" hidden={!apps}>
              <div className="pss-pop__label">Your apps</div>
              <a className="is-current" href="/">
                <span>Dastavej</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                     strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </a>
              {APPS.map((a) => (
                <a key={a.href} href={a.href}>{a.label}</a>
              ))}
              <div className="pss-pop__sep" />
              <a href="https://accounts.prabhassaas.in/">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                <span>Add app</span>
              </a>
            </div>
          </div>

          <Link className="pss-cta" href="/">Open editor</Link>
        </div>

        <button className="pss-burger" type="button" aria-expanded={mobile} aria-label="Menu"
                onClick={() => setMobile((v) => !v)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>

      <div className="pss-mobile" hidden={!mobile}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setMobile(false)}>{n.label}</Link>
        ))}
        <div className="pss-mobile__sep">
          <a className="pss-mobile__home" href="https://prabhassaas.in">← Prabhas SaaS</a>
          <Link href="/" onClick={() => setMobile(false)}>Open editor</Link>
        </div>
      </div>
    </header>
  );
}
