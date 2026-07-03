'use client';

export function HeartIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#ef4444" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.3C.4 8.2 2.1 4.8 5.5 4.2c2-.35 3.9.5 5 2.1 1.1-1.6 3-2.45 5-2.1 3.4.6 5.1 4 3.5 7.5C19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}

export function IndianFlag({ className = 'h-4 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 24" role="img" aria-label="Flag of India">
      <rect width="36" height="8" y="0" fill="#FF9933" />
      <rect width="36" height="8" y="8" fill="#FFFFFF" />
      <rect width="36" height="8" y="16" fill="#128807" />
      <circle cx="18" cy="12" r="3" fill="none" stroke="#000080" strokeWidth="0.5" />
      <circle cx="18" cy="12" r="0.6" fill="#000080" />
      {Array.from({ length: 24 }).map((_, i) => (
        <line
          key={i}
          x1="18"
          y1="12"
          x2={18 + 3 * Math.cos((i * Math.PI) / 12)}
          y2={12 + 3 * Math.sin((i * Math.PI) / 12)}
          stroke="#000080"
          strokeWidth="0.25"
        />
      ))}
    </svg>
  );
}

/** "Made in India with ❤️" line used in the splash screen and footer. */
export function MadeInIndia({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      Made in India with <HeartIcon className="h-3.5 w-3.5" /> <IndianFlag className="h-3 w-5 rounded-[1px]" />
    </span>
  );
}
