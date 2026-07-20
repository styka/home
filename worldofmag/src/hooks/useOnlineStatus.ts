"use client";

import { useSyncExternalStore } from "react";

// Współdzielona detekcja stanu sieci (feature 009-shopping-offline-sync).
// Jeden zestaw nasłuchów `online`/`offline` na całą stronę (subskrypcja przez
// useSyncExternalStore), więc wiele wywołań hooka (np. w każdym wierszu listy)
// nie mnoży listenerów. SSR-safe: na serwerze zwraca `true` (zakładamy online),
// żeby pierwszy render zgadzał się z hydracją.

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/** Zwraca `true`, gdy przeglądarka raportuje połączenie z siecią. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
