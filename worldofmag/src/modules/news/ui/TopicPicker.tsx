"use client";

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

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          // `py-3` = cel dotyku na telefonie (C-31). Pełna szerokość, bo to główna nawigacja widoku.
          "flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left text-sm transition-colors",
          open
            ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        )}
      >
        {/* `min-w-0` przy `flex-1`: bez tego długa nazwa ustawiłaby minimalną szerokość przycisku i
            rozepchnęła stronę w bok — dokładnie ta usterka, którą naprawialiśmy w 040. */}
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.title : topics.length === 0 ? "Brak tematów" : "Wybierz temat"}
        </span>
        {selected && selected.pendingCount > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--accent-blue)] px-1.5 text-[10px] font-medium text-[var(--on-accent)]">
            {selected.pendingCount}
          </span>
        )}
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-[var(--text-muted)] transition-transform", open && "rotate-180")}
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
    </div>
  );
}
