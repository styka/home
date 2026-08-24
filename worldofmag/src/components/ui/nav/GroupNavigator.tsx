"use client";

/**
 * 083 — WSPÓLNY nawigator po grupach elementów.
 *
 * Powstał z modułu Wiadomości (tematy → wiadomości), ale świadomie **nie wie nic o wiadomościach**:
 * dostaje listę grup i wywołania zwrotne. Właściciel poprosił wprost, żeby zrobić z tego komponent
 * do użycia w innym kontekście — a wzorzec „zbiór grup, w każdej lista elementów, czytane jednym
 * przewijaniem" powtarza się w Omnii (notatki w grupach, zadania w projektach, przepisy w książkach).
 *
 * Jedna droga do zmiany: lista z wyszukiwarką. 084 skasowało dwie pozostałe — strzałki
 * „poprzednia/następna" i pozycję zbiorczą („Wszystkie") — bo po zmianie znaczenia listy (SKOK,
 * nie filtr) żadna nie miała konsumenta, a martwe API w komponencie współdzielonym jest gorsze niż
 * jego brak: następny moduł bierze je za rekomendowaną drogę. Sąsiada liczy `sasiadujacaGrupa`,
 * której konsument używa tam, gdzie sam chce (w Wiadomościach: gest w bok na telefonie).
 *
 * Czego tu NIE MA i dlaczego: **nazwy grupy aktualnie czytanej**. Wyzwalacz pokazuje WYBRANY FILTR,
 * a nie to, co akurat mijasz przewijając. To rozróżnienie jest sednem zgłoszenia właściciela po 082
 * („podwójnie mamy bieżący temat, ten jako input i ten ładny") — nazwa czytanej grupy należy do jej
 * przyklejonego nagłówka, bo to on stoi przy jej treści.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface GrupaNawigatora {
  id: string;
  etykieta: string;
  /** Np. liczba nieprzeczytanych. Pominięte = bez odznaki. */
  licznik?: number;
  /** Dodatkowy tekst do wyszukiwania (opis, filtr) — użytkownik częściej pamięta treść niż nazwę. */
  szukajTakze?: string;
}

/**
 * Sąsiad w kolejności — `null`, gdy nie ma dokąd iść.
 *
 * Nieznany identyfikator liczymy jak „przed pierwszym", więc „dalej" z nieistniejącego wyboru
 * ląduje na pierwszej pozycji zamiast nic nie robić. Milczące nic to najgorsza odpowiedź na
 * dotknięcie strzałki: użytkownik nie wie, czy trafił w przycisk, czy lista się skończyła.
 */
export function sasiadujacaGrupa(
  kolejnosc: string[],
  aktywna: string | null,
  kierunek: -1 | 1,
): string | null {
  const teraz = aktywna ? kolejnosc.indexOf(aktywna) : -1;
  const cel = kolejnosc[teraz + kierunek];
  return cel ?? null;
}

export function GroupNavigator({
  grupy,
  aktywnaId,
  onWybor,
  etykietaStala,
  akcje,
}: {
  grupy: GrupaNawigatora[];
  /** Identyfikator grupy, którą wyzwalacz ma pokazywać jako aktywną. */
  aktywnaId: string;
  onWybor: (id: string) => void;
  /**
   * Stała etykieta wyzwalacza zamiast nazwy aktywnej grupy.
   *
   * Dla konsumentów, u których lista jest SKOKIEM, a nie filtrem: nazwa grupy, w której akurat
   * jesteś, należy wtedy do jej własnego nagłówka, a powtórzenie jej w pasku jest duplikatem.
   * Pominięta — wyzwalacz pokazuje nazwę aktywnej grupy, jak dotąd.
   */
  etykietaStala?: string;
  /** Kontrolki po prawej (filtry, akcje zbiorcze). */
  akcje?: React.ReactNode;
}) {
  const t = useTranslations("components.ui.GroupNavigator");
  const [otwarta, setOtwarta] = useState(false);
  const [fraza, setFraza] = useState("");
  const korzenRef = useRef<HTMLDivElement>(null);
  const szukajRef = useRef<HTMLInputElement>(null);

  const aktywna = grupy.find((g) => g.id === aktywnaId) ?? grupy[0] ?? null;

  const widoczne = useMemo(() => {
    const q = fraza.trim().toLowerCase();
    if (!q) return grupy;
    return grupy.filter(
      (g) => g.etykieta.toLowerCase().includes(q) || (g.szukajTakze ?? "").toLowerCase().includes(q),
    );
  }, [grupy, fraza]);

  // Kursor ląduje w wyszukiwarce: przy kilkunastu grupach szukanie jest częstsze niż przewijanie,
  // a na telefonie to jedno dotknięcie mniej.
  useEffect(() => {
    if (otwarta) szukajRef.current?.focus();
    else setFraza("");
  }, [otwarta]);

  useEffect(() => {
    if (!otwarta) return;
    function naKlawisz(e: KeyboardEvent) {
      if (e.key === "Escape") setOtwarta(false);
    }
    function naKlik(e: MouseEvent) {
      if (korzenRef.current && !korzenRef.current.contains(e.target as Node)) setOtwarta(false);
    }
    document.addEventListener("keydown", naKlawisz);
    document.addEventListener("mousedown", naKlik);
    return () => {
      document.removeEventListener("keydown", naKlawisz);
      document.removeEventListener("mousedown", naKlik);
    };
  }, [otwarta]);

  return (
    // 084 (AC-18): `flex-1 min-w-0` — wyzwalacz ma BRAĆ dostępną szerokość, a nie zajmować tyle,
    // ile mierzy jego treść. Bez tego przy wąskim ekranie kurczył się do skrawka („nie widać
    // wybranej wartości"), a jednocześnie rozpychał pasek, gdy nazwa była długa.
    <div ref={korzenRef} className="relative flex min-w-0 flex-1 items-center gap-1">
      <button
        type="button"
        onClick={() => setOtwarta((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={otwarta}
        className={cn(
          // `py-3` = cel dotyku na telefonie (C-31); `min-w-0` + `truncate` — długa nazwa ma się
          // przyciąć, a nie rozepchnąć paska w bok (usterka z 040).
          "flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-3 text-left text-sm transition-colors",
          otwarta
            ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {etykietaStala ?? (aktywna ? aktywna.etykieta : t("brakGrup"))}
        </span>
        {aktywna?.licznik ? (
          <span className="shrink-0 rounded-full bg-[var(--accent-blue)] px-1.5 text-[10px] font-medium text-[var(--on-accent)]">
            {aktywna.licznik}
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-[var(--text-muted)] transition-transform", otwarta && "rotate-180")}
        />
      </button>

      {akcje}

      {otwarta && (
        <div
          role="listbox"
          aria-label={t("listaGrup")}
          className="absolute left-0 top-full z-40 mt-1 w-full min-w-[16rem] max-w-[28rem] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size={14} className="shrink-0 text-[var(--text-muted)]" />
            <input
              ref={szukajRef}
              value={fraza}
              onChange={(e) => setFraza(e.target.value)}
              placeholder={t("szukaj")}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Lista przewija się WE WŁASNYM kontenerze i tylko pionowo — nazwy łamią się na kolejne
              linie zamiast wyjeżdżać poza ekran, więc poziomo nie ma czego przewijać. */}
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {widoczne.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--text-muted)]">{t("nicNiePasuje")}</p>
            ) : (
              widoczne.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="option"
                  aria-selected={g.id === aktywnaId}
                  onClick={() => {
                    onWybor(g.id);
                    setOtwarta(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-3 text-left text-sm transition-colors",
                    g.id === aktywnaId
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {/* Bez `truncate` — w liście jest miejsce w pionie, więc pokazujemy pełną nazwę. */}
                  <span className="min-w-0 flex-1 break-words">{g.etykieta}</span>
                  {g.licznik ? (
                    <span className="mt-0.5 shrink-0 rounded-full bg-[var(--accent-blue)] px-1.5 text-[10px] font-medium text-[var(--on-accent)]">
                      {g.licznik}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
