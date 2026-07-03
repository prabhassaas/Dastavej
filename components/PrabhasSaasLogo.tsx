'use client';

/**
 * Recreated inline-SVG version of the Prabhas SaaS mark (network/node "P"
 * tower in navy + saffron, an AI chip badge, and the tricolor swoosh under
 * the wordmark) so it renders crisply at any size with no image request.
 * If the source raster logo becomes available, swap this file's contents
 * for an <img>/<Image> pointing at it — the call sites won't need to change.
 */
export function PrabhasSaasMark({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" role="img" aria-label="Prabhas SaaS">
      <g stroke="#0f2a4a" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M30 18 L60 18 M30 18 L30 55 M30 30 L60 30 M30 42 L48 55 M30 55 L48 42" />
        <circle cx="30" cy="18" r="3.2" fill="#0f2a4a" />
        <circle cx="60" cy="18" r="3.2" fill="#0f2a4a" />
        <circle cx="30" cy="30" r="3.2" fill="#0f2a4a" />
        <circle cx="30" cy="42" r="3.2" fill="#0f2a4a" />
        <circle cx="30" cy="55" r="3.2" fill="#0f2a4a" />
        <circle cx="48" cy="42" r="3.2" fill="#0f2a4a" />
        <circle cx="48" cy="55" r="3.2" fill="#0f2a4a" />
      </g>
      <g stroke="#f2960c" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M60 18 L90 18 M60 18 L90 30 M90 18 L60 30 M60 30 L48 55 M60 55 L90 42 M60 68 L48 55 M60 68 L90 55 M60 68 L84 100" />
        <circle cx="90" cy="18" r="3.2" fill="#f2960c" />
        <circle cx="60" cy="30" r="3.2" fill="#f2960c" />
        <circle cx="60" cy="55" r="3.2" fill="#f2960c" />
        <circle cx="90" cy="42" r="3.2" fill="#f2960c" />
        <circle cx="60" cy="68" r="3.2" fill="#f2960c" />
        <circle cx="90" cy="55" r="3.2" fill="#f2960c" />
        <circle cx="84" cy="100" r="3.2" fill="#f2960c" />
      </g>
      <circle cx="66" cy="52" r="14" fill="#0f2a4a" />
      <text x="66" y="56" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="#fff" textAnchor="middle">
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
