"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CheckCheck, Crosshair, Headphones, Loader2, Newspaper } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { NewsItemCard } from "./NewsItemCard";
import { NewsReader, type ReaderBlock } from "./NewsReader";
import { primeSpeech } from "@/lib/tts";
import { SekcjaTematu } from "./sekcjeTematow";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ViewEmpty } from "@/components/ui/view";
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
  | { kind: "item"; itemId: string }
  | { kind: "topic"; topicId: string }
  | { kind: "stream" };

/** Czy lektor czyta akurat coś z tego tematu — decyduje, czy pokazać przełącznik podążania. */
function czytaSieTuLektor(reader: ReaderScope, topicId: string): boolean {
  return reader.kind === "stream" || (reader.kind === "topic" && reader.topicId === topicId);
}

/**
 * Tożsamość zakresu jako klucz Reacta — przełączenie odsłuchu na inny temat PRZEMONTOWUJE lektora.
 *
 * To jest właśnie ten „nowy zestaw, więc czytaj od początku", który do recenzji robił autostart
 * przy każdej zmianie listy — w tym po oznaczeniu wiadomości jako przeczytanej. Klucz odróżnia
 * jedno od drugiego: inny zakres = nowy lektor, ta sama lista mniej jedna pozycja = ten sam.
 */
function kluczZakresu(r: ReaderScope): string {
  if (r.kind === "topic") return `topic:${r.topicId}`;
  if (r.kind === "item") return `item:${r.itemId}`;
  return r.kind;
}

/** Czy to ten sam zakres odsłuchu — powtórne dotknięcie tego samego przycisku ma go WYŁĄCZYĆ. */
function tenSamZakres(a: ReaderScope, b: ReaderScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "topic" && b.kind === "topic") return a.topicId === b.topicId;
  if (a.kind === "item" && b.kind === "item") return a.itemId === b.itemId;
  return true;
}

export function NewsStream({
  topics,
  loading,
  filtrAktywny,
  czytanyTemat,
  zarejestruj,
  onChanged,
  onPrzewinDoPozycji,
  podazanie,
  onPodazanie,
  onGra,
  wszystkieUkryte = false,
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
  /** 084 (AC-6): czy widok ma podążać za czytanym tekstem. Jeden stan na cały widok. */
  podazanie: boolean;
  onPodazanie: (wlaczone: boolean) => void;
  /** Czy lektor faktycznie czyta — rama widoku gasi podążanie tylko wtedy, gdy jest co gasić. */
  onGra?: (gra: boolean) => void;
  /** 085 (AC-16): lista jest pusta, bo ODSIALIŚMY puste tematy — a nie dlatego, że ich nie ma. */
  wszystkieUkryte?: boolean;
  /** Akcje tematu (edycja, usunięcie) wstawiane do przyklejonego nagłówka sekcji. */
  akcjeTematu?: (topicId: string) => ReactNode;
}) {
  const t = useTranslations("modules.news.NewsStream");
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [reader, setReader] = useState<ReaderScope>({ kind: "none" });
  /**
   * 084 (AC-5): co lektor czyta W TEJ CHWILI — treść zdania i pozycja, do której należy.
   *
   * Trzymamy to tutaj, bo podświetlić trzeba KARTĘ, a lektor jest jeden na cały widok. Przekazanie
   * indeksu zamiast treści wymagałoby, żeby karta i lektor utrzymywały zgodne listy zdań — a one
   * i tak dzielą ten sam podział, więc porównanie tekstu jest tańsze i odporniejsze.
   */
  const [czytaneZdanie, setCzytaneZdanie] = useState<string | null>(null);
  const [czytanaPozycja, setCzytanaPozycja] = useState<string | null>(null);

  const totalItems = topics.reduce((n, t) => n + t.items.length, 0);

  // ── Lektor ────────────────────────────────────────────────────────────────
  const readerBlocks = useMemo<ReaderBlock[]>(() => {
    const toBlock = (i: NewsItemDTO): ReaderBlock => ({ title: i.title, text: i.summary });

    /**
     * 084 (AC-9): ZAPOWIEDŹ ŹRÓDŁA, ale bez powtarzania.
     *
     * Słuchacz nie widzi ekranu, więc musi wiedzieć, skąd pochodzi wiadomość — ale słysząc pięć
     * razy pod rząd „Onet", przestaje słyszeć cokolwiek. Zapowiadamy więc tylko przy ZMIANIE
     * portalu. Ten sam mechanizm co zapowiedź tematu (`lead`), a nie drugi obok niego.
     */
    const zZapowiedziami = (pozycje: NewsItemDTO[], temat?: string): ReaderBlock[] => {
      let poprzednieZrodlo: string | null = null;
      return pozycje.map((item, idx) => {
        const b = toBlock(item);
        const zapowiedzi: string[] = [];
        if (idx === 0 && temat) zapowiedzi.push(`Temat: ${temat}`);
        if (item.sourceName && item.sourceName !== poprzednieZrodlo) zapowiedzi.push(`Źródło: ${item.sourceName}`);
        poprzednieZrodlo = item.sourceName ?? poprzednieZrodlo;
        if (zapowiedzi.length > 0) b.lead = zapowiedzi.join(". ");
        return b;
      });
    };

    if (reader.kind === "item") {
      const item = topics.flatMap((t) => t.items).find((i) => i.id === reader.itemId);
      return item ? zZapowiedziami([item]) : [];
    }
    if (reader.kind === "topic") {
      const t = topics.find((x) => x.id === reader.topicId);
      return t ? zZapowiedziami(t.items) : [];
    }
    if (reader.kind === "stream") {
      const out: ReaderBlock[] = [];
      for (const t of topics) out.push(...zZapowiedziami(t.items, t.title));
      return out;
    }
    return [];
  }, [reader, topics]);

  /** Pozycje w tej samej kolejności co bloki lektora — po nich przewijamy do czytanej karty. */
  const readerItemIds = useMemo<string[]>(() => {
    if (reader.kind === "item") return [reader.itemId];
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
    // 084: odblokowanie dźwięku MUSI paść tutaj — w obsłudze dotknięcia. Lektor startuje z efektu
    // po zamontowaniu, czyli już poza gestem, a iOS pozwala grać tylko elementowi odblokowanemu
    // w geście użytkownika.
    if (next.kind !== "none") primeSpeech();
    // W danej chwili gra JEDEN lektor. Dwa głosy naraz to błąd, nie funkcja.
    setCzytaneZdanie(null);
    setCzytanaPozycja(null);
    setReader((prev) => (tenSamZakres(prev, next) ? { kind: "none" } : next));
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
    /**
     * Potwierdzenie, bo akcja jest masowa i z poziomu ekranu nieodwracalna (AC-B16).
     *
     * 087 (AC-13): okno ma też TREŚĆ. Do 087 miało wyłącznie tytuł, więc pytało „czy na pewno" bez
     * powiedzenia, co się właściwie stanie — a właściciel zgłosił dokładnie to („dialog ma tytuł ale
     * nie ma contentu"). Opis mówi, ile pozycji zniknie z listy i że nic nie ginie; okno zostaje
     * NEUTRALNE (C-34), bo oznaczenie jako przeczytane niczego nie usuwa.
     */
    const potwierdzone = await confirmDialog({
      title: t("oznaczycWszystkieTytul"),
      description: t("oznaczycWszystkieOpis", { liczba: totalItems }),
    });
    if (!potwierdzone) return;
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

  /**
   * 085 (AC-16): dwa różne powody pustej listy, dwa różne komunikaty.
   *
   * „Nie masz jeszcze tematów" i „wszystkie tematy są dziś puste, bo ukrywamy puste" to nie jest to
   * samo zdanie. Do 085 istniał tylko pierwszy, więc po włączeniu ukrywania użytkownik z pełną listą
   * tematów zobaczyłby zachętę do dodania pierwszego — czyli komunikat wprost nieprawdziwy.
   * Używamy wspólnego `ViewEmpty`, a nie własnego pudełka: stan pusty ma wyglądać tak samo w całej
   * aplikacji (C-33), a rama widoku nie może tu przyjąć `state="empty"`, bo schowałaby zakładki
   * modułu — czyli jedyną drogę do ustawień, którymi te tematy się odsłania.
   */
  if (topics.length === 0) {
    return wszystkieUkryte ? (
      <ViewEmpty
        icon={<Newspaper size={20} />}
        title={t("wszystkieTematyPuste")}
        description={t("wszystkieTematyPusteOpis")}
      />
    ) : (
      <ViewEmpty title={t("dodajPierwszyTematDo")} />
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
        {/* 084 (AC-10): dwie akcje o CAŁKIEM różnych skutkach przestają wyglądać jak bliźniaki.
            Do 083 stały obok siebie jako dwa przyciski tekstowe tej samej wagi — a jeden zaczyna
            odsłuch, drugi masowo zamyka porcję. Odsłuch dostaje wagę główną (obramowanie akcentem),
            oznaczanie zostaje przyciskiem tekstowym, a między nimi stoi separator. */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => toggleReader({ kind: "stream" })}
            disabled={totalItems === 0}
            aria-pressed={reader.kind === "stream"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors disabled:opacity-40",
              reader.kind === "stream"
                ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            <Headphones size={14} />
            {reader.kind === "stream" ? "Zamknij lektora" : "Słuchaj wszystkiego"}
          </button>
          <span aria-hidden className="h-5 w-px shrink-0 bg-[var(--border)]" />
          <button
            onClick={markAll}
            disabled={busyAll || totalItems === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            {busyAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Oznacz wszystkie
          </button>
        </div>
      </div>

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
                    {/* 084 (AC-6): PODĄŻANIE ZA CZYTANIEM stoi przy wiadomościach, a nie tylko
                        w pasku lektora — bo to tutaj użytkownik patrzy, gdy czyta, i tutaj
                        zauważa, że widok sam mu ucieka. Jeden stan, dwa wejścia. */}
                    {czytaSieTuLektor(reader, topic.id) && (
                      <button
                        onClick={() => onPodazanie(!podazanie)}
                        aria-pressed={podazanie}
                        title={podazanie ? t("wylaczPodazanie") : t("wlaczPodazanie")}
                        aria-label={podazanie ? t("wylaczPodazanie") : t("wlaczPodazanie")}
                        className={cn(
                          "shrink-0 rounded-md p-2 transition-colors",
                          podazanie
                            ? "bg-[var(--bg-elevated)] text-[var(--accent-blue)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                        )}
                      >
                        <Crosshair size={16} />
                      </button>
                    )}
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
                    <NewsItemCard
                      item={item}
                      onChanged={onChanged}
                      czytaneZdanie={czytanaPozycja === item.id ? czytaneZdanie : null}
                      czytana={reader.kind === "item" && reader.itemId === item.id}
                      onSluchaj={(id) => toggleReader({ kind: "item", itemId: id })}
                    />
                  </div>
                ))}
              </div>
            )}
          </SekcjaTematu>
        ))}
      </div>

      {/* 084 (AC-4): JEDEN pasek lektora na cały widok, przyklejony do dołu ramy.
          Do 083 lektor renderował się w trzech miejscach naraz (nad listą, w sekcji tematu,
          w karcie) i każdy z nich niósł własną kopię treści. Teraz jest jeden i steruje wszystkim,
          niezależnie od tego, czy słuchasz pojedynczej wiadomości, tematu, czy całej porcji. */}
      {/* Zapas na wysokość przyklejonego paska — bez niego ostatnie wiadomości chowają się pod nim
          i nie da się ich doczytać ani oznaczyć. */}
      {reader.kind !== "none" && <div aria-hidden style={{ height: 72 }} />}

      {reader.kind !== "none" && readerBlocks.length > 0 && (
        <div data-no-swipe>
          <NewsReader
            key={kluczZakresu(reader)}
            blocks={readerBlocks}
            onBlockChange={handleBlockChange}
            onCzytaneZdanie={(zdanie, blockIndex) => {
              setCzytaneZdanie(zdanie);
              setCzytanaPozycja(blockIndex == null ? null : readerItemIds[blockIndex] ?? null);
            }}
            onZamknij={() => toggleReader({ kind: "none" })}
            podazanie={podazanie}
            onPodazanie={onPodazanie}
            onGra={onGra}
            autoStart
          />
        </div>
      )}
    </div>
  );
}
