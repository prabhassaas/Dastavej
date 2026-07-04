import { getPdfjs } from './pdfjs';

/** BCP-47 language prefixes for Indian languages we specifically call out. */
const INDIC_LANG_PREFIXES = [
  'hi', // Hindi
  'bn', // Bengali
  'ta', // Tamil
  'te', // Telugu
  'mr', // Marathi
  'gu', // Gujarati
  'kn', // Kannada
  'ml', // Malayalam
  'pa', // Punjabi
  'ur', // Urdu
  'or', // Odia
  'as', // Assamese
  'en-in', // Indian English
];

export function isIndicVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  return INDIC_LANG_PREFIXES.some((p) => lang === p || lang.startsWith(`${p}-`));
}

/**
 * Resolves once the browser has actually populated its voice list — Chrome
 * in particular returns an empty array on the first synchronous call and
 * fires `voiceschanged` once real voices are ready.
 */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const onChange = () => {
      speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', onChange);
    // Some browsers never fire the event if there are simply no voices.
    setTimeout(() => {
      speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(speechSynthesis.getVoices());
    }, 1500);
  });
}

/** Plain running text of one page, for reading aloud (not layout-aware). */
export async function extractPageText(bytes: Uint8Array, pageNumber: number): Promise<string> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } finally {
    await doc.destroy();
  }
}

export async function extractAllText(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/** Small wrapper so callers don't juggle SpeechSynthesisUtterance events by hand. */
export function speak(
  text: string,
  opts: { voice?: SpeechSynthesisVoice | null; rate?: number; onEnd?: () => void; onBoundary?: (charIndex: number) => void },
): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  if (opts.voice) utter.voice = opts.voice;
  utter.rate = opts.rate ?? 1;
  if (opts.onEnd) utter.onend = opts.onEnd;
  if (opts.onBoundary) utter.onboundary = (e) => opts.onBoundary!(e.charIndex);
  speechSynthesis.speak(utter);
  return utter;
}
