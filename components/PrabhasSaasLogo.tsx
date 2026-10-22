/**
 * Official Prabhas SaaS lockup (icon + wordmark + tricolor swoosh).
 * Source of truth: brand/prabhas-saas-logo.svg (as supplied by the team).
 * Servable copy: public/brand/prabhas-saas-logo.webp — a trimmed, transparent
 * raster export of that exact file (~77 KB vs ~435 KB for the SVG wrapper).
 */
export const PRABHAS_SAAS_LOGO_SRC = '/brand/prabhas-saas-logo.webp';
export const PRABHAS_SAAS_LOGO_WIDTH = 512;
export const PRABHAS_SAAS_LOGO_HEIGHT = 481;

export function PrabhasSaasLockup({ className = 'h-14' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PRABHAS_SAAS_LOGO_SRC}
      width={PRABHAS_SAAS_LOGO_WIDTH}
      height={PRABHAS_SAAS_LOGO_HEIGHT}
      alt="Prabhas SaaS"
      decoding="async"
      className={`${className} w-auto object-contain`}
    />
  );
}
