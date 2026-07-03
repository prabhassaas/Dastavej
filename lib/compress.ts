import type { CompressResponse } from '@/workers/compress.worker';

export interface CompressResult {
  bytes: Uint8Array;
  imagesFound: number;
  imagesRecompressed: number;
  bytesSaved: number;
}

/**
 * Compress a PDF's embedded JPEGs in a dedicated Web Worker (OffscreenCanvas
 * downsampling + re-encode). Framework-free — usable outside the Dastavej UI.
 */
export function compressPdf(
  bytes: Uint8Array,
  options: { quality?: number; maxDimension?: number; onProgress?: (current: number, total: number) => void } = {},
): Promise<CompressResult> {
  const { quality = 0.6, maxDimension = 1600, onProgress } = options;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/compress.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<CompressResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress?.(msg.current, msg.total);
      else if (msg.type === 'done') {
        worker.terminate();
        resolve({
          bytes: new Uint8Array(msg.bytes),
          imagesFound: msg.imagesFound,
          imagesRecompressed: msg.imagesRecompressed,
          bytesSaved: msg.bytesSaved,
        });
      } else {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Compression worker crashed'));
    };
    const copy = bytes.slice();
    worker.postMessage({ bytes: copy.buffer, quality, maxDimension }, [copy.buffer]);
  });
}
