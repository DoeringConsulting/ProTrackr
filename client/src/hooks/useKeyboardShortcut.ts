import { useEffect } from "react";

interface KeyboardShortcutOptions {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  onKeyDown: () => void;
}

export function useKeyboardShortcut({
  key,
  ctrl = false,
  meta = false,
  shift = false,
  alt = false,
  onKeyDown,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesCtrl = ctrl ? event.ctrlKey : !event.ctrlKey;
      const matchesMeta = meta ? event.metaKey : !event.metaKey;
      const matchesShift = shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = alt ? event.altKey : !event.altKey;

      // Ctrl+K or Cmd+K (Mac)
      const isSearchShortcut = 
        (event.ctrlKey || event.metaKey) && 
        event.key.toLowerCase() === "k" &&
        !event.shiftKey &&
        !event.altKey;

      if (isSearchShortcut || (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt)) {
        event.preventDefault();
        onKeyDown();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, ctrl, meta, shift, alt, onKeyDown]);
}
