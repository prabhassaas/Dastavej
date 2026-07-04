# Dastavej — 100% Free, Client-Side PDF Editor

A PDF editor that runs **entirely in your browser**. There is no backend, no
database, no upload endpoint and no cost to operate: the app is a static site,
and every byte of every PDF you open stays on your device.

## Features

| Feature | How it works locally |
| --- | --- |
| **Viewer** | Drag & drop PDFs, rendered with Mozilla's `pdf.js` (its rendering worker runs in-browser). Zoom presets and page-by-page navigation. |
| **Page organizer** | Grid of live thumbnails. Drag to reorder, delete, rotate, **duplicate**, **extract a page as its own PDF**, or **reverse the order**. Drop in more PDFs to merge — pages from all files can be interleaved. `pdf-lib` assembles the result on export. |
| **Split PDF** | Split the working document by **custom ranges** (e.g. `1-3, 5, 8-9`) or **every N pages**. A single result downloads as a plain PDF; multiple results are packaged into a `.zip` written by a hand-rolled, zero-dependency ZIP writer — no upload involved. |
| **Edit mode** | `pdf.js` text items are projected into screen space and overlaid with HTML textareas. Click any text block to rewrite it, or place brand-new text boxes. On export the edits are mapped back to PDF user-space coordinates and burned in with `pdf-lib` (original text is whited out, replacement drawn at the same baseline). |
| **Annotate** | The essentials of a desktop PDF editor's comment ribbon: **highlight** (5 colors), **outlined boxes**, **freehand ink** (draw a signature with mouse or touch pen) and **image stamps** — upload a signature/stamp/photo, then drag to position and resize. Everything is burned into the PDF on export. |
| **Magic grab** | Canva-style object lifting: drag around a seal, signature or any object to cut it off the page — the background is keyed out, the original spot is patched with the sampled page color, and the cutout becomes a selected, movable, resizable object. |
| **Select tool** | Click any annotation to select it (Shift-click for more), drag its body directly to move it, resize images, **Select all** / **Delete selected** for bulk cleanup. |
| **Signature library** | A few premade cursive signature styles, plus upload-a-photo and draw-with-mouse/pen — all insert as movable, resizable objects. |
| **Text formatting** | Font family (Sans/Serif/Mono), size, **bold**, *italic*, <u>underline</u>, applied live while editing. A font-recognizer heuristic reads the original PDF's embedded font metadata and pre-selects the closest match automatically. |
| **Selectable text** | The View tab renders an invisible text layer aligned to the canvas so you can drag-select and copy text like a native PDF viewer. |
| **AI workbench** | Bring-your-own open-source AI — no server, no API key required from us. Point it at a local model (**Ollama**, **LM Studio**) for unlimited, fully private use, or any OpenAI-compatible provider (Groq, OpenRouter…). Generate a styled PDF from any topic (with a two-pass "deep research" mode) or fill a form from unstructured text. For local models, start the server with CORS open to the browser, e.g. `OLLAMA_ORIGINS=* ollama serve` — the panel explains this and gives an actionable error if it's missed. |
| **Developer API** | `lib/publicApi.ts` re-exports the same headless engine (merge, compress, convert, forms, OCR, watermark) as plain `Uint8Array → Uint8Array` functions — no React, no AI — for embedding in other apps. See `/developers` in the running app. |
| **Watermark & numbering** | Diagonal text watermark (opacity, size, color — previews live in the viewer) plus header / footer text with `{date}` placeholder and page numbers (`1`, `Page 1`, `1 of N`) on every page. |
| **Converter** | PDF → **Word** (`docx`, text with page breaks and heading sizes — scanned pages with no text layer are OCR'd automatically so they still convert), **Excel** (SheetJS — text-position clustering infers real table columns and keeps blank cells blank instead of shifting values left, all pages in one worksheet), **PowerPoint** (`pptxgenjs`, each page as a full-bleed slide image) and **Images** (one PNG/JPEG per page, zipped) — all generated in the browser. |
| **Image to PDF** | Turn one or more photos/screenshots (PNG/JPEG) into a single PDF — choose page size (A4/Letter), orientation, and how each image fits the page (fit, fill, or actual size). Built with `pdf-lib`, no server round-trip. |
| **Form wizard** | Build fillable **AcroForm** PDFs from scratch or from **10 professional templates** (school admission, patient registration, job application, leave application, event registration, feedback, hotel guest card, gym membership, bank KYC, clinic appointment). Add your **organization logo** and an **applicant photo box** (35 × 45 mm). Field types: text, paragraph, number, date, time, email, phone, checkbox, dropdown, radio — with required flags, defaults and options, on A4 / Letter / Legal / A3 / A5 / Tabloid pages in portrait or landscape. |
| **Forms → Excel** | Import filled copies of your form (or any AcroForm PDF); each file becomes one row, then export all responses as a real **`.xlsx`** or CSV — parsed and written entirely on-device. |
| **Flatten & sign** | Upload any filled AcroForm PDF and **flatten** it — form field values are burned permanently into the page content (via `pdf-lib`'s built-in flatten) so the result behaves like a signed, uneditable document, with zero fields left over. |
| **Compressor** | A dedicated **Web Worker** parses the PDF with `pdf-lib`, finds embedded JPEG (`DCTDecode`) images, decodes them with `createImageBitmap`, downsamples them on an **OffscreenCanvas**, re-encodes at your chosen JPEG quality (default 0.6) and swaps the streams back in. The UI thread never blocks. |
| **Print** | One-click printing through the browser dialog; a live date & clock sits in the header and every printed page is stamped with the print date & time. |
| **Themes** | Light and dark UI with a one-click toggle (defaults to your OS preference). |
| **OCR** | Pages (or a standalone uploaded photo/screenshot — no PDF required) are rasterized to a canvas and recognized by `tesseract.js`, which runs its WASM engine inside its own **Web Worker**. The worker script, WASM core and English language model are self-hosted static assets — no CDN involved. Extracted text can be copied, downloaded as `.txt`, or downloaded as an editable **`.docx`**. |
| **Read aloud** | Reads the document's extracted text using the browser's built-in **Web Speech API** — completely free and offline-capable, no audio ever leaves the device. Voice picker groups **Indic-language** voices separately when available, plus a speed slider and per-page playback controls. |
| **Undo / redo** | Full history for page edits, annotations, organizer changes and watermark settings — buttons in the header plus **Ctrl+Z / Ctrl+Y** (Ctrl+Shift+Z also works). Rapid same-target edits (typing, dragging) coalesce into one step so undo reverts a whole edit, not one keystroke. Opening a new document or replacing the workspace (e.g. "use compressed as working file") starts a clean history rather than reaching back into a document that's no longer cached. |
| **Splash screen** | Dastavej mark, "Powered by Prabhas SaaS" (the real logo, `public/brand/prabhas-saas-logo.svg`) and a Made-in-India note in a 2:1 card on every load. The green progress bar tracks real boot work (web fonts + the pdf.js engine loading), not a fixed timer — it only completes once the app is actually ready. |

## The form → Excel flow

```
┌─────────┐    ┌────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐
│ 1 Design │ →  │ 2 Save PDF │ →  │ 3 Distribute │ →  │ 4 Import the │ →  │ 5 Export   │
│  (wizard,│    │  (AcroForm,│    │  (email/print│    │   filled PDFs│    │  .xlsx/.csv│
│ template,│    │  data lives│    │   any viewer │    │   here — one │    │  open in   │
│ logo…)   │    │  in the PDF│    │   can fill)  │    │   row each)  │    │  Excel     │
└─────────┘    └────────────┘    └──────────────┘    └──────────────┘    └────────────┘
```

No server collects anything: responses live inside each returned PDF, and the
spreadsheet is generated locally with SheetJS when you click export.

## Privacy model

- Files are held **in memory only** — no localStorage, no IndexedDB, no cookies, no network calls with your data. (The only thing stored locally is your light/dark theme preference.)
- The only network access at runtime is fetching the app's own static assets (which include the OCR engine and language model). Your documents are never part of any request.

## Stack

- **Next.js (App Router)** with `output: 'export'` — builds to a fully static `out/` directory
- **Tailwind CSS 4** for styling
- **pdfjs-dist** for rendering, **pdf-lib** for manipulation
- **Web Workers** (`workers/compress.worker.ts`, tesseract.js's internal worker) for heavy processing
- **React in-memory state** — a single reducer holds sources, page order and edits

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

## Production build

```bash
npm run build      # emits a static site in ./out
```

Deploy `out/` to any static host — GitHub Pages, Netlify, Cloudflare Pages,
S3… no server required.

## Project layout

```
app/                  Next.js app shell (layout, page, global styles)
components/           UI — viewer, edit overlay, organizer, panels
lib/                  state store, pdf.js loader/cache, export, OCR helpers
workers/              compress.worker.ts (pdf-lib + OffscreenCanvas)
```

## Notes & limitations

- Text replacement uses Helvetica (WinAnsi); characters outside Latin-1 are substituted on export.
- Edited text is replaced *visually* (white-out + redraw). The original string still exists in the PDF's extractable text layer, so don't rely on this for redacting sensitive data.
- The compressor only rewrites plain baseline JPEGs in safe color spaces; exotic images (indexed palettes, decode arrays, CMYK) are left untouched rather than risk corruption.
- Edit overlays assume unrotated page content for pixel-perfect alignment; rotated pages can still be viewed, organized and exported normally.
- Encrypted/password-protected PDFs are not supported.
