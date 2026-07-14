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

      // Always-active shortcuts. Każdy handler jest opcjonalny — gdy go nie ma,
      // klawisz NIE jest blokowany (przechodzi do innych listenerów / domyślnej
      // akcji), więc nie „połykamy" np. Ctrl+K, gdy moduł nie ma własnej palety.
      if (e.key === "Escape") {
        handlers.onEscape?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        // Zawsze return: Ctrl+K nie może wpaść w case "k" (= nawigacja w górę).
        if (handlers.onCommandPalette) {
          e.preventDefault();
          handlers.onCommandPalette();
        }
        return;
      }

      // Blocked while typing
      if (typing) return;

      switch (e.key) {
        case "a":
        case "n":
          if (handlers.onQuickAdd) { e.preventDefault(); handlers.onQuickAdd(); }
          break;
        case "j":
        case "ArrowDown":
          if (handlers.onNavigateDown) { e.preventDefault(); handlers.onNavigateDown(); }
          break;
        case "k":
        case "ArrowUp":
          if (handlers.onNavigateUp) { e.preventDefault(); handlers.onNavigateUp(); }
          break;
        case " ":
        case "x":
          if (handlers.onToggleStatus) { e.preventDefault(); handlers.onToggleStatus(); }
          break;
        case "d":
        case "Delete":
        case "Backspace":
          // Backspace poza polem tekstowym (typing już odsiane wyżej) = usuń.
          if (handlers.onDelete) { e.preventDefault(); handlers.onDelete(); }
          break;
        case "e":
          if (handlers.onEdit) { e.preventDefault(); handlers.onEdit(); }
          break;
        case "Enter": {
          // Enter = „otwórz" zogniskowany element listy nawigacyjnej. Nie przejmuj,
          // gdy fokus jest na realnej kontrolce (przycisk/link/select) — niech zadziała natywnie.
          const ae = document.activeElement;
          const aeTag = ae?.tagName.toLowerCase();
          const interactive = aeTag === "button" || aeTag === "a" || aeTag === "select" || ae?.getAttribute("role") === "button";
          if (handlers.onEnter && !interactive) { e.preventDefault(); handlers.onEnter(); }
          break;
        }
        case "/":
        case "f":
          if (handlers.onSearch) { e.preventDefault(); handlers.onSearch(); }
          break;
        case "1": handlers.onFilterTab?.(0); break;
        case "2": handlers.onFilterTab?.(1); break;
        case "3": handlers.onFilterTab?.(2); break;
        case "4": handlers.onFilterTab?.(3); break;
        case "5": handlers.onFilterTab?.(4); break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
