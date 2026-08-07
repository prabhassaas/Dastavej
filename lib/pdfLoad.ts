import { PDFDocument, type LoadOptions } from '@cantoo/pdf-lib';

/**
 * Load a PDF with pdf-lib, tolerating owner-password/permissions-only
 * encryption (no user password) — common for bank statements, HR and
 * government PDFs that restrict printing/copying but open fine everywhere
 * else, including this app's own pdf.js-based viewer. pdf-lib refuses to
 * load ANY encrypted PDF unless told otherwise, so every write/edit path
 * needs this rather than the plain `PDFDocument.load`.
 */
export function loadPdf(
  bytes: string | Uint8Array | ArrayBuffer,
  opts: LoadOptions = {},
): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true, ...opts });
}

/**
 * Cheap, parser-free check for whether a PDF is encrypted: an encrypted
 * file's trailer must contain a literal `/Encrypt` key naming the encryption
 * dictionary (PDF spec), so a raw byte scan finds it without ever running
 * pdf-lib's parser — which matters, because pdf-lib's parser is the fragile
 * part here and should only be invoked on files that actually need it.
 */
function looksEncrypted(bytes: Uint8Array): boolean {
  return new TextDecoder('latin1').decode(bytes).includes('/Encrypt');
}

/**
 * If `bytes` is an encrypted PDF, decrypt it once and return clean,
 * unencrypted bytes; otherwise returns `bytes` unchanged. `ignoreEncryption`
 * alone isn't enough for correctness: pdf-lib's page-copying path
 * (`copyPages`, used by nearly every write operation via `assemblePdf`)
 * copies encrypted content streams verbatim without decrypting them,
 * silently corrupting the result (garbled/empty text on export). Re-saving
 * the SAME loaded document — no `copyPages`, no new document — forces every
 * stream through pdf-lib's decrypt-on-read path, producing genuinely clean
 * bytes. Call this once at upload time, before bytes enter the workspace,
 * so every downstream operation just works on plain bytes.
 *
 * This is deliberately best-effort and never blocks the upload: pdf-lib's
 * parser is far less tolerant of real-world PDF quirks than pdf.js (which
 * does the actual viewing/rendering), so any failure here — encrypted or
 * not — just falls back to the original bytes rather than surfacing a
 * confusing pdf-lib error for a file that would otherwise open fine.
 */
export async function sanitizeEncryptedPdf(bytes: Uint8Array): Promise<Uint8Array> {
  if (!looksEncrypted(bytes)) return bytes;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return await doc.save();
  } catch {
    return bytes;
  }
}
