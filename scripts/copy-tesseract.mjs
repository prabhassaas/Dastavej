/**
 * Copies the tesseract.js worker and WASM core from node_modules into
 * public/tesseract so OCR runs from same-origin static assets instead of a
 * CDN. Runs on postinstall and before dev/build; output is gitignored.
 */
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'tesseract');

mkdirSync(join(dest, 'core'), { recursive: true });

cpSync(
  join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  join(dest, 'worker.min.js'),
);

const coreSrc = join(root, 'node_modules', 'tesseract.js-core');
for (const file of readdirSync(coreSrc)) {
  if (file.startsWith('tesseract-core') && (file.endsWith('.wasm.js') || file.endsWith('.wasm'))) {
    cpSync(join(coreSrc, file), join(dest, 'core', file));
  }
}

// English language model, self-hosted so OCR needs no CDN at all.
mkdirSync(join(dest, 'lang'), { recursive: true });
cpSync(
  join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0', 'eng.traineddata.gz'),
  join(dest, 'lang', 'eng.traineddata.gz'),
);

console.log('tesseract.js assets copied to public/tesseract');
