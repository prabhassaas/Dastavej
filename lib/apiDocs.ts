/**
 * Dastavej Core's function reference, as plain data — shared by the
 * /developers page (rendered as a table) and its "Ask about the API" RAG
 * widget (embedded and searched so answers quote real signatures instead of
 * a paraphrase from memory).
 */

export interface ApiFunctionDoc {
  name: string;
  from: string;
  desc: string;
}

export const API_FUNCTIONS: ApiFunctionDoc[] = [
  { name: 'mergePdfs(files)', from: 'pdfOps', desc: 'Merge PDF byte arrays, in order, into one document.' },
  { name: 'reorderPages(bytes, order)', from: 'pdfOps', desc: 'Rebuild a PDF with a new page order/subset and per-page rotation.' },
  { name: 'extractPage(bytes, index)', from: 'pdfOps', desc: 'Pull one page out as its own standalone PDF.' },
  { name: 'splitPdfByRanges(bytes, ranges)', from: 'pdfOps', desc: 'Split a PDF into multiple PDFs by 0-based [start, end] page ranges.' },
  { name: 'splitPdfEveryNPages(bytes, n)', from: 'pdfOps', desc: 'Split a PDF into fixed-size chunks of N pages each.' },
  { name: 'parsePageRanges(spec, totalPages)', from: 'pdfOps', desc: 'Parse a human range spec like "1-3, 5, 8-9" into 0-based ranges.' },
  { name: 'compressPdf(bytes, opts)', from: 'compress', desc: 'Downsample & re-encode embedded JPEGs in a Web Worker.' },
  { name: 'assemblePdf(sources, pages, edits, extras)', from: 'export', desc: 'Build a document from sources + apply text edits, annotations, watermark/header/footer.' },
  { name: 'printPdf(bytes)', from: 'print', desc: 'Open the browser print dialog with a date/time-stamped copy.' },
  { name: 'imagesToPdf(images, options)', from: 'imageToPdf', desc: 'Combine PNG/JPEG images into a new PDF, one per page, with page size/orientation/fit options.' },
  { name: 'pdfToImages(bytes, options)', from: 'pdfToImages', desc: 'Render every page of a PDF to a PNG/JPEG image.' },
  { name: 'flattenFormPdf(bytes)', from: 'flatten', desc: 'Burn AcroForm field values permanently into the page content.' },
  { name: 'openForConversion(bytes)', from: 'convert', desc: 'Parse bytes into a pdf.js document for the convert* functions.' },
  { name: 'convertToWord(doc, onProgress)', from: 'convert', desc: 'PDF → .docx (paragraphs, page breaks, heading sizes); OCRs scanned pages automatically.' },
  { name: 'convertToExcel(doc, onProgress)', from: 'convert', desc: 'PDF → .xlsx — infers real table columns from text position, all pages in one sheet.' },
  { name: 'convertToCsv(doc, onProgress)', from: 'convert', desc: 'Same table extraction as convertToExcel, written as plain-text CSV.' },
  { name: 'convertToPowerPoint(doc, onProgress)', from: 'convert', desc: 'PDF → .pptx (each page as a full-bleed slide image).' },
  { name: 'buildWordFromPages(pages)', from: 'convert', desc: 'Build a .docx straight from an array of extracted/OCR\'d page text strings.' },
  { name: 'buildFormPdf(options)', from: 'formBuilder', desc: 'Generate a fillable AcroForm PDF from a field spec, with logo/photo box.' },
  { name: 'FORM_TEMPLATES', from: 'formTemplates', desc: '10 ready-made professional form field sets.' },
  { name: 'extractFormData(name, bytes)', from: 'formData', desc: 'Read AcroForm field values out of a filled PDF.' },
  { name: 'exportRowsToXlsx(rows)', from: 'formData', desc: 'Write form responses to a real .xlsx (SheetJS).' },
  { name: 'exportRowsToCsv(rows)', from: 'formData', desc: 'Write form responses to a plain CSV file.' },
  { name: 'ocrPdfBytes(bytes, onProgress, opts)', from: 'ocr', desc: 'Run Tesseract.js OCR over a PDF\'s pages, fully client-side.' },
  { name: 'ocrImages(images, onProgress, opts)', from: 'ocr', desc: 'Run OCR over standalone image files (photos/screenshots), no PDF needed.' },
  { name: 'createOcrEngine(onProgress)', from: 'ocr', desc: 'Low-level: spin up one tesseract.js worker to reuse across multiple recognize() calls.' },
  { name: 'buildPdfFromMarkdown(title, markdown)', from: 'mdPdf', desc: 'Render Markdown into a clean, styled PDF report.' },
  { name: 'createZip(entries)', from: 'zip', desc: 'Zero-dependency ZIP writer for bundling multiple output files.' },
];

export interface ApiExample {
  title: string;
  code: string;
}

export const API_EXAMPLES: ApiExample[] = [
  {
    title: 'Merge PDFs',
    code: `import { mergePdfs } from 'dastavej';\n\nconst merged = await mergePdfs([bytesA, bytesB, bytesC]);`,
  },
  {
    title: 'Compress',
    code: `import { compressPdf } from 'dastavej';\n\nconst { bytes, imagesRecompressed } = await compressPdf(pdfBytes, {\n  quality: 0.6,\n  maxDimension: 1600,\n  onProgress: (done, total) => console.log(\`\${done}/\${total}\`),\n});`,
  },
  {
    title: 'Split a PDF',
    code: `import { splitPdfByRanges, parsePageRanges } from 'dastavej';\n\nconst ranges = parsePageRanges('1-3, 5', totalPages);\nconst parts = await splitPdfByRanges(pdfBytes, ranges); // Uint8Array[]`,
  },
  {
    title: 'Build a fillable form',
    code: `import { buildFormPdf, FORM_TEMPLATES } from 'dastavej';\n\nconst template = FORM_TEMPLATES.find((t) => t.id === 'job-application')!;\nconst pdf = await buildFormPdf({\n  title: template.title,\n  fields: template.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),\n  pageSize: 'A4',\n  orientation: 'portrait',\n  photoBox: template.photoBox,\n});`,
  },
  {
    title: 'Convert to Word',
    code: `import { openForConversion, convertToWord } from 'dastavej';\n\nconst doc = await openForConversion(pdfBytes);\nconst docxBytes = await convertToWord(doc, (p) => console.log(p));`,
  },
  {
    title: 'Collect filled forms into Excel',
    code: `import { extractFormData, exportRowsToXlsx } from 'dastavej';\n\nconst rows = await Promise.all(\n  files.map((f) => f.arrayBuffer().then((buf) => extractFormData(f.name, new Uint8Array(buf)))),\n);\nawait exportRowsToXlsx(rows, 'responses.xlsx');`,
  },
  {
    title: 'OCR a scanned PDF',
    code: `import { ocrPdfBytes } from 'dastavej';\n\nconst results = await ocrPdfBytes(pdfBytes, (p) => console.log(p.phase, p.progress), {\n  enhance: true, // grayscale + auto-threshold for faded scans\n});\nconsole.log(results.map((r) => r.text).join('\\n\\n'));`,
  },
];
