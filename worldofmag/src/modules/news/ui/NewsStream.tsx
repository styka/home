"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CheckCheck, Headphones, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { NewsItemCard } from "./NewsItemCard";
import { NewsReader, type ReaderBlock } from "./NewsReader";
import { SekcjaTematu } from "./sekcjeTematow";
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
 * 083: strumień przestał być TRYBEM, a stał się widokiem filtrowanym. „Wszystkie tematy" pokazuje
 * wszystkie sekcje, wybrany temat — jedną; to ta sama lista, więc przełącznik „Strumień / Jeden
 * temat" (044) zniknął jako drugi nośnik tej samej decyzji. Razem z nim wyszły stąd: obserwator
 * czytanego tematu, przewijanie do sekcji i skoki do sąsiada — należą do paska nawigacji, który
 * jest jeden dla wiadomości i dla linii czasu (`sekcjeTematow.tsx`).
 */

/** Poziom, na którym gra lektor. Union TS, nie enum (C-12). */
type ReaderScope =
  | { kind: "none" }
  | { kind: "topic"; topicId: string }
  | { kind: "stream" };

export function NewsStream({
  topics,
  loading,
  filtrAktywny,
  czytanyTemat,
  zarejestruj,
  onChanged,
  onPrzewinDoPozycji,
  akcjeTematu,
}: {
  /** Tematy JUŻ przefiltrowane przez pasek nawigacji — widok nie zna reguł filtrowania. */
  topics: StreamTopicDTO[];
  loading: boolean;
  /** Czy działa jakikolwiek filtr (temat albo portale) — zmienia treść komunikatu pustki. */
  filtrAktywny: boolean;
  czytanyTemat: string | null;
  zarejestruj: (id: string, el: HTMLElement | null) => void;
  /** Wołane po każdej zmianie stanu pozycji — odświeża liczniki tematów po stronie serwera. */
  onChanged: () => void;
  /** Przewinięcie do karty czytanej przez lektora — należy do ramy widoku, nie do tego komponentu. */
  onPrzewinDoPozycji: (itemId: string) => void;
  /** Akcje tematu (edycja, usunięcie) wstawiane do przyklejonego nagłówka sekcji. */
  akcjeTematu?: (topicId: string) => ReactNode;
}) {
  const t = useTranslations("modules.news.NewsStream");
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [reader, setReader] = useState<ReaderScope>({ kind: "none" });

  const totalItems = topics.reduce((n, t) => n + t.items.length, 0);

  // ── Lektor ────────────────────────────────────────────────────────────────
  const readerBlocks = useMemo<ReaderBlock[]>(() => {
    const toBlock = (i: NewsItemDTO): ReaderBlock => ({ title: i.title, text: i.summary });
    if (reader.kind === "topic") {
      const t = topics.find((x) => x.id === reader.topicId);
      return t ? t.items.map(toBlock) : [];
    }
    if (reader.kind === "stream") {
      const out: ReaderBlock[] = [];
      for (const t of topics) {
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
  }, [reader, topics]);

  /** Pozycje w tej samej kolejności co bloki lektora — po nich przewijamy do czytanej karty. */
  const readerItemIds = useMemo<string[]>(() => {
    if (reader.kind === "topic") {
      return topics.find((x) => x.id === reader.topicId)?.items.map((i) => i.id) ?? [];
    }
    if (reader.kind === "stream") return topics.flatMap((t) => t.items.map((i) => i.id));
    return [];
  }, [reader, topics]);

  const handleBlockChange = useCallback(
    (blockIndex: number) => {
      const id = readerItemIds[blockIndex];
      if (id) onPrzewinDoPozycji(id);
    },
    [readerItemIds, onPrzewinDoPozycji],
  );

  function toggleReader(next: ReaderScope) {
    // W danej chwili gra JEDEN lektor. Dwa głosy naraz to błąd, nie funkcja.
    setReader((prev) =>
      prev.kind === next.kind &&
      (prev.kind !== "topic" || (next.kind === "topic" && prev.topicId === next.topicId))
        ? { kind: "none" }
        : next,
    );
  }

  // ── Akcje zbiorcze ────────────────────────────────────────────────────────
  async function markTopic(topicId: string, title: string) {
    setBusyTopicId(topicId);
    try {
      const { count } = await acknowledgeTopicItems(topicId);
      showToast(
        count > 0 ? `Oznaczono jako przeczytane: ${count}` : `Temat „${title}" nie ma nowych pozycji`,
        count > 0 ? "success" : "info",
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
        {t("dodajPierwszyTematDo")}
      </div>
    );
  }

  return (
    <div>
      {/* Pasek strumienia: ile jest nowych + odsłuch całości + zamknięcie porcji. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          {totalItems === 0
            ? "Brak nowych wiadomości"
            : `Nowych wiadomości: ${totalItems} w ${topics.filter((t) => t.items.length > 0).length} tematach`}
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
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
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
          {filtrAktywny
            ? "Żadna z nowych wiadomości nie pasuje do wybranego filtra. Wyczyść wybór, żeby zobaczyć całą porcję."
            : "Brak nowych, istotnych wiadomości. Kliknij „Odśwież” w nagłówku, żeby pobrać najświeższe materiały (tylko z ostatnich 24 godzin)."}
        </p>
      )}

      <div className="space-y-6">
        {topics.map((topic) => (
          <SekcjaTematu
            key={topic.id}
            id={topic.id}
            tytul={topic.title}
            licznik={topic.items.length}
            czytana={topic.id === czytanyTemat}
            zarejestruj={zarejestruj}
            akcje={
              <>
                {topic.items.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleReader({ kind: "topic", topicId: topic.id })}
                      aria-pressed={reader.kind === "topic" && reader.topicId === topic.id}
                      title={t("sluchajCalegoTematu")}
                      aria-label={`Słuchaj tematu: ${topic.title}`}
                      className={cn(
                        "shrink-0 rounded-md p-2 transition-colors",
                        reader.kind === "topic" && reader.topicId === topic.id
                          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                      )}
                    >
                      <Headphones size={16} />
                    </button>
                    <button
                      onClick={() => markTopic(topic.id, topic.title)}
                      disabled={busyTopicId === topic.id}
                      title={t("oznaczCalyTematJako")}
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
                {akcjeTematu?.(topic.id)}
              </>
            }
          >
            {reader.kind === "topic" && reader.topicId === topic.id && readerBlocks.length > 0 && (
              <div className="mt-3" data-no-swipe>
                <NewsReader blocks={readerBlocks} onBlockChange={handleBlockChange} />
              </div>
            )}

            {topic.items.length === 0 ? (
              // Temat bez nowych pozycji ZOSTAJE na liście. Znikający temat wygląda jak usterka,
              // a pusta sekcja jest informacją: „tu nic nowego nie przyszło".
              <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                {t("brakNowychWiadomosciW")}
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
          </SekcjaTematu>
        ))}
      </div>
    </div>
  );
}
