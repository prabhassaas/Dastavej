import type { FontFamily } from './types';

/**
 * Best-effort "font recognizer": pdf.js resolves each embedded font to a CSS
 * font-family stack (e.g. "Times New Roman, serif" or "Helvetica, Arial,
 * sans-serif, Bold") that we can pattern-match to the closest one of the 14
 * standard PDF fonts — the only fonts we can embed client-side without
 * shipping extra font files.
 */
export function detectFontStyle(
  cssFontFamily: string | undefined,
): { fontFamily: FontFamily; bold: boolean; italic: boolean; label: string } {
  const s = (cssFontFamily || '').toLowerCase();
  const bold = /bold|black|heavy|-700|-800|-900/.test(s);
  const italic = /italic|oblique/.test(s);

  let fontFamily: FontFamily;
  let label: string;
  if (/times|serif|georgia|garamond|minion|cambria|book\s?antiqua/.test(s)) {
    fontFamily = 'Times';
    label = 'Serif (Times-like)';
  } else if (/courier|mono|consolas|menlo|source code/.test(s)) {
    fontFamily = 'Courier';
    label = 'Monospace (Courier-like)';
  } else {
    fontFamily = 'Helvetica';
    label = 'Sans-serif (Helvetica-like)';
  }
  if (bold) label += ', bold';
  if (italic) label += ', italic';
  return { fontFamily, bold, italic, label };
}

/** CSS font-family stack for live-previewing a `FontFamily` in an overlay textarea. */
export function cssFontStack(family: FontFamily): string {
  switch (family) {
    case 'Times':
      return '"Times New Roman", Times, Georgia, serif';
    case 'Courier':
      return '"Courier New", Courier, monospace';
    default:
      return 'Helvetica, Arial, sans-serif';
  }
}
