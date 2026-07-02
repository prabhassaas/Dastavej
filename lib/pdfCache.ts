import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfjs } from './pdfjs';

/**
 * Module-level cache of parsed pdf.js documents, keyed by source id.
 * These proxies are not serializable, so they live outside React state.
 */
const docs = new Map<string, PDFDocumentProxy>();

/** Parse `bytes` with pdf.js and cache the document. Returns the page count. */
export async function loadIntoCache(id: string, bytes: Uint8Array): Promise<number> {
  const pdfjs = await getPdfjs();
  // pdf.js transfers the buffer to its worker, so always hand it a copy.
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  docs.set(id, doc);
  return doc.numPages;
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
