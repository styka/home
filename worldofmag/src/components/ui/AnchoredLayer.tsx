"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  obliczPozycje,
  type PreferowanaStrona,
  type Wyrownanie,
} from "@/components/ui/anchoredPosition";

/**
 * 080 (Z7, Z2): JEDNA warstwa przyklejona do elementu — dla wszystkich okienek, które otwierają się
 * przy przycisku i mają leżeć nad treścią.
 *
 * Po co wspólny komponent, skoro każde z tych miejsc „działało":
 *
 *  - Każde liczyło pozycję po swojemu i **żadne nie sprawdzało pionu**. `AiCostBadge` miał zaszyte
 *    `bottom: calc(100% + 6px)` — zawsze w górę — więc przy przycisku blisko górnej krawędzi panel
 *    wychodził ponad ekran. To jest zgłoszenie właściciela z /wiadomosci.
 *  - `position: absolute` daje się przyciąć każdemu przodkowi z `overflow: hidden` i jest zależne
 *    od bloku zawierającego. Portal do `body` wyklucza OBIE te przyczyny naraz — dlatego naprawa
 *    nie zależy od tego, który wariant akurat zadziałał w danym miejscu.
 *  - Zamykanie klawiszem Esc, kliknięciem poza obszarem i zwrot ogniskowania były pisane od nowa
 *    w każdym miejscu (albo pomijane). Teraz są raz.
 *
 * Warstwa: 9995. Świadomie **powyżej** modali (50) i okna asystenta (9990) — okienko otwarte
 * wewnątrz nich musi być widoczne — i **poniżej** trybu wskazywania elementu (9998/9999), który
 * z definicji ma być nad wszystkim (patrz `doświadczenia.md`, 2026-06-08).
 */
const WARSTWA = 9995;

export interface AnchoredLayerProps {
  /** Element, przy którym otwiera się panel. */
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  /** Preferowana strona; przy braku miejsca komponent odbija się na drugą. */
  side?: PreferowanaStrona;
  align?: Wyrownanie;
  /** Szerokość panelu. Domyślnie własna szerokość treści, ograniczona do okna. */
  width?: number | string;
  /** `role` warstwy — „menu" dla list akcji, „dialog" dla treści. */
  role?: "menu" | "dialog" | "listbox";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function AnchoredLayer({
  anchorRef,
  open,
  onClose,
  side = "dol",
  align = "start",
  width,
  role = "dialog",
  ariaLabel,
  className,
  style,
  children,
}: AnchoredLayerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pozycja, setPozycja] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [zamontowany, setZamontowany] = useState(false);

  // Portal wymaga `document`, którego przy renderze na serwerze nie ma. Montujemy po hydratacji —
  // to nie jest opóźnienie widoczne dla użytkownika, bo panel i tak otwiera dopiero kliknięcie.
  useEffect(() => setZamontowany(true), []);

  const przelicz = useCallback(() => {
    const kotwica = anchorRef.current;
    const panel = panelRef.current;
    if (!kotwica || !panel) return;
    const r = kotwica.getBoundingClientRect();
    setPozycja(
      obliczPozycje({
        wyzwalacz: { top: r.top, left: r.left, width: r.width, height: r.height },
        panel: { width: panel.offsetWidth, height: panel.offsetHeight },
        okno: { width: window.innerWidth, height: window.innerHeight },
        strona: side,
        wyrownanie: align,
      })
    );
  }, [anchorRef, side, align]);

  // `useLayoutEffect`, nie `useEffect`: pozycję trzeba znać PRZED malowaniem, inaczej panel mignie
  // w lewym górnym rogu, zanim trafi na miejsce.
  useLayoutEffect(() => {
    if (!open) {
      setPozycja(null);
      return;
    }
    przelicz();
  }, [open, przelicz, children]);

  useEffect(() => {
    if (!open) return;
    // `capture` przy przewijaniu: zdarzenie łapiemy też z zagnieżdżonych kontenerów, a moduły
    // Omnii przewijają treść WEWNĄTRZ ramy widoku, nie oknem.
    const przeliczenie = () => przelicz();
    window.addEventListener("resize", przeliczenie);
    window.addEventListener("scroll", przeliczenie, true);
    return () => {
      window.removeEventListener("resize", przeliczenie);
      window.removeEventListener("scroll", przeliczenie, true);
    };
  }, [open, przelicz]);

  // Esc i kliknięcie poza obszarem. Wcześniej każde miejsce robiło to po swojemu — albo wcale.
  useEffect(() => {
    if (!open) return;
    const kotwica = anchorRef.current;

    function naKlawisz(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      // Ognisko wraca na wyzwalacz: bez tego zamknięcie klawiaturą gubi miejsce w formularzu.
      kotwica?.focus?.();
    }
    function naWskaznik(e: PointerEvent) {
      const cel = e.target as Node | null;
      if (!cel) return;
      if (panelRef.current?.contains(cel)) return;
      // Kliknięcie w sam wyzwalacz zostawiamy jemu — inaczej zamknęlibyśmy panel tutaj,
      // a jego `onClick` natychmiast otworzyłby go z powrotem.
      if (kotwica?.contains(cel)) return;
      onClose();
    }

    document.addEventListener("keydown", naKlawisz, true);
    document.addEventListener("pointerdown", naWskaznik, true);
    return () => {
      document.removeEventListener("keydown", naKlawisz, true);
      document.removeEventListener("pointerdown", naWskaznik, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !zamontowany || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      className={className}
      style={{
        position: "fixed",
        zIndex: WARSTWA,
        top: pozycja?.top ?? 0,
        left: pozycja?.left ?? 0,
        // Do pierwszego pomiaru panel jest niewidoczny, ale ZAJMUJE miejsce — inaczej nie dałoby
        // się go zmierzyć. `visibility` zamiast `display: none` właśnie z tego powodu.
        visibility: pozycja ? "visible" : "hidden",
        width: typeof width === "number" ? `${width}px` : width,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: pozycja?.maxHeight,
        overflowY: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
