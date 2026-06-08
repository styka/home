"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bug, X } from "lucide-react";
import { openAssistant } from "@/lib/ai/assistantBus";
import { FEEDBACK_START_EVENT } from "@/lib/ai/feedbackBus";
import { ensureOmniaProject } from "@/actions/taskProjects";
import { useOverlayState } from "@/hooks/useOverlayState";

// Tryb wskazywania (admin-only): admin włącza tryb, najeżdża/klika dowolny element
// UI, a my rozpoznajemy „miejsce" (route + obszar + element + tekst w pobliżu) i
// otwieramy asystenta z tym kontekstem, żeby z opisu admina utworzyć zadanie
// w projekcie „Omnia". Aktywacja: pływający przycisk (robaczek) lub Ctrl+Shift+B.

const FEEDBACK_UI_ATTR = "data-feedback-ui";

// Buduje czytelny (markdown) opis wskazanego miejsca dla kontekstu rozmowy.
function describeElement(el: HTMLElement, pathname: string): string {
  const lines: string[] = [];
  lines.push(`- **Ścieżka (route):** \`${pathname}\``);

  const area = el.closest<HTMLElement>("[data-omnia-area]");
  if (area?.dataset.omniaArea) lines.push(`- **Obszar:** ${area.dataset.omniaArea}`);

  // Najbliższy nagłówek sekcji — dobrze identyfikuje „dział/podstronę".
  const container = el.closest("section, main, article, form, [role='dialog']") ?? document.body;
  const heading = container.querySelector("h1, h2, h3")?.textContent?.trim();
  if (heading) lines.push(`- **Sekcja:** „${heading.replace(/\s+/g, " ").slice(0, 120)}"`);

  // Etykieta dostępności (przyciski/pola) — z elementu lub najbliższego przodka.
  const aria = el.getAttribute("aria-label") || el.closest("[aria-label]")?.getAttribute("aria-label") || el.getAttribute("title");
  if (aria) lines.push(`- **Etykieta:** ${aria.trim().slice(0, 120)}`);

  // Charakterystyka samego elementu (tag + id + kilka klas).
  const tag = el.tagName.toLowerCase();
  let sel = tag;
  if (el.id) sel += `#${el.id}`;
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 4).join(".") : "";
  if (cls) sel += `.${cls}`;
  lines.push(`- **Element:** \`<${sel}>\``);

  const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160);
  if (text) lines.push(`- **Tekst w pobliżu:** „${text}"`);

  lines.push(`- **Ścieżka DOM:** \`${domPath(el)}\``);
  return lines.join("\n");
}

// Krótka ścieżka po przodkach (do ~5 poziomów) — pomocna przy lokalizacji komponentu.
function domPath(el: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  for (let i = 0; node && i < 5 && node !== document.body; i++) {
    let p = node.tagName.toLowerCase();
    if (node.id) p += `#${node.id}`;
    else {
      const c = typeof node.className === "string" ? node.className.trim().split(/\s+/).filter(Boolean)[0] : "";
      if (c) p += `.${c}`;
    }
    parts.unshift(p);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

export function FeedbackInspector() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Pływający przycisk musi działać też NAD modalem (by wskazać element w modalu):
  // gdy modal jest otwarty, asystent chowa swój FAB, więc nasz wskakuje w jego
  // (główne) miejsce i nad modal. Przy otwartym asystencie chowamy się, by go nie zasłaniać.
  const { modalOpen, assistantOpen } = useOverlayState();

  const capture = useCallback(async (el: HTMLElement) => {
    const context = describeElement(el, pathname);
    setActive(false);
    setRect(null);
    try { await ensureOmniaProject(); } catch { /* projekt powstanie i tak przy wykonaniu akcji (fallback skrzynka) */ }
    openAssistant({ feedbackContext: context });
  }, [pathname]);

  // Dodatkowe wejścia (poza pływającym przyciskiem): skrót Ctrl/Cmd+Shift+B oraz
  // wpis w panelu admina (przez `feedbackBus`).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setActive((v) => !v);
      }
    }
    function onStart() { setActive(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener(FEEDBACK_START_EVENT, onStart);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(FEEDBACK_START_EVENT, onStart);
    };
  }, []);

  // Nasłuch na czas trwania trybu: podświetlenie najechanego elementu + przechwycenie kliknięcia.
  useEffect(() => {
    if (!active) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    function isUi(t: EventTarget | null): boolean {
      return t instanceof HTMLElement && !!t.closest(`[${FEEDBACK_UI_ATTR}]`);
    }
    function onMove(e: PointerEvent) {
      if (isUi(e.target)) { setRect(null); return; }
      const t = e.target as HTMLElement | null;
      setRect(t ? t.getBoundingClientRect() : null);
    }
    function onClick(e: MouseEvent) {
      if (isUi(e.target)) return; // klik w pasek/anuluj obsługujemy normalnie
      e.preventDefault();
      e.stopPropagation();
      if (e.target instanceof HTMLElement) void capture(e.target);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); setActive(false); setRect(null); }
    }
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.cursor = prevCursor;
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [active, capture]);

  return (
    <>
      {/* Pływający przycisk (admin-only — montaż za `isAdmin` w AppShell). Mały,
          nad asystentem AI, ale niżej w z-index (39 < 41), więc to asystent
          ewentualnie zasłania ten przycisk, nigdy odwrotnie; odstęp dobrany tak,
          by się nie nakładały. Gdy otwarty jest modal treściowy, asystent chowa
          swój FAB — nasz wskakuje w jego (główne) miejsce i NAD modal (wysoki
          z-index), żeby dało się wskazać element w modalu. Chowany w trybie
          aktywnym (sterujemy z paska) oraz gdy otwarty jest asystent. */}
      {!active && !assistantOpen && (
        <button
          {...{ [FEEDBACK_UI_ATTR]: "" }}
          onClick={() => setActive(true)}
          title="Zgłoś błąd / sugestię (wskaż element) — Ctrl+Shift+B"
          aria-label="Tryb zgłaszania błędu lub sugestii"
          className={
            modalOpen
              ? "fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6"
              : "fixed right-5 bottom-[calc(132px+env(safe-area-inset-bottom))] md:bottom-[84px]"
          }
          style={{ zIndex: modalOpen ? 10001 : 39, width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--accent-purple)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", cursor: "pointer" }}
        >
          <Bug size={20} />
        </button>
      )}

      {active && (
        <>
          {/* Podświetlenie najechanego elementu */}
          {rect && (
            <div
              style={{
                position: "fixed", pointerEvents: "none", zIndex: 9998,
                top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                border: "2px solid var(--accent-purple)", borderRadius: 4,
                background: "rgba(168,85,247,0.12)", transition: "all 60ms ease-out",
              }}
            />
          )}
          {/* Pasek instrukcji. Na mobile u dołu (nad paskiem zakładek), na desktopie u góry.
              Sam pasek jest „przezroczysty dla dotyku" (pointer-events: none), więc element
              pod nim da się normalnie wskazać/kliknąć — interaktywny jest tylko przycisk Anuluj. */}
          <div
            {...{ [FEEDBACK_UI_ATTR]: "" }}
            className="fixed left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 max-w-[calc(100vw-24px)] bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-auto md:top-[calc(12px+env(safe-area-inset-top))]"
            style={{ pointerEvents: "none", padding: "8px 14px", borderRadius: 999, background: "var(--bg-surface)", border: "1px solid var(--accent-purple)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
          >
            <Bug size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Wskaż element zgłoszenia</span>
            <button
              onClick={() => { setActive(false); setRect(null); }}
              title="Anuluj (Esc)"
              aria-label="Anuluj tryb zgłaszania"
              style={{ pointerEvents: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 9px", cursor: "pointer" }}
            >
              <X size={12} /> Anuluj
            </button>
          </div>
        </>
      )}
    </>
  );
}
