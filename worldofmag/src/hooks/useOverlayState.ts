"use client";

import { useEffect, useState } from "react";

// Wykrywa stan nakładek pełnoekranowych w aplikacji, żeby pływające przyciski
// (asystent AI „magiczna ikona" oraz admin „zgłoś błąd") mogły się odpowiednio
// zachować:
//   - magiczną ikonę chowamy, gdy otwarty jest modal treściowy (nie nakładamy
//     dialogu na dialog i nie rozpraszamy w skupionym zadaniu),
//   - przycisk admina wynosimy nad modal (by dało się wskazać element w modalu)
//     i chowamy, gdy otwarty jest sam asystent (żeby go nie zasłaniał).
//
// Modale w tej aplikacji nie ustawiają `role="dialog"` — dzielą wspólny wzorzec
// nakładki `fixed inset-0` z półprzezroczystym tłem. Detekcja opiera się więc na
// tych klasach. Nakładki, które NIE są „modalami treściowymi" (sam asystent,
// menu mobilne), oznaczamy `data-omnia-overlay` i wykluczamy z detekcji.

// Modal treściowy: pełnoekranowa nakładka, która nie jest oznaczona jako asystent/menu.
const CONTENT_MODAL_SELECTOR =
  '[class~="fixed"][class~="inset-0"]:not([data-omnia-overlay])';
const ASSISTANT_SELECTOR = '[data-omnia-overlay="assistant"]';

export interface OverlayState {
  /** Otwarty jest modal treściowy (formularz/dialog modułu, paleta poleceń itp.). */
  modalOpen: boolean;
  /** Otwarty jest sheet asystenta AI. */
  assistantOpen: boolean;
}

export function useOverlayState(): OverlayState {
  const [state, setState] = useState<OverlayState>({ modalOpen: false, assistantOpen: false });

  useEffect(() => {
    function compute() {
      setState((prev) => {
        const modalOpen = !!document.querySelector(CONTENT_MODAL_SELECTOR);
        const assistantOpen = !!document.querySelector(ASSISTANT_SELECTOR);
        if (prev.modalOpen === modalOpen && prev.assistantOpen === assistantOpen) return prev;
        return { modalOpen, assistantOpen };
      });
    }
    compute();
    // Modale montują/odmontowują się warunkowo → childList+subtree wyłapuje pojawienie/zniknięcie.
    const observer = new MutationObserver(compute);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return state;
}
