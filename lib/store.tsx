'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import {
  DEFAULT_MARKS,
  uid,
  type AddedText,
  type Annotation,
  type DocMarks,
  type PageEntry,
  type SourceFile,
  type Tab,
  type TextEdit,
  type WorkspaceState,
} from './types';
import { clearCache, clearCacheExcept, loadIntoCache } from './pdfCache';

const initialState: WorkspaceState = {
  sources: {},
  pages: [],
  edits: {},
  annots: {},
  marks: DEFAULT_MARKS,
  tab: 'view',
  currentPage: 0,
  zoom: 1,
  error: null,
};

type Action =
  | { type: 'ADD_SOURCE'; source: SourceFile }
  | { type: 'RESET_WORKSPACE'; source: SourceFile }
  | { type: 'CLEAR_ALL' }
  | { type: 'REORDER_PAGES'; from: number; to: number }
  | { type: 'REMOVE_PAGE'; pageId: string }
  | { type: 'ROTATE_PAGE'; pageId: string }
  | { type: 'SET_TAB'; tab: Tab }
  | { type: 'SET_PAGE'; index: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'UPSERT_TEXT_EDIT'; pageId: string; edit: TextEdit }
  | { type: 'REMOVE_TEXT_EDIT'; pageId: string; itemIndex: number }
  | { type: 'ADD_TEXT'; pageId: string; added: AddedText }
  | { type: 'UPDATE_ADDED'; pageId: string; id: string; patch: Partial<AddedText> }
  | { type: 'REMOVE_ADDED'; pageId: string; id: string }
  | { type: 'ADD_ANNOT'; pageId: string; annot: Annotation }
  | { type: 'UPDATE_ANNOT'; pageId: string; id: string; patch: Partial<Annotation> }
  | { type: 'REMOVE_ANNOT'; pageId: string; id: string }
  | { type: 'SET_MARKS'; marks: DocMarks }
  | { type: 'DUPLICATE_PAGE'; pageId: string }
  | { type: 'REVERSE_PAGES' }
  | { type: 'SET_ERROR'; error: string | null };

function pagesForSource(source: SourceFile): PageEntry[] {
  return Array.from({ length: source.numPages }, (_, i) => ({
    id: uid(),
    sourceId: source.id,
    pageIndex: i,
    rotation: 0,
  }));
}

function editsFor(state: WorkspaceState, pageId: string) {
  return state.edits[pageId] ?? { textEdits: {}, added: [] };
}

function clampPage(index: number, total: number): number {
  return Math.max(0, Math.min(index, total - 1));
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'ADD_SOURCE': {
      return {
        ...state,
        sources: { ...state.sources, [action.source.id]: action.source },
        pages: [...state.pages, ...pagesForSource(action.source)],
        error: null,
      };
    }
    case 'RESET_WORKSPACE': {
      return {
        ...initialState,
        tab: state.tab,
        zoom: state.zoom,
        sources: { [action.source.id]: action.source },
        pages: pagesForSource(action.source),
      };
    }
    case 'CLEAR_ALL':
      return { ...initialState };
    case 'REORDER_PAGES': {
      const pages = [...state.pages];
      const [moved] = pages.splice(action.from, 1);
      pages.splice(action.to, 0, moved);
      return { ...state, pages };
    }
    case 'REMOVE_PAGE': {
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      const edits = { ...state.edits };
      delete edits[action.pageId];
      const annots = { ...state.annots };
      delete annots[action.pageId];
      return {
        ...state,
        pages,
        edits,
        annots,
        currentPage: clampPage(state.currentPage, pages.length),
      };
    }
    case 'DUPLICATE_PAGE': {
      const index = state.pages.findIndex((p) => p.id === action.pageId);
      if (index === -1) return state;
      const copy = { ...state.pages[index], id: uid() };
      const pages = [...state.pages];
      pages.splice(index + 1, 0, copy);
      return { ...state, pages };
    }
    case 'REVERSE_PAGES':
      return { ...state, pages: [...state.pages].reverse(), currentPage: 0 };
    case 'ROTATE_PAGE': {
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === action.pageId ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
        ),
      };
    }
    case 'SET_TAB':
      return { ...state, tab: action.tab };
    case 'SET_PAGE':
      return { ...state, currentPage: clampPage(action.index, state.pages.length) };
    case 'SET_ZOOM':
      return { ...state, zoom: Math.min(4, Math.max(0.25, action.zoom)) };
    case 'UPSERT_TEXT_EDIT': {
      const page = editsFor(state, action.pageId);
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.pageId]: {
            ...page,
            textEdits: { ...page.textEdits, [action.edit.itemIndex]: action.edit },
          },
        },
      };
    }
    case 'REMOVE_TEXT_EDIT': {
      const page = editsFor(state, action.pageId);
      const textEdits = { ...page.textEdits };
      delete textEdits[action.itemIndex];
      return {
        ...state,
        edits: { ...state.edits, [action.pageId]: { ...page, textEdits } },
      };
    }
    case 'ADD_TEXT': {
      const page = editsFor(state, action.pageId);
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.pageId]: { ...page, added: [...page.added, action.added] },
        },
      };
    }
    case 'UPDATE_ADDED': {
      const page = editsFor(state, action.pageId);
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.pageId]: {
            ...page,
            added: page.added.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
          },
        },
      };
    }
    case 'REMOVE_ADDED': {
      const page = editsFor(state, action.pageId);
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.pageId]: { ...page, added: page.added.filter((a) => a.id !== action.id) },
        },
      };
    }
    case 'ADD_ANNOT': {
      const list = state.annots[action.pageId] ?? [];
      return {
        ...state,
        annots: { ...state.annots, [action.pageId]: [...list, action.annot] },
      };
    }
    case 'UPDATE_ANNOT': {
      const list = state.annots[action.pageId] ?? [];
      return {
        ...state,
        annots: {
          ...state.annots,
          [action.pageId]: list.map((a) =>
            a.id === action.id ? ({ ...a, ...action.patch } as Annotation) : a,
          ),
        },
      };
    }
    case 'REMOVE_ANNOT': {
      const list = state.annots[action.pageId] ?? [];
      return {
        ...state,
        annots: { ...state.annots, [action.pageId]: list.filter((a) => a.id !== action.id) },
      };
    }
    case 'SET_MARKS':
      return { ...state, marks: action.marks };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

// ── Undo / redo ──────────────────────────────────────────────────────────
//
// Only document-mutating actions go on the history stack; navigation state
// (active tab, current page, zoom, transient errors) is excluded so undo
// never fights the user over "what am I looking at". Rapid same-target
// edits (typing into a text box, dragging an annotation) are coalesced into
// one history step within a short window, so undo reverts a whole edit
// rather than one keystroke/pixel at a time.

const UNDOABLE_TYPES = new Set<Action['type']>([
  'ADD_SOURCE',
  'REORDER_PAGES',
  'REMOVE_PAGE',
  'ROTATE_PAGE',
  'DUPLICATE_PAGE',
  'REVERSE_PAGES',
  'UPSERT_TEXT_EDIT',
  'REMOVE_TEXT_EDIT',
  'ADD_TEXT',
  'UPDATE_ADDED',
  'REMOVE_ADDED',
  'ADD_ANNOT',
  'UPDATE_ANNOT',
  'REMOVE_ANNOT',
  'SET_MARKS',
]);

const COALESCE_WINDOW_MS = 800;
const MAX_HISTORY = 50;

/** Actions dispatched rapidly against the same target coalesce into one step. */
function coalesceKey(action: Action): string | null {
  switch (action.type) {
    case 'UPSERT_TEXT_EDIT':
      return `UPSERT_TEXT_EDIT:${action.pageId}:${action.edit.itemIndex}`;
    case 'UPDATE_ADDED':
      return `UPDATE_ADDED:${action.pageId}:${action.id}`;
    case 'UPDATE_ANNOT':
      return `UPDATE_ANNOT:${action.pageId}:${action.id}`;
    case 'SET_MARKS':
      return 'SET_MARKS';
    default:
      return null;
  }
}

type HistoryAction = Action | { type: 'UNDO' } | { type: 'REDO' };

interface HistoryState {
  present: WorkspaceState;
  past: WorkspaceState[];
  future: WorkspaceState[];
  lastKey: string | null;
  lastTime: number;
}

const initialHistory: HistoryState = {
  present: initialState,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
};

function historyReducer(h: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === 'UNDO') {
    if (h.past.length === 0) return h;
    return {
      present: h.past[h.past.length - 1],
      past: h.past.slice(0, -1),
      future: [h.present, ...h.future],
      lastKey: null,
      lastTime: 0,
    };
  }
  if (action.type === 'REDO') {
    if (h.future.length === 0) return h;
    return {
      present: h.future[0],
      past: [...h.past, h.present],
      future: h.future.slice(1),
      lastKey: null,
      lastTime: 0,
    };
  }

  const nextPresent = reducer(h.present, action);
  if (nextPresent === h.present) return h;

  // These start a fresh document: RESET_WORKSPACE evicts the previous
  // source(s) from the pdf.js cache, so any older history entries would
  // reference a document that's no longer loadable — drop them rather than
  // risk an undo that can't render. The very first ADD_SOURCE into an empty
  // workspace is "opening a file", not an edit, so it gets the same
  // treatment — undo shouldn't take you back to an empty app.
  const opensFreshDocument =
    action.type === 'CLEAR_ALL' ||
    action.type === 'RESET_WORKSPACE' ||
    (action.type === 'ADD_SOURCE' && h.present.pages.length === 0);
  if (opensFreshDocument) {
    return { present: nextPresent, past: [], future: [], lastKey: null, lastTime: 0 };
  }
  if (!UNDOABLE_TYPES.has(action.type)) {
    return { ...h, present: nextPresent };
  }

  const key = coalesceKey(action);
  const now = Date.now();
  if (key !== null && key === h.lastKey && now - h.lastTime < COALESCE_WINDOW_MS) {
    return { ...h, present: nextPresent, lastTime: now };
  }

  return {
    present: nextPresent,
    past: [...h.past, h.present].slice(-MAX_HISTORY),
    future: [],
    lastKey: key,
    lastTime: now,
  };
}

interface StoreValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
  /** Parse and add PDF files to the workspace (appends pages = local merge). */
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** Replace the whole workspace with a single new PDF (e.g. compressed output). */
  replaceWorkspace: (name: string, bytes: Uint8Array) => Promise<void>;
  /** Add an in-memory generated PDF (e.g. a form built by the wizard). */
  addGeneratedPdf: (name: string, bytes: Uint8Array) => Promise<void>;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function PdfProvider({ children }: { children: ReactNode }) {
  const [history, dispatchHistory] = useReducer(historyReducer, initialHistory);
  const state = history.present;
  const dispatch: React.Dispatch<Action> = dispatchHistory;

  const undo = useCallback(() => dispatchHistory({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatchHistory({ type: 'REDO' }), []);

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl+Y to redo — skipped while
  // typing in an input/textarea/contentEditable so text-field editing (and
  // the browser's own native undo inside a field) isn't hijacked.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      const target = e.target as HTMLElement | null;
      const editable =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (editable) return;
      e.preventDefault();
      if (isUndo) dispatchHistory({ type: 'UNDO' });
      else dispatchHistory({ type: 'REDO' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        dispatch({ type: 'SET_ERROR', error: `"${file.name}" is not a PDF file.` });
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const id = uid();
        const numPages = await loadIntoCache(id, bytes);
        dispatch({ type: 'ADD_SOURCE', source: { id, name: file.name, bytes, numPages } });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: `Could not open "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }, []);

  const replaceWorkspace = useCallback(async (name: string, bytes: Uint8Array) => {
    const id = uid();
    // Parse the new file first so a corrupt result never wipes the workspace.
    const numPages = await loadIntoCache(id, bytes);
    clearCacheExcept(id);
    dispatch({ type: 'RESET_WORKSPACE', source: { id, name, bytes, numPages } });
  }, []);

  const addGeneratedPdf = useCallback(async (name: string, bytes: Uint8Array) => {
    const id = uid();
    const numPages = await loadIntoCache(id, bytes);
    dispatch({ type: 'ADD_SOURCE', source: { id, name, bytes, numPages } });
  }, []);

  const clearAll = useCallback(() => {
    clearCache();
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      addFiles,
      replaceWorkspace,
      addGeneratedPdf,
      clearAll,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [state, addFiles, replaceWorkspace, addGeneratedPdf, clearAll, undo, redo, history.past.length, history.future.length],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePdfStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('usePdfStore must be used inside <PdfProvider>');
  return ctx;
}
