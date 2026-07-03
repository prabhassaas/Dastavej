# Dastavej — 100% Free, Client-Side PDF Editor

A PDF editor that runs **entirely in your browser**. There is no backend, no
database, no upload endpoint and no cost to operate: the app is a static site,
and every byte of every PDF you open stays on your device.

## Features

| Feature | How it works locally |
| --- | --- |
| **Viewer** | Drag & drop PDFs, rendered with Mozilla's `pdf.js` (its rendering worker runs in-browser). Zoom presets and page-by-page navigation. |
| **Page organizer** | Grid of live thumbnails. Drag to reorder, delete, rotate, **duplicate**, **extract a page as its own PDF**, or **reverse the order**. Drop in more PDFs to merge — pages from all files can be interleaved. `pdf-lib` assembles the result on export. |
| **Edit mode** | `pdf.js` text items are projected into screen space and overlaid with HTML textareas. Click any text block to rewrite it, or place brand-new text boxes. On export the edits are mapped back to PDF user-space coordinates and burned in with `pdf-lib` (original text is whited out, replacement drawn at the same baseline). |
| **Annotate** | The essentials of a desktop PDF editor's comment ribbon: **highlight** (5 colors), **outlined boxes**, **freehand ink** (draw a signature with mouse or touch pen) and **image stamps** — upload a signature/stamp/photo, then drag to position and resize. Everything is burned into the PDF on export. |
| **Magic grab** | Canva-style object lifting: drag around a seal, signature or any object to cut it off the page — the background is keyed out, the original spot is patched with the sampled page color, and the cutout becomes a selected, movable, resizable object. |
| **Select tool** | Click any annotation to select it (Shift-click for more), drag its body directly to move it, resize images, **Select all** / **Delete selected** for bulk cleanup. |
| **Signature library** | A few premade cursive signature styles, plus upload-a-photo and draw-with-mouse/pen — all insert as movable, resizable objects. |
| **Text formatting** | Font family (Sans/Serif/Mono), size, **bold**, *italic*, <u>underline</u>, applied live while editing. A font-recognizer heuristic reads the original PDF's embedded font metadata and pre-selects the closest match automatically. |
| **Selectable text** | The View tab renders an invisible text layer aligned to the canvas so you can drag-select and copy text like a native PDF viewer. |
| **AI workbench** *(currently paused)* | Bring-your-own open-source AI (Ollama/LM Studio locally, or any OpenAI-compatible endpoint): generate a styled PDF from any topic and fill forms from unstructured text. The tab is disabled in the UI while local, on-device AI support is built out; the code remains in the repo. |
| **Developer API** | `lib/publicApi.ts` re-exports the same headless engine (merge, compress, convert, forms, OCR, watermark) as plain `Uint8Array → Uint8Array` functions — no React, no AI — for embedding in other apps. See `/developers` in the running app. |
| **Watermark & numbering** | Diagonal text watermark (opacity, size, color — previews live in the viewer) plus header / footer text with `{date}` placeholder and page numbers (`1`, `Page 1`, `1 of N`) on every page. |
| **Converter** | PDF → **Word** (`docx`, text with page breaks and heading sizes), **Excel** (SheetJS, one worksheet per page, text fragments as cells) and **PowerPoint** (`pptxgenjs`, each page as a full-bleed slide image) — all generated in the browser. |
| **Form wizard** | Build fillable **AcroForm** PDFs from scratch or from **10 professional templates** (school admission, patient registration, job application, leave application, event registration, feedback, hotel guest card, gym membership, bank KYC, clinic appointment). Add your **organization logo** and an **applicant photo box** (35 × 45 mm). Field types: text, paragraph, number, date, time, email, phone, checkbox, dropdown, radio — with required flags, defaults and options, on A4 / Letter / Legal / A3 / A5 / Tabloid pages in portrait or landscape. |
| **Forms → Excel** | Import filled copies of your form (or any AcroForm PDF); each file becomes one row, then export all responses as a real **`.xlsx`** or CSV — parsed and written entirely on-device. |
| **Compressor** | A dedicated **Web Worker** parses the PDF with `pdf-lib`, finds embedded JPEG (`DCTDecode`) images, decodes them with `createImageBitmap`, downsamples them on an **OffscreenCanvas**, re-encodes at your chosen JPEG quality (default 0.6) and swaps the streams back in. The UI thread never blocks. |
| **Print** | One-click printing through the browser dialog; a live date & clock sits in the header and every printed page is stamped with the print date & time. |
| **Themes** | Light and dark UI with a one-click toggle (defaults to your OS preference). |
| **OCR** | Pages are rasterized to a canvas and recognized by `tesseract.js`, which runs its WASM engine inside its own **Web Worker**. The worker script, WASM core and English language model are self-hosted static assets — no CDN involved. Extracted text can be copied or downloaded as `.txt`. |

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
