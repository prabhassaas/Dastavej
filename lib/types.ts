/** Shared types for the workspace state. Everything lives in memory only. */

export type Tab = 'view' | 'organize' | 'edit' | 'convert' | 'form' | 'compress' | 'ocr';

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
  tab: Tab;
  /** index into `pages` */
  currentPage: number;
  zoom: number;
  error: string | null;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
