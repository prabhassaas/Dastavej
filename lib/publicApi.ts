/**
 * Dastavej Core — the same headless, client-side PDF engine that powers the
 * Dastavej app, exposed as a plain, framework-free JS/TS module so any web
 * app can embed the same features. Every function here:
 *   - is plain async functions over `Uint8Array` bytes — no React, no
 *     global store, no UI components required from the caller;
 *   - runs entirely in the browser (canvas, Web Workers, WASM) — nothing is
 *     uploaded anywhere;
 *   - has no AI dependency (AI features are intentionally excluded here).
 *
 * `assemblePdf` is the one exception worth calling out: it accepts plain
 * data records (`SourceFile[]` / `PageEntry[]` / `PageEdits`) describing a
 * multi-source document plus edits/annotations/watermarks to burn in — the
 * shapes are simple, documented interfaces (see ./types), not opaque
 * Dastavej classes, so you can construct them yourself. For a single PDF
 * with no edits, `mergePdfs([bytes])` is the simpler entry point.
 *
 * See /developers in the app for install instructions and copy-paste
 * examples for each function.
 */

export {
  mergePdfs,
  reorderPages,
  extractPage,
  splitPdfByRanges,
  splitPdfEveryNPages,
  parsePageRanges,
  type PageOp,
  type PageRange,
} from './pdfOps';
export { compressPdf, type CompressResult } from './compress';
export { printPdf } from './print';
export { downloadBytes, formatBytes } from './download';
export { createZip, type ZipEntry } from './zip';
export { imagesToPdf, type PageFit } from './imageToPdf';
export { pdfToImages, type PdfToImagesProgress } from './pdfToImages';
export { flattenFormPdf } from './flatten';
export {
  isIndicVoice,
  getVoices,
  extractPageText,
  extractAllText,
  speak,
} from './tts';

export {
  openForConversion,
  convertToWord,
  convertToExcel,
  convertToPowerPoint,
  buildWordFromPages,
  CONVERT_MIME,
  type ConvertProgress,
} from './convert';

export {
  buildFormPdf,
  FIELD_TYPES,
  PAGE_SIZES,
  type FormFieldSpec,
  type FormFieldType,
  type FormLogo,
  type Orientation,
} from './formBuilder';

export { FORM_TEMPLATES, type FormTemplate } from './formTemplates';

export {
  extractFormData,
  collectColumns,
  exportRowsToXlsx,
  exportRowsToCsv,
  type FormRow,
} from './formData';

export {
  ocrPdfBytes,
  ocrImages,
  createOcrEngine,
  type OcrProgress,
  type OcrResult,
  type OcrEngine,
} from './ocr';

export { buildPdfFromMarkdown } from './mdPdf';

export {
  assemblePdf,
  type AssembleExtras,
} from './export';

export type { Annotation, DocMarks, FontFamily, TextStyle } from './types';
