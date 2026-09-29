import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfjs } from './pdfjs';

/**
 * Module-level cache of parsed pdf.js documents, keyed by source id.
 * These proxies are not serializable, so they live outside React state.
 */
const docs = new Map<string, PDFDocumentProxy>();

/**
 * Parse `bytes` with pdf.js and cache the document. Returns the page count.
 * `password` is only needed for files that refuse to open without one — see
 * `isPasswordError` for spotting that case.
 */
export async function loadIntoCache(id: string, bytes: Uint8Array, password?: string): Promise<number> {
  const pdfjs = await getPdfjs();
  // pdf.js transfers the buffer to its worker, so always hand it a copy.
  const doc = await pdfjs.getDocument({ data: bytes.slice(), ...(password ? { password } : {}) }).promise;
  docs.set(id, doc);
  return doc.numPages;
}

/**
 * True when pdf.js rejected a file purely because it needs an open password
 * (or the one supplied was wrong) rather than because it is broken. pdf.js
 * signals this with a `PasswordException`; its `code` is 1 for "no password
 * given" and 2 for "password is wrong", per pdf.js's PasswordResponses.
 */
export function isPasswordError(err: unknown): boolean {
  return err instanceof Error && err.name === 'PasswordException';
}

/** True when a password WAS supplied for this file and pdf.js rejected it. */
export function isWrongPassword(err: unknown): boolean {
  return isPasswordError(err) && (err as Error & { code?: number }).code === 2;
}

export function getCachedDoc(id: string): PDFDocumentProxy {
  const doc = docs.get(id);
  if (!doc) throw new Error(`PDF source ${id} is not loaded`);
  return doc;
}

export function evictFromCache(id: string): void {
  const doc = docs.get(id);
  if (doc) {
    doc.destroy().catch(() => {});
    docs.delete(id);
  }
}

export function clearCache(): void {
  for (const id of Array.from(docs.keys())) evictFromCache(id);
}

/** Evict everything except `keepId` (used when swapping in a new working file). */
export function clearCacheExcept(keepId: string): void {
  for (const id of Array.from(docs.keys())) {
    if (id !== keepId) evictFromCache(id);
  }
}
