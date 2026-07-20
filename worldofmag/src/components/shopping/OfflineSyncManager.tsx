"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getActiveListsForOffline } from "@/actions/lists";
import { syncShoppingMutations } from "@/actions/shoppingSync";
import { getQueue, removeOps, saveSnapshot, pendingCount, onOfflineChanged } from "@/lib/shopping/offlineStore";
import { OfflineIndicator } from "./OfflineIndicator";

// 009-shopping-offline-sync — steruje trybem offline Zakupów:
//  • warm-up: gdy online, zapisuje lokalną kopię WSZYSTKICH aktywnych list (AC-8),
//  • flush: gdy wraca sieć / karta staje się widoczna, wysyła kolejkę (AC-4),
//  • renderuje wskaźnik offline + licznik oczekujących (AC-7).
// Montowany raz, w layoucie Zakupów.

export function OfflineSyncManager() {
  const online = useOnlineStatus();
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const busyRef = useRef(false);

  // Odśwież licznik oczekujących przy każdej zmianie snapshotu/kolejki.
  useEffect(() => {
    const update = () => setPending(pendingCount());
    update();
    return onOfflineChanged(update);
  }, []);

  const warmUp = useCallback(async () => {
    try {
      const lists = await getActiveListsForOffline();
      saveSnapshot(lists);
      // Prefetch DOKUMENTU HTML każdej aktywnej listy, żeby service worker go zbuforował.
      // Bez tego strona /shopping/[id] nie jest w cache (nawigacja SPA pobiera tylko RSC),
      // więc offline twarda nawigacja w listę nie miałaby czego zserwować.
      lists.forEach((l) => {
        void fetch(`/shopping/${l.id}`, { credentials: "same-origin" }).catch(() => {});
      });
    } catch {
      // brak sieci / błąd — zostaje poprzedni snapshot
    }
  }, []);

  const flush = useCallback(async () => {
    if (busyRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const queue = getQueue();
    if (queue.length === 0) {
      // Nic do wysłania — odśwież tylko lokalną kopię list.
      await warmUp();
      return;
    }
    busyRef.current = true;
    setSyncing(true);
    try {
      const result = await syncShoppingMutations(queue);
      removeOps([...result.applied, ...result.skipped]);
      // Serwer to źródło prawdy po synchronizacji: odśwież widok i lokalną kopię.
      router.refresh();
      await warmUp();
    } catch {
      // Sieć padła w trakcie — kolejka zostaje, spróbujemy ponownie przy następnym zdarzeniu online.
    } finally {
      setSyncing(false);
      busyRef.current = false;
      setPending(pendingCount());
    }
  }, [router, warmUp]);

  // Start: gdy online — warm-up + ewentualny flush kolejki z poprzedniej sesji.
  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  // Powrót karty na pierwszy plan (typowe po wyjściu ze sklepu) — spróbuj zsynchronizować.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void flush();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [flush]);

  return <OfflineIndicator online={online} pending={pending} syncing={syncing} />;
}
