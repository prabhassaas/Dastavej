'use client';

import { useEffect, useState } from 'react';

const REAL_LOGO_SRC = '/brand/prabhas-saas-logo.png';

/**
 * Prabhas SaaS mark. Renders the hand-traced SVG fallback immediately (so
 * there is never a broken-image flash), and silently upgrades to the real
 * logo file if one is present — drop it at `public/brand/prabhas-saas-logo.png`
 * (commit it via the GitHub UI or a push) and it takes over everywhere this
 * component is used, no code change needed. This sandbox has no file access
 * to images pasted in chat (inline chat attachments don't land on disk
 * here), so pixel-exact reproduction isn't possible without that file.
 */
export function PrabhasSaasMark({ className = 'h-16 w-16' }: { className?: string }) {
  const [realLogoReady, setRealLogoReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setRealLogoReady(true);
    };
    probe.src = REAL_LOGO_SRC;
    return () => {
      cancelled = true;
    };
  }, []);

  if (realLogoReady) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={REAL_LOGO_SRC} alt="Prabhas SaaS" className={`${className} object-contain`} />
    );
  }

  return <PrabhasSaasMarkFallback className={className} />;
}

/** Hand-traced approximation of the network/node "flag tower" mark. */
function PrabhasSaasMarkFallback({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Prabhas SaaS">
      {/* navy (left) network */}
      <g stroke="#0f2a4a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 14 L42 14 M16 14 L16 46 M16 27 L42 14 M16 27 L34 40 M16 40 L34 27 M16 46 Q16 56 28 58" />
        <circle cx="16" cy="14" r="3" fill="#0f2a4a" />
        <circle cx="42" cy="14" r="3" fill="#0f2a4a" />
        <circle cx="16" cy="27" r="3" fill="#0f2a4a" />
        <circle cx="16" cy="40" r="3" fill="#0f2a4a" />
        <circle cx="16" cy="46" r="3" fill="#0f2a4a" />
        <circle cx="34" cy="27" r="3" fill="#0f2a4a" />
        <circle cx="34" cy="40" r="3" fill="#0f2a4a" />
        <circle cx="28" cy="58" r="2.6" fill="#0f2a4a" />
      </g>
      {/* saffron (right) network — extends further down, like a longer flag tail */}
      <g stroke="#f2960c" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M42 14 L74 14 M42 14 L74 25 M74 14 L42 25 M42 25 L34 40 M42 40 L74 32 M50 54 L34 40 M50 54 L74 44 M50 54 L64 74 M64 74 L58 88" />
        <circle cx="74" cy="14" r="3" fill="#f2960c" />
        <circle cx="42" cy="25" r="3" fill="#f2960c" />
        <circle cx="42" cy="40" r="3" fill="#f2960c" />
        <circle cx="74" cy="32" r="3" fill="#f2960c" />
        <circle cx="50" cy="54" r="3" fill="#f2960c" />
        <circle cx="74" cy="44" r="3" fill="#f2960c" />
        <circle cx="64" cy="74" r="2.8" fill="#f2960c" />
        <circle cx="58" cy="88" r="2.4" fill="#f2960c" />
      </g>
      {/* AI chip badge at the seam where the two networks meet */}
      <circle cx="52" cy="43" r="12.5" fill="#0f2a4a" stroke="#fff" strokeWidth="1.5" />
      <text x="52" y="47" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="700" fill="#fff" textAnchor="middle">
        AI
      </text>
    </svg>
  );
}

export function PrabhasSaasWordmark({ className = 'h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 210 46" role="img" aria-label="Prabhas SaaS">
      <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="24" letterSpacing="0.5" fill="#0f2a4a">
        PRABHAS
      </text>
      <text x="0" y="42" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="17" fill="#0f2a4a">
        SaaS
      </text>
      <path d="M62 34 Q78 28 96 33" stroke="#f2960c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M62 40 Q78 35 96 39" stroke="#128a3e" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PrabhasSaasLockup({ className = 'h-14' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PrabhasSaasMark className="h-full w-auto" />
      <PrabhasSaasWordmark className="h-2/3 w-auto" />
    </span>
  );
}
