/**
 * useEditorState — useReducer-backed YAML editor state with undo/redo.
 *
 * Why useReducer instead of useState?
 * - Undo/redo requires tracking past/future stacks.
 * - All mutations become explicit named actions, making logic auditable.
 * - Keyboard shortcuts dispatch the same actions as UI buttons.
 */
'use client';

import { useCallback, useEffect, useReducer } from 'react';

const MAX_HISTORY = 50;

type EditorState = {
  past: string[];
  present: string;
  future: string[];
};

type EditorAction =
  | { type: 'SET_YAML'; payload: string; skipHistory?: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_YAML': {
      if (action.payload === state.present) return state;

      if (action.skipHistory) {
        return { past: state.past, present: action.payload, future: [] };
      }

      const past = [...state.past, state.present].slice(-MAX_HISTORY);
      return { past, present: action.payload, future: [] };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

export type UseEditorStateReturn = {
  yamlText: string;
  canUndo: boolean;
  canRedo: boolean;
  setYaml: (next: string) => void;
  setYamlSkipHistory: (next: string) => void;
  undo: () => void;
  redo: () => void;
};

export function useEditorState(initialValue: string): UseEditorStateReturn {
  const [state, dispatch] = useReducer(editorReducer, {
    past: [],
    present: initialValue,
    future: [],
  });

  // Sync when the initial value changes (e.g. localStorage restore).
  useEffect(() => {
    dispatch({ type: 'SET_YAML', payload: initialValue, skipHistory: true });
  }, [initialValue]);

  // Keyboard shortcuts: Ctrl+Z (undo) and Ctrl+Shift+Z / Ctrl+Y (redo).
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const isCtrl = event.ctrlKey || event.metaKey;
      if (!isCtrl) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: 'UNDO' });
      } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const setYaml = useCallback((next: string) => {
    dispatch({ type: 'SET_YAML', payload: next });
  }, []);

  const setYamlSkipHistory = useCallback((next: string) => {
    dispatch({ type: 'SET_YAML', payload: next, skipHistory: true });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return {
    yamlText: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setYaml,
    setYamlSkipHistory,
    undo,
    redo,
  };
}
