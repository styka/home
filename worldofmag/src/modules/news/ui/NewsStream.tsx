"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Headphones, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { NewsItemCard } from "./NewsItemCard";
import { NewsReader, type ReaderBlock } from "./NewsReader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  acknowledgeAllItems,
  acknowledgeTopicItems,
  type NewsItemDTO,
  type StreamTopicDTO,
} from "../actions/news";

/**
 * 044: ciągły strumień nowych wiadomości ze WSZYSTKICH tematów.
 *
 * Zgłoszenie właściciela: „z wiadomości na mobile korzysta się niewygodnie… wyobrażam to sobie tak,
 * że po odświeżeniu danych będę miał możliwość łatwego przeczytania wszystkich nowych wiadomości,
 * tylko scrollując, ale jednocześnie dobrze wiedząc, z jakiego tematu są wiadomości".
 *
 * Do 043 moduł pokazywał JEDEN temat naraz, więc przejrzenie porcji oznaczało ręczne przełączanie
 * tematu i czekanie na wczytanie za każdym razem. Tutaj wszystko jest już wczytane (jeden odczyt
 * `getStreamView`), a nawigacja działa w obie strony:
 *  - przewijanie → aktywny temat podąża za tym, co widać (obserwator przecięć),
 *  - wybór tematu → strona przewija się do jego sekcji (bez przeładowania widoku).
 *
 * Dwukierunkowość jest tu największą pułapką: skok zmienia przewijanie, a przewijanie zmienia
 * wskazanie tematu, więc bez strażnika `programmaticUntil` wybór „uciekałby" w trakcie animacji.
 */

/** Poziom, na którym gra lektor. Union TS, nie enum (C-12). */
type ReaderScope =
  | { kind: "none" }
  | { kind: "topic"; topicId: string }
  | { kind: "stream" };

/** Ile milisekund po skoku ignorujemy obserwatora — tyle mniej więcej trwa płynne przewinięcie. */
const PROGRAMMATIC_SCROLL_MS = 700;
/** Gest w bok liczy się od tylu pikseli i musi być tyle razy bardziej poziomy niż pionowy. */
const SWIPE_MIN_PX = 60;
const SWIPE_DOMINANCE = 1.5;

export function NewsStream({
  topics,
  loading,
  sourceFilter,
  activeTopicId,
  onActiveTopicChange,
  onChanged,
  registerScrollToTopic,
}: {
  topics: StreamTopicDTO[];
  loading: boolean;
  /** Klucz źródła albo „all" — filtr jest ustawieniem użytkownika, więc działa na cały strumień. */
  sourceFilter: string;
  activeTopicId: string | null;
  onActiveTopicChange: (topicId: string) => void;
  /** Wołane po każdej zmianie stanu pozycji — odświeża liczniki tematów po stronie serwera. */
  onChanged: () => void;
  /** Udostępnia rodzicowi funkcję „przewiń do tematu", żeby selektor tematu mógł jej użyć. */
  registerScrollToTopic: (fn: (topicId: string) => void) => void;
}) {
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const programmaticUntil = useRef(0);
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [reader, setReader] = useState<ReaderScope>({ kind: "none" });

  const visible = useMemo(
    () =>
      topics.map((t) => ({
        ...t,
        items: t.items.filter((i) => sourceFilter === "all" || i.sourceKey === sourceFilter),
      })),
    [topics, sourceFilter]
  );

  const totalItems = visible.reduce((n, t) => n + t.items.length, 0);
  const topicOrder = visible.map((t) => t.id);

  // ── Nawigacja: wybór tematu → przewinięcie ────────────────────────────────
  const scrollToTopic = useCallback((topicId: string) => {
    const el = sectionRefs.current.get(topicId);
    if (!el) return;
    // Strażnik MUSI być ustawiony przed przewinięciem: w trakcie płynnej animacji obserwator
    // zobaczy po drodze każdą mijaną sekcję i bez tego przestawiałby wybór na przypadkową.
    programmaticUntil.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    registerScrollToTopic(scrollToTopic);
  }, [registerScrollToTopic, scrollToTopic]);

  // ── Nawigacja: przewijanie → wybór tematu ─────────────────────────────────
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < programmaticUntil.current) return;
        // Bierzemy sekcję najwyżej na ekranie spośród widocznych — to ta, której nagłówek jest
        // aktualnie przyklejony u góry, więc wskazanie zgadza się z tym, co użytkownik widzi.
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = top?.target.getAttribute("data-topic-id");
        if (id) onActiveTopicChange(id);
      },
      // Górna krawędź przycięta pod przyklejony nagłówek; dolna mocno, żeby „widoczna" znaczyła
      // „w górnej części ekranu", a nie „gdziekolwiek na dole".
      { rootMargin: "-64px 0px -55% 0px", threshold: 0 }
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // Przeliczamy obserwatora, gdy zmieni się zestaw sekcji.
  }, [onActiveTopicChange, topicOrder.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gest w bok: skok do sąsiedniego tematu ────────────────────────────────
  const touchStart = useRef<{ x: number; y: number; interactive: boolean } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    // Gest zaczęty na przycisku/linku/polu to nie jest nawigacja po tematach — to próba użycia
    // tego elementu. Przechwycenie takiego ruchu odbierałoby możliwość np. przewinięcia lektora.
    const interactive = !!(e.target as HTMLElement).closest?.(
      "button, a, input, textarea, select, [role='button'], [data-no-swipe]"
    );
    touchStart.current = { x: t.clientX, y: t.clientY, interactive };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.interactive) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Świadomie NIE wołamy `preventDefault` w `touchmove`: przewijanie w pionie ma zostać w 100%
    // natywne. Rozstrzygamy dopiero po zakończeniu gestu, na podstawie jego kształtu.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return;
    const from = activeTopicId ? topicOrder.indexOf(activeTopicId) : 0;
    if (from < 0) return;
    const next = dx < 0 ? from + 1 : from - 1;
    if (next < 0 || next >= topicOrder.length) return;
    onActiveTopicChange(topicOrder[next]);
    scrollToTopic(topicOrder[next]);
  }

  // ── Lektor ────────────────────────────────────────────────────────────────
  const readerBlocks = useMemo<ReaderBlock[]>(() => {
    const toBlock = (i: NewsItemDTO): ReaderBlock => ({ title: i.title, text: i.summary });
    if (reader.kind === "topic") {
      const t = visible.find((x) => x.id === reader.topicId);
      return t ? t.items.map(toBlock) : [];
    }
    if (reader.kind === "stream") {
      const out: ReaderBlock[] = [];
      for (const t of visible) {
        t.items.forEach((item, idx) => {
          const b = toBlock(item);
          // Zapowiedź tematu na PIERWSZEJ wiadomości każdego tematu — słuchacz nie widzi ekranu,
          // więc bez niej nie wiedziałby, że właśnie zmienił się temat.
          if (idx === 0) b.lead = `Temat: ${t.title}`;
          out.push(b);
        });
      }
      return out;
    }
    return [];
  }, [reader, visible]);

  /** Pozycje w tej samej kolejności co bloki lektora — po nich przewijamy do czytanej karty. */
  const readerItemIds = useMemo<string[]>(() => {
    if (reader.kind === "topic") {
      return visible.find((x) => x.id === reader.topicId)?.items.map((i) => i.id) ?? [];
    }
    if (reader.kind === "stream") return visible.flatMap((t) => t.items.map((i) => i.id));
    return [];
  }, [reader, visible]);

  const handleBlockChange = useCallback(
    (blockIndex: number) => {
      const id = readerItemIds[blockIndex];
      if (!id) return;
      const el = document.querySelector<HTMLElement>(`[data-news-item="${id}"]`);
      if (!el) return;
      programmaticUntil.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [readerItemIds]
  );

  function toggleReader(next: ReaderScope) {
    // W danej chwili gra JEDEN lektor. Dwa głosy naraz to błąd, nie funkcja.
    setReader((prev) =>
      prev.kind === next.kind &&
      (prev.kind !== "topic" || (next.kind === "topic" && prev.topicId === next.topicId))
        ? { kind: "none" }
        : next
    );
  }

  // ── Akcje zbiorcze ────────────────────────────────────────────────────────
  async function markTopic(topicId: string, title: string) {
    setBusyTopicId(topicId);
    try {
      const { count } = await acknowledgeTopicItems(topicId);
      showToast(
        count > 0 ? `Oznaczono jako przeczytane: ${count}` : `Temat „${title}" nie ma nowych pozycji`,
        count > 0 ? "success" : "info"
      );
      if (reader.kind === "topic" && reader.topicId === topicId) setReader({ kind: "none" });
      onChanged();
    } catch (e: any) {
      showToast(e.message ?? "Nie udało się oznaczyć tematu", "error");
    } finally {
      setBusyTopicId(null);
    }
  }

  async function markAll() {
    // Potwierdzenie, bo akcja jest masowa i z poziomu ekranu nieodwracalna (AC-B16).
    if (!(await confirmDialog(`Oznaczyć wszystkie nowe wiadomości (${totalItems}) jako przeczytane?`))) return;
    setBusyAll(true);
    try {
      const { count } = await acknowledgeAllItems();
      showToast(`Oznaczono jako przeczytane: ${count}`, "success");
      setReader({ kind: "none" });
      onChanged();
    } catch (e: any) {
      showToast(e.message ?? "Nie udało się oznaczyć wiadomości", "error");
    } finally {
      setBusyAll(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-[var(--text-muted)]">
        Dodaj pierwszy temat do monitorowania albo zajrzyj w „Gorące tematy”.
      </div>
    );
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Pasek strumienia: ile jest nowych + odsłuch całości + zamknięcie porcji. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          {totalItems === 0
            ? "Brak nowych wiadomości"
            : `Nowych wiadomości: ${totalItems} w ${visible.filter((t) => t.items.length > 0).length} tematach`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => toggleReader({ kind: "stream" })}
            disabled={totalItems === 0}
            aria-pressed={reader.kind === "stream"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs transition-colors disabled:opacity-40",
              reader.kind === "stream"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
          >
            <Headphones size={14} />
            {reader.kind === "stream" ? "Zamknij lektora" : "Słuchaj wszystkiego"}
          </button>
          <button
            onClick={markAll}
            disabled={busyAll || totalItems === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            {busyAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Oznacz wszystkie
          </button>
        </div>
      </div>

      {reader.kind === "stream" && readerBlocks.length > 0 && (
        <div className="mb-4" data-no-swipe>
          <NewsReader blocks={readerBlocks} onBlockChange={handleBlockChange} />
        </div>
      )}

      {totalItems === 0 && (
        <p className="mb-4 rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          {sourceFilter === "all"
            ? "Brak nowych, istotnych wiadomości. Kliknij „Odśwież” w nagłówku, żeby pobrać najświeższe materiały (tylko z ostatnich 24 godzin)."
            : "Żadne z nowych wiadomości nie pochodzi z tego portalu. Wróć do „Wszystkie”, żeby zobaczyć całą porcję."}
        </p>
      )}

      <div className="space-y-6">
        {visible.map((topic) => (
          <section
            key={topic.id}
            data-topic-id={topic.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(topic.id, el);
              else sectionRefs.current.delete(topic.id);
            }}
            // `scroll-mt` odsuwa cel przewijania spod przyklejonego nagłówka — bez tego skok
            // zatrzymywałby się dokładnie pod nim i pierwszy wiersz byłby zasłonięty.
            className="scroll-mt-2"
          >
            {/* Nagłówek tematu przyklejony u góry: właściciel ma „dobrze wiedzieć, z jakiego tematu
                są wiadomości" przez CAŁY czas przewijania, nie tylko na granicy sekcji. */}
            <div
              className={cn(
                "sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-base)] px-1 py-2",
                topic.id === activeTopicId && "border-[var(--accent-blue)]"
              )}
            >
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                {topic.title}
              </h3>
              <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                {topic.items.length}
              </span>
              {topic.items.length > 0 && (
                <>
                  <button
                    onClick={() => toggleReader({ kind: "topic", topicId: topic.id })}
                    aria-pressed={reader.kind === "topic" && reader.topicId === topic.id}
                    title="Słuchaj całego tematu"
                    aria-label={`Słuchaj tematu: ${topic.title}`}
                    className={cn(
                      "shrink-0 rounded-md p-2 transition-colors",
                      reader.kind === "topic" && reader.topicId === topic.id
                        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <Headphones size={16} />
                  </button>
                  <button
                    onClick={() => markTopic(topic.id, topic.title)}
                    disabled={busyTopicId === topic.id}
                    title="Oznacz cały temat jako przeczytany"
                    aria-label={`Oznacz temat jako przeczytany: ${topic.title}`}
                    className="shrink-0 rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-green)] disabled:opacity-40"
                  >
                    {busyTopicId === topic.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCheck size={16} />
                    )}
                  </button>
                </>
              )}
            </div>

            {reader.kind === "topic" && reader.topicId === topic.id && readerBlocks.length > 0 && (
              <div className="mt-3" data-no-swipe>
                <NewsReader blocks={readerBlocks} onBlockChange={handleBlockChange} />
              </div>
            )}

            {topic.items.length === 0 ? (
              // Temat bez nowych pozycji ZOSTAJE na liście. Znikający temat wygląda jak usterka,
              // a pusta sekcja jest informacją: „tu nic nowego nie przyszło".
              <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                Brak nowych wiadomości w tym temacie.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {topic.items.map((item) => (
                  <div key={item.id} data-news-item={item.id}>
                    <NewsItemCard item={item} onChanged={onChanged} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Skok do sąsiedniego tematu również dotknięciem — gest w bok jest SKRÓTEM, a nie jedyną
          drogą (na desktopie i przy obsłudze klawiaturą nie ma go wcale). */}
      {topicOrder.length > 1 && (
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <StepTopicButton
            direction="prev"
            topicOrder={topicOrder}
            activeTopicId={activeTopicId}
            onGo={(id) => {
              onActiveTopicChange(id);
              scrollToTopic(id);
            }}
            titleOf={(id) => visible.find((t) => t.id === id)?.title ?? ""}
          />
          <StepTopicButton
            direction="next"
            topicOrder={topicOrder}
            activeTopicId={activeTopicId}
            onGo={(id) => {
              onActiveTopicChange(id);
              scrollToTopic(id);
            }}
            titleOf={(id) => visible.find((t) => t.id === id)?.title ?? ""}
          />
        </div>
      )}
    </div>
  );
}

function StepTopicButton({
  direction,
  topicOrder,
  activeTopicId,
  onGo,
  titleOf,
}: {
  direction: "prev" | "next";
  topicOrder: string[];
  activeTopicId: string | null;
  onGo: (topicId: string) => void;
  titleOf: (topicId: string) => string;
}) {
  const from = activeTopicId ? topicOrder.indexOf(activeTopicId) : 0;
  const target = topicOrder[direction === "next" ? from + 1 : from - 1];
  const disabled = from < 0 || !target;

  return (
    <button
      onClick={() => target && onGo(target)}
      disabled={disabled}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-md px-3 py-3 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40",
        direction === "next" && "ml-auto"
      )}
    >
      {direction === "prev" && <ChevronLeft size={14} className="shrink-0" />}
      <span className="min-w-0 truncate">
        {disabled ? (direction === "prev" ? "Pierwszy temat" : "Ostatni temat") : titleOf(target)}
      </span>
      {direction === "next" && <ChevronRight size={14} className="shrink-0" />}
    </button>
  );
}
