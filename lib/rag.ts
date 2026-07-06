import { embedTexts } from './ai';

/**
 * Minimal, dependency-free RAG (retrieval-augmented generation): split text
 * into overlapping chunks, embed them via the user's configured provider,
 * and do plain in-memory cosine-similarity search to find the most relevant
 * chunks for a question. No vector database needed — a document or an API
 * reference is small enough that a flat array + a similarity loop is plenty
 * fast, and it keeps this 100% client-side like everything else in the app.
 */

export interface RagChunk {
  text: string;
  vector: number[];
  /** e.g. "Page 3" or "compressPdf" — shown next to retrieved context, optional */
  source?: string;
}

/** Split text into overlapping chunks so no sentence gets cut off between two chunks. */
export function chunkText(text: string, opts: { chunkSize?: number; overlap?: number } = {}): string[] {
  const chunkSize = opts.chunkSize ?? 800;
  const overlap = opts.overlap ?? 120;
  const clean = text.replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const slice = clean.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

const EMBED_BATCH = 24;

/**
 * Chunk + embed a set of source texts into a searchable index. Embeds in
 * batches (one request per batch) so progress can be reported and a single
 * request doesn't balloon with a very long document.
 */
export async function buildRagIndex(
  items: { text: string; source?: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<RagChunk[]> {
  const pending: { text: string; source?: string }[] = [];
  for (const { text, source } of items) {
    for (const chunk of chunkText(text)) pending.push({ text: chunk, source });
  }
  if (!pending.length) return [];

  const out: RagChunk[] = [];
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const vectors = await embedTexts(batch.map((b) => b.text));
    batch.forEach((b, j) => out.push({ text: b.text, source: b.source, vector: vectors[j] }));
    onProgress?.(Math.min(i + EMBED_BATCH, pending.length), pending.length);
  }
  return out;
}

/** Embed the query and return the top-k most similar chunks, best first. */
export async function searchRagIndex(index: RagChunk[], query: string, k = 4): Promise<RagChunk[]> {
  if (!index.length) return [];
  const [queryVector] = await embedTexts([query]);
  return index
    .map((chunk) => ({ chunk, score: cosineSimilarity(chunk.vector, queryVector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk);
}

/** Render retrieved chunks as a labeled context block to prepend to a prompt. */
export function formatContext(chunks: RagChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}]${c.source ? ` (${c.source})` : ''} ${c.text}`)
    .join('\n\n');
}
