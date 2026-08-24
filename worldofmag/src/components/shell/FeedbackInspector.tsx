"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bug, X } from "lucide-react";
import { useTrybAdmina } from "@/platform/admin/trybAdmina";
import { openAssistant } from "@/platform/ai/assistantBus";
import { FEEDBACK_START_EVENT } from "@/platform/ai/feedbackBus";
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

// 088: ZRZUT WSKAZANEGO ELEMENTU.
//
// Opis miejsca (route + sekcja + selektor + tekst w pobliżu) mówi, GDZIE coś jest; nie mówi, jak to
// wygląda. Administrator odtwarzał usterkę z opisu — zrzut oszczędza mu tę pracę.
//
// Trzy reguły, każda wynika z tego, że zrzut jest DODATKIEM, a nie warunkiem zgłoszenia:
//   • biblioteka ładowana LENIWIE i tylko tutaj — to narzędzie administratora, nie może dokładać
//     bajtów do żadnej trasy zwykłego użytkownika (budżet `check:perf`);
//   • limit czasu — rasteryzacja potrafi utknąć na obrazie z innej domeny; zawieszony tryb
//     wskazywania byłby gorszy od braku zrzutu;
//   • degradacja PNG → JPEG → brak zrzutu — zamiast odrzucać za duży obraz, najpierw próbujemy
//     go zmniejszyć; dopiero potem rezygnujemy, po cichu.
const MAX_ZRZUT_ZNAKOW = 1_500_000;
const LIMIT_CZASU_MS = 4000;

async function zrzutElementu(el: HTMLElement): Promise<string | undefined> {
  try {
    const praca = (async () => {
      const { toPng, toJpeg } = await import("html-to-image");
      // Element bywa przezroczysty (sam w sobie nie ma tła) — bez podkładu zrzut wygląda jak
      // uszkodzony plik. Bierzemy tło ze zmiennej motywu, więc zrzut pasuje do aktywnej skórki.
      const backgroundColor =
        getComputedStyle(document.documentElement).getPropertyValue("--bg-base").trim() || undefined;
      const opcje = { backgroundColor, cacheBust: true, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) };

      const png = await toPng(el, opcje);
      if (png.length <= MAX_ZRZUT_ZNAKOW) return png;

      const jpeg = await toJpeg(el, { ...opcje, pixelRatio: 1, quality: 0.8 });
      return jpeg.length <= MAX_ZRZUT_ZNAKOW ? jpeg : undefined;
    })();

    const limit = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), LIMIT_CZASU_MS));
    return await Promise.race([praca, limit]);
  } catch {
    // Świadomie cicho: zgłoszenie ma powstać także wtedy, gdy elementu nie da się narysować.
    return undefined;
  }
}

export function FeedbackInspector() {
  // 085 (AC-8): narzędzie administratora — widoczne tylko przy włączonym trybie administratora.
  const { wlaczony: trybAdmina } = useTrybAdmina();
  const t = useTranslations("components.shell.FeedbackInspector");
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Pływający przycisk musi działać też NAD modalem (by wskazać element w modalu):
  // gdy modal jest otwarty, asystent chowa swój FAB, więc nasz wskakuje w jego
  // (główne) miejsce i nad modal. Przy otwartym asystencie chowamy się, by go nie zasłaniać.
  const { modalOpen, assistantOpen, panelOpen } = useOverlayState();

  const capture = useCallback(async (el: HTMLElement) => {
    const context = describeElement(el, pathname);
    setActive(false);
    // 088: podświetlenie znika PRZED zrzutem — inaczej na obrazie zostałaby nasza własna ramka
    // wskaźnika i zgłoszenie pokazywałoby narzędzie zamiast usterki. `setRect(null)` jest tu
    // pierwszym krokiem, a nie porządkiem po wszystkim.
    setRect(null);
    const shot = await zrzutElementu(el);
    // 031: nie tworzymy tu żadnego projektu — skrzynkę zgłoszeń wyznacza serwer
    // (`submitFeedbackTask`), więc zgłoszenie trafia do administratora niezależnie od
    // uprawnień zgłaszającego.
    openAssistant({ feedbackContext: context, feedbackShot: shot });
  }, [pathname]);

  /**
   * Dodatkowe wejścia (poza pływającym przyciskiem): skrót Ctrl/Cmd+Shift+B oraz wpis w panelu
   * admina (przez `feedbackBus`).
   *
   * 085 (AC-8): przy wyłączonym trybie administratora nie nasłuchujemy w ogóle. Ukrycie samego
   * przycisku nie wystarczy — narzędzie, które zniknęło z ekranu, a nadal daje się odpalić
   * klawiszami, wygląda dla oglądającego stronę „oczami użytkownika" jak usterka, a nie jak
   * funkcja administratora.
   */
  useEffect(() => {
    if (!trybAdmina) return;
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
  }, [trybAdmina]);

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

  // Przy wyłączonym trybie nie ma ani przycisku, ani podświetleń — strona wygląda dokładnie tak,
  // jak widzi ją zwykły użytkownik. Hooki wyżej zostają wywołane bezwarunkowo (reguły Reacta).
  if (!trybAdmina) return null;

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
          title={t("zglosBladSugestieWskaz")}
          aria-label={t("trybZglaszaniaBleduLub")}
          className={
            modalOpen
              ? "fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6"
              : "fixed right-5 bottom-[calc(132px+env(safe-area-inset-bottom))] md:bottom-[84px]"
          }
          // Nad panelem roboczym (mobilny podgląd zadania, z-50) wynosimy przycisk nad panel
          // (54 < FAB asystenta 55 < toasty 60), zachowując pozycję „nad-modalową" gdy modalOpen.
          style={{ zIndex: modalOpen ? 10001 : (panelOpen ? 54 : 39), width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--accent-purple)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", cursor: "pointer" }}
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
            <span style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("wskazElementZgloszenia")}</span>
            <button
              onClick={() => { setActive(false); setRect(null); }}
              title="Anuluj (Esc)"
              aria-label={t("anulujTrybZglaszania")}
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
