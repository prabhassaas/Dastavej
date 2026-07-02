'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import {
  uid,
  type AddedText,
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
      return {
        ...state,
        pages,
        edits,
        currentPage: clampPage(state.currentPage, pages.length),
      };
    }
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
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

interface StoreValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
  /** Parse and add PDF files to the workspace (appends pages = local merge). */
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** Replace the whole workspace with a single new PDF (e.g. compressed output). */
  replaceWorkspace: (name: string, bytes: Uint8Array) => Promise<void>;
  clearAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function PdfProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

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

  const clearAll = useCallback(() => {
    clearCache();
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, addFiles, replaceWorkspace, clearAll }),
    [state, addFiles, replaceWorkspace, clearAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePdfStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('usePdfStore must be used inside <PdfProvider>');
  return ctx;
}
