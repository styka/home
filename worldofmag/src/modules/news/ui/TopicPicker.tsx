"use client";

import { useTranslations } from "next-intl";
// 041: wybór tematu jako rozwijana lista zamiast poziomego paska zakładek.
//
// Historia tego miejsca to trzecie podejście. Kolumna (do 039) zabierała jedną trzecią szerokości i
// i tak ucinała nazwy. Poziomy pasek (040) pokazywał nazwę w całości, ale tylko dla kilku pierwszych
// tematów — reszta chowała się za przewijaniem, o którym z ekranu nic nie mówiło. Rozwijana lista
// odwraca kompromis: w spoczynku zajmuje JEDEN wiersz, a po otwarciu pokazuje WSZYSTKIE tematy,
// każdy z pełną nazwą, bo lista rośnie w dół, a nie w bok.
//
// Świadomie nie ma tu wariantów `hidden md:*` — ten sam mechanizm działa na telefonie i na
// desktopie (C-31, AC-25). Rozwijana lista jest jedną z niewielu kontrolek, które skalują się w obie
// strony bez osobnego wariantu: na wąskim ekranie zajmuje pełną szerokość, na szerokim stoi w
// kolumnie o rozsądnej maksymalnej szerokości.
//
// 082: POZIOMY PASEK TEMATÓW WRACA — ale nie jako następca listy, tylko obok niej.
//
// Zgłoszenie właściciela: „tematy scrolowały się na boki w tym przypiętym temacie". To jest ten sam
// pomysł, który przegrał w 041, więc trzeba powiedzieć wprost, co się zmieniło: pasek przegrał
// dlatego, że BYŁ JEDYNĄ drogą — mieścił kilka pierwszych tematów, a o reszcie z ekranu nic nie
// mówiło. Wada nie leżała w przewijaniu, tylko w tym, że nie było czym go zastąpić.
//
// Teraz pasek jest SKRÓTEM: pokazuje sąsiednie tematy (czyli odpowiada na to, czego brakowało —
// widać, że są inne) i sam dosuwa aktywny do widoku. Pełna lista z wyszukiwarką i pełnymi nazwami
// zostaje pod przyciskiem obok. Trzy drogi wyboru — chip, strzałka, lista — wołają JEDNO `onSelect`,
// więc nie mogą się rozjechać (ta sama zasada, dla której 080 dołożyło strzałki).
//
// Gdyby ktoś kiedyś chciał „posprzątać" jedną z dwóch dróg: usunięcie listy odtwarza usterkę z 040,
// usunięcie paska odtwarza zgłoszenie z 082. Obie są potrzebne.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TopicDTO } from "../actions/news";

export function TopicPicker({
  topics,
  selectedId,
  onSelect,
}: {
  topics: TopicDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("modules.news.TopicPicker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const aktywnyChipRef = useRef<HTMLButtonElement>(null);

  const selected = topics.find((t) => t.id === selectedId) ?? null;

  // Wyszukiwanie po tytule ORAZ po filtrze semantycznym: użytkownik często pamięta, o co temat
  // pytał („zarzuty prokuratorskie"), a nie jak go nazwał.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.semanticFilter.toLowerCase().includes(q)
    );
  }, [topics, query]);

  // Po otwarciu kursor ląduje w wyszukiwarce — przy dwudziestu tematach szukanie jest częstsze niż
  // przewijanie, a na telefonie to jedno dotknięcie mniej.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  /**
   * 082: aktywny temat sam wjeżdża w widoczny obszar paska.
   *
   * Efekt wisi na `selectedId`, a nie na obsłudze kliknięcia w chip — dzięki temu działa tak samo
   * dla wszystkich trzech dróg zmiany tematu (chip, strzałka, wybór z listy) oraz dla gestu
   * w `NewsStream`. Gdyby siedział w `pick`, wybór strzałką przesuwałby zaznaczenie poza ekran.
   *
   * `inline: "center"` zamiast `"nearest"`: przy wyborze strzałką „nearest" dosuwa chip dokładnie
   * do krawędzi, więc sąsiedni temat — to, co ten pasek ma pokazywać — zostaje poza kadrem.
   */
  useEffect(() => {
    aktywnyChipRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  // Zamknięcie: `Esc` (C-31) i kliknięcie poza listą. Bez tego drugiego lista zostawałaby otwarta po
  // przejściu wzrokiem do treści, zasłaniając pierwsze wiadomości.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  function pick(id: string) {
    onSelect(id);
    setOpen(false);
  }

  /**
   * 080 (Z12): WIDOCZNE przełączanie tematów.
   *
   * Zgłoszenie właściciela miało dwie części i ta jest ważniejsza od progu gestu: „użytkownik
   * nawet nie podejrzewa, że może zmieniać tematy, bo jak nie wie o tym geście, to może się nie
   * domyśleć". Gest zostaje jako skrót, ale przestaje być jedyną drogą — strzałki wołają tę samą
   * funkcję wyboru, więc obie drogi mają jedną implementację i nie mogą się rozjechać.
   *
   * Strzałki pokazują się dopiero przy DWÓCH tematach: przy jednym byłyby dwoma wyłączonymi
   * przyciskami, czyli szumem w miejscu, w którym walczymy o miejsce.
   */
  const indeks = selected ? topics.findIndex((x) => x.id === selected.id) : -1;
  const mogeWstecz = indeks > 0;
  const mogeDalej = indeks >= 0 && indeks < topics.length - 1;

  function skok(kierunek: -1 | 1) {
    const cel = topics[indeks + kierunek];
    if (cel) onSelect(cel.id);
  }

  const strzalka =
    "flex shrink-0 items-center justify-center rounded-md border border-[var(--border)] px-1.5 py-3 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-1 items-center gap-1">
      {topics.length > 1 && (
        <button
          type="button"
          onClick={() => skok(-1)}
          disabled={!mogeWstecz}
          aria-label={t("poprzedniTemat")}
          title={t("poprzedniTemat")}
          className={strzalka}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {/* 082: przewijany poziomo pasek tematów. `min-w-0` przy `flex-1` jest tu warunkiem
          działania, a nie ozdobą: bez niego kontener przyjąłby szerokość swojej zawartości
          i rozepchnął stronę w bok zamiast się przewijać — dokładnie usterka z 040. */}
      <div
        className="omnia-pasek-tematow flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        role="tablist"
        aria-label={t("pasekTematow")}
      >
        {topics.length === 0 ? (
          <span className="px-3 py-3 text-sm text-[var(--text-muted)]">{t("brakTematow")}</span>
        ) : (
          topics.map((x) => {
            const aktywny = x.id === selectedId;
            return (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={aktywny}
                ref={aktywny ? aktywnyChipRef : undefined}
                onClick={() => onSelect(x.id)}
                className={cn(
                  // `py-3` = cel dotyku na telefonie (C-31); `whitespace-nowrap` — chip ma wyjechać
                  // poza kadr, a nie złamać się na dwie linie i rozepchnąć pasek w pionie.
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-3 text-sm transition-colors",
                  aktywny
                    ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                )}
              >
                {/* `max-w-[14rem]` + `truncate`: bardzo długi tytuł nie może zająć całego paska,
                    bo wtedy sąsiednich tematów znów nie widać. Pełna nazwa jest w liście obok. */}
                <span className="max-w-[14rem] truncate">{x.title}</span>
                {x.pendingCount > 0 && (
                  <span className="shrink-0 rounded-full bg-[var(--accent-blue)] px-1.5 text-[10px] font-medium text-[var(--on-accent)]">
                    {x.pendingCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Wyzwalacz pełnej listy. Do 082 zajmował całą szerokość paska — teraz oddaje ją chipom,
          bo nazwa aktywnego tematu jest już widoczna na własnym chipie. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("wszystkieTematy")}
        title={t("wszystkieTematy")}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border px-1.5 py-3 transition-colors",
          open
            ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
        )}
      >
        <ChevronDown
          size={16}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Tematy do monitorowania"
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size={14} className="shrink-0 text-[var(--text-muted)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj tematu…"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Lista przewija się WE WŁASNYM kontenerze i tylko pionowo — poziomo nie ma czego
              przewijać, bo nazwy łamią się na kolejne linie zamiast wyjeżdżać poza ekran. */}
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--text-muted)]">
                {topics.length === 0
                  ? "Nie masz jeszcze żadnego tematu."
                  : "Żaden temat nie pasuje do wyszukiwania."}
              </p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={t.id === selectedId}
                  onClick={() => pick(t.id)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-3 text-left text-sm transition-colors",
                    t.id === selectedId
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {/* Bez `truncate` — pełna nazwa jest sednem tej zmiany (AC-23). Długi tytuł łamie
                      się na kolejne linie, bo pionowo mamy miejsca do woli. */}
                  <span className="min-w-0 flex-1 break-words">{t.title}</span>
                  {t.pendingCount > 0 && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-[var(--accent-blue)] px-1.5 text-[10px] font-medium text-[var(--on-accent)]">
                      {t.pendingCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {topics.length > 1 && (
        <button
          type="button"
          onClick={() => skok(1)}
          disabled={!mogeDalej}
          aria-label={t("nastepnyTemat")}
          title={t("nastepnyTemat")}
          className={strzalka}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
