"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { opublikujSygnal } from "@/platform/events/sygnalKlienta";

// Globalny nasłuchiwacz świeżości danych.
//
// Mutacje używają Server Actions + revalidatePath(), co odświeża dane TYLKO dla klienta, który
// wykonał mutację. Inne urządzenia/karty nie wiedzą o zmianie, dopóki nie pobiorą komponentów
// serwerowych na nowo. router.refresh() robi dokładnie to (re-fetch RSC bez przeładowania strony
// i bez utraty stanu klienta / focusu w polach edycji).
//
// 072 (zadanie 24, rozdz. 11.1.4) — KONIEC ODPYTYWANIA CO 45 SEKUND.
//
// Było: `setInterval` co 45 s z każdej otwartej karty, niezależnie od tego, czy cokolwiek się
// zmieniło (diagnoza 5.2). Trzy karty = ~240 pełnych przeliczeń serwerowych na godzinę, z których
// prawie wszystkie zwracały to samo — a użytkownik i tak czekał średnio 22 sekundy na cudzą zmianę.
//
// Jest: strumień `/api/events` (jedno połączenie na kartę) wypycha sygnał, gdy w przestrzeni
// użytkownika naprawdę coś się wydarzyło.
//
// TRZY RZECZY ZOSTAJĄ CELOWO:
//  1. odświeżenie na `visibilitychange` / `focus` / `pageshow` — tanie, tylko przy powrocie,
//     i ratuje sytuację po zerwanym strumieniu. Kluczowe dla PWA na iPhonie (Safari standalone),
//     gdzie nie ma paska przeglądarki ani przycisku odświeżania;
//  2. **awaryjne odpytywanie co 5 minut — NA STAŁE, nie „dopóki SSE nie działa"**. Pokrywa trzy
//     sytuacje naraz: brak `EventSource`, zerwany strumień, oraz **wiele instancji serwera**
//     (szyna rozgłoszeniowa żyje w jednym procesie — patrz `platform/events/bus.ts`);
//  3. `MIN_GAP_MS` — ochrona przed podwójnym odświeżeniem, gdy sygnał zbiegnie się z powrotem
//     do karty.

const AWARYJNY_INTERWAL_MS = 300_000; // 5 minut (było 45 s) — siatka bezpieczeństwa, nie główny mechanizm
const MIN_GAP_MS = 3_000;
/** Po tylu nieudanych próbach zostajemy na odpytywaniu. `EventSource` sam wznawia w kółko. */
const MAKS_PROB = 5;

export function DataFreshness() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    let zamkniete = false;
    let zrodlo: EventSource | null = null;
    let wznowienie: ReturnType<typeof setTimeout> | null = null;
    let nieudane = 0;

    function refresh() {
      const now = Date.now();
      if (now - lastRefresh.current < MIN_GAP_MS) return;
      lastRefresh.current = now;
      // 085: nie rozgłaszamy już „dane odświeżono". Jedynym odbiorcą był wskaźnik świeżości
      // w pasku widoku, który tę chwilę przedstawiał jako świeżość DANYCH MODUŁU — a to jest
      // moment przeładowania CAŁEJ strony przez powłokę. Wskaźnik i magistrala zniknęły razem;
      // samo odświeżanie zostaje nietknięte.
      router.refresh();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }

    function polacz() {
      if (zamkniete || typeof EventSource === "undefined") return;
      try {
        zrodlo = new EventSource("/api/events");
      } catch {
        return; // brak wsparcia albo blokada — zostajemy na odpytywaniu awaryjnym
      }

      zrodlo.addEventListener("open", () => {
        nieudane = 0; // połączenie stanęło — licznik prób od zera
      });

      zrodlo.addEventListener("zmiana", (e) => {
        // 107: sygnał idzie DALEJ, do komponentów z własnym stanem (wątek rozmowy, licznik
        // nieprzeczytanych). `router.refresh()` przeładowuje dane serwerowe, ale nie dotyka
        // stanu klienta — a rozmowa jest zbudowana właśnie z niego (pozycja przewijania,
        // doczytane starsze wiadomości, treść w polu).
        try {
          const dane = JSON.parse((e as MessageEvent).data as string);
          opublikujSygnal(dane);
        } catch {
          // Sygnał bez ładunku albo uszkodzony — odświeżenie poniżej i tak jest właściwą reakcją.
        }
        refresh();
      });

      zrodlo.addEventListener("error", () => {
        zrodlo?.close();
        zrodlo = null;
        nieudane += 1;
        // Trwała awaria (brak trasy, 401, proxy tnące strumienie) nie może zamienić się w pętlę
        // ponowień. Po serii prób milkniemy — aplikacja działa dalej na odpytywaniu co 5 minut.
        if (zamkniete || nieudane >= MAKS_PROB) return;
        const odstep = Math.min(30_000, 1_000 * 2 ** nieudane); // narastająco: 2 s, 4 s, 8 s…
        wznowienie = setTimeout(polacz, odstep);
      });
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);

    const awaryjny = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, AWARYJNY_INTERWAL_MS);

    polacz();

    return () => {
      zamkniete = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      clearInterval(awaryjny);
      if (wznowienie) clearTimeout(wznowienie);
      zrodlo?.close();
    };
  }, [router]);

  return null;
}
