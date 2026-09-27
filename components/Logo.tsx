'use client';

/**
 * Dastavej logo mark: the brand guidelines' "file" glyph, white on the Dastavej
 * accent -- the same tile the Prabhas SaaS website, the Products menu and every
 * app switcher use (PrabhasSaaS-Website shared/pss-apps.json). Inline SVG so it
 * ships with the bundle and stays crisp at every size.
 */
export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Dastavej logo">
      <rect width="64" height="64" rx="14" fill="#6366f1" />
      <g
        transform="translate(14 14) scale(1.5)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </g>
    </svg>
  );
}

/** Horizontal lockup: mark + wordmark. */
export function LogoLockup({ className = 'h-10' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-full w-auto" />
      <span className="text-xl font-bold tracking-tight">Dastavej</span>
    </span>
  );
}
