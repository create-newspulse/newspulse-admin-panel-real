import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

// BrowserRouter does not expose the data-router useBlocker API.
export function useUnsavedChanges(dirty: boolean, saving = false) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const state = useRef({ dirty, saving });
  state.current = { dirty, saving };
  const historyIndex = useRef<number | null>(null);

  useLayoutEffect(() => {
    const index: unknown = window.history.state?.idx;
    historyIndex.current = typeof index === 'number' ? index : null;
  }, [location.key]);

  useEffect(() => {
    const canLeave = () => {
      if (state.current.saving) {
        toast.error('A save is in progress. Wait for its result before leaving.');
        return false;
      }
      return !state.current.dirty || window.confirm('You have unsaved changes. Leave this page?');
    };
    const push = navigator.push;
    const replace = navigator.replace;
    const go = navigator.go;
    let approvedPop: { index: number; expires: number } | null = null;
    let restoringIndex: number | null = null;
    navigator.push = (...args) => { if (canLeave()) push.apply(navigator, args); };
    navigator.replace = (...args) => { if (canLeave()) replace.apply(navigator, args); };
    navigator.go = (delta) => {
      if (!canLeave()) return;
      approvedPop = historyIndex.current === null ? null : { index: historyIndex.current + delta, expires: Date.now() + 1000 };
      go.call(navigator, delta);
    };
    const onPopState = (event: PopStateEvent) => {
      const nextIndex: unknown = event.state?.idx;
      if (restoringIndex !== null) {
        event.stopImmediatePropagation();
        if (nextIndex === restoringIndex) restoringIndex = null;
        return;
      }
      const approved = approvedPop;
      approvedPop = null;
      if (approved && nextIndex === approved.index && Date.now() <= approved.expires) {
        return;
      }
      if (typeof nextIndex !== 'number' || historyIndex.current === null) return;
      if (canLeave()) {
        historyIndex.current = nextIndex;
        return;
      }
      // Stop Router's listener before it unmounts the editor, then restore the URL.
      event.stopImmediatePropagation();
      restoringIndex = historyIndex.current;
      window.history.go(restoringIndex - nextIndex);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty && !state.current.saving) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('popstate', onPopState, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      navigator.push = push;
      navigator.replace = replace;
      navigator.go = go;
      window.removeEventListener('popstate', onPopState, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [navigator]);
}
