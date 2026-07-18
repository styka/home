# Weryfikacja: Zakupy offline z synchronizacją

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-18
- **Metoda:** bramki techniczne (lokalny Postgres) + trace ścieżek w kodzie (file:line). Ostateczne
  potwierdzenie zachowania offline robi się ręcznie na środowisku testowym (`develop`) — DevTools
  „Offline" lub PWA na telefonie; tu weryfikujemy logikę i kompilację.

## 1. Bramki techniczne
| Komenda | Wynik |
|--------|-------|
| `npm run check:migrations` | ✅ OK (brak nowej migracji; następny wolny numer 0206) |
| `npm run check:actions` | ✅ OK (95 akcji, wszystkie mają egzekutor — brak nowej AIAction, C-23 n/d) |
| `npx next lint --dir src` | ✅ 0 błędów (tylko istniejące kosmetyczne warningi; **żadnego** w nowych/edytowanych plikach) |
| `npx next build` (lokalny Postgres, C-13) | ✅ Compiled successfully + type-check + 128/128 stron |

## 2. Kryteria akceptacji
| AC | Werdykt | Dowód (trace w kodzie) |
|----|---------|------------------------|
| **AC-1** offline odczyt aktywnej listy | ✅ | `sw.js:55` cache-first dla `/_next/static/*` (app bootuje offline) + `sw.js` network-first z fallbackiem na cache dla stron; `ShoppingPage.tsx:85-95` offline effect ładuje pozycje z `getSnapshot()`; `offlineStore.ts` `getListSnapshot`. |
| **AC-2** offline zmiana statusu | ✅ | `ItemRow.tsx:59,64` `cycleStatus`/`markMissing` → `mutSetStatus(item.listId,…)`; `offlineMutations.ts` offline → `enqueue` + `applyOpToSnapshot` (status ustawiany optymistycznie); `localStatus` daje natychmiastowy UI. Brak wywołania sieci offline (gałąź `!isOnline()`). |
| **AC-3** offline add/edit/delete + „oczekujące" | ✅ | add: `QuickAddBar.tsx` → `mutAdd` (offline generuje `itemId` = `crypto.randomUUID()`); edit: `ItemRow.tsx:80` → `mutUpdate`; delete: `ItemRow.tsx:68` → `mutRemove`. Każda offline: `enqueue` → licznik `pendingCount()` → `OfflineIndicator` „X zmian czeka". |
| **AC-4** auto-sync po powrocie sieci | ✅ | `OfflineSyncManager.tsx:66-69` effect na `[online]` → `flush()`; `flush` (l.40-63) woła `syncShoppingMutations(getQueue())`, `removeOps(applied+skipped)`, `router.refresh()`. Bez akcji użytkownika. `visibilitychange` (l.72-78) jako drugi wyzwalacz. |
| **AC-5** stan serwera zgodny po sync | ✅ | `shoppingSync.ts` aplikuje operacje przez `prisma.item.create/update/delete` + `revalidatePath`; po flush `warmUp()` (`getActiveListsForOffline` → `saveSnapshot`) odświeża lokalną kopię ze stanu serwera. |
| **AC-6** LWW przy konflikcie | ✅ | `shoppingSync.ts:115` `item.updatedAt.getTime() > op.ts` → serwer wygrywa. Kluczowe: LWW liczone **tylko przy pierwszym dotknięciu** (mapa `resolved`, l.37,100,115-116,146), więc własne kolejne zmiany offline (np. NEEDED→IN_CART→DONE, add→edit) nie „konfliktują same ze sobą". Kolejka nie wisi — konflikt → `skipped`. |
| **AC-7** wskaźnik offline + licznik | ✅ | `OfflineIndicator.tsx` fixed pill: „Offline — pracujesz lokalnie" / „X zmian czeka" / „Synchronizuję…"; zmienne CSS (C-30), PL (C-32), `env(safe-area-inset-bottom)` (C-31). Znika po sync (`visible = !online || syncing || pending>0`). |
| **AC-8** wszystkie aktywne listy offline | ✅ | Warm-up: `OfflineSyncManager` `warmUp()` (online) → `getActiveListsForOffline()` (`lists.ts`) → `saveSnapshot` wszystkich aktywnych list user+team. Offline przełącznik: `ShoppingPage.tsx:102` `switcherLists = snapshotLists`, `<select>` offline → `setActiveListId` (l. onChange), efekt `[online,activeListId]` renderuje wybraną listę ze snapshotu bez nawigacji sieciowej. |
| **AC-9** op na skasowanej pozycji/liście pomijana | ✅ | `shoppingSync.ts`: brak dostępu/listy → `skipped` bez rzucania (l.44-56); pozycja nieistniejąca/obca → `skipped` (delete → `applied` bo cel osiągnięty) (l.106-112); `try/catch` wokół każdej operacji (l.152) — jedna zła op nie blokuje reszty. |
| **AC-10** brak regresji online | ✅ | `offlineMutations.ts`: gałąź `isOnline()` woła **istniejące** akcje `updateItemStatus/addItemStructured/updateItem/deleteItem` — bez zmian. `items.ts` nietknięty. Operacje na listach („Zakończ zakupy"/archiwizacja/`clearDoneItems`) niezmienione, offline tylko `disabled`. `next build` potwierdza brak zmian kontraktów. |

**Uwaga do AC-8 (ograniczenie, nie brak):** offline dostęp do „każdej" aktywnej listy działa przez
przełącznik na **załadowanej** stronie Zakupów (SW serwuje cache ostatnio odwiedzonej trasy) — snapshot
ma dane wszystkich list, więc przełączanie jest w pełni offline. Skrajny przypadek „użytkownik nigdy nie
otworzył żadnej listy online, tylko `/shopping`, i wszedł offline" nie da otworzyć trasy listy (RSC nie
w cache) — realnie poza scenariuszem ze speca; nie blokuje AC-8, którego istotą jest „lista dostępna,
choć jej nie otwierałeś w tej sesji offline".

## 3. Zgodność z konstytucją
- **C-01/C-02** ✅ całość w `worldofmag/`, importy `@/*`.
- **C-10..C-13** ✅ brak zmian schematu → brak migracji (LWW na `Item.updatedAt`, id z klienta);
  weryfikacja na lokalnym Postgresie, nie prod.
- **C-12** ✅ statusy/rodzaje jako `String`+union (`ItemStatus`, `OfflineOpType`) — zero enumów.
- **C-20** ✅ zapisy na serwer przez Server Actions z `revalidatePath` (`shoppingSync`, `items`).
- **C-21** ✅ dostęp przez `assertListAccess` w `syncShoppingMutations` i `getActiveListsForOffline`
  (wzorzec `OR:[{ownerId},{ownerTeamId:{in}}]`).
- **C-22** ✅ RBAC bez zmian (istniejący `module.shopping`); **C-23** n/d (brak AIAction);
  **C-24** ✅ pozycje Zakupów i dziś bez soft-delete — offline delete spójne z `deleteItem`;
  **C-25** n/d (brak zmian RBAC/config).
- **C-30/C-31/C-32** ✅ wskaźnik na zmiennych CSS, safe-area, teksty PL.
- **C-50** ✅ build zielony do `next build`. **C-51** ✅ wpis w `doświadczenia.md` (2026-07-18).
- **C-53** ✅ zero nowych zależności (localStorage), online path nietknięty, jedna batchowa akcja sync.

## 4. Regresje
- **Online Zakupy** — bez zmian zachowania: mutacje idą przez te same akcje (`offlineMutations` gałąź
  online), `ShoppingPage` online bierze pozycje z propsów serwera (efekt `[online,list]`), DnD/reorder,
  sort po sklepie, „Zakończ zakupy", archiwizacja — nietknięte. ✅
- **Service worker** — `bump CACHE→v3` czyści stare cache na `activate`; RSC i `/api/` nadal pomijane
  (mutacje/nawigacja online bez zmian); nowy cache-first tylko dla immutable `/_next/static`. ✅
- **Inne moduły** — zmiany izolowane w `shopping/` + nowy `src/lib/shopping/`, `hooks/useOnlineStatus`,
  `actions/shoppingSync`; `lists.ts` tylko dopisana funkcja (istniejące nietknięte). `next build`
  całości przechodzi (128 stron). ✅

## 5. Werdykt końcowy
**GOTOWE Z UWAGAMI** — wszystkie AC (AC-1…AC-10) spełnione w trace kodu, wszystkie bramki zielone.
Uwaga (nieblokująca): skrajny przypadek AC-8 (offline bez otwarcia żadnej trasy listy) ograniczony
architekturą PWA/RSC — poza scenariuszem ze speca. Rekomendacja: potwierdzić zachowanie offline ręcznie
na `develop` (DevTools „Offline" / PWA na iPhone) — to jedyny sposób realnego sprawdzenia SW + storage.
