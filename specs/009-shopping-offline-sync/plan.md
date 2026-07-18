# Plan techniczny: Zakupy offline z synchronizacją

- **Spec:** ./spec.md (009-shopping-offline-sync)
- **Status:** draft
- **Data:** 2026-07-17

> **Zasada planu:** to jest **JAK**. Pod istniejący kod Zakupów (server components `force-dynamic` +
> Server Actions + client `ShoppingPage`/`ItemRow`) i istniejący PWA/service worker.

## 1. Podejście (2–4 zdania)
Dokładamy **cienką warstwę offline po stronie klienta** dla modułu Zakupy: lokalną kopię aktywnych list
(localStorage) + **kolejkę operacji na pozycjach** odtwarzaną po powrocie sieci. Online zostaje **bez
zmian** (istniejące Server Actions + `revalidatePath`); offline mutacje pozycji idą optymistycznie do
lokalnej kopii i do kolejki. Synchronizację wykonuje **jedna, tolerancyjna Server Action** przyjmująca
całą kolejkę i aplikująca ją z regułą „ostatni zapis wygrywa". Service worker rozszerzamy tak, by
aplikacja w ogóle **bootowała offline** (dziś nie cache'uje `/_next/`, więc offline nie wstałaby).
Wzorce naśladujemy z istniejącego kodu Zakupów oraz z konwencji `localStorage` używanej w repo
(np. `ShoppingPage` sort, `DailyBriefingCard` cache).

## 2. Model danych (Prisma)
**Bez zmian w schemacie — brak migracji.**
- Reguła „ostatni zapis wygrywa" opiera się na istniejącym `Item.updatedAt` (`@updatedAt`): przy
  synchronizacji porównujemy znacznik czasu operacji offline z aktualnym `updatedAt` pozycji na serwerze.
- Pozycje **tworzone offline** dostają **id generowane po stronie klienta** (`crypto.randomUUID()`),
  zapisane wprost do `Item.id` (kolumna `String`; klucz jest dowolnym unikalnym stringiem). Dzięki temu
  kolejne operacje offline na tej pozycji (status/edycja/usunięcie) odwołują się już do finalnego id —
  **zero remapowania temp-id** po synchronizacji.
- Statusy pozycji pozostają unią TS `ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING"` (C-12, bez
  enumów). Typ operacji offline to również `String`+union po stronie TS (patrz §3), nietrzymany w DB.

## 3. Warstwa serwera (Server Actions — C-20)
Nowy plik: **`src/actions/shoppingSync.ts`**
- Typy współdzielone (TS, w `src/types` lub w pliku akcji):
  ```ts
  type OfflineOpType = "status" | "add" | "update" | "delete";
  interface OfflineOp {
    opId: string;        // uuid operacji (idempotencja / usuwanie z kolejki)
    ts: number;          // czas wykonania offline (ms) — do reguły LWW
    type: OfflineOpType;
    listId: string;
    itemId: string;      // finalne id (dla add: client-generated)
    payload?: { name?; quantity?; unit?; notes?; price?; status?; category? };
  }
  interface SyncResult { applied: string[]; skipped: string[]; } // opId-e
  ```
- Funkcja **`syncShoppingMutations(ops: OfflineOp[]): Promise<SyncResult>`**:
  1. `requireAuth()`; operacje sortujemy po `ts` rosnąco.
  2. Dla każdej operacji: `assertListAccess(op.listId, user.id)` (C-21). Brak dostępu / lista skasowana
     → **pomiń** (dodaj do `skipped`), nie rzucaj — kolejka nie może się zablokować (AC-9).
  3. **LWW:** wczytaj `Item.updatedAt`. Jeśli pozycja istnieje i `item.updatedAt.getTime() > op.ts`
     → serwer nowszy → **pomiń** (AC-6). W przeciwnym razie zastosuj:
     - `status` → `prisma.item.update({ where:{id}, data:{ status } })`.
     - `add` → `prisma.item.create({ data:{ id: op.itemId, listId, name, quantity, unit, category, ... } })`;
       jeśli id już istnieje (podwójna sync) → potraktuj jak `update`/skip (idempotencja). Kategorię
       liczymy `categorize(name)` gdy brak (reużycie `@/lib/categorize`); aktualizacja `ItemHistory`/
       `upsertUserProduct` jak w `addItemStructured` (reużycie logiki).
     - `update` → `prisma.item.update` z przekazanymi polami (jak `updateItem`).
     - `delete` → `prisma.item.delete` (pozycja nieistniejąca → skip). Zachowanie spójne z obecnym
       `deleteItem` (moduł Zakupy dziś nie robi soft-delete pozycji — nie wprowadzamy nowej ścieżki
       trash, C-24 „tam gdzie moduł wspiera").
  4. Na końcu **`revalidatePath("/shopping")`** i `revalidatePath` dla dotkniętych `/shopping/{listId}`.
  5. `void trackActivity("shopping", "offline_sync", { count })` (spójnie z innymi akcjami).
- Nowa funkcja **`getActiveListsForOffline()`** (w `src/actions/lists.ts` — obok `getLists`):
  zwraca wszystkie **aktywne** listy użytkownika (user + team, wzorzec `OR:[{ownerId},{ownerTeamId:{in}}]`)
  **wraz z pozycjami** (te same `include/orderBy` co strona listy). Służy do zbudowania offline-snapshotu
  wszystkich list (AC-8). Read-only (bez `revalidatePath`).

**Istniejące akcje pozycji (`src/actions/items.ts`) — bez zmian** (online path zostaje).

## 4. RBAC / rejestr modułu (C-22)
- **Bez zmian.** Używamy istniejącego slug `module.shopping`. Brak wpisów w `permissions.ts` /
  `modules.tsx` / `ModuleSidebar`. Dostęp offline dotyczy wyłącznie danych, które użytkownik już widzi;
  synchronizacja egzekwuje `assertListAccess` po stronie serwera.

## 5. UI (C-30, C-31, C-32) — warstwa kliencka offline
Nowy katalog logiki: **`src/lib/shopping/`** + komponenty w **`src/components/shopping/`**.

1. **`src/lib/shopping/offlineStore.ts`** — localStorage (zero zależności; wzorzec try/catch jak w repo):
   - snapshot: `wom_shopping_offline_lists` → `{ savedAt, lists: ListWithItems[] }`.
   - kolejka: `wom_shopping_offline_queue` → `OfflineOp[]`.
   - API: `saveSnapshot(lists)`, `getSnapshot()`, `getListSnapshot(listId)`, `enqueue(op)`,
     `getQueue()`, `removeOps(opIds)`, `applyOpToSnapshot(op)` (optymistyczna mutacja lokalnej kopii),
     `pendingCount()`. Emituje `window` event `wom:shopping-offline-changed` po każdej zmianie, żeby UI
     (wskaźnik + widok listy) reagowało.
2. **`src/hooks/useOnlineStatus.ts`** — `navigator.onLine` + nasłuch `online`/`offline`; SSR-safe
   (domyślnie „online" na serwerze). Współdzielony, mały.
3. **`src/lib/shopping/offlineMutations.ts`** (lub hook `useItemMutations(listId)`): **jedno API** dla
   komponentów: `setStatus(item, status)`, `add(...)`, `update(id, patch)`, `remove(id)`.
   - **online** → wołanie istniejącej Server Action (`updateItemStatus`/`addItemStructured`/`updateItem`/
     `deleteItem`) — dziś działa, brak regresji (AC-10).
   - **offline** → `applyOpToSnapshot` (optymistycznie) + `enqueue(op)` (z `crypto.randomUUID()` opId oraz,
     dla `add`, wygenerowanym `itemId`).
4. **Refaktor `ShoppingPage.tsx`**: źródłem `items` staje się stan kliencki:
   - online: inicjalizacja z propsów serwera; `useEffect` synchronizuje z `list.items` po revalidate.
   - offline: inicjalizacja/override z `getListSnapshot(listId)` (bo SW mógł podać nieświeży HTML);
     nasłuch `wom:shopping-offline-changed` odświeża widok. `ItemRow`/`QuickAddBar` wołają nowe
     `useItemMutations` zamiast bezpośrednio Server Actions. Zachowujemy `localStatus` optymizm.
   - operacje na **liście** (Wyczyść, „Zakończ zakupy", przełącznik list) są **wyłączane/oznaczane**
     offline (online-only, per spec) — disabled + tooltip „Niedostępne offline".
5. **`src/components/shopping/OfflineIndicator.tsx`** — pasek/badge: „Offline — pracujesz lokalnie" +
   „X zmian czeka na wysłanie" (gdy `pendingCount>0`); po powrocie sieci „Synchronizuję…", potem znika.
   Kolory z `var(--accent-amber)`/`var(--bg-surface)` itd. (C-30), teksty PL (C-32), mobile-first (C-31).
6. **`src/components/shopping/OfflineSyncManager.tsx`** — client, montowany w `src/app/shopping/layout.tsx`
   (obok `CommandPaletteProvider`): na `online` (i przy montażu, gdy online, oraz po `visibilitychange`)
   **flushuje kolejkę** → `syncShoppingMutations(getQueue())`, po sukcesie `removeOps(applied+skipped)` i
   odświeża snapshot (`getActiveListsForOffline()`); prostym backoffem chroni przed pętlą. Renderuje
   `OfflineIndicator`. Warm-up snapshotu wszystkich aktywnych list (AC-8) też tutaj: gdy online, w tle
   `getActiveListsForOffline()` → `saveSnapshot`.

## 6. AI / integracje (C-23, C-40)
- **Nie dotyczy.** Brak nowej `AIAction`, brak read-toola, brak zmian w `agentTools.ts` / `execute`
  (asystent działa online). `check:actions` nie jest ruszany. Kalendarz/powiadomienia/auto-expense —
  bez zmian (auto-expense pozostaje w online-only „Zakończ zakupy").

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/public/sw.js` | edycja | Cache `/_next/static/*` (cache-first) + `/shopping`,`/shopping/[id]` (network-first z fallbackiem), bump `CACHE` do `worldofmag-v3`, dodać `/shopping` do SHELL. Bez tego app nie wstanie offline. |
| `worldofmag/src/actions/shoppingSync.ts` | nowy | `syncShoppingMutations(ops)` — tolerancyjna, LWW, `revalidatePath`. |
| `worldofmag/src/actions/lists.ts` | edycja | `getActiveListsForOffline()` — listy aktywne + pozycje do snapshotu. |
| `worldofmag/src/lib/shopping/offlineStore.ts` | nowy | localStorage snapshot + kolejka + event. |
| `worldofmag/src/lib/shopping/offlineMutations.ts` | nowy | wspólne API mutacji (online→action / offline→queue). |
| `worldofmag/src/hooks/useOnlineStatus.ts` | nowy | detekcja online/offline. |
| `worldofmag/src/components/shopping/OfflineIndicator.tsx` | nowy | wskaźnik offline + licznik oczekujących. |
| `worldofmag/src/components/shopping/OfflineSyncManager.tsx` | nowy | flush kolejki na `online` + warm-up snapshotu; montuje indicator. |
| `worldofmag/src/app/shopping/layout.tsx` | edycja | montaż `OfflineSyncManager`. |
| `worldofmag/src/components/shopping/ShoppingPage.tsx` | edycja | stan kliencki items + offline render + użycie `useItemMutations`; wyłączenie akcji listowych offline. |
| `worldofmag/src/components/shopping/ItemRow.tsx` | edycja | mutacje przez wspólne API (online/offline). |
| `worldofmag/src/components/shopping/QuickAddBar.tsx` | edycja | dodawanie przez wspólne API (offline enqueue). |
| `worldofmag/src/types` (index) | edycja | eksport typów `OfflineOp`/`OfflineOpType`/`SyncResult` (jeśli współdzielone). |
| `doświadczenia.md` | edycja | wpis z lekcją (C-51), przy okazji dowolnej napotkanej pułapki (np. SW `/_next/`). |

## 8. Bramki i weryfikacja (C-50)
- Lokalnie: lokalny Postgres + `npx prisma migrate deploy` (choć **migracji brak**), `.env.local`
  (C-13 — nigdy prod DB). Weryfikacja do kroku `next build` (bez `migrate.js`).
- `npm run check:migrations` (brak nowej migracji → OK), `npm run check:actions` (brak nowej AIAction →
  OK), `next lint`, `next build`.
- Ręczny test offline (DevTools → Network „Offline", lub realny telefon PWA):
  - AC-1: offline otwarcie aktywnej listy → widoczne pozycje ze snapshotu.
  - AC-2: offline cykl statusu → natychmiast w UI, brak błędu sieci.
  - AC-3: offline add/edit/delete → widoczne + oznaczone „oczekujące".
  - AC-4/AC-5: powrót sieci → auto-flush → po odświeżeniu serwer zgodny.
  - AC-6: równoległa zmiana serwera (nowszy `updatedAt`) → serwer wygrywa, kolejka nie wisi.
  - AC-7: wskaźnik offline + licznik; znika po sync.
  - AC-8: offline bez wcześniejszego otwarcia listy → dostęp do wszystkich aktywnych (warm-up snapshot).
  - AC-9: op na skasowanej pozycji/liście → pominięta, reszta idzie.
  - AC-10: online bez regresji (dodawanie/statusy/„Zakończ zakupy"/archiwizacja).

## 9. Ryzyka techniczne i plan wycofania
- **App nie wstaje offline, bo SW nie cache'uje `/_next/`** → naprawiamy w `sw.js` (cache-first dla
  hashowanych statyków). Ryzyko cache stale JS → cache-first jest bezpieczny, bo pliki są immutable/hashed;
  bump wersji cache czyści stare.
- **Skew zegara klient/serwer w LWW** → akceptowalne dla prywatnego systemu; udokumentujemy. Ewentualnie
  porównanie względne (snapshot `baseUpdatedAt`) jako ulepszenie poza MVP.
- **localStorage limit ~5MB** → listy to sam tekst, z zapasem wystarcza; snapshot trzymamy tylko dla list
  aktywnych.
- **iOS PWA kaprysy (Szymon = iPhone)** → opieramy się na `navigator.onLine` + `online/offline` events
  (wspierane) i localStorage; degradacja łagodna: brak wsparcia → zachowanie jak dziś (online-only).
- **Rollback:** czysto **kod** (brak migracji) — rewert commita/branczu przywraca stan online-only;
  odrejestrowanie SW nie jest wymagane (bump wersji + network-first). Por. runbook devops.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **brak zmian schematu**, świadomie uzasadnione (Item.updatedAt + client id).
- [x] C-20..C-25 — mutacje przez Server Actions z `revalidatePath`; dostęp przez `assertListAccess`
      (C-21); RBAC bez zmian (C-22); brak nowej AIAction (C-23); pozycje bez soft-delete jak dziś (C-24);
      brak zmian RBAC/config → brak wpisów AuditLog (C-25).
- [x] C-30..C-32 — wskaźnik/UX na zmiennych CSS, mobile-first, teksty PL.
- [x] C-53 (minimalizm) — brak nowych zależności (localStorage zamiast idb; brak frameworka sync),
      online path nietknięty, jedna batchowa akcja sync zamiast rozsypanych ścieżek.
