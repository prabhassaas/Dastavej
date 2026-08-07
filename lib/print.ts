import { StandardFonts, rgb } from '@cantoo/pdf-lib';
import { loadPdf } from './pdfLoad';

/**
 * Print the given PDF via the browser's print dialog. Each page is stamped
 * with the print date & time in the top-right corner before printing.
 * Everything happens locally: the stamped copy lives in a blob URL that is
 * revoked after the dialog closes.
 */
export async function printPdf(bytes: Uint8Array, stampDateTime = true): Promise<void> {
  let toPrint = bytes;

  if (stampDateTime) {
    const doc = await loadPdf(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const now = new Date();
    const stamp = `Printed: ${now.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })} ${now.toLocaleTimeString()}`;
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const w = font.widthOfTextAtSize(stamp, 8);
      page.drawText(stamp, {
        x: width - w - 24,
        y: height - 18,
        size: 8,
        font,
        color: rgb(0.42, 0.45, 0.5),
      });
    }
    toPrint = await doc.save();
  }

  const url = URL.createObjectURL(
    new Blob([toPrint.slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
  );
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.src = url;
  document.body.appendChild(iframe);
  await new Promise((resolve) => (iframe.onload = resolve));
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  // Keep the frame alive while the dialog is open; clean up afterwards.
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
