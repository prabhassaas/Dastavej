import { PDFDocument, EncryptedPDFError, type LoadOptions } from '@cantoo/pdf-lib';

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
 */
export async function sanitizeEncryptedPdf(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    await PDFDocument.load(bytes);
    return bytes;
  } catch (err) {
    if (!(err instanceof EncryptedPDFError)) throw err;
  }
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.save();
}
