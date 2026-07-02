/**
 * Lazy loader for pdf.js. The library touches browser globals, so it is only
 * ever imported on the client, on first use. The rendering worker is bundled
 * as a static asset via `new URL(...)` and runs entirely in the browser.
 */

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    // The legacy build includes polyfills (e.g. Map.getOrInsertComputed) that
    // the modern build assumes, keeping the app working on current browsers.
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return pdfjs as PdfjsModule;
    });
  }
  return pdfjsPromise;
}
