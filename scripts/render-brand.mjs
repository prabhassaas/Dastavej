/**
 * Renders the brand exports from their sources:
 *   brand/poster.html  → brand/poster.png   (1080×1350)
 *   app/icon.svg       → app/apple-icon.png (180×180)
 *
 * Needs a Chromium driver: `npm i -D playwright-core` (or set
 * CHROMIUM_PATH to a Chrome/Chromium binary).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('playwright-core is not installed. Run: npm i -D playwright-core');
  process.exit(1);
}

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

// Poster
const posterPage = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await posterPage.goto(pathToFileURL(join(root, 'brand', 'poster.html')).href, {
  waitUntil: 'networkidle',
});
await posterPage.screenshot({ path: join(root, 'brand', 'poster.png') });
console.log('brand/poster.png rendered (1080×1350)');

// Apple touch icon from the favicon source
const iconSvg = readFileSync(join(root, 'app', 'icon.svg'), 'utf8');
const iconPage = await browser.newPage({ viewport: { width: 180, height: 180 } });
await iconPage.setContent(
  `<body style="margin:0">${iconSvg.replace('<svg ', '<svg width="180" height="180" ')}</body>`,
);
await iconPage.screenshot({ path: join(root, 'app', 'apple-icon.png'), omitBackground: true });
console.log('app/apple-icon.png rendered (180×180)');

await browser.close();
