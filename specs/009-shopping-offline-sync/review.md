# Recenzja: Zakupy offline z synchronizacją

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-18
- **Diff:** 13 plików, ~804 insercji (kod w `worldofmag/`), względem bazy `cf75038`.
- **Metoda:** fresh-eyes trace pełnego diffa + bramki (patrz verify.md, wszystkie zielone).

## Ustalenia (od najpoważniejszego)

### 1. [simplification] Martwy eksport `getListSnapshot` — **NAPRAWIONE w recenzji**
- `offlineStore.ts` eksportował `getListSnapshot`, ale `ShoppingPage` czyta przez `getSnapshot()` +
  `.find` (potrzebuje i pełnej listy do przełącznika, i bieżącej). Funkcja nieużywana.
- **Skutek:** martwy kod (C-53). **Poprawka:** usunięto funkcję; zsynchronizowano `plan.md`/`tasks.md`/
  `verify.md` (C-54). Build po zmianie zielony.

### 2. [correctness — minor, non-blocking] Migotanie przy powrocie sieci
- `ShoppingPage.tsx` efekt online (`[online, list]`) po przełączeniu offline→online robi
  `setItems(list.items)` z (chwilowo) nieświeżych propsów serwera — zanim `OfflineSyncManager.flush()`
  wyśle kolejkę i zrobi `router.refresh()`.
- **Scenariusz:** offline zaznaczasz 5 pozycji jako kupione → wracasz online → przez ułamek sekundy UI
  pokazuje stan sprzed zmian, po czym flush+refresh przywraca poprawny stan.
- **Ocena:** **dane nie giną** (zmiany są w kolejce i zostają wysłane); to wyłącznie krótkie migotanie,
  samonaprawiające się po ~sekundzie. Naprawa (wstrzymanie revert do czasu refresh) dodałaby stan i
  złożoność — świadomie **zostawione** zgodnie z minimalizmem (C-53). Odnotowane.

### 3. [convention — observation] Offline DnD-reorder pozycji
- `CategoryGroup` woła `reorderItems` (Server Action) przy przeciąganiu; offline żądanie się nie powiedzie
  (transition połyka błąd). Reorder pozycji jest **poza zakresem** offline (spec §5 wymienia status/add/
  edit/delete). **Ocena:** dopuszczalna degradacja; brak akcji.

### 4. [perf — observation] Warm-up snapshotu przy wejściu w Zakupy
- `OfflineSyncManager` przy montażu (online) woła `getActiveListsForOffline()` (wszystkie aktywne listy +
  pozycje). Layout Zakupów jest persystentny, więc to **jedno** zapytanie na sesję /shopping. **Ocena:**
  akceptowalne (dane to sam tekst, zakres ograniczony do list aktywnych). Brak akcji.

## Poprawność — sprawdzone bez zastrzeżeń
- **Dostęp (C-21):** `syncShoppingMutations` woła `assertListAccess` per lista (cache) i sprawdza
  `item.listId === op.listId` — brak eskalacji: obce id → create pada (unique) → skip; obca lista →
  `assertListAccess` odrzuca. ✅
- **LWW (AC-6):** reguła „pierwsze dotknięcie" (mapa `resolved`) poprawnie chroni własne kolejne zmiany
  przed samo-konfliktem; konflikt międzyklientowy (`updatedAt > ts`) → serwer wygrywa, op → `skipped`. ✅
- **Tolerancja kolejki (AC-9):** brak dostępu/listy/pozycji oraz każdy wyjątek → `skipped`, `try/catch`
  wokół operacji — jedna zła op nie blokuje reszty; `removeOps(applied+skipped)` czyści kolejkę. ✅
- **revalidatePath (C-20):** `syncShoppingMutations` rewaliduje `/shopping` + dotknięte `/shopping/{id}`;
  online path używa niezmienionych akcji z `items.ts`. ✅
- **Brak regresji online (AC-10):** `offlineMutations` w gałęzi `isOnline()` woła istniejące akcje; przy
  padzie sieci w trakcie żądania — fallback do kolejki tylko gdy `!navigator.onLine` (realny błąd
  rethrow). ✅
- **Bezpieczeństwo:** brak kluczy/logów wrażliwych, brak renderu HTML/markdown (brak XSS), wszystkie
  akcje za `requireAuth`. ✅

## Konwencje Omnia
- C-01/C-02 ✅ · C-12 (String+union, zero enumów) ✅ · C-20/C-21 ✅ · C-23 n/d ·
  C-30 (zmienne CSS, `--on-accent`, brak hardcode) ✅ · C-31 (safe-area, mobile) ✅ · C-32 (PL) ✅ ·
  C-51 (wpis w `doświadczenia.md`) ✅ · C-53 (zero nowych zależności, online path nietknięty) ✅.

## Werdykt
**APPROVE Z UWAGAMI** — brak defektów blokujących. Jedna drobna poprawka naniesiona w recenzji (martwy
`getListSnapshot`). Uwagi 2–4 to świadome, nieblokujące kompromisy (migotanie na reconnect, offline
reorder poza zakresem, jednorazowy warm-up). Rekomendacja jak w verify: potwierdzić offline ręcznie na
`develop` (DevTools „Offline" / PWA na iPhone).
