/** Shared types for the workspace state. Everything lives in memory only. */

export type Tab =
  | 'view'
  | 'organize'
  | 'edit'
  | 'annotate'
  | 'marks'
  | 'convert'
  | 'form'
  | 'ai'
  | 'compress'
  | 'ocr';

/**
 * Page annotations (highlight, freehand ink, box, stamped image), stored in
 * PDF user space so they can be burned in exactly with pdf-lib on export.
 */
export type Annotation =
  | { id: string; kind: 'highlight'; x: number; y: number; w: number; h: number; color: string }
  | { id: string; kind: 'box'; x: number; y: number; w: number; h: number; color: string }
  /** opaque patch that hides the original spot after a "magic grab" */
  | { id: string; kind: 'erase'; x: number; y: number; w: number; h: number; color: string }
  | { id: string; kind: 'ink'; points: [number, number][]; color: string; strokeWidth: number }
  | {
      id: string;
      kind: 'image';
      x: number;
      y: number;
      w: number;
      h: number;
      /** PNG or JPEG bytes of the stamped image (signature, logo, photo…) */
      bytes: Uint8Array;
      mime: 'image/png' | 'image/jpeg';
      /** object URL for on-screen preview */
      previewUrl: string;
    };

/** Annotation palette (name → hex) shared by the overlay and the export. */
export const ANNOT_COLORS: Record<string, string> = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#60a5fa',
  pink: '#f472b6',
  red: '#ef4444',
};

/** Document-level watermark + header/footer settings, applied on export. */
export interface DocMarks {
  watermark: {
    enabled: boolean;
    text: string;
    /** 0..1 */
    opacity: number;
    fontSize: number;
    color: 'gray' | 'red' | 'indigo';
  };
  headerFooter: {
    enabled: boolean;
    /** supports the {date} placeholder */
    headerText: string;
    footerText: string;
    /** '' = none */
    pageNumbers: '' | 'Page {page}' | '{page} of {total}' | '{page}';
  };
}

export const DEFAULT_MARKS: DocMarks = {
  watermark: { enabled: false, text: 'CONFIDENTIAL', opacity: 0.15, fontSize: 64, color: 'gray' },
  headerFooter: { enabled: false, headerText: '', footerText: '', pageNumbers: 'Page {page}' },
};

/** A PDF file the user loaded. Bytes are kept pristine in memory. */
export interface SourceFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  numPages: number;
}

/** One page of the working document. Points into a source file. */
export interface PageEntry {
  id: string;
  sourceId: string;
  /** 0-based page index inside the source file */
  pageIndex: number;
  /** extra rotation applied by the user, degrees clockwise (0/90/180/270) */
  rotation: number;
}

/**
 * An edit of an existing text block. Coordinates are in PDF user space
 * (origin bottom-left, y = text baseline), captured from pdf.js text items,
 * so they can be replayed 1:1 with pdf-lib on export.
 */
export interface TextEdit {
  /** index of the text item in pdf.js getTextContent().items */
  itemIndex: number;
  original: string;
  text: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfSize: number;
}

/** A brand-new text box placed by the user. PDF user space, y = baseline. */
export interface AddedText {
  id: string;
  text: string;
  pdfX: number;
  pdfY: number;
  pdfSize: number;
}

export interface PageEdits {
  textEdits: Record<number, TextEdit>;
  added: AddedText[];
}

/** Minimal shape of a pdf.js PageViewport that the overlay layer needs. */
export interface ViewportLike {
  width: number;
  height: number;
  scale: number;
  transform: number[];
  convertToPdfPoint(x: number, y: number): number[];
  convertToViewportPoint(x: number, y: number): number[];
}

export interface WorkspaceState {
  sources: Record<string, SourceFile>;
  pages: PageEntry[];
  /** keyed by PageEntry.id */
  edits: Record<string, PageEdits>;
  /** annotations keyed by PageEntry.id */
  annots: Record<string, Annotation[]>;
  /** document-level watermark / header / footer settings */
  marks: DocMarks;
  tab: Tab;
  /** index into `pages` */
  currentPage: number;
  zoom: number;
  error: string | null;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
