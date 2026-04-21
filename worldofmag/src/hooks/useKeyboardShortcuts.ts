import { useEffect } from "react";
import type { ShortcutHandlers } from "@/types";

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    el.getAttribute("contenteditable") === "true"
  );
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(document.activeElement);

      // Always-active shortcuts
      if (e.key === "Escape") {
        handlers.onEscape();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        handlers.onCommandPalette();
        return;
      }

      // Blocked while typing
      if (typing) return;

      switch (e.key) {
        case "a":
        case "n":
          e.preventDefault();
          handlers.onQuickAdd();
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          handlers.onNavigateDown();
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          handlers.onNavigateUp();
          break;
        case " ":
        case "x":
          e.preventDefault();
          handlers.onToggleStatus();
          break;
        case "d":
        case "Delete":
        case "Backspace":
          if (e.key !== "Backspace" || !typing) {
            e.preventDefault();
            handlers.onDelete();
          }
          break;
        case "e":
          e.preventDefault();
          handlers.onEdit();
          break;
        case "/":
        case "f":
          e.preventDefault();
          handlers.onSearch();
          break;
        case "1": handlers.onFilterTab(0); break;
        case "2": handlers.onFilterTab(1); break;
        case "3": handlers.onFilterTab(2); break;
        case "4": handlers.onFilterTab(3); break;
        case "5": handlers.onFilterTab(4); break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
