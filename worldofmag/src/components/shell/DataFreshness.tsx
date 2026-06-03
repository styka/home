"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Globalny nasłuchiwacz świeżości danych.
//
// Mutacje używają Server Actions + revalidatePath(), co odświeża dane TYLKO dla klienta,
// który wykonał mutację. Inne urządzenia/karty nie wiedzą o zmianie, dopóki nie pobiorą
// komponentów serwerowych na nowo. router.refresh() robi dokładnie to (re-fetch RSC bez
// przeładowania strony i bez utraty stanu klienta / focusu w polach edycji).
//
// Odświeżamy przy każdym powrocie do aplikacji oraz cyklicznie gdy karta jest widoczna.
// To rozwiązuje też PWA wyciągnięty na ekran główny iPhone'a (Safari standalone), gdzie
// nie ma paska przeglądarki ani przycisku odświeżania — visibilitychange jest tam kluczowy.

const POLL_INTERVAL_MS = 45_000; // odświeżanie w tle, tylko gdy karta widoczna
const MIN_GAP_MS = 3_000; // ochrona przed podwójnym refresh (focus + visibilitychange naraz)

export function DataFreshness() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    function refresh() {
      const now = Date.now();
      if (now - lastRefresh.current < MIN_GAP_MS) return;
      lastRefresh.current = now;
      router.refresh();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh); // wznowienie z bfcache / restore w standalone

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
