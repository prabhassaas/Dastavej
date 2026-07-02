# Dastavej Brand Kit

Version-controlled brand assets for **Dastavej — the free, client-side PDF
editor**. Everything here is the source of truth; the app consumes the same
mark via `components/Logo.tsx` and `app/icon.svg`.

## Assets

| File | Purpose |
| --- | --- |
| `logo-mark.svg` | Square app mark (gradient tile + document + pencil). Use at 16 px and up. |
| `logo.svg` | Horizontal lockup with wordmark & tagline, for light backgrounds. |
| `logo-dark.svg` | Same lockup for dark backgrounds. |
| `poster.html` | Marketing poster **source** (1080×1350, self-contained HTML). Edit this, then re-export. |
| `poster.png` | Rendered poster export (social-media portrait, 4:5). |
| `app-screenshot.png` | Real app screenshot embedded in the poster. |
| `../app/icon.svg` | Favicon (served by Next.js at `/icon.svg`). |
| `../app/apple-icon.png` | 180×180 touch icon (rendered from the mark). |

## Palette

| Token | Hex | Usage |
| --- | --- | --- |
| Indigo 500 | `#6366f1` | Primary / gradient start |
| Violet 500 | `#8b5cf6` | Gradient end |
| Amber 500 | `#f59e0b` | Pencil / accent |
| Slate 950 | `#0b1020` | Dark surfaces |
| Slate 50 | `#f8fafc` | Light text on dark |

## The mark

A document with a folded corner (the PDF) and a pencil writing on it (the
editor). It must remain legible at 16 px: don't add detail, don't outline,
don't rotate. Keep at least ½ tile of clear space around lockups.
Wordmark uses the system UI stack (`Segoe UI / Helvetica`), weight 700,
tight tracking.

## Re-exporting the poster

```bash
# from repo root — renders brand/poster.html to brand/poster.png at 1080×1350
node scripts/render-brand.mjs
```

## Version history

| Version | Date | Changes |
| --- | --- | --- |
| 1.1.0 | 2026-07-02 | Initial brand kit: mark, lockups, favicon, touch icon, poster v1. |
