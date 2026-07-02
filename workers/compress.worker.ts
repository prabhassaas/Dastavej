/**
 * PDF compression Web Worker.
 *
 * Runs entirely in the browser: parses the PDF with pdf-lib, finds embedded
 * JPEG images (DCTDecode streams), decodes them with createImageBitmap,
 * downsamples them on an OffscreenCanvas, re-encodes them as JPEG at the
 * requested quality, and swaps the streams back into the document.
 * The main thread stays responsive the whole time.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from 'pdf-lib';

export interface CompressRequest {
  bytes: ArrayBuffer;
  /** JPEG quality 0..1 (default 0.6) */
  quality: number;
  /** longest edge of any image after downsampling, in px */
  maxDimension: number;
}

export type CompressResponse =
  | { type: 'progress'; current: number; total: number }
  | {
      type: 'done';
      bytes: ArrayBuffer;
      imagesFound: number;
      imagesRecompressed: number;
      bytesSaved: number;
    }
  | { type: 'error'; message: string };

const post = (msg: CompressResponse, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

const NAME = {
  subtype: PDFName.of('Subtype'),
  image: PDFName.of('Image'),
  filter: PDFName.of('Filter'),
  dct: PDFName.of('DCTDecode'),
  colorSpace: PDFName.of('ColorSpace'),
  decode: PDFName.of('Decode'),
  smask: PDFName.of('SMask'),
  interpolate: PDFName.of('Interpolate'),
  deviceRgb: PDFName.of('DeviceRGB'),
  deviceGray: PDFName.of('DeviceGray'),
};

/** Only plain baseline JPEGs in a safe color space are rewritten. */
function isRecompressibleJpeg(stream: PDFRawStream): boolean {
  const dict = stream.dict;
  if (dict.get(NAME.subtype) !== NAME.image) return false;

  const filter = dict.get(NAME.filter);
  const isDct =
    filter === NAME.dct ||
    (filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === NAME.dct);
  if (!isDct) return false;

  // A Decode array can invert the samples; skip rather than corrupt colors.
  if (dict.has(NAME.decode)) return false;

  const cs = dict.get(NAME.colorSpace);
  if (cs instanceof PDFName) {
    if (cs !== NAME.deviceRgb && cs !== NAME.deviceGray) return false;
  } else if (cs instanceof PDFArray) {
    // Allow [/ICCBased ref]; skip Indexed / Separation / DeviceN etc.
    const first = cs.get(0);
    if (!(first instanceof PDFName) || first.decodeText() !== 'ICCBased') return false;
  } else if (cs !== undefined && !(cs instanceof PDFRef)) {
    return false;
  }
  return true;
}

self.onmessage = async (event: MessageEvent<CompressRequest>) => {
  try {
    const { bytes, quality, maxDimension } = event.data;
    const doc = await PDFDocument.load(bytes);

    const targets: { ref: PDFRef; stream: PDFRawStream }[] = [];
    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream && isRecompressibleJpeg(obj)) {
        targets.push({ ref, stream: obj });
      }
    }

    let recompressed = 0;
    let saved = 0;

    for (let i = 0; i < targets.length; i++) {
      post({ type: 'progress', current: i + 1, total: targets.length });
      const { ref, stream } = targets[i];
      try {
        const raw = stream.getContents();
        const bitmap = await createImageBitmap(
          new Blob([raw.slice().buffer as ArrayBuffer], { type: 'image/jpeg' }),
        );

        // If the image carries a soft mask, keep its dimensions so the mask
        // still lines up; otherwise downsample the longest edge.
        const hasSMask = stream.dict.has(NAME.smask);
        let width = bitmap.width;
        let height = bitmap.height;
        if (!hasSMask && Math.max(width, height) > maxDimension) {
          const s = maxDimension / Math.max(width, height);
          width = Math.max(1, Math.round(width * s));
          height = Math.max(1, Math.round(height * s));
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        const out = new Uint8Array(await blob.arrayBuffer());
        if (out.length >= raw.length) continue; // not worth it

        const dict = doc.context.obj({
          Type: 'XObject',
          Subtype: 'Image',
          Width: width,
          Height: height,
          ColorSpace: 'DeviceRGB',
          BitsPerComponent: 8,
          Filter: 'DCTDecode',
          Length: out.length,
        }) as PDFDict;
        const smask = stream.dict.get(NAME.smask);
        if (smask) dict.set(NAME.smask, smask);
        const interpolate = stream.dict.get(NAME.interpolate);
        if (interpolate) dict.set(NAME.interpolate, interpolate);

        doc.context.assign(ref, PDFRawStream.of(dict, out));
        recompressed++;
        saved += raw.length - out.length;
      } catch {
        // Undecodable or exotic image — leave it untouched.
      }
    }

    const result = await doc.save({ useObjectStreams: true });
    const buffer = result.buffer.slice(
      result.byteOffset,
      result.byteOffset + result.byteLength,
    ) as ArrayBuffer;
    post(
      {
        type: 'done',
        bytes: buffer,
        imagesFound: targets.length,
        imagesRecompressed: recompressed,
        bytesSaved: saved,
      },
      [buffer],
    );
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
