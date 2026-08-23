"use client";

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * 083: JEDEN sposób rysowania i przewijania sekcji tematu — wspólny dla wiadomości i dla linii czasu.
 *
 * Zgłoszenie właściciela: „linia czasu nie działa przy wszystkich tematach i nie widać, który wpis
 * do którego tematu należy" oraz „zadbaj o spójność wszystkich 3 zakładek". Wcześniej sekcje z
 * przyklejonym nagłówkiem umiał rysować wyłącznie strumień wiadomości, a oś czasu była gołą listą
 * jednego tematu. Dwie kopie tego układu rozjechałyby się przy pierwszej zmianie nagłówka — stąd
 * wspólny komponent zamiast skopiowanego bloku JSX.
 */

/** Ile milisekund po skoku ignorujemy obserwatora — tyle mniej więcej trwa płynne przewinięcie. */
export const PROGRAMOWE_PRZEWIJANIE_MS = 700;

/**
 * Przewinięcie do sekcji tematu — liczone RĘCZNIE na ramie widoku.
 *
 * Świadomie **nie** `scrollIntoView`: jego zasięgiem jest cały łańcuch przewijalnych przodków, więc
 * potrafi przesunąć coś zupełnie innego niż zamierzone (lekcja z 082 — pasek tematów cofał stronę
 * o 4719 px przy każdej zmianie tematu). Tutaj dotykamy jednego elementu: ramy widoku.
 */
export function przewinDoSekcji(
  rama: HTMLElement | null,
  cel: HTMLElement | null,
  zaslonaGory: number,
  plynnie = true,
) {
  if (!cel) return;
  if (!rama) return;
  const gora =
    cel.getBoundingClientRect().top - rama.getBoundingClientRect().top + rama.scrollTop - zaslonaGory - 8;
  rama.scrollTo({ top: Math.max(0, gora), behavior: plynnie ? "smooth" : "auto" });
}

/**
 * Rejestr sekcji + obserwator „która sekcja jest teraz czytana".
 *
 * Strażnik `programoweDo` jest tu konieczny, a nie ostrożnościowy: skok zmienia przewijanie, a
 * przewijanie zmienia wskazanie tematu, więc bez niego obserwator zobaczyłby po drodze każdą mijaną
 * sekcję i przestawił wskazanie na przypadkową.
 */
export function useSekcjeTematow({
  ramaRef,
  zaslonaGory,
  kolejnosc,
  onCzytana,
}: {
  ramaRef: RefObject<HTMLDivElement>;
  /** Ile pikseli u góry zasłania przyklejony pasek nawigacji. */
  zaslonaGory: number;
  /** Identyfikatory sekcji w kolejności renderowania — obserwator przelicza się przy zmianie. */
  kolejnosc: string[];
  onCzytana: (topicId: string) => void;
}) {
  const sekcje = useRef(new Map<string, HTMLElement>());
  const programoweDo = useRef(0);

  const zarejestruj = useCallback((id: string, el: HTMLElement | null) => {
    if (el) sekcje.current.set(id, el);
    else sekcje.current.delete(id);
  }, []);

  const przewinDo = useCallback(
    (id: string, plynnie = true) => {
      // Strażnik MUSI stanąć PRZED przewinięciem — w trakcie animacji obserwator dostaje przecięcia
      // wszystkich mijanych sekcji.
      programoweDo.current = Date.now() + PROGRAMOWE_PRZEWIJANIE_MS;
      przewinDoSekcji(ramaRef.current, sekcje.current.get(id) ?? null, zaslonaGory, plynnie);
    },
    [ramaRef, zaslonaGory],
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const obserwator = new IntersectionObserver(
      (wpisy) => {
        if (Date.now() < programoweDo.current) return;
        // Bierzemy sekcję najwyżej na ekranie spośród widocznych — to ta, której nagłówek jest
        // aktualnie przyklejony u góry, więc wskazanie zgadza się z tym, co użytkownik widzi.
        const gorna = wpisy
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = gorna?.target.getAttribute("data-topic-id");
        if (id) onCzytana(id);
      },
      // Górna krawędź przycięta pod OBA przyklejone paski — nawigację modułu (`zaslonaGory`)
      // i nagłówek sekcji (64 px).
      { rootMargin: `-${zaslonaGory + 64}px 0px -55% 0px`, threshold: 0 },
    );
    sekcje.current.forEach((el) => obserwator.observe(el));
    return () => obserwator.disconnect();
    // Przeliczamy obserwatora, gdy zmieni się zestaw sekcji.
  }, [onCzytana, zaslonaGory, kolejnosc.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { zarejestruj, przewinDo, programoweDo };
}

/**
 * Sekcja jednego tematu z PRZYKLEJONYM nagłówkiem.
 *
 * Nagłówek niesie nazwę tematu przez cały czas przewijania — i to on, a nie pasek nawigacji, jest
 * miejscem na nazwę tematu CZYTANEGO. Rozdział jest sednem zgłoszenia po 082 („podwójnie mamy
 * bieżący temat"): pasek pokazuje WYBRANY FILTR, nagłówek — to, co akurat mijasz.
 */
export function NaglowekSekcji({
  tytul,
  licznik,
  wyrozniony,
  akcje,
}: {
  tytul: string;
  /** Pominięty = bez odznaki (sekcja, której nic się nie liczy, np. ustawienie). */
  licznik?: number;
  wyrozniony?: boolean;
  akcje?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky z-20 -mx-1 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-base)] px-1 py-2",
        wyrozniony && "border-[var(--accent-blue)]",
      )}
      // Nagłówek sekcji zatrzymuje się POD paskiem nawigacji, a nie na krawędzi ramy — inaczej
      // oba przyklejone paski rysowałyby się jeden na drugim.
      style={{ top: "var(--news-pasek-h, 0px)" }}
    >
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{tytul}</h3>
      {licznik !== undefined && (
        <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
          {licznik}
        </span>
      )}
      {akcje}
    </div>
  );
}

export function SekcjaTematu({
  id,
  tytul,
  licznik,
  czytana,
  zarejestruj,
  akcje,
  children,
}: {
  id: string;
  tytul: string;
  licznik: number;
  czytana: boolean;
  zarejestruj: (id: string, el: HTMLElement | null) => void;
  akcje?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      data-topic-id={id}
      ref={(el) => zarejestruj(id, el)}
      // Margines celu przewijania liczony ze ZMIERZONEJ wysokości paska (`--news-pasek-h`), nie
      // z wpisanej liczby: skórki Omnii zmieniają gęstość i typografię, więc stała byłaby prawdziwa
      // dla jednej skórki i fałszywa dla ośmiu pozostałych.
      style={{ scrollMarginTop: "calc(var(--news-pasek-h, 0px) + 0.5rem)" }}
    >
      <NaglowekSekcji tytul={tytul} licznik={licznik} wyrozniony={czytana} akcje={akcje} />
      {children}
    </section>
  );
}
