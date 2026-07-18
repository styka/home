# Zadania: Zakupy offline z synchronizacją

- **Plan:** ./plan.md (009-shopping-offline-sync)
- **Status:** todo
- **Data:** 2026-07-17

> Kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami. **Brak migracji** (plan §2:
> schemat bez zmian). Fazy: warstwa serwera → biblioteka offline (klient) → UI/integracja → bramki.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- [x] **T-1** — **Brak migracji / brak zmian schematu** (plan §2). Potwierdzone: `Item.updatedAt`
  (`@updatedAt`) istnieje → LWW; `Item.id String @default(cuid())` → można podać id z klienta.
  Brak nowego katalogu migracji; `check:migrations` bez zmian.

## Faza 1 — Warstwa serwera (Server Actions — C-20)
- [x] **T-2** — Typy offline w TS: `src/lib/shopping/offlineTypes.ts` (`OfflineOpType`, `OfflineOp`,
  `OfflineOpPayload`, `SyncResult`, `OfflineSnapshot`) — zwykły moduł (nie „use server"), importowalny
  po obu stronach; `ItemStatus` reużyty (bez enumów, C-12).
- [x] **T-3** — `src/actions/lists.ts`: **`getActiveListsForOffline()`** — aktywne listy user+team z
  pozycjami (te same `include`/`orderBy` co strona listy). Pokrywa **AC-8**.
- [x] **T-4** — `src/actions/shoppingSync.ts` (nowy): **`syncShoppingMutations(ops)`** — sort po `ts`,
  per-op `assertListAccess` (C-21), **LWW** (`item.updatedAt.getTime() > op.ts` → skip; **AC-6**),
  obsługa `status`/`add`(z `id` z klienta, reużycie `categorize`+`ItemHistory`+`upsertUserProduct`)/
  `update`/`delete`, **tolerancja** (brak listy/pozycji/dostępu → `skipped`, bez rzucania; **AC-9**),
  `revalidatePath("/shopping")` + `/shopping/{listId}`, `trackActivity`. *Gotowe, gdy:* funkcja aplikuje
  kolejkę i zwraca `{applied,skipped}`; pokrywa **AC-4/AC-5/AC-6/AC-9**.

## Faza 2 — Biblioteka offline (klient)
- [x] **T-5** `[P]` — `src/hooks/useOnlineStatus.ts` — `useSyncExternalStore` na `online`/`offline`,
  SSR-safe (domyślnie online), współdzielony (bez mnożenia listenerów per wiersz).
- [x] **T-6** — `src/lib/shopping/offlineStore.ts` — localStorage snapshot + kolejka; API `saveSnapshot`,
  `getSnapshot`, `getListSnapshot`, `upsertListSnapshot`, `enqueue`, `getQueue`, `removeOps`,
  `applyOpToSnapshot`, `pendingCount`; event `wom:shopping-offline-changed` (`onOfflineChanged`).
- [x] **T-7** — `src/lib/shopping/offlineMutations.ts`: `mutSetStatus/mutAdd/mutUpdate/mutRemove`;
  **online** → akcje z `items.ts`, **offline** → `enqueue` (+ fallback gdy sieć padnie w trakcie).

## Faza 3 — UI i integracja
- [x] **T-8** — `src/components/shopping/OfflineIndicator.tsx` — fixed pill „Offline — pracujesz
  lokalnie" / „X zmian czeka" / „Synchronizuję…"; zmienne CSS (C-30), PL (C-32), safe-area (C-31).
  Pokrywa **AC-7**.
- [x] **T-9** — `src/components/shopping/OfflineSyncManager.tsx` — na `online` + montaż + `visibilitychange`:
  flush `syncShoppingMutations(getQueue())` → `removeOps` → `router.refresh()` → warm-up snapshotu przez
  `getActiveListsForOffline()`; guard `busyRef`. Pokrywa **AC-4/AC-8**.
- [x] **T-10** — `src/app/shopping/layout.tsx`: zamontowany `OfflineSyncManager` (persystentny layout).
- [x] **T-11** — `ShoppingPage.tsx`: stan kliencki `items` (online z propsów + `upsertListSnapshot`,
  offline z `getSnapshot`), `activeListId` do **offline'owego przełączania list** (AC-8), akcje listowe
  „Wyczyść"/„Zakończ zakupy" **disabled offline** + tooltip. Pokrywa **AC-1**, granica zakresu.
- [x] **T-12** — `ItemRow.tsx` (mutacje `mutSetStatus/mutUpdate/mutRemove` po `item.listId`, move online-only)
  + `QuickAddBar.tsx` (`mutAdd`, podpowiedzi w try/catch). Pokrywa **AC-2/AC-3**, chroni **AC-10**.
- [x] **T-13** — `public/sw.js`: `CACHE`→`worldofmag-v3`, cache-first dla `/_next/static/*` (kluczowe dla
  bootu offline), sieć-first z fallbackiem dla stron, pomijanie żądań RSC. Warunek dla **AC-1/AC-2/AC-3**.

## Faza 4 — Bramki i domknięcie
- [x] **T-14** — Bramki zielone na lokalnym Postgresie (C-13): `check:migrations` ✓ (brak nowej migracji,
  następny wolny 0206), `check:actions` ✓ (95 akcji, brak nowej AIAction), `next build` ✓ (kompilacja +
  type-check + 128 stron), `next lint` ✓ (tylko istniejące kosmetyczne warningi, żadnego w nowych plikach).
- [x] **T-15** — Mapowanie AC → weryfikacja (poniżej; input do `/verify`).
- [x] **T-16** — Wpis do `doświadczenia.md` (2026-07-18): SW nie cache'ował `/_next/static` → brak bootu
  offline; oraz LWW gubiące własne kolejne zmiany (naprawione regułą „pierwsze dotknięcie").

## Weryfikacja AC (T-15)
| AC | Jak sprawdzić (DevTools „Offline" lub PWA na telefonie) |
|----|--------------------------------------------------------|
| AC-1 | Online otwórz Zakupy → offline → otwórz aktywną listę: widać pozycje ze snapshotu, nie błąd. |
| AC-2 | Offline klik w checkbox statusu: zmiana natychmiast, bez błędu sieci. |
| AC-3 | Offline dodaj/edytuj/usuń pozycję: widoczne od razu + licznik „X zmian czeka". |
| AC-4 | Wróć online: kolejka flushuje się sama (bez klikania), wskaźnik znika. |
| AC-5 | Po sync odśwież (online): serwer pokazuje stan ustawiony offline. |
| AC-6 | Zmień pozycję offline i równolegle na serwerze (nowszy `updatedAt`): serwer wygrywa, kolejka nie wisi. |
| AC-7 | Offline: pill „Offline — pracujesz lokalnie" + licznik; „Synchronizuję…" przy flush. |
| AC-8 | Online na `/shopping` (warm-up) → offline → przełącznik list pokazuje **wszystkie aktywne** listy. |
| AC-9 | Offline zmień pozycję, skasuj ją na serwerze, wróć online: ta op pominięta, reszta kolejki idzie. |
| AC-10 | Online: dodawanie/statusy/„Zakończ zakupy"/archiwizacja bez regresji (stare akcje niezmienione). |

## Mapowanie AC → zadania
| AC | Zadania |
|----|---------|
| AC-1 offline odczyt listy | T-6, T-11, T-13 |
| AC-2 offline zmiana statusu | T-7, T-12 |
| AC-3 offline add/edit/delete | T-6, T-7, T-12 |
| AC-4 auto-sync po powrocie sieci | T-4, T-9 |
| AC-5 stan serwera zgodny po sync | T-4, T-9 |
| AC-6 LWW przy konflikcie | T-4 |
| AC-7 wskaźnik offline + licznik | T-6, T-8 |
| AC-8 wszystkie aktywne listy offline | T-3, T-9 |
| AC-9 op na skasowanej pozycji/liście pomijana | T-4 |
| AC-10 brak regresji online | T-7, T-11, T-12, T-14 |

## Ścieżka krytyczna / zależności
- **T-2 → T-4** (typy przed akcją sync). **T-3, T-4** blokują **T-9** (manager woła obie akcje).
- **T-6 → T-7 → T-12** (store → wspólne mutacje → komponenty). **T-6 → T-8** (licznik).
- **T-11, T-12** zależą od **T-7**; **T-10** zależy od **T-9**.
- **T-13** niezależny (SW), ale konieczny do realnego testu offline — robić przed **T-14**.
- Bramki **T-14** na końcu.

## Notatki / blokady
- Brak. Plan pokrywa wszystkie AC; żadne zadanie nie wymaga decyzji właściciela (C-55 nie uruchomiona).
