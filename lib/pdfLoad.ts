import { PDFDocument, type LoadOptions } from '@cantoo/pdf-lib';

/**
 * Load a PDF with pdf-lib, tolerating owner-password/permissions-only
 * encryption (no user password) — common for bank statements, HR and
 * government PDFs that restrict printing/copying but open fine everywhere
 * else, including this app's own pdf.js-based viewer. pdf-lib refuses to
 * load ANY encrypted PDF unless told otherwise, so every write/edit path
 * needs this rather than the plain `PDFDocument.load`.
 *
 * Tries a real empty-password decrypt first and only falls back to
 * `ignoreEncryption`, because the two are not equivalent: `ignoreEncryption`
 * merely silences the check and leaves content streams encrypted, so pages
 * copied out of such a document come out blank. An empty password is safe
 * on unencrypted files too (verified), so the fast path costs nothing.
 */
export async function loadPdf(
  bytes: string | Uint8Array | ArrayBuffer,
  opts: LoadOptions = {},
): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { password: '', ...opts });
  } catch {
    // Needs a real open password, or pdf-lib tripped on some quirk — behave
    // no worse than before and let the caller surface any failure.
    return PDFDocument.load(bytes, { ignoreEncryption: true, ...opts });
  }
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
 * Decrypt an encrypted PDF into genuinely plain bytes, given its open
 * password (`''` for the very common owner-password/permissions-only case,
 * where no password is needed to open the file at all).
 *
 * Passing a real `password` matters — it is NOT interchangeable with
 * `ignoreEncryption: true`. The latter only silences pdf-lib's "this is
 * encrypted" check; content streams stay encrypted, so the file reads fine
 * once but comes out empty/garbled the moment anything copies pages out of
 * it (which `assemblePdf` does for every edit/merge/reorder). Decrypting
 * with a password instead produces output that survives a full `copyPages`
 * round-trip intact — verified against AES-128 files with both an open
 * password and owner-password-only restrictions.
 *
 * Throws if the password is wrong or the file can't be parsed.
 */
export async function decryptPdf(bytes: Uint8Array, password = ''): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { password });
  return doc.save();
}

/**
 * If `bytes` is an encrypted PDF that opens without a password (owner
 * password / permissions restrictions only — bank statements, HR and
 * government forms that block printing or copying), decrypt it once so
 * every downstream operation sees plain bytes. Returns `bytes` unchanged
 * for anything else.
 *
 * Deliberately best-effort and never blocks the upload: pdf-lib's parser is
 * far less tolerant of real-world PDF quirks than pdf.js (which does the
 * actual viewing), so any failure just falls back to the original bytes.
 * A file that needs a real open password lands here too and fails the
 * empty-password attempt — that's expected, and pdf.js then reports it as
 * needing a password so the UI can prompt for one.
 */
export async function sanitizeEncryptedPdf(bytes: Uint8Array): Promise<Uint8Array> {
  if (!looksEncrypted(bytes)) return bytes;
  try {
    return await decryptPdf(bytes, '');
  } catch {
    return bytes;
  }
}
