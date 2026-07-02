# Dastavej — 100% Free, Client-Side PDF Editor

A PDF editor that runs **entirely in your browser**. There is no backend, no
database, no upload endpoint and no cost to operate: the app is a static site,
and every byte of every PDF you open stays on your device.

## Features

| Feature | How it works locally |
| --- | --- |
| **Viewer** | Drag & drop PDFs, rendered with Mozilla's `pdf.js` (its rendering worker runs in-browser). Zoom presets and page-by-page navigation. |
| **Page organizer** | Grid of live thumbnails. Drag to reorder, delete, rotate. Drop in more PDFs to merge — pages from all files can be interleaved. `pdf-lib` assembles the result on export. |
| **Edit mode** | `pdf.js` text items are projected into screen space and overlaid with HTML textareas. Click any text block to rewrite it, or place brand-new text boxes. On export the edits are mapped back to PDF user-space coordinates and burned in with `pdf-lib` (original text is whited out, replacement drawn at the same baseline). |
| **Compressor** | A dedicated **Web Worker** parses the PDF with `pdf-lib`, finds embedded JPEG (`DCTDecode`) images, decodes them with `createImageBitmap`, downsamples them on an **OffscreenCanvas**, re-encodes at your chosen JPEG quality (default 0.6) and swaps the streams back in. The UI thread never blocks. |
| **OCR** | Pages are rasterized to a canvas and recognized by `tesseract.js`, which runs its WASM engine inside its own **Web Worker**. The worker script, WASM core and English language model are self-hosted static assets — no CDN involved. Extracted text can be copied or downloaded as `.txt`. |

## Privacy model

- Files are held **in memory only** — no localStorage, no IndexedDB, no cookies, no network calls with your data.
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
